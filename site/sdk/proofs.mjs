import {closed,requireThat,digest,sha256,canonical,clone,text,isoNow} from './hash.mjs';
import {decodeBase64} from './claims.mjs';
export async function makeEntailmentProof(submission,{id,targetClaimId,premiseClaimIds}) {
  requireThat(submission.review,'Review the formalization before binding a proof.');
  return {format:'wmt.computational-proof/1',id:text(id,'Proof ID',200),kind:'smt-entailment',
    binding:{documentHash:submission.document.sha256,proposalDigest:submission.proposal.digest,irDigest:submission.review.irDigest,claimIds:[targetClaimId]},
    evidence:{targetClaimId,premiseClaimIds:clone(premiseClaimIds)},assets:[]};
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
  else if(proof.kind==='smt-entailment') {
    closed(proof.evidence,['targetClaimId','premiseClaimIds'],'entailment evidence');
    requireThat(binding.claimIds.length===1 && binding.claimIds[0]===proof.evidence.targetClaimId,'Entailment target must equal the bound claim.');
    const answer=await client.entailment(review.ir,proof.evidence,{limits,signal});
    result=['checked','failed','unsupported'].includes(answer.status)?answer:{status:'unsupported',reason:answer.message??'Checker stopped.',stopReason:answer.stopReason};
    checker={id:'wmt.smt-entailment/1',revision:answer.runtime?.engineRevision??null};
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
