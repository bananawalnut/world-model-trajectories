import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoPaper,client} from './helpers.mjs';
import {createKernelRequest,runPaperKernel,kernelObservationIR,prepareKernelObservation,reviewKernelObservation,submitKernelObservation,createKernelVerifier,KERNEL_PROOF_KIND,BucketRepository,clone,reviewSubmission,verifySubmissionProofs,exportSidecar,restoreSubmission,digest} from '../index.mjs';
const kernel={format:'wmt.kernel/1',id:'test:threshold',revision:'1',executorId:'test:host',language:'test-host',interface:'test/1',source:'threshold(inputs)',libraries:[]};
let paper;
const base=async()=>clone(paper??=await demoPaper());
const executors=(output=true)=>new Map([['test:host',{id:'test:host',revision:'host/1',async execute(request){assert.equal(request.inputs.minimum,80);return output;}}]]);
async function draftFor(p=undefined,output=true){
 p??=await base();const request=await createKernelRequest(p,{kernel,inputs:{minimum:80},claimIds:[p.review.ir.claims.at(-1).id]});
 const run=await runPaperKernel(p,request,{executors:executors(output)}),ir=await kernelObservationIR(request,run),sourceClaimId=p.proposal.mappings.find(m=>m.formalClaimIds.includes(request.claimIds[0])).sourceClaimId;
 const draft=await prepareKernelObservation(p,request,run,{ir,sourceClaimId});return reviewKernelObservation(draft,{actorId:'person:test'});
}
test('paper kernel execution, explicit observation review, fresh replay, SAT admission and sidecar bindings',async()=>{
 const draft=await draftFor();assert(draft.submission.review);assert.equal(draft.base.proofs.length,0);
 const repo=new BucketRepository(client),b=await repo.create({id:'bucket:kernel',name:'Kernel',owner:'person:test'});
 let runs=0;const installed=executors();installed.get('test:host').execute=async()=>{runs++;return true;};
 const result=await submitKernelObservation({draft,repository:repo,bucketId:b.id,expectedVersion:b.version,expectedDigest:b.digest,actorId:b.owner,idempotencyKey:'first',executors:installed});
 assert.equal(runs,1);assert.equal(result.receipt.outcome,'inserted');assert.equal(result.bucket.version,2);
 assert.equal(result.submission.proofReceipts[0].result.status,'checked');assert.equal(result.submission.proofs[0].kind,KERNEL_PROOF_KIND);
 const again=await submitKernelObservation({draft,repository:repo,bucketId:b.id,expectedVersion:b.version,expectedDigest:b.digest,actorId:b.owner,idempotencyKey:'first',executors:installed});assert.equal(again.receipt.id,result.receipt.id);assert.equal(runs,2);
 const sidecar=exportSidecar(result.submission,{bucketReceipts:[result.receipt],buckets:[result.bucket]});
 assert.deepEqual(sidecar.submission.proofs[0].evidence.request.kernel,kernel);
 assert.equal(sidecar.submission.proofs[0].evidence.request.binding.documentHash,sidecar.submission.document.sha256);
 const restored=await restoreSubmission(sidecar.submission,client);assert.equal(restored.review,null);assert.deepEqual(restored.proofReceipts,[]);
 const noVerifier=await verifySubmissionProofs(result.submission,client);assert.equal(noVerifier.proofReceipts[0].result.status,'not_checked');
});
test('code/input/paper changes and a missing paper review cannot reuse an old request',async()=>{
 const p=await base(),d=await draftFor(p);
 for(const modify of [r=>r.kernel.source+='changed',r=>r.inputs.minimum=90,r=>r.claimIds=['not_present']]){const r=clone(d.request);modify(r);await assert.rejects(runPaperKernel(p,r,{executors:executors()}),/digest|changed/);}
 const other=await reviewSubmission(p,{actorId:'other',sourceClaimIds:[p.review.sourceClaimIds[0]]});await assert.rejects(runPaperKernel(other,d.request,{executors:executors()}),/reviewed claims|revision/);
 p.review=null;await assert.rejects(createKernelRequest(p,d.request),/Review/);
 await assert.rejects(createKernelRequest(await base(),{...d.request,inputs:{text:'\ud800'}}),/Unicode/);
});
test('changed output, replaced executor, cancellation and failed replay never append',async()=>{
 const draft=await draftFor(),repo=new BucketRepository(client),b=await repo.create({id:'bucket:stopped',name:'Stopped',owner:'person:test'});
 const options={draft,repository:repo,bucketId:b.id,expectedVersion:1,expectedDigest:b.digest,actorId:b.owner,idempotencyKey:'stop'};
 await assert.rejects(submitKernelObservation({...options,executors:executors(false)}),/reproduce/);
 const changed=executors();changed.get('test:host').revision='host/2';await assert.rejects(submitKernelObservation({...options,executors:changed}),/reproduce/);
 await assert.rejects(submitKernelObservation({...options,executors:new Map()}),/reproduce/);
 const controller=new AbortController();controller.abort();await assert.rejects(submitKernelObservation({...options,executors:executors(),signal:controller.signal}),/reproduce/);
 assert.equal(repo.get(b.id).version,1);assert.equal(repo.export().receipts.length,0);
});
test('unknown executor, exception, malformed output, timeout and cancellation are explicit stopped runs',async()=>{
 const p=await base(),request=await createKernelRequest(p,{kernel,inputs:{minimum:80},claimIds:[p.review.ir.claims[0].id]});
 assert.equal((await runPaperKernel(p,request)).result.status,'unsupported');
 const bad=executors();bad.get('test:host').execute=async()=>{throw Error('compile failed');};assert.equal((await runPaperKernel(p,request,{executors:bad})).result.status,'error');
 bad.get('test:host').execute=async()=>NaN;assert.equal((await runPaperKernel(p,request,{executors:bad})).result.status,'error');
 let aborted=false;bad.get('test:host').execute=(_,{signal})=>new Promise(()=>signal.addEventListener('abort',()=>{aborted=true;}));
 const run=await runPaperKernel(p,request,{executors:bad,wallTimeMs:10});assert.equal(run.result.status,'timeout');assert(aborted);
 await assert.rejects(kernelObservationIR(request,run),/completed/);
 const c=new AbortController();c.abort();assert.equal((await runPaperKernel(p,request,{executors:executors(),signal:c.signal})).result.status,'cancelled');
});
test('a reviewed negative observation conflicts with the whole bucket; missing/stale review cannot append',async()=>{
 const d=await draftFor(undefined,false),observation=d.observationIR.claims[0],repo=new BucketRepository(client);
 assert.equal(observation.formula.op,'not');
 const b=await repo.create({id:'bucket:conflict',name:'Conflict',owner:'person:test',ir:{...clone(d.observationIR),claims:[{id:'c_contrast',source:'Analyst assumes the opposite computed result.',formula:observation.formula.x}]}});
 const opts={draft:d,repository:repo,bucketId:b.id,expectedVersion:b.version,expectedDigest:b.digest,actorId:b.owner,idempotencyKey:'conflict',executors:executors(false)};
 const result=await submitKernelObservation(opts);assert.equal(result.receipt.outcome,'conflict');assert.equal(repo.get(b.id).version,1);
 const unreviewed=await prepareKernelObservation(d.base,d.request,d.run,{ir:d.observationIR,sourceClaimId:d.sourceClaimId});await assert.rejects(submitKernelObservation({...opts,draft:unreviewed}),/Review/);
 const tampered=clone(d);tampered.observationIR.claims[0].formula=d.request.ir.claims[0].formula;await assert.rejects(submitKernelObservation({...opts,draft:tampered}),/digest/);
 await assert.rejects(submitKernelObservation({...opts,expectedVersion:7,idempotencyKey:'stale'}),/version/);
});
test('imported/fabricated execution results must reproduce and observation IR must match the reviewed target',async()=>{
 const d=await draftFor(),p=clone(d.submission);
 p.proofs[0].evidence.expectedOutput=false;
 const checked=await verifySubmissionProofs(p,client,{verifiers:new Map([[KERNEL_PROOF_KIND,createKernelVerifier({executors:executors()})]])});assert.equal(checked.proofReceipts[0].result.status,'failed');
 p.proofs[0].evidence.observationIR.claims[0].formula={op:'and',xs:[]};
 await assert.rejects(verifySubmissionProofs(p,client,{verifiers:new Map([[KERNEL_PROOF_KIND,createKernelVerifier({executors:executors()})]])}),/IR changed/);
 const bad=clone(d);bad.run.result.output=false;const {format,digest:old,...payload}=bad.run;bad.run.digest=await digest(format,payload);
 const fresh=await prepareKernelObservation(bad.base,bad.request,bad.run,{ir:await kernelObservationIR(bad.request,bad.run),sourceClaimId:bad.sourceClaimId});assert.equal(fresh.submission.review,null);
});
