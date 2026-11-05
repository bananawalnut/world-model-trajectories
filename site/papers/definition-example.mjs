import {createWorkerClient,buildCandidateReview} from '../sdk/index.mjs';
import {syntheticPdf,createSyntheticSubmission,acceptedCandidate} from './synthetic-review.mjs';
import {mountCandidateReview,restoreCandidateFeedback} from './candidate-review.mjs';
import {predicateDefinitionDraft} from './formal-drafts.mjs';
import {mountDefinitionWorkflow} from './definition-workflow.mjs';
import {mountTrajectoryView} from './coherence-view.mjs';
const $=id=>document.getElementById(id),client=createWorkerClient(()=>new Worker(new URL('./worker.js',import.meta.url))),flowState={};let candidates,flow;
const url=URL.createObjectURL(new Blob([syntheticPdf()],{type:'application/pdf'}));$('synthetic-pdf').href=url;
try{
 const submission=await createSyntheticSubmission(client),fresh=await buildCandidateReview(submission.document,submission.extraction),restored=await restoreCandidateFeedback(fresh,submission.document,submission.extraction);
 function openDefinition(sourceClaimId,label='Accepted'){
  flow=mountDefinitionWorkflow($('definition-workflow'),{base:submission,extraction:submission.extraction,sourceClaimId,client,state:flowState,draftIR:candidates.formalDrafts.drafts.find(d=>d.candidateId===sourceClaimId)?.ir,proposedIR:predicateDefinitionDraft(submission.extraction.claims.find(c=>c.id===sourceClaimId),{predicate:label.replace(/[^A-Za-z0-9_]/g,'_')||'DefinedProperty'}),onLocate:c=>{$('definition-source').textContent=`Page ${c.locator.page}, exact span ${c.locator.start}–${c.locator.end}\n${c.statement}`;},onSaveDraft:(id,ir)=>candidates.saveFormalDraft(id,ir),onExperiment:e=>{mountTrajectoryView($('definition-trajectories'),{workspace:e.workspace,activeId:e.after.id,onSelect:b=>{$('definition-source').textContent=b.name+' · v'+b.version+' · '+b.ir.claims.length+' assumptions';}});}});
 }
 candidates=mountCandidateReview($('definition-candidates'),{document:submission.document,extraction:submission.extraction,review:restored.review,notice:restored.notice,onLocate:c=>{$('definition-source').textContent=c.statement;},onFormalReview:id=>{const registry=candidates.definitionReview,binding=registry.concepts.find(c=>c.id===id),o=registry.occurrences.find(o=>binding.occurrenceIds.includes(o.id)&&o.kind==='definition')??registry.occurrences.find(o=>binding.occurrenceIds.includes(o.id));openDefinition(o.candidateId,binding.label);flow.open();}});
 openDefinition(acceptedCandidate(submission.extraction).id);$('definition-ready').textContent='Ready · real PDF extraction; synthetic source';$('definition-ready').classList.add('rdy');
}catch(e){$('definition-error').textContent=e.message;}
addEventListener('pagehide',()=>{flowState.controller?.abort();URL.revokeObjectURL(url);});
