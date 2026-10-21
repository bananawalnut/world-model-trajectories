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
