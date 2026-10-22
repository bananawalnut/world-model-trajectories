import type {PublicationClaimSet} from './castalia/publication-claim-set.js';
import type {PaperAnalysisSemantic} from './castalia/paper-analysis-semantic.js';
import {BucketRepository,createSubmission,formalizeSubmission,reviewSubmission,makeEntailmentProof,createModelFormalizer,type WmtIR,toCastaliaClaimSet,toCastaliaAnalysis} from '@wmt/paper-sdk';
import {createNodeClient} from '@wmt/paper-sdk/node';
import {createSidecarServer} from '@wmt/paper-sdk/server';
async function submissionConsumer(bytes:Uint8Array) {
  const client=createNodeClient(),buckets=new BucketRepository(client);
  let paper=await createSubmission({bytes,title:'Paper',authors:['Author']},client);
  paper=await formalizeSubmission(paper);
  if(!paper.proposal)throw new Error('No proposal');
  paper=await reviewSubmission(paper,{actorId:'person:me',sourceClaimIds:paper.proposal.mappings.map(m=>m.sourceClaimId)});
  const bucket=await buckets.create({id:'model',name:'My model',owner:'person:me'});
  const result=await buckets.submit(bucket.id,{expectedVersion:bucket.version,expectedDigest:bucket.digest,actorId:bucket.owner,submission:paper,idempotencyKey:'one'});
  if(result.receipt.analysis.complete)result.receipt.analysis.positions.forEach(p=>p.keep.map(id=>id.toUpperCase()));
  const proof=await makeEntailmentProof(paper,{id:'proof:one',targetClaimId:'c_one',premiseClaimIds:[]});
  const castaliaClaims:PublicationClaimSet=toCastaliaClaimSet(paper,{id:'PCS-0001',revision:'rev-claim-set-demo',publicationRevision:'rev-publication-demo',claimIdMap:{}});
  const castaliaAnalysis:PaperAnalysisSemantic=toCastaliaAnalysis(result.receipt,{id:'PAS-0001',targetId:'FMT-0001',snapshotId:'PMS-DEMO'});
  return {result,proof,castaliaClaims,castaliaAnalysis};
}
const ir:WmtIR={sorts:[],preds:[],funcs:[],claims:[]};
createModelFormalizer({id:'test.model/1',completeJSON:async()=>({status:'draft',ir})});
createSidecarServer({client:createNodeClient()});
void submissionConsumer;

import {PROOF_CANDIDATE_POLICY,selectProofSpans,buildCandidateReview,updateCandidateFeedback,type CandidateRole,type CandidateReview} from '@wmt/paper-sdk';
async function extractionReviewConsumer(bytes:Uint8Array) {
  const submission=await createSubmission({bytes,title:'Structured review',authors:['Author']},createNodeClient(),{claimExtractor:{id:PROOF_CANDIDATE_POLICY,select:selectProofSpans}});
  const role:CandidateRole='corollary';
  let review:CandidateReview=await buildCandidateReview(submission.document,submission.extraction);
  if(review.entries.length)review=await updateCandidateFeedback(review,review.entries[0].candidateId,{role,scopeType:'local',disposition:'needs_change'});
  return review;
}
void extractionReviewConsumer;

import {makeWitnessProof,analyzeSubmissionDefaults,collectiveConflicts,DEFEASIBLE_POLICY,type Submission} from '@wmt/paper-sdk';
async function reasoningConsumer(paper:Submission){
 const client=createNodeClient();if(!paper.review)return;
 const ir=paper.review.ir,w=await client.witness(ir,{targetClaimId:'conclusion'});
 if(w.complete && w.status==='checked')w.premiseClaimIds.map(id=>id.toUpperCase());
 const proof=await makeWitnessProof(paper,{id:'proof:auto',targetClaimId:'conclusion'});
 const receipt=await analyzeSubmissionDefaults(paper,{defaultClaimIds:['rule'],targetClaimId:'conclusion',policy:DEFEASIBLE_POLICY},client);
 if(receipt.result.complete && receipt.result.status==='selected')receipt.result.overridden.forEach(o=>o.conflict.map(id=>id.toUpperCase()));
 return {proof,receipt,groups:collectiveConflicts([['P','Q','N']])};
}
void reasoningConsumer;

async function extensionsConsumer(){const client=createNodeClient(),repo=new BucketRepository(client),b=await repo.create({id:'e',name:'E',owner:'me'});
 const check=await client.consistency(ir);if(check.complete)check.status;
 const receipt=await repo.enumerateDefaults('e',{expectedVersion:1,expectedDigest:b.digest,actorId:'me',candidateIR:ir,request:{defaultClaimIds:[],entities:[]}});
 if(receipt.result.complete && receipt.result.status==='enumerated'){const selected=receipt.result.extensions[0];if(selected)await repo.forkExtension('e',{receiptId:receipt.id,extensionId:selected.id,newId:'fork',name:'Fork',actorId:'me',expectedVersion:1,expectedDigest:b.digest});}
 return receipt;
}
void extensionsConsumer;
import {buildDefinitionReview,definitionConcepts,mergeDefinitionConcepts,moveDefinitionOccurrence,type DefinitionReview} from '@wmt/paper-sdk';
async function definitionConsumer(bytes:Uint8Array){const p=await createSubmission({bytes,title:'Definitions',authors:['Author']},createNodeClient());let review:DefinitionReview=await buildDefinitionReview(p.document,p.extraction);const concepts=definitionConcepts(review);if(concepts.length>1)review=await mergeDefinitionConcepts(review,{conceptIds:concepts.slice(0,2).map(c=>c.id),label:'One shared concept'});const first=review.occurrences[0];if(first)review=await moveDefinitionOccurrence(review,{occurrenceId:first.id,conceptId:review.concepts[0].id,kind:'reference'});return review;}
void definitionConsumer;
