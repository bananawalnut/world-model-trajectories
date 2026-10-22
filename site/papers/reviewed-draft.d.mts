import type {Submission,Extraction,SourceClaim,WmtIR,WorkerClient,Bucket,BucketReceipt,BucketWorkspace,BucketRepository} from '../sdk/index.mjs';
export interface ReviewedPaperDraft {format:'wmt.reviewed-paper-draft/1';documentHash:string;extractionDigest:string;sourceClaimId:string;source:string;locator:SourceClaim['locator'];draftIR:WmtIR;draftDigest:string;namespace:string;symbols:{local:string;qualified:string}[];submission:Submission}
export interface DefinitionBucketExperiment {format:'wmt.definition-bucket-experiment/1';reviewedDraft:ReviewedPaperDraft;before:Bucket;after:Bucket;receipt:BucketReceipt;workspace:BucketWorkspace;boundary:string}
export function prepareDraftSubmission(input:{base:Submission;extraction:Extraction;sourceClaimId:string;ir:WmtIR}):Promise<ReviewedPaperDraft>;
export function recordDraftReview(prepared:ReviewedPaperDraft,review:{actorId:string}):Promise<ReviewedPaperDraft>;
export function admitReviewedDraft(prepared:ReviewedPaperDraft,client:WorkerClient,options?:{signal?:AbortSignal;repository?:BucketRepository;bucketId?:string;contrast?:boolean}):Promise<DefinitionBucketExperiment>;
