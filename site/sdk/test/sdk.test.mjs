import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {client,demoBytes,demoPaper,blankPdf} from './helpers.mjs';
import {createSubmission,formalizeSubmission,reviewSubmission,restoreSubmission,controlledParser,createModelFormalizer,
  validateIR,mergeIR,EMPTY_IR,BucketRepository,makeEntailmentProof,verifySubmissionProofs,checkProof,validateProof,
  createAnalysisRunner,checkedSolverReply,digest,sha256,encodeBase64,clone,createModelClaimSelector,extractClaims,exportSidecar} from '../node.mjs';

test('real PDF extraction has exact page/text anchors and deterministic source claim IDs',async()=>{
  const options={bytes:await demoBytes(),title:'SDK demo',authors:['Test author']};
  const first=await createSubmission(options,client),second=await createSubmission(options,client);
  assert.equal(first.document.sha256,await sha256(options.bytes));assert.equal(first.document.pageCount,1);
  assert.deepEqual(first.extraction.claims,second.extraction.claims);assert.equal(first.extraction.extractionStatus,'candidate_partial');
  for(const c of first.extraction.claims){const page=first.document.pages[c.locator.page-1];assert.equal(page.text.slice(c.locator.start,c.locator.end),c.locator.quote);assert.equal(c.locator.textHash,page.textHash);}
  assert(first.extraction.claims.some(c=>c.statement==='Tweety is a bird.'));
  const empty=await createSubmission({...options,bytes:blankPdf()},client);
  assert.equal(empty.document.extraction.status,'ocr_required');assert.equal(empty.extraction.claims.length,0);
  await assert.rejects(()=>createSubmission({...options,bytes:new Uint8Array([1,2,3])},client),/Expected PDF/);
});
test('controlled and model parsers produce proposals only; unsupported prose is retained',async()=>{
  const p=await demoPaper({review:false});assert.equal(p.proposal.ir.claims.length,4);assert(p.proposal.unsupported.length>0);assert.equal(p.review,null);
  await assert.rejects(()=>reviewSubmission(p,{actorId:'reviewer',sourceClaimIds:[p.proposal.unsupported[0].sourceClaimId]}),/mapped source/);
  const c=p.extraction.claims.find(c=>c.statement==='Tweety is a bird.'),parse=controlledParser();
  const model=createModelFormalizer({id:'test.model/1',completeJSON:async()=>({status:'draft',ir:await parse(c)})});
  const fragment=await model(c,EMPTY_IR);assert.equal(fragment.claims[0].source,c.statement);
  await assert.rejects(()=>createModelFormalizer({id:'test.model/1',completeJSON:async()=>({status:'checked',ir:fragment})})(c,EMPTY_IR),/typed draft/);
  const refusal=createModelFormalizer({id:'test.model/1',completeJSON:async()=>({status:'unsupported',reason:'Scope is ambiguous'})});
  await assert.rejects(()=>refusal(c,EMPTY_IR),/ambiguous/);
});
test('configured scientific extraction adapters select verifiable source spans, never invented quotes',async()=>{
  const p=await demoPaper({review:false});
  const select=createModelClaimSelector({completeJSON:async()=>({claims:[{page:1,quote:'Tweety is a bird.',kind:'model'}]})});
  const extraction=await extractClaims(p.document,{policy:'test.scientific-extractor/1',selectCandidates:select});
  assert.equal(extraction.claims.length,1);assert.equal(extraction.claims[0].statement,'Tweety is a bird.');assert.equal(extraction.extractionStatus,'candidate_partial');
  const hallucination=createModelClaimSelector({completeJSON:async()=>({claims:[{page:1,quote:'A sentence that the source does not contain.'}]})});
  await assert.rejects(()=>extractClaims(p.document,{policy:'test.model/1',selectCandidates:hallucination}),/absent or ambiguous/);
  await assert.rejects(()=>extractClaims(p.document,{selectCandidates:async()=>[{page:1,start:0,end:900000}]}),/in-page source spans/);
});
test('closed typed IR rejects solver injection, wrong types, missing names and hidden inactive claims',async()=>{
  const ir=await controlledParser()({id:'c_bird',statement:'Tweety is a bird.'});
  const numeric={sorts:[],preds:[],funcs:[],claims:[{id:'c_num',source:'Exact value',formula:{op:'eq',a:{t:'real',v:'1'},b:{t:'real',v:'1'}}}]};
  for(const mutate of [
    x=>{x.claims[0].formula.b.v='1) (assert false)';},x=>{x.claims[0].formula.b={t:'int',v:1};},
    x=>{x.claims[0].active=false;},x=>{x.claims[0].defeasible=true;},x=>{x.claims[0].extra='x';},
  ]){const x=clone(numeric);mutate(x);assert.throws(()=>validateIR(x));}
  const missing=clone(ir);missing.preds=[];assert.throws(()=>validateIR(missing),/Undeclared/);
  const revised=clone(ir);revised.claims[0].formula={op:'not',x:revised.claims[0].formula};assert.throws(()=>mergeIR(ir,revised),/Conflicting claims/);
  const glossed=clone(ir);glossed.preds[0].gloss='bird class';assert.doesNotThrow(()=>mergeIR(glossed,ir));
});
test('real WMT lattice restores all coherent buckets, conflicts, and global weighted repair',async()=>{
  const empty=await client.analyze(EMPTY_IR);assert.equal(empty.status,'consistent');assert.deepEqual(empty.positions,[{keep:[],drop:[]}]);assert.deepEqual(empty.renderedClaims,[]);
  const p=await demoPaper(),background=await controlledParser()({id:'c_background',statement:'All birds are fliers.'});
  background.claims[0].weight=20;const combined=mergeIR(background,p.review.ir),a=await client.analyze(combined);
  assert.equal(a.status,'inconsistent');assert.equal(a.complete,true);assert.equal(a.positions.length,4);assert.equal(a.conflicts.length,2);
  const sets=new Set(a.positions.map(p=>[...p.keep].sort().join(',')));assert.equal(sets.size,4);
  assert(!a.repair.drop.includes('c_background'));
  for(const position of a.positions){const check=await client.analyze({...combined,claims:combined.claims.filter(c=>position.keep.includes(c.id))});assert.equal(check.status,'consistent');}
});
test('personal conflicts do not mutate; RFC append creates one exact version and replay is idempotent',async()=>{
  const p=await demoPaper(),repo=new BucketRepository(client),background=await controlledParser()({id:'c_background',statement:'All birds are fliers.'});
  const personal=await repo.create({id:'personal',name:'Personal',owner:'person:test',ir:background});
  const opts={expectedVersion:1,expectedDigest:personal.digest,actorId:personal.owner,submission:p,idempotencyKey:'one'};
  const conflict=await repo.submit('personal',opts);assert.equal(conflict.receipt.outcome,'conflict');assert.equal(repo.get('personal').digest,personal.digest);
  const fork=await repo.fork('personal',{receiptId:conflict.receipt.id,keepIds:conflict.receipt.analysis.positions[0].keep,newId:'fork',name:'Alternative',actorId:personal.owner,expectedVersion:1,expectedDigest:personal.digest});
  assert.equal(fork.parent.digest,personal.digest);assert.equal(repo.get('personal').version,1);
  const rfc=await repo.create({id:'rfc',name:'RFC model',scope:'rfc',rfcRef:'RFC-0041@revision-a',owner:personal.owner});
  const request={...opts,expectedDigest:rfc.digest,idempotencyKey:'rfc-one'};
  const inserted=await repo.submit('rfc',request),again=await repo.submit('rfc',request);
  assert.equal(inserted.receipt.outcome,'inserted');assert.deepEqual(again,inserted);assert.equal(repo.get('rfc').version,2);assert.equal(repo.get('rfc',1).digest,rfc.digest);
  await assert.rejects(()=>repo.submit('rfc',{...request,idempotencyKey:'other'}),e=>e.code==='stale_version');
  await assert.rejects(()=>repo.submit('rfc',{...request,actorId:'someone-else',expectedVersion:2,expectedDigest:inserted.bucket.digest,idempotencyKey:'wrong-owner'}),e=>e.code==='owner_mismatch');
  await assert.rejects(()=>repo.submit('rfc',{...request,limits:{maxSteps:1}}),e=>e.code==='revision_conflict');
});
test('concurrent appends compare versions after solving; only one can commit',async()=>{
  const p=await demoPaper(),repo=new BucketRepository(client),b=await repo.create({id:'race',name:'Race',owner:'person:test'});
  const opts={expectedVersion:1,expectedDigest:b.digest,actorId:b.owner,submission:p};
  const results=await Promise.allSettled([repo.submit('race',{...opts,idempotencyKey:'a'}),repo.submit('race',{...opts,idempotencyKey:'b'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected' && r.reason.code==='stale_version').length,1);assert.equal(repo.get('race').version,2);
});
test('proof checker establishes exact nonvacuous entailment; attachment or matching filename is insufficient',async()=>{
  let p=await demoPaper();const ids=p.review.ir.claims.map(c=>c.id);
  const proof=await makeEntailmentProof(p,{id:'proof:bird',targetClaimId:ids[3],premiseClaimIds:[ids[0],ids[2]]});p.proofs=[proof];
  p=await verifySubmissionProofs(p,client);assert.equal(p.proofReceipts[0].result.status,'checked');assert.equal(p.proofReceipts[0].result.inputDigest,p.review.irDigest);
  const wrong=clone(proof);wrong.binding.documentHash='0'.repeat(64);assert.equal((await checkProof(wrong,p,client)).result.status,'not_checked');
  const source=new TextEncoder().encode('theorem unrelated : True := True.intro\n'),lean={...clone(proof),id:'proof:lean',kind:'lean4',evidence:{declaration:'unrelated'},assets:[{fileName:'Main.lean',mediaType:'text/plain',base64:encodeBase64(source),sha256:await sha256(source)}]};
  assert.equal((await checkProof(lean,p,client)).result.status,'not_checked');lean.assets[0].sha256='0'.repeat(64);await assert.rejects(()=>validateProof(lean),/checksum mismatch/);
  const notEntailed=await client.entailment(p.review.ir,{targetClaimId:ids[0],premiseClaimIds:[ids[2]]});assert.equal(notEntailed.status,'failed');
  const identity={...p.review.ir,claims:[{id:'c_identity',source:'Tweety equals Tweety.',formula:{op:'eq',a:{t:'app',name:'tweety',args:[]},b:{t:'app',name:'tweety',args:[]}}}]};
  assert.equal((await client.entailment(identity,{targetClaimId:'c_identity',premiseClaimIds:[]})).status,'checked');
  const ownProof={...clone(proof),kind:'my-smt-kernel'};
  const own=await checkProof(ownProof,p,client,{verifiers:new Map([['my-smt-kernel',{id:'user.smt-wrapper',revision:'test-wrapper-v1',verify:async(artifact,ir)=>client.entailment(ir,artifact.evidence)}]])});
  assert.equal(own.result.status,'checked');assert.equal(own.checker.id,'user.smt-wrapper');assert.equal(own.checker.revision,'test-wrapper-v1');
  const contradictory=mergeIR(p.review.ir,await controlledParser()({id:'c_bad',statement:'Tweety is not a bird.'}));
  const vacuous=await client.entailment(contradictory,{targetClaimId:ids[1],premiseClaimIds:[ids[3],'c_bad']});assert.equal(vacuous.status,'failed');assert.match(vacuous.reason,/vacuous/);
});
test('timeouts, cancellation and enumeration limits are explicit stops and never append',async()=>{
  const p=await demoPaper(),repo=new BucketRepository(client),b=await repo.create({id:'bounded',name:'Bounded',owner:'person:test'});
  const result=await repo.submit('bounded',{expectedVersion:1,expectedDigest:b.digest,actorId:b.owner,submission:p,idempotencyKey:'timeout',limits:{wallTimeMs:1}});
  assert.equal(result.receipt.outcome,'stopped');assert.equal(result.receipt.analysis.stopReason,'timeout');assert.equal(repo.get('bounded').version,1);
  const abort=new AbortController();abort.abort();assert.equal((await client.analyze(p.review.ir,{signal:abort.signal})).stopReason,'cancelled');
  const fake=()=>({ingest:()=>'{"ok":true}',remove:()=>'{"claims":[]}',lattice_begin(){},lattice_next:()=>'',lattice_result:()=>'{"done":true,"capped":true}',free(){}});
  const runner=createAnalysisRunner({createEngine:fake,evaluate:async()=>'',runtime:{}});assert.equal((await runner.analyze(EMPTY_IR)).stopReason,'enumeration_cap');
  assert.throws(()=>checkedSolverReply('unknown'),/unknown/);assert.throws(()=>checkedSolverReply('(error "bad symbol")\nsat'),/valid status/);assert.throws(()=>checkedSolverReply('sat\n(error "bad symbol")'),/bad symbol/);
  const normal=await client.analyze(p.review.ir);assert.equal(normal.status,'consistent');
});
test('explicit restore rechecks bucket heads and PDF bytes; historical receipts cannot authorize a fork',async()=>{
  const p=await demoPaper(),repo=new BucketRepository(client),b=await repo.create({id:'restore',name:'Restore',owner:'person:test'});
  const checked=await repo.submit('restore',{submission:p,actorId:b.owner,expectedVersion:1,expectedDigest:b.digest,idempotencyKey:'first'});
  const unrelated=await repo.create({id:'private-unrelated',name:'Unrelated bucket',owner:'person:test'});
  const sidecar=exportSidecar(p,{bucketReceipts:repo.export().receipts,buckets:repo.export().versions});assert(!sidecar.buckets.some(b=>b.id===unrelated.id));
  const other=new BucketRepository(client);await other.restore(repo.export());assert.equal(other.get('restore').version,2);
  assert.throws(()=>other.receipt(checked.receipt.id),e=>e.code==='not_found');
  const fresh=await restoreSubmission(p,client);assert.equal(fresh.id,p.id);assert.equal(fresh.review,null);assert.equal(fresh.proofReceipts.length,0);
  const tampered=repo.export();tampered.versions[0].name='Changed';await assert.rejects(()=>new BucketRepository(client).restore(tampered),/digest mismatch/);
  const rollback=repo.export();rollback.heads=[{id:b.id,version:1,digest:b.digest}];await assert.rejects(()=>new BucketRepository(client).restore(rollback),/roll back/);
});
test('SDK runtime and browser PDF assets match their pinned build manifest',async()=>{
  const base=new URL('../',import.meta.url),m=JSON.parse(await readFile(new URL('runtime/manifest.json',base)));
  for(const [name,hash] of Object.entries(m.files))assert.equal(await sha256(await readFile(new URL('runtime/'+name,base))),hash);
  for(const [name,hash] of Object.entries(m.adaptersSha256))assert.equal(await sha256(await readFile(new URL(name,base))),hash);
  for(const [name,hash] of Object.entries(m.pdfjs.standardFontsSha256))assert.equal(await sha256(await readFile(new URL('../vendor/pdfjs/standard_fonts/'+name,base))),hash);
  for(const [file,key] of [['pdf.mjs','moduleSha256'],['pdf.worker.mjs','workerSha256']])assert.equal(await sha256(await readFile(new URL('../vendor/pdfjs/'+file,base))),m.pdfjs[key]);
  assert.equal(await sha256(await readFile(new URL('node_modules/z3-solver/build/z3-built.wasm',base))),await sha256(await readFile(new URL('../vendor/z3/z3-built.wasm',base))));
});
