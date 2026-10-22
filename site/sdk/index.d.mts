export type Json = null | boolean | number | string | Json[] | {[key:string]:Json};
export type Term = {t:'var';name:string} | {t:'int';v:number} | {t:'real';v:string} |
  {t:'app';name:string;args?:Term[]} | {t:'arith';op:'+'|'-'|'*';args:Term[]};
export type Formula = {op:'pred';name:string;args?:Term[]} | {op:'eq';a:Term;b:Term} |
  {op:'cmp';rel:'<'|'<='|'>'|'>=';a:Term;b:Term} | {op:'not';x:Formula} |
  {op:'and'|'or';xs:Formula[]} | {op:'imp'|'iff';a:Formula;b:Formula} |
  {op:'forall'|'exists';vars:{name:string;sort:string}[];body:Formula};
export interface Signature {name:string;args:string[];ret?:string;gloss?:string}
export interface Claim {id:string;source:string;formula:Formula;weight?:number;active?:true;defeasible?:false;gloss?:string;back?:string}
export interface WmtIR {sorts:string[];preds:Signature[];funcs:Signature[];claims:Claim[]}
export interface Limits {maxSteps:number;solverTimeoutMs:number;wallTimeMs:number}
export interface OperationOptions {signal?:AbortSignal;limits?:Partial<Limits>}
export interface RuntimeManifest {format:'wmt.sdk-runtime/1';sdkVersion:string;engine:string;engineRevision:string;solver:string;solverWasmSha256:string;logicProfile:string;files:Record<string,string>;adaptersSha256:Record<string,string>;browserAdapterSha256:string;pdfjs:{version:string;moduleSha256:string;workerSha256:string;standardFontsSha256:Record<string,string>}}
export interface Position {keep:string[];drop:string[]}
export interface CompleteAnalysis {format:'wmt.analysis/1';status:'consistent'|'inconsistent';complete:true;stopReason:'completed';profile:string;limits:Limits;steps:number;runtime:RuntimeManifest;inputDigest:string;positions:Position[];conflicts:string[][];repair:{drop:string[];weight:number}|null;conflictSemantics?:CollectiveConflicts;acceptance:{attackSemantics?:'legacy-co-membership-only';attacks:unknown[];credulous:string[];skeptical:string[];defeated:string[]};renderedClaims:RenderedClaim[];engineState:string}
export interface StoppedAnalysis {format:'wmt.analysis/1';status:'unknown';complete:false;stopReason:string;message:string;positions:[];conflicts:[];repair:null}
export type Analysis = CompleteAnalysis | StoppedAnalysis;
export interface RenderedClaim {id:string;source:string;render:string;back:string;weight:number;active:boolean;defeasible:boolean}
export interface PdfDocument {format:'wmt.pdf-document/1';fileName:string;sha256:string;byteSize:number;pageCount:number;pages:{page:number;text:string;textHash:string}[];extraction:{engine:string;policy:string;status:'text_extracted'|'ocr_required';imageOnlyPages:number[]}}
export interface SourceClaim {id:string;statement:string;kind:'definition'|'axiom'|'theorem'|'empirical'|'model'|'hypothesis'|'interpretive';epistemicGrade:'source_stated'|'derived'|'measured'|'speculative';locator:{page:number;start:number;end:number;quote:string;textHash:string};reviewState:'candidate';dependencies:string[]}
export interface Extraction {format:'wmt.claim-extraction/1';documentHash:string;policy:string;extractionStatus:'candidate_partial';claims:SourceClaim[];skipped:number;coverageNote:string}
export interface Mapping {sourceClaimId:string;formalClaimIds:string[]}
export interface ProposalInput {ir:WmtIR;mappings:Mapping[];unsupported?:{sourceClaimId:string;reason:string}[];parserId?:string}
export interface Proposal {format:'wmt.formalization/1';documentHash:string;ir:WmtIR;mappings:Mapping[];unsupported:{sourceClaimId:string;reason:string}[];parserId:string;digest:string}
export interface Review {format:'wmt.formalization-review/1';actorId:string;proposalDigest:string;sourceClaimIds:string[];ir:WmtIR;irDigest:string;reviewedAt:string;boundary:string}
export interface Proof {format:'wmt.computational-proof/1';id:string;kind:string;binding:{documentHash:string;proposalDigest:string;irDigest:string;claimIds:string[]}|null;evidence:Record<string,Json>;assets:{fileName:string;mediaType:string;base64:string;sha256:string}[]}
export interface ProofResult {status:'not_checked'|'checked'|'failed'|'unsupported';reason:string;stopReason?:string;inputDigest?:string;targetDigest?:string;targetClaimId?:string;premiseClaimIds?:string[];requestDigest?:string;complete?:boolean;candidatePremiseIds?:string[];minimality?:'inclusion';necessity?:{removedClaimId:string;without:'not_entailed'}[];runtime?:RuntimeManifest;profile?:string;limits?:Limits}
export interface ProofReceipt {format:'wmt.proof-receipt/1';id:string;proofId:string;proofDigest:string;binding:Proof['binding'];checker:{id:string;revision:string|null}|null;result:ProofResult;boundary:string;checkedAt:string|null}
export interface Submission {format:'wmt.paper-submission/1';id:string;title:string;authors:string[];rfcRef:string|null;publicationRef:string|null;documentHash:string;document:PdfDocument;extraction:Extraction;source:{fileName:string;mediaType:'application/pdf';sha256:string;base64:string};proposal:Proposal|null;review:Review|null;proofs:Proof[];proofReceipts:ProofReceipt[];createdAt:string}
export interface BucketRef {id:string;version:number;digest:string}
export interface Bucket extends BucketRef {format:'wmt.bucket/1';name:string;scope:'personal'|'rfc';owner:string;rfcRef:string|null;parent:BucketRef|null;ir:WmtIR;provenance:Record<string,unknown>;createdAt:string}
export interface BucketReceipt {consistency?:ConsistencyResult;format:'wmt.bucket-receipt/1';id:string;actorId:string;bucket:BucketRef;submissionId:string;documentHash:string;proposalDigest:string;reviewDigest:string;inputDigest:string;logicProfile:string;budgets:Limits;analysis:Analysis;operationDigest:string;outcome:'inserted'|'unchanged'|'conflict'|'stopped';before:BucketRef;after:BucketRef;addedClaimIds:string[];inputIR:WmtIR;boundary:string;createdAt:string}
export interface BucketWorkspace {extensionReceipts?:BucketExtensionsReceipt[];format:'wmt.bucket-workspace/1';heads:BucketRef[];versions:Bucket[];receipts:BucketReceipt[]}
export interface BucketOptions {id:string;name:string;owner:string;scope?:'personal'|'rfc';rfcRef?:string|null;ir?:WmtIR;parent?:BucketRef|null;signal?:AbortSignal}
export interface SubmitOptions extends OperationOptions {enumeratePositions?:boolean;expectedVersion:number;expectedDigest:string;actorId:string;submission:Submission;idempotencyKey:string}
export interface ForkOptions {receiptId:string;keepIds:string[];newId:string;name:string;actorId:string;expectedVersion:number;expectedDigest:string}
export interface Vocabulary {sort:string;classes:Record<string,string>;entities:Record<string,string>}
export type Formalizer = ((claim:SourceClaim,currentVocabulary:WmtIR)=>Promise<WmtIR>) & {parserId?:string};
export interface ClaimSpan {page:number;start:number;end:number;kind?:SourceClaim['kind'];epistemicGrade?:SourceClaim['epistemicGrade']}
export interface ClaimExtractor {id:string;select(document:PdfDocument):Promise<ClaimSpan[]>}
export interface EntailmentEvidence {targetClaimId:string;premiseClaimIds:string[]}
export interface CollectiveConflicts {format:'wmt.collective-conflicts/1';groups:string[][];collectiveAttacks:{from:string[];to:string}[];boundary:string}
export interface WitnessEvidence {targetClaimId:string;candidatePremiseIds?:string[]}
export interface WitnessComplete extends ProofResult {format:'wmt.explanation-witness/1';status:'checked'|'failed';complete:true;stopReason:'completed';inputDigest:string;targetDigest:string;targetClaimId:string;candidatePremiseIds:string[];requestDigest:string;premiseClaimIds:string[];limits:Limits;steps:number;runtime:RuntimeManifest}
export interface UnsupportedReasoning {format:'wmt.explanation-witness/1'|'wmt.defeasible-analysis/1';status:'unsupported';complete:false;stopReason:string;reason:string}
export type WitnessAnalysis = WitnessComplete | UnsupportedReasoning;
export interface DefaultsRequest {defaultClaimIds:string[];targetClaimId?:string;policy?:typeof DEFEASIBLE_POLICY}
export interface DefaultsBase {format:'wmt.defeasible-analysis/1';complete:true;stopReason:'completed';inputDigest:string;requestDigest:string;policy:typeof DEFEASIBLE_POLICY;defaultClaimIds:string[];strictClaimIds:string[];targetClaimId:string|null;limits:Limits;steps:number;runtime:RuntimeManifest;boundary:string;reason:string;acceptedClaimIds:string[];overridden:{claimId:string;conflict:string[]}[];specificity:[string,string][];order:string[];trace:{claimId:string;decision:'retained'|'overridden';conflict?:string[]}[]}
export interface SelectedDefaults extends DefaultsBase {status:'selected';specificityEligibility:{claimId:string;status:'logical_antecedent'|'priority_only'|'impossible_antecedent';reason?:string}[];conclusion:{claimId:string;targetDigest:string;status:'supported_in_selected_subtheory'|'refuted_in_selected_subtheory'|'undetermined'}|null}
export interface InconsistentDefaults extends DefaultsBase {status:'strict_inconsistent'}
export type DefaultsAnalysis = SelectedDefaults | InconsistentDefaults | UnsupportedReasoning;
export interface PaperReasoningReceipt {format:'wmt.paper-reasoning/1';id:string;binding:{documentHash:string;proposalDigest:string;irDigest:string};request:DefaultsRequest;result:DefaultsAnalysis|StoppedAnalysis;boundary:string;checkedAt:string}
export const DEFEASIBLE_POLICY:'wmt.strict-specificity-greedy/1';
export function collectiveConflicts(groups:string[][]):CollectiveConflicts;
export interface ConsistencyCheck {format:'wmt.consistency/1';status:'consistent'|'inconsistent';complete:true;stopReason:'completed';inputDigest:string;profile:string;limits:Limits;steps:number;runtime:RuntimeManifest;renderedClaims:RenderedClaim[];engineState:string}
export type ConsistencyResult = ConsistencyCheck | (Omit<StoppedAnalysis,'format'>&{format:'wmt.consistency/1'});
export const EXTENSIONS_POLICY:'wmt.named-normal-extensions/1';
export interface GroundEntity {name:string;sort:string}
export interface ExtensionsRequest {defaultClaimIds:string[];targetClaimId?:string|null;entities?:GroundEntity[];policy?:typeof EXTENSIONS_POLICY}
export interface NormalizedExtensionsRequest {defaultClaimIds:string[];targetClaimId:string|null;entities:GroundEntity[];policy:typeof EXTENSIONS_POLICY}
export interface GroundInstance {renderedConclusion?:string|null;id:string;sourceClaimId:string;source:string;bindings:{variable:string;sort:string;entity:string}[];weight:number;prerequisite:Formula;conclusion:Formula}
export interface DefaultExtension {id:string;appliedInstanceIds:string[];blockedInstanceIds:string[];notTriggeredInstanceIds:string[];consequentClaimIds:string[];derivation:{instanceId:string;prerequisiteFrom:string[]}[];blockingConflicts:{instanceId:string;conflict:string[]}[];conclusion:{claimId:string;targetDigest:string;status:'supported'|'refuted'|'undetermined'}|null;inputIR:WmtIR;irDigest:string;preferred:boolean}
export interface ExtensionConclusion {supportedIn:string[];refutedIn:string[];undeterminedIn:string[];skepticallySupported:boolean;credulouslySupported:boolean}
export interface CompleteExtensions {format:'wmt.default-extensions/1';status:'enumerated'|'strict_inconsistent';complete:true;stopReason:'completed';policy:typeof EXTENSIONS_POLICY;request:NormalizedExtensionsRequest;inputDigest:string;requestDigest:string;limits:Limits;steps:number;states:number;runtime:RuntimeManifest;grounding:{scope:'named_entities_only';entities:GroundEntity[];strictClaimIds:string[];instances:GroundInstance[]};extensions:DefaultExtension[];preferredExtensionIds:string[];specificity:[string,string][];priorityStrata:string[][];conclusion:{all:ExtensionConclusion|null;preferred:ExtensionConclusion|null}|null;boundary:string;reason:string}
export interface StoppedExtensions {format:'wmt.default-extensions/1';status:'unsupported';complete:false;stopReason:string;reason:string;extensions:[];preferredExtensionIds:[]}
export type ExtensionsAnalysis=CompleteExtensions|StoppedExtensions|StoppedAnalysis;
export interface BucketExtensionsReceipt {format:'wmt.bucket-extensions/1';id:string;before:BucketRef;actorId:string;sourceBinding:{submissionId:string;documentHash:string;proposalDigest:string;reviewDigest:string}|null;inputIR:WmtIR;request:NormalizedExtensionsRequest;result:ExtensionsAnalysis;budgets:Limits;createdAt:string;boundary:string}
export interface EnumerateBucketDefaults extends OperationOptions {expectedVersion:number;expectedDigest:string;actorId:string;submission?:Submission;candidateIR?:WmtIR;request:ExtensionsRequest}
export interface AdoptExtensionOptions extends OperationOptions {receiptId:string;extensionId:string;newId:string;name:string;actorId:string;expectedVersion:number;expectedDigest:string}
export function normalizeExtensionsRequest(ir:WmtIR,request:ExtensionsRequest):NormalizedExtensionsRequest;
export function prepareGroundDefaults(ir:WmtIR,request:ExtensionsRequest):{normalized:NormalizedExtensionsRequest;background:WmtIR;instances:GroundInstance[];materialize(ids:string[]):WmtIR};
export interface WorkerClient {consistency(ir:WmtIR,options?:OperationOptions):Promise<ConsistencyResult>;extensions(ir:WmtIR,request:ExtensionsRequest,options?:OperationOptions):Promise<ExtensionsAnalysis>;request(action:string,payload:unknown,options?:OperationOptions):Promise<unknown>;witness(ir:WmtIR,evidence:WitnessEvidence,options?:OperationOptions):Promise<WitnessAnalysis|StoppedAnalysis>;defeasible(ir:WmtIR,request:DefaultsRequest,options?:OperationOptions):Promise<DefaultsAnalysis|StoppedAnalysis>;analyze(ir:WmtIR,options?:OperationOptions):Promise<Analysis>;extract(bytes:ArrayBuffer|Uint8Array,fileName?:string,options?:OperationOptions):Promise<PdfDocument|StoppedAnalysis>;entailment(ir:WmtIR,evidence:EntailmentEvidence,options?:OperationOptions):Promise<ProofResult|StoppedAnalysis>}
export interface Verifier {id:string;revision:string;verify(proof:Proof,ir:WmtIR,options:OperationOptions):Promise<ProofResult&{inputDigest:string}>}
export class ContractError extends Error {code:string;constructor(message:string,code?:string)}
export function requireThat(ok:unknown,message:string,code?:string):asserts ok;
export function isObject(value:unknown):value is Record<string,unknown>;
export function closed(value:unknown,keys:string[],where:string):void;
export function canonical(value:unknown):string;
export function sha256(bytes:ArrayBuffer|Uint8Array):Promise<string>;
export function digest(domain:string,value:unknown):Promise<string>;
export function clone<T>(value:T):T;
export function text(value:unknown,label:string,max?:number):string;
export function isoNow():string;
export const EMPTY_IR:WmtIR;
export const LOGIC_PROFILE:'wmt.strict-many-sorted-fol/1';
export const EXTRACTION_POLICY:'wmt.pdf-text-sentences/1';
export const DEFAULT_LIMITS:Limits;
export const DEMO_VOCABULARY:Vocabulary;
export function limitsFor(input?:Partial<Limits>):Limits;
export function validateIR(ir:WmtIR,limits?:{maxClaims?:number}):WmtIR;
export function mergeIR(left:WmtIR,right:WmtIR):WmtIR;
export function stopped(reason:string,message?:string):StoppedAnalysis;
export function checkedSolverReply(value:unknown):string;
export function createWorkerClient(spawn:()=>unknown):WorkerClient;
export function createAnalysisRunner(options:{createEngine:()=>unknown;evaluate:(script:string)=>Promise<string>;runtime:RuntimeManifest}):{analyze(ir:WmtIR,limits?:Partial<Limits>):Promise<Analysis>;entailment(ir:WmtIR,evidence:EntailmentEvidence,limits?:Partial<Limits>):Promise<ProofResult>;witness(ir:WmtIR,evidence:WitnessEvidence,limits?:Partial<Limits>):Promise<WitnessAnalysis>;defeasible(ir:WmtIR,request:DefaultsRequest,limits?:Partial<Limits>):Promise<DefaultsAnalysis>;consistency(ir:WmtIR,limits?:Partial<Limits>):Promise<ConsistencyResult>;extensions(ir:WmtIR,request:ExtensionsRequest,limits?:Partial<Limits>):Promise<ExtensionsAnalysis>};
export function lowLevelEvaluator(z3:unknown):(script:string)=>Promise<string>;
export function renderIR(createEngine:()=>unknown,ir:WmtIR):{claims:RenderedClaim[];[key:string]:unknown};
export function extractPdf(bytes:ArrayBuffer|Uint8Array,options?:{pdfjs?:unknown;worker?:unknown;standardFontDataUrl?:string;fileName?:string;maxBytes?:number;maxPages?:number;maxText?:number}):Promise<PdfDocument>;
export function extractClaims(document:PdfDocument,options?:{maxCandidates?:number;policy?:string;selectCandidates?:(document:PdfDocument)=>Promise<ClaimSpan[]>}):Promise<Extraction>;
export function controlledParser(vocabulary?:Vocabulary):Formalizer;
export function formalizeClaims(extraction:Extraction,options?:{parse?:Formalizer;parserId?:string;vocabularyIR?:WmtIR}):Promise<Proposal>;
export function makeProposal(extraction:Extraction,input:ProposalInput):Promise<Proposal>;
export function reviewProposal(proposal:Proposal,extraction:Extraction,review:{actorId:string;sourceClaimIds:string[]}):Promise<Review>;
export function encodeBase64(bytes:Uint8Array):string;
export function decodeBase64(value:string,maxBytes?:number):Uint8Array;
export function createSubmission(input:{bytes:ArrayBuffer|Uint8Array;fileName?:string;title:string;authors:string[];rfcRef?:string|null;publicationRef?:string|null;proofs?:Proof[]},client:WorkerClient,options?:OperationOptions&{claimExtractor?:ClaimExtractor}):Promise<Submission>;
export function formalizeSubmission(submission:Submission,options?:ProposalInput|{parse?:Formalizer;parserId?:string;vocabularyIR?:WmtIR}):Promise<Submission>;
export function reviewSubmission(submission:Submission,review:{actorId:string;sourceClaimIds:string[]}):Promise<Submission>;
export function restoreSubmission(saved:Submission,client:WorkerClient,options?:OperationOptions&{claimExtractor?:ClaimExtractor}):Promise<Submission>;
export function validateProof(proof:Proof):Promise<Proof>;
export function makeEntailmentProof(submission:Submission,evidence:EntailmentEvidence&{id:string}):Promise<Proof>;
export function makeWitnessProof(submission:Submission,evidence:WitnessEvidence&{id:string}):Promise<Proof>;
export function analyzeSubmissionDefaults(submission:Submission,request:DefaultsRequest,client:WorkerClient,options?:OperationOptions):Promise<PaperReasoningReceipt>;
export function checkProof(proof:Proof,submission:Submission,client:WorkerClient,options?:OperationOptions&{verifiers?:Map<string,Verifier>}):Promise<ProofReceipt>;
export function verifySubmissionProofs(submission:Submission,client:WorkerClient,options?:OperationOptions&{verifiers?:Map<string,Verifier>}):Promise<Submission>;
export function createBucket(options:BucketOptions&{client?:WorkerClient}):Promise<Bucket>;
export function validateBucket(bucket:Bucket):Promise<Bucket>;
export function submitToBucket(options:Omit<SubmitOptions,'idempotencyKey'>&{bucket:Bucket;client:WorkerClient}):Promise<{bucket:Bucket;receipt:BucketReceipt}>;
export function compareBuckets(left:Bucket,right:Bucket):{left:BucketRef;right:BucketRef;onlyLeft:string[];onlyRight:string[];changed:string[]};
export class BucketRepository {constructor(client:WorkerClient);extensionReceipt(id:string):BucketExtensionsReceipt;enumerateDefaults(id:string,options:EnumerateBucketDefaults):Promise<BucketExtensionsReceipt>;forkExtension(id:string,options:AdoptExtensionOptions):Promise<Bucket>;list():Bucket[];get(id:string,version?:number):Bucket;receipt(id:string):BucketReceipt;export():BucketWorkspace;restore(workspace:BucketWorkspace,options?:{signal?:AbortSignal}):Promise<Bucket[]>;create(options:BucketOptions):Promise<Bucket>;submit(id:string,options:SubmitOptions):Promise<{bucket:Bucket;receipt:BucketReceipt}>;fork(id:string,options:ForkOptions):Promise<Bucket>}
export function formalizerPrompt(candidate:SourceClaim,ir:WmtIR):string;
export function createModelFormalizer(options:{id:string;completeJSON(input:{prompt:string;candidate:SourceClaim;vocabulary:WmtIR}):Promise<{status:'draft';ir:WmtIR}|{status:'unsupported';reason:string}>}):Formalizer;
export interface CastaliaClaimSetProjection {schemaVersion:'castalia.publication-claim-set.v1';id:string;revision:string;publicationRevision:string;extractionStatus:'candidate_partial'|'reviewed_partial';coverageNote:string;claims:{id:string;statement:string;kind:SourceClaim['kind'];epistemicGrade:SourceClaim['epistemicGrade'];sourceLocator:{pages:string;section:string};reviewState:'candidate'|'confirmed';formalizationStatus:'drafted'|'unformalized';dependencies:string[]}[];createdAt:string}
export interface CastaliaAnalysisProjection {schemaVersion:'castalia.paper-analysis-semantic.v1';id:string;targetId:string;snapshotId:string;engine:string;engineRevision:string;limits:string[];status:'exhausted'|'counterexample_found'|'unsupported'|'error';stopReason:string;conclusionBoundary:string;createdAt:string}
export function toCastaliaClaimSet(submission:Submission,options:{id:string;revision:string;publicationRevision:string;claimIdMap:Record<string,string>}):CastaliaClaimSetProjection;
export function toCastaliaAnalysis(receipt:BucketReceipt,options:{id:string;targetId:string;snapshotId:string}):CastaliaAnalysisProjection;
export function exportSidecar(submission:Submission,options?:{bucketReceipts?:BucketReceipt[];buckets?:Bucket[];extensionReceipts?:BucketExtensionsReceipt[]}):{format:'wmt.paper-sidecar/1';delivery:'local_not_published';submission:Submission;extensionReceipts:BucketExtensionsReceipt[];bucketReceipts:BucketReceipt[];buckets:Bucket[];boundary:string};

export function createModelClaimSelector(options:{completeJSON(input:{prompt:string;document:PdfDocument}):Promise<{claims:{page:number;quote:string;kind?:SourceClaim["kind"];epistemicGrade?:SourceClaim["epistemicGrade"]}[]}>}):(document:PdfDocument)=>Promise<ClaimSpan[]>;

export * from "./proof-candidates.mjs";
export * from './definition-review.mjs';
