import {closed,requireThat,clone,canonical,digest,text,isoNow} from './hash.mjs';
import {validateIR,mergeIR} from './ir.mjs';
import {makeProposal,reviewProposal} from './claims.mjs';
import {reviewSubmission,verifySubmissionProofs} from './submissions.mjs';
import {validateProof} from './proofs.mjs';

export const KERNEL_PROOF_KIND='wmt.kernel-execution/1';
const boundary='Reproduced computation over exact code, inputs and paper claims. The output-to-formula mapping is a local interpretation, not a proof of the kernel, empirical truth or author endorsement.';
function boundedJSON(value,max=200000){
 const pending=[[value,0]];let count=0;
 while(pending.length){const[v,depth]=pending.pop();requireThat(++count<=30000&&depth<=30,'Kernel JSON exceeds its depth/node budget.','resource_limit');if(typeof v==='string')requireThat(v.isWellFormed(),'Kernel text must contain well-formed Unicode.');else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){requireThat(k.isWellFormed(),'Kernel JSON keys must contain well-formed Unicode.');pending.push([x,depth+1]);}}
 const s=canonical(value);requireThat(s.length<=max,'Kernel JSON exceeds its byte budget.','resource_limit');return value;
}
async function sealed(format,payload){return {...payload,format,digest:await digest(format,payload)};}
async function unseal(value,format){requireThat(value?.format===format,'Unexpected kernel artifact format.');const {digest:expected,format:actual,...payload}=value;requireThat(expected===await digest(format,payload),'Kernel artifact digest mismatch.','binding_mismatch');return payload;}
export function validateKernel(kernel){
 closed(kernel,['format','id','revision','executorId','language','interface','source','libraries'],'kernel');
 requireThat(kernel.format==='wmt.kernel/1','Expected wmt.kernel/1.');
 for(const key of ['id','revision','executorId','language','interface'])text(kernel[key],`Kernel ${key}`,200);
 text(kernel.source,'Kernel source',100000);
 requireThat(kernel.source.isWellFormed(),'Kernel source must contain well-formed Unicode.');
 requireThat(Array.isArray(kernel.libraries)&&kernel.libraries.length<=8&&new Set(kernel.libraries).size===kernel.libraries.length,'Invalid kernel libraries.');kernel.libraries.forEach(x=>text(x,'Library ID',200));return kernel;
}
async function checkedReview(submission){
 requireThat(submission?.review&&submission.proposal,'Review the paper formalization first.','review_required');
 const r=await reviewProposal(submission.proposal,submission.extraction,submission.review);
 requireThat(r.irDigest===submission.review.irDigest&&canonical(r.ir)===canonical(submission.review.ir)&&submission.document.sha256===submission.extraction.documentHash,'Paper review/source binding changed.','binding_mismatch');return r;
}
export async function createKernelRequest(submission,{kernel,inputs,claimIds}){
 const paper=clone(submission);validateKernel(kernel);boundedJSON(inputs);const review=await checkedReview(paper);
 requireThat(Array.isArray(claimIds)&&claimIds.length>0&&new Set(claimIds).size===claimIds.length&&claimIds.every(id=>review.ir.claims.some(c=>c.id===id)),'Select existing reviewed claims for the kernel.');
 return sealed('wmt.paper-kernel-request/1',{kernel:clone(kernel),inputs:clone(inputs),claimIds:clone(claimIds),ir:clone(review.ir),binding:{submissionId:paper.id,documentHash:paper.document.sha256,proposalDigest:paper.proposal.digest,irDigest:review.irDigest},kernelDigest:await digest('kernel',kernel),inputsDigest:await digest('kernel-inputs',inputs)});
}
async function validateRequest(request){
 boundedJSON(request,150000);
 const p=await unseal(request,'wmt.paper-kernel-request/1');
 closed(p,['kernel','inputs','claimIds','ir','binding','kernelDigest','inputsDigest'],'kernel request');validateKernel(p.kernel);validateIR(p.ir);boundedJSON(p.inputs);
 closed(p.binding,['submissionId','documentHash','proposalDigest','irDigest'],'kernel paper binding');text(p.binding.submissionId,'Submission ID',200);
 requireThat(['documentHash','proposalDigest','irDigest'].every(k=>/^[0-9a-f]{64}$/.test(p.binding[k])),'Invalid kernel binding.');
 requireThat(p.binding.irDigest===await digest('ir',p.ir)&&p.kernelDigest===await digest('kernel',p.kernel)&&p.inputsDigest===await digest('kernel-inputs',p.inputs),'Kernel inputs/code/IR binding mismatch.','binding_mismatch');
 requireThat(Array.isArray(p.claimIds)&&p.claimIds.length>0&&new Set(p.claimIds).size===p.claimIds.length&&p.claimIds.every(id=>p.ir.claims.some(c=>c.id===id)),'Kernel target claims changed.');return p;
}
async function bindCurrent(submission,request){
 await validateRequest(request);
 const fresh=await createKernelRequest(submission,request);requireThat(fresh.digest===request.digest,'Kernel request belongs to another paper/formalization revision.','binding_mismatch');
}
// Hosts install executors explicitly. Submitted language/source never chooses
// an arbitrary executable, URL, shell command or dynamic-import target.
async function execute(request,{executors=new Map(),signal,wallTimeMs=20000}={}){
 request=clone(request);await validateRequest(request);
 requireThat(Number.isSafeInteger(wallTimeMs)&&wallTimeMs>=1&&wallTimeMs<=60000,'Kernel wall-clock limit must be 1–60000 ms.');
 const executor=executors.get(request.kernel.executorId),controller=new AbortController();
 const checker=executor?{id:text(executor.id,'Executor ID',200),revision:text(executor.revision,'Executor revision',200)}:null;
 if(executor)requireThat(executor.id===request.kernel.executorId,'Installed executor ID mismatch.');
 let result,timer,cancel;
 try{
  if(signal?.aborted)result={status:'cancelled',reason:'Kernel operation cancelled.'};
  else if(!executor)result={status:'unsupported',reason:'No installed executor for this kernel.'};
  else {
   const stopped=new Promise(resolve=>{cancel=()=>{controller.abort();resolve({status:'cancelled',reason:'Kernel operation cancelled.'});};signal?.addEventListener('abort',cancel,{once:true});timer=setTimeout(()=>{controller.abort();resolve({status:'timeout',reason:'Kernel execution exceeded its wall-clock limit.'});},wallTimeMs);});
   const work=Promise.resolve().then(()=>executor.execute(clone(request),{signal:controller.signal,wallTimeMs})).then(output=>{boundedJSON(output);return {status:'executed',output:clone(output)};});
   result=await Promise.race([work,stopped]);
  }
 }catch(e){result={status:e.code==='unsupported'?'unsupported':'error',reason:String(e.message??e).slice(0,2000)};}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.abort();}
 return sealed('wmt.paper-kernel-run/1',{requestDigest:request.digest,checker,result,createdAt:isoNow(),boundary});
}
export async function runPaperKernel(submission,request,options){const paper=clone(submission),snapshot=clone(request);await bindCurrent(paper,snapshot);return execute(snapshot,options);}
async function validateRun(request,run){
 await validateRequest(request);await unseal(run,'wmt.paper-kernel-run/1');
 requireThat(run.requestDigest===request.digest&&run.result.status==='executed'&&run.checker,'A completed execution of this exact kernel request is required.','kernel_not_executed');boundedJSON(run.result.output);
}
export async function kernelObservationIR(request,run){
 await validateRun(request,run);
 const name='k_'+request.digest.slice(0,24)+(typeof run.result.output==='boolean'?'_accepts':'_recorded');
 const atom={op:'pred',name,args:[]};
 return {sorts:[],preds:[{name,args:[]}],funcs:[],claims:[{id:name+'_observation',source:`Computation ${request.kernel.id}@${request.kernel.revision} on request ${request.digest}: ${Array.from(canonical(run.result.output)).slice(0,1000).join('')}`,formula:run.result.output===false?{op:'not',x:atom}:atom}]};
}
export async function prepareKernelObservation(submission,request,run,{ir,sourceClaimId}){
 request=clone(request);run=clone(run);ir=clone(ir);
 const base=clone(submission);await bindCurrent(base,request);await validateRun(request,run);validateIR(ir);boundedJSON(ir,40000);
 requireThat(ir.claims.length>0,'Author at least one formal observation.');
 const existing=new Set(base.review.ir.claims.map(c=>c.id));requireThat(ir.claims.every(c=>!existing.has(c.id)),'Kernel observations need new claim IDs.');
 const relevant=base.proposal.mappings.filter(m=>m.formalClaimIds.some(id=>request.claimIds.includes(id)));
 requireThat(relevant.some(m=>m.sourceClaimId===sourceClaimId),'Map the observation to a source of a selected kernel claim.');
 const combined=mergeIR(base.review.ir,ir),keep=new Set(base.review.ir.claims.map(c=>c.id));
 const mappings=base.proposal.mappings.map(m=>({sourceClaimId:m.sourceClaimId,formalClaimIds:m.formalClaimIds.filter(id=>keep.has(id))})).filter(m=>m.formalClaimIds.length);
 mappings.find(m=>m.sourceClaimId===sourceClaimId).formalClaimIds.push(...ir.claims.map(c=>c.id));
 const proposal=await makeProposal(base.extraction,{ir:combined,mappings,unsupported:base.proposal.unsupported,parserId:'wmt.reviewed-kernel-observation/1'});
 const next={...clone(base),proposal,review:null,proofs:[],proofReceipts:[]};
 // The snapshot is part of the artifact; no hidden callback decides semantics.
 return sealed('wmt.kernel-observation/1',{base,request:clone(request),run:clone(run),observationIR:clone(ir),sourceClaimId,submission:next,boundary});
}
async function validateDraft(draft){
 await unseal(draft,'wmt.kernel-observation/1');
 const fresh=await prepareKernelObservation(draft.base,draft.request,draft.run,{ir:draft.observationIR,sourceClaimId:draft.sourceClaimId});
 requireThat(fresh.submission.proposal.digest===draft.submission.proposal.digest,'Observation formula/source binding changed.','binding_mismatch');return fresh;
}
export async function reviewKernelObservation(draft,{actorId}){
 const fresh=await validateDraft(draft);
 const submission=await reviewSubmission(fresh.submission,{actorId,sourceClaimIds:fresh.submission.proposal.mappings.map(m=>m.sourceClaimId)});
 const proof={format:'wmt.computational-proof/1',id:'kernel_'+fresh.request.digest,kind:KERNEL_PROOF_KIND,
  binding:{documentHash:submission.document.sha256,proposalDigest:submission.proposal.digest,irDigest:submission.review.irDigest,claimIds:fresh.observationIR.claims.map(c=>c.id)},
  evidence:{request:clone(fresh.request),expectedOutput:clone(fresh.run.result.output),checker:clone(fresh.run.checker),observationIR:clone(fresh.observationIR)},assets:[]};
 await validateProof(proof);submission.proofs=[proof];
 const {format,digest:previous,...payload}=fresh;return sealed(format,{...payload,submission});
}
export function createKernelVerifier({executors=new Map(),wallTimeMs=20000}={}){
 return {id:KERNEL_PROOF_KIND,revision:'1',async verify(proof,ir,{signal}={}){
  closed(proof.evidence,['request','expectedOutput','checker','observationIR'],'kernel evidence');
  const {request,expectedOutput,checker,observationIR}=proof.evidence;await validateRequest(request);validateIR(observationIR);boundedJSON(expectedOutput);
  requireThat(request.binding.documentHash===proof.binding.documentHash,'Kernel paper source mismatch.','binding_mismatch');
  requireThat(canonical(proof.binding.claimIds)===canonical(observationIR.claims.map(c=>c.id)),'Kernel observation claim binding changed.','binding_mismatch');
  // Every original reviewed claim and every authored observation must survive
  // byte-for-byte in the newly reviewed IR; adding a receipt proves no new law.
  requireThat(canonical(mergeIR(request.ir,observationIR))===canonical(ir),'Kernel observation IR changed.','binding_mismatch');
  const run=await execute(request,{executors,signal,wallTimeMs});
  const reproduced=run.result.status==='executed'&&canonical(run.result.output)===canonical(expectedOutput)&&canonical(run.checker)===canonical(checker);
  return {status:reproduced?'checked':run.result.status==='executed'?'failed':'unsupported',inputDigest:await digest('ir',ir),reason:reproduced?boundary:run.result.reason??'Kernel output or executor revision changed; review a fresh run.',run};
 }};
}
export async function submitKernelObservation({draft,repository,bucketId,expectedVersion,expectedDigest,actorId,idempotencyKey,executors,signal,limits={},wallTimeMs}){
 draft=clone(draft);
 await validateDraft(draft);requireThat(draft.submission.review,'Review the exact kernel observation first.','review_required');
 const checked=await checkedReview(draft.submission);
 requireThat(checked.actorId===actorId,'Use the reviewer identity for this kernel admission.','owner_mismatch');
 const reviewed=await reviewKernelObservation(await prepareKernelObservation(draft.base,draft.request,draft.run,{ir:draft.observationIR,sourceClaimId:draft.sourceClaimId}),{actorId});
 requireThat(canonical(reviewed.submission.proofs)===canonical(draft.submission.proofs),'Kernel proof binding changed.','binding_mismatch');
 const submission=await verifySubmissionProofs(draft.submission,null,{verifiers:new Map([[KERNEL_PROOF_KIND,createKernelVerifier({executors,wallTimeMs})]]),signal});
 requireThat(!signal?.aborted&&submission.proofReceipts[0]?.result.status==='checked','Kernel did not reproduce; run it again and review the result.','kernel_not_reproduced');
 // Fresh execution timestamps must not change an otherwise identical append's
 // idempotency key. Return the fresh evidence separately with the submission.
 const result=await repository.submit(bucketId,{expectedVersion,expectedDigest,actorId,idempotencyKey,submission:draft.submission,signal,limits,enumeratePositions:false});
 return {...result,submission};
}
