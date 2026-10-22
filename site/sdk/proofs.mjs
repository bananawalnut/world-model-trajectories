import {DEFEASIBLE_POLICY} from './reasoning.mjs';
import {closed,requireThat,digest,sha256,canonical,clone,text,isoNow} from './hash.mjs';
import {decodeBase64} from './claims.mjs';
export async function makeEntailmentProof(submission,{id,targetClaimId,premiseClaimIds}) {
  requireThat(submission.review,'Review the formalization before binding a proof.');
  return {format:'wmt.computational-proof/1',id:text(id,'Proof ID',200),kind:'smt-entailment',
    binding:{documentHash:submission.document.sha256,proposalDigest:submission.proposal.digest,irDigest:submission.review.irDigest,claimIds:[targetClaimId]},
    evidence:{targetClaimId,premiseClaimIds:clone(premiseClaimIds)},assets:[]};
}
export async function makeWitnessProof(submission,{id,targetClaimId,candidatePremiseIds}) {
  const artifact=await makeEntailmentProof(submission,{id,targetClaimId,premiseClaimIds:[]});
  artifact.kind='smt-explanation-witness';artifact.evidence={targetClaimId,...(candidatePremiseIds===undefined?{}:{candidatePremiseIds:clone(candidatePremiseIds)})};return artifact;
}
export async function validateProof(proof) {
  closed(proof,['format','id','kind','binding','evidence','assets'],'proof');
  requireThat(proof.format==='wmt.computational-proof/1','Expected wmt.computational-proof/1.');text(proof.id,'Proof ID',200);text(proof.kind,'Proof kind',100);
  requireThat(Array.isArray(proof.assets) && proof.assets.length<=8 && typeof proof.evidence==='object' && proof.evidence!==null,'Invalid proof evidence/assets.');
  requireThat(canonical(proof.evidence).length<=200000,'Proof evidence exceeds the byte budget.','resource_limit');
  if(proof.binding!==null) {
    closed(proof.binding,['documentHash','proposalDigest','irDigest','claimIds'],'proof binding');
    for(const key of ['documentHash','proposalDigest','irDigest'])requireThat(/^[0-9a-f]{64}$/.test(proof.binding[key]),'Proof bindings require full SHA-256 digests.');
    requireThat(Array.isArray(proof.binding.claimIds) && proof.binding.claimIds.length>0 && proof.binding.claimIds.length<=64 && new Set(proof.binding.claimIds).size===proof.binding.claimIds.length,'Proof needs unique target claim IDs.');
  }
  let total=0;const names=new Set();
  for(const asset of proof.assets) {
    closed(asset,['fileName','mediaType','base64','sha256'],'proof asset');text(asset.fileName,'Proof asset name',200);text(asset.mediaType,'Proof asset media type',100);
    requireThat(!names.has(asset.fileName),'Duplicate proof asset filename.');names.add(asset.fileName);
    const bytes=decodeBase64(asset.base64,2000000);total+=bytes.length;
    requireThat(total<=12000000,'Proof assets exceed the total byte budget.','resource_limit');
    requireThat(await sha256(bytes)===asset.sha256,'Proof asset checksum mismatch.','binding_mismatch');
  }
  return proof;
}
export async function checkProof(proof,submission,client,{verifiers=new Map(),limits={},signal}={}) {
  await validateProof(proof);
  const proofDigest=await digest('proof',proof),binding=proof.binding,review=submission.review;
  let result={status:'not_checked',reason:'Artifact attached; no checker ran.'},checker=null;
  const matches=binding && review && binding.documentHash===submission.document.sha256 && binding.proposalDigest===submission.proposal?.digest && binding.irDigest===review.irDigest && binding.claimIds.every(id=>review.ir.claims.some(c=>c.id===id));
  if(!matches)result={status:'not_checked',reason:'Proof is unbound or its exact source/formalization/claim binding does not match.'};
  else if(['smt-entailment','smt-explanation-witness'].includes(proof.kind)) {
    const automatic=proof.kind==='smt-explanation-witness';
    closed(proof.evidence,automatic?['targetClaimId','candidatePremiseIds']:['targetClaimId','premiseClaimIds'],'entailment evidence');
    requireThat(binding.claimIds.length===1 && binding.claimIds[0]===proof.evidence.targetClaimId,'Entailment target must equal the bound claim.');
    const answer=await client[automatic?'witness':'entailment'](review.ir,proof.evidence,{limits,signal});
    result=['checked','failed','unsupported'].includes(answer.status)?answer:{status:'unsupported',reason:answer.message??'Checker stopped.',stopReason:answer.stopReason};
    checker={id:automatic?'wmt.smt-explanation-witness/1':'wmt.smt-entailment/1',revision:answer.runtime?.engineRevision??null};
    if(automatic && result.status==='checked'){
      const ids=proof.evidence.candidatePremiseIds??review.ir.claims.filter(c=>c.id!==proof.evidence.targetClaimId).map(c=>c.id);
      requireThat(result.requestDigest===await digest('witness-request',{ir:review.ir,evidence:{targetClaimId:proof.evidence.targetClaimId,candidatePremiseIds:ids}}) && result.complete===true && result.minimality==='inclusion' && Array.isArray(result.premiseClaimIds) && new Set(result.premiseClaimIds).size===result.premiseClaimIds.length && result.premiseClaimIds.every(id=>ids.includes(id) && id!==proof.evidence.targetClaimId),'Witness reply binding mismatch.');
    }
    if(result.status==='checked')requireThat(result.inputDigest===binding.irDigest && result.targetDigest===await digest('formula',review.ir.claims.find(c=>c.id===binding.claimIds[0]).formula),'Checker reply binding mismatch.');
  } else if(verifiers.has(proof.kind)) {
    const verifier=verifiers.get(proof.kind);text(verifier.id,'Checker ID',200);text(verifier.revision,'Checker revision',200);
    const answer=await verifier.verify(clone(proof),clone(review.ir),{limits,signal});
    requireThat(['checked','failed','unsupported'].includes(answer.status) && answer.inputDigest===binding.irDigest,'Custom checker must bind its result to the exact input.');
    result=answer;checker={id:verifier.id,revision:verifier.revision};
  }
  const payload={format:'wmt.proof-receipt/1',proofId:proof.id,proofDigest,binding:clone(binding),checker,result,
    boundary:'Result covers only the named checker, exact inputs and bound claims. It does not establish PDF extraction fidelity, empirical truth, whole-paper correctness or publication acceptance.',checkedAt:checker?isoNow():null};
  return {...payload,id:'proof_receipt_'+await digest('proof-receipt',payload)};
}

// A separate analysis receipt: preferred assumptions never become a checked
// proof artifact or an automatic strict-bucket append.
export async function analyzeSubmissionDefaults(submission,request,client,options={}) {
  requireThat(submission.review,'Review the formalization before defaults analysis.','review_required');
  const ir=submission.review.ir;
  closed(request,['defaultClaimIds','targetClaimId','policy'],'defaults request');
  requireThat(Array.isArray(request.defaultClaimIds) && new Set(request.defaultClaimIds).size===request.defaultClaimIds.length && request.defaultClaimIds.every(id=>ir.claims.some(c=>c.id===id) && id!==request.targetClaimId),'Defaults must be unique, present and exclude the conclusion.');
  requireThat(request.targetClaimId===undefined || ir.claims.some(c=>c.id===request.targetClaimId),'Conclusion must exist.');
  requireThat(request.policy===undefined || request.policy===DEFEASIBLE_POLICY,'Unknown defaults policy.');
  const result=await client.defeasible(ir,request,options);
  const policy=request.policy??DEFEASIBLE_POLICY;
  const inputDigest=await digest('ir',ir);
  requireThat(inputDigest===submission.review.irDigest,'Review IR digest mismatch.','binding_mismatch');
  if(result.complete)requireThat(result.inputDigest===inputDigest && result.requestDigest===await digest('defeasible-request',{ir,defaultClaimIds:request.defaultClaimIds,targetClaimId:request.targetClaimId??null,policy}),'Defaults reply binding mismatch.','binding_mismatch');
  const payload={format:'wmt.paper-reasoning/1',binding:{documentHash:submission.document.sha256,proposalDigest:submission.proposal.digest,irDigest:inputDigest},request:clone(request),result,
    boundary:'Defaults analysis of the reviewed interpretation, with explicit user-selected rules. This receipt does not change the paper, its author review, or any strict bucket.',checkedAt:isoNow()};
  return {...payload,id:'reasoning_'+await digest('paper-reasoning',payload)};
}
