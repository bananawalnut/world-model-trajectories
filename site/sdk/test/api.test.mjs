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
test('API checks automatic witnesses and returns revision-bound defaults receipts without mutating the paper',async t=>{
  const {makeWitnessProof}=await import('../index.mjs');
  const call=await serve(t),p=await reviewed(call),ids=p.submission.review.ir.claims.map(c=>c.id);
  const proof=await makeWitnessProof(p.submission,{id:'proof:auto',targetClaimId:ids[3],candidatePremiseIds:[ids[0],ids[2]]});
  let r=await call(`/v1/submissions/${p.submission.id}/proofs`,{expectedRevision:p.revision,proofs:[proof]});assert.equal(r.status,200);let current=r.body;
  r=await call(`/v1/submissions/${p.submission.id}/proofs/check`,{expectedRevision:current.revision});assert.equal(r.status,200);current=r.body;
  assert.equal(current.submission.proofReceipts[0].result.status,'checked');assert.equal(current.submission.proofReceipts[0].checker.id,'wmt.smt-explanation-witness/1');
  const request={expectedRevision:current.revision,request:{defaultClaimIds:[ids[0]],targetClaimId:ids[3]}};
  r=await call(`/v1/submissions/${p.submission.id}/reasoning/defaults`,request);assert.equal(r.status,200);assert.equal(r.body.revision,current.revision);assert.equal(r.body.receipt.binding.irDigest,current.submission.review.irDigest);assert.equal(r.body.receipt.result.status,'selected');
  const after=await call(`/v1/submissions/${p.submission.id}`);assert.deepEqual(after.body,current);
  const sidecar=await call(`/v1/submissions/${p.submission.id}/sidecar`);assert.equal(sidecar.body.submission.proofReceipts[0].result.minimality,'inclusion');
  const bad=await call(`/v1/submissions/${p.submission.id}/reasoning/defaults`,{...request,request:{...request.request,implicitDefaults:true}});assert.equal(bad.status,400);assert.equal(bad.body.code,'invalid_input');
  assert.equal((await call(`/v1/submissions/${p.submission.id}/reasoning/defaults`,{...request,expectedRevision:0})).status,409);
  const caps=(await call('/v1/capabilities')).body;assert(caps.proofCheckers.includes('smt-explanation-witness'));assert(caps.reasoningPolicies.includes('wmt.strict-specificity-greedy/1'));
  const spec=(await call('/v1/openapi.json')).body;const {default:Ajv}=await import('ajv/dist/2020.js');const ajv=new Ajv({strict:false});const validate=ajv.compile({...spec.components.schemas.AnalyzeDefaults,components:spec.components});assert(validate(request),JSON.stringify(validate.errors));assert(!validate({...request,request:{defaultClaimIds:[],wat:true}}));
});
test('API enumerates entity defaults, preserves alternate extensions, and independently checks bucket forks',async t=>{
 const {extensionIR,extensionRequest}=await import('../../papers/extensions-example.mjs');const call=await serve(t),base=(await call('/v1/buckets',{id:'extension-base',name:'Extension baseline',owner:'me'})).body.bucket;
 const body={expectedVersion:1,expectedDigest:base.digest,actorId:'me',candidateIR:extensionIR,request:extensionRequest};let r=await call('/v1/buckets/extension-base/default-extensions',body);assert.equal(r.status,200);const receipt=r.body.receipt;assert.equal(receipt.result.extensions.length,4);assert.equal(receipt.result.preferredExtensionIds.length,2);const e=receipt.result.extensions.find(e=>e.preferred);
 r=await call('/v1/buckets/extension-base/extension-forks',{receiptId:receipt.id,extensionId:e.id,newId:'extension-fork',name:'Checked extension',actorId:'me',expectedVersion:1,expectedDigest:base.digest});assert.equal(r.status,201);assert.equal(r.body.bucket.provenance.creationEvidence.status,'consistent');assert.equal((await call('/v1/buckets/extension-base')).body.bucket.digest,base.digest);
 const paper=await reviewed(call);r=await call('/v1/buckets/extension-base/default-extensions',{expectedVersion:1,expectedDigest:base.digest,actorId:'me',submissionId:paper.submission.id,submissionRevision:paper.revision,request:{defaultClaimIds:[],targetClaimId:paper.submission.review.ir.claims.at(-1).id}});assert.equal(r.status,200);assert.equal(r.body.receipt.sourceBinding.documentHash,paper.submission.document.sha256);
 const sidecar=(await call(`/v1/submissions/${paper.submission.id}/sidecar`)).body;assert.equal(sidecar.extensionReceipts.length,1);assert(sidecar.extensionReceipts.every(r=>r.sourceBinding.submissionId===paper.submission.id));
 const api=(await call('/v1/openapi.json')).body,{default:Ajv}=await import('ajv/dist/2020.js'),ajv=new Ajv({strict:false});const validate=ajv.compile({...api.components.schemas.BucketExtensions,components:api.components});assert(validate(body),JSON.stringify(validate.errors));assert(!validate({...body,submissionId:'both',submissionRevision:1}));
});
