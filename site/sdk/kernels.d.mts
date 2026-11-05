import type {Submission,Json,WmtIR,OperationOptions,Verifier,Proof,ProofReceipt,BucketRepository,Bucket,BucketReceipt} from './index.mjs';
export interface Kernel {format:'wmt.kernel/1';id:string;revision:string;executorId:string;language:string;interface:string;source:string;libraries:string[]}
export interface KernelRequest {format:'wmt.paper-kernel-request/1';digest:string;kernel:Kernel;inputs:Json;claimIds:string[];ir:WmtIR;binding:{submissionId:string;documentHash:string;proposalDigest:string;irDigest:string};kernelDigest:string;inputsDigest:string}
export interface KernelExecutor {id:string;revision:string;execute(request:KernelRequest,options:{signal?:AbortSignal;wallTimeMs:number}):Promise<Json>}
export interface KernelOptions {executors?:Map<string,KernelExecutor>;signal?:AbortSignal;wallTimeMs?:number}
export interface KernelRun {format:'wmt.paper-kernel-run/1';digest:string;requestDigest:string;checker:{id:string;revision:string}|null;result:{status:'executed';output:Json}|{status:'unsupported'|'cancelled'|'error'|'timeout';reason:string};createdAt:string;boundary:string}
export interface KernelObservation {format:'wmt.kernel-observation/1';digest:string;base:Submission;request:KernelRequest;run:KernelRun;observationIR:WmtIR;sourceClaimId:string;submission:Submission;boundary:string}
export const KERNEL_PROOF_KIND:'wmt.kernel-execution/1';
export function validateKernel(kernel:Kernel):Kernel;
export function createKernelRequest(submission:Submission,input:{kernel:Kernel;inputs:Json;claimIds:string[]}):Promise<KernelRequest>;
export function runPaperKernel(submission:Submission,request:KernelRequest,options?:KernelOptions):Promise<KernelRun>;
export function kernelObservationIR(request:KernelRequest,run:KernelRun):Promise<WmtIR>;
export function prepareKernelObservation(submission:Submission,request:KernelRequest,run:KernelRun,input:{ir:WmtIR;sourceClaimId:string}):Promise<KernelObservation>;
export function reviewKernelObservation(draft:KernelObservation,input:{actorId:string}):Promise<KernelObservation>;
export function createKernelVerifier(options?:Omit<KernelOptions,'signal'>):Verifier;
export function submitKernelObservation(input:KernelOptions&OperationOptions&{draft:KernelObservation;repository:BucketRepository;bucketId:string;expectedVersion:number;expectedDigest:string;actorId:string;idempotencyKey:string}):Promise<{bucket:Bucket;receipt:BucketReceipt;submission:Submission}>;
