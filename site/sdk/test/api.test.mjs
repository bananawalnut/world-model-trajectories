import test from 'node:test';
import assert from 'node:assert/strict';
import {createSidecarServer} from '../server.mjs';
import {encodeBase64,controlledParser,makeEntailmentProof} from '../index.mjs';
import {demoBytes,demoPaper} from './helpers.mjs';
async function serve(t,options={}) {
  const sidecar=createSidecarServer(options);await new Promise(resolve=>sidecar.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+sidecar.server.address().port;t.after(()=>sidecar.close());
  return async(path,input,extra={})=>{
    const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(input===undefined?{}:{'Content-Type':'application/json'}),...extra.headers},...(input===undefined?{}:{body:JSON.stringify(input)}),...extra});
    return {status:response.status,body:await response.json()};
  };
}
const payload=async proofs=>({title:'API paper',authors:['Test author'],pdf:{fileName:'demo.pdf',base64:encodeBase64(await demoBytes())},...(proofs?{proofs}:{})});
async function reviewed(call) {
  let r=await call('/v1/submissions',await payload());assert.equal(r.status,201);let p=r.body;
  r=await call(`/v1/submissions/${p.submission.id}/formalizations`,{expectedRevision:p.revision});assert.equal(r.status,200);p=r.body;
  r=await call(`/v1/submissions/${p.submission.id}/review`,{expectedRevision:p.revision,actorId:'person:test',sourceClaimIds:p.submission.proposal.mappings.map(m=>m.sourceClaimId)});assert.equal(r.status,200);return r.body;
}
test('HTTP API accepts a real paper, reviewed IR and bound computational proofs, then exports a complete sidecar',async t=>{
  const call=await serve(t),p=await reviewed(call),ids=p.submission.review.ir.claims.map(c=>c.id);
  const proof=await makeEntailmentProof(p.submission,{id:'proof:api',targetClaimId:ids[3],premiseClaimIds:[ids[0],ids[2]]});
  let r=await call(`/v1/submissions/${p.submission.id}/proofs`,{expectedRevision:p.revision,proofs:[proof]});assert.equal(r.status,200);
  let current=r.body;r=await call(`/v1/submissions/${p.submission.id}/proofs/check`,{expectedRevision:current.revision});assert.equal(r.status,200);current=r.body;
  assert.equal(current.submission.proofReceipts[0].result.status,'checked');
  r=await call('/v1/buckets',{id:'api:rfc',name:'RFC bucket',owner:'person:test',scope:'rfc',rfcRef:'RFC-0041@revision-a'});assert.equal(r.status,201);const b=r.body.bucket;
  const request={expectedVersion:1,expectedDigest:b.digest,actorId:b.owner,submissionId:p.submission.id,submissionRevision:current.revision,idempotencyKey:'first'};
  const accepted=await call('/v1/buckets/api%3Arfc/submissions',request);assert.equal(accepted.status,200);assert.equal(accepted.body.receipt.outcome,'inserted');assert.equal(accepted.body.bucket.version,2);
  assert.deepEqual(await call('/v1/buckets/api%3Arfc/submissions',request),accepted);
  const stale=await call('/v1/buckets/api%3Arfc/submissions',{...request,idempotencyKey:'new'});assert.equal(stale.status,409);
  const old=await call('/v1/buckets/api%3Arfc?version=1');assert.equal(old.body.bucket.digest,b.digest);
  const sidecar=await call(`/v1/submissions/${p.submission.id}/sidecar`);assert.equal(sidecar.status,200);assert.equal(sidecar.body.delivery,'local_not_published');
  assert.equal(sidecar.body.submission.source.base64,encodeBase64(await demoBytes()));assert.equal(sidecar.body.bucketReceipts.length,1);assert.equal(sidecar.body.buckets.length,2);
});
test('HTTP conflict leaves personal bucket unchanged and permits only an exact verified coherent fork',async t=>{
  const call=await serve(t),p=await reviewed(call),ir=await controlledParser()({id:'c_background',statement:'All birds are fliers.'});
  const created=await call('/v1/buckets',{id:'personal',name:'My assumptions',owner:'person:test',ir}),b=created.body.bucket;
  const r=await call('/v1/buckets/personal/submissions',{expectedVersion:1,expectedDigest:b.digest,actorId:b.owner,submissionId:p.submission.id,submissionRevision:p.revision,idempotencyKey:'conflict'});
  assert.equal(r.status,200);assert.equal(r.body.receipt.outcome,'conflict');assert.equal((await call('/v1/buckets/personal')).body.bucket.digest,b.digest);
  const fork={receiptId:r.body.receipt.id,keepIds:r.body.receipt.analysis.positions[0].keep,newId:'fork',name:'Alternative',actorId:b.owner,expectedVersion:1,expectedDigest:b.digest};
  const adopted=await call('/v1/buckets/personal/forks',fork);assert.equal(adopted.status,201);assert.equal(adopted.body.bucket.parent.digest,b.digest);
  const bad=await call('/v1/buckets/personal/forks',{...fork,newId:'bad',keepIds:r.body.receipt.inputIR.claims.map(c=>c.id)});assert.equal(bad.status,400);
});
test('API keeps review and revision gates, refuses claimed checker success, unknown fields and cross-origin calls',async t=>{
  const call=await serve(t);const paper=await call('/v1/submissions',await payload());
  const b=(await call('/v1/buckets',{id:'empty',name:'Empty',owner:'person:test'})).body.bucket;
  const unreviewed=await call('/v1/buckets/empty/submissions',{expectedVersion:1,expectedDigest:b.digest,actorId:b.owner,submissionId:paper.body.submission.id,submissionRevision:1,idempotencyKey:'unreviewed'});
  assert.equal(unreviewed.status,400);assert.equal(unreviewed.body.code,'review_required');
  const unknown=await call('/v1/submissions',{...await payload(),publish:true});assert.equal(unknown.status,400);
  const stale=await call(`/v1/submissions/${paper.body.submission.id}/formalizations`,{expectedRevision:99});assert.equal(stale.status,409);
  const fabricated=await demoPaper(),ids=fabricated.review.ir.claims.map(c=>c.id),proof=await makeEntailmentProof(fabricated,{id:'fake',targetClaimId:ids[3],premiseClaimIds:[ids[0],ids[2]]});proof.status='checked';
  const forged=await call(`/v1/submissions/${paper.body.submission.id}/proofs`,{expectedRevision:1,proofs:[proof]});assert.equal(forged.status,400);
  const foreign=await call('/v1/buckets',{id:'foreign',name:'Foreign',owner:'person:test'},{headers:{'Content-Type':'application/json',Origin:'https://external.example'}});assert.equal(foreign.status,403);
  assert.equal((await call('/v1/not-an-operation')).status,404);
  const caps=await call('/v1/capabilities');assert.equal(caps.body.releaseStatus,'experimental_unsigned');assert.equal(caps.body.publication,'unavailable');
  const openapi=await call('/v1/openapi.json');assert.equal(openapi.body.openapi,'3.1.0');assert(openapi.body.paths['/v1/buckets/{bucketId}/submissions']);
});
test('API enforces its streaming body budget',async t=>{
  const call=await serve(t,{maxBodyBytes:128});const result=await call('/v1/submissions',{title:'x'.repeat(500)});assert.equal(result.status,413);assert.equal(result.body.code,'resource_limit');
});
