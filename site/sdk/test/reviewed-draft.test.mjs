import {test} from 'node:test';import assert from 'node:assert/strict';import {createSyntheticSubmission,syntheticReview,acceptedCandidate} from '../../papers/synthetic-review.mjs';
import {predicateDefinitionDraft,primitiveDraft} from '../../papers/formal-drafts.mjs';
import {prepareDraftSubmission,recordDraftReview,admitReviewedDraft} from '../../papers/reviewed-draft.mjs';
import {createNodeClient,BucketRepository} from '../node.mjs';
const {document,extraction}=await syntheticReview(),base={format:'wmt.paper-submission/1',id:'paper_synthetic',document,extraction,source:{fileName:document.fileName},title:'Synthetic definition review',authors:['Public software fixture'],proofs:[],proofReceipts:[],proposal:null,review:null},candidate=acceptedCandidate(extraction),ir=predicateDefinitionDraft(candidate);
const prepare=()=>prepareDraftSubmission({base,extraction,sourceClaimId:candidate.id,ir});
test('one Accepted definition maps to its exact passage; all other candidates stay outside the review',async()=>{
 const before=JSON.stringify({base,extraction,ir}),p=await prepare();assert.equal(p.submission.review,null);assert.equal(p.submission.proposal.mappings.length,1);assert.equal(p.submission.proposal.mappings[0].sourceClaimId,candidate.id);assert.equal(p.submission.proposal.unsupported.length,extraction.claims.length-1);assert.equal(p.submission.proofs.length,0);assert(p.symbols.some(s=>s.local==='Accepted'&&s.qualified.startsWith(p.namespace)));assert.equal(JSON.stringify({base,extraction,ir}),before);
 const other=structuredClone(ir);other.claims[0].formula.op='exists';const q=await prepareDraftSubmission({base,extraction,sourceClaimId:candidate.id,ir:other});assert.notEqual(p.namespace,q.namespace);
});
test('opaque declarations, foreign source, and altered prepared code cannot gain formal review',async()=>{
 await assert.rejects(()=>prepareDraftSubmission({base,extraction,sourceClaimId:candidate.id,ir:primitiveDraft(candidate,{definition:true,label:'Accepted'})}),/primitive declaration/);
 const wrong=structuredClone(extraction);wrong.documentHash='0'.repeat(64);await assert.rejects(()=>prepareDraftSubmission({base,extraction:wrong,sourceClaimId:candidate.id,ir}),/mismatch/);
 for(const change of [p=>p.source='changed',p=>p.draftDigest='bad',p=>p.submission.proposal.ir.claims[0].formula.op='exists',p=>p.symbols[0].qualified='Other']){const p=await prepare();change(p);await assert.rejects(()=>recordDraftReview(p,{actorId:'agent:test'}),/changed/);}
});
test('review is a separate source-bound step; admission requires it',async()=>{
 const p=await prepare();await assert.rejects(()=>admitReviewedDraft(p,{}),/review first/);const r=await recordDraftReview(p,{actorId:'agent:test'});assert.deepEqual(r.submission.review.sourceClaimIds,[candidate.id]);assert.equal(r.submission.review.actorId,'agent:test');assert.equal(r.submission.review.ir.claims.length,1);assert.equal(p.submission.review,null);
});
test('real Z3 admits the reviewed definition, duplicate replay adds nothing, and rejects a conflicting bucket without changing it',async()=>{
 const r=await recordDraftReview(await prepare(),{actorId:'agent:test'}),client=createNodeClient(),repo=new BucketRepository(client),added=await admitReviewedDraft(r,client,{repository:repo});assert.equal(added.receipt.outcome,'inserted');assert.equal(added.receipt.consistency.status,'consistent');assert.equal(added.before.version,1);assert.equal(added.after.version,2);assert.equal(added.after.ir.claims.length,1);
 const again=await admitReviewedDraft(r,client,{repository:repo});assert.equal(again.receipt.outcome,'unchanged');assert.equal(again.after.digest,added.after.digest);
 const conflict=await admitReviewedDraft(r,client,{contrast:true,bucketId:'contrast'});assert.equal(conflict.receipt.outcome,'conflict');assert.equal(conflict.receipt.consistency.status,'inconsistent');assert.equal(conflict.after.digest,conflict.before.digest);assert.equal(conflict.after.version,1);assert.equal(conflict.receipt.addedClaimIds.length,0);
});
