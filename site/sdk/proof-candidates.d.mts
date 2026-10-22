import type {PdfDocument,Extraction,ClaimSpan,SourceClaim} from './index.mjs';
export type CandidateRole='schema'|'definition'|'notation'|'axiom'|'assumption'|'hypothesis'|'conjecture'|'statement'|'proposition'|'lemma'|'theorem'|'corollary'|'proof_step'|'observation'|'example'|'construction'|'case'|'goal'|'algorithm'|'question';
export type ScopeType='paper'|'section'|'local'|'bound'|'unresolved';
export interface CandidateFeedback {disposition:'unreviewed'|'looks_right'|'needs_change'|'not_candidate';role:CandidateRole|null;scopeType:ScopeType|null;scopeLabel:string;interpretationId:string|null;note:string}
export interface CandidateInterpretation {id:string;label:string;description:string;requires:string[]}
export interface CandidateEntry {candidateId:string;sourceOrder:number;classification:{role:CandidateRole;label:string|null;basis:string;status:'suggested'};scope:{type:'local'|'unresolved';label:string;basis:string;parentCandidateId:string|null;contextCandidateId:string|null};declarations:{symbol:string;kind:string;extent:string}[];ambiguities:{code:string;message:string}[];interpretations:CandidateInterpretation[];relations:{kind:string;label:string;targetCandidateId:string|null;status:string}[];feedback:CandidateFeedback}
export interface CandidateReview {format:'wmt.candidate-review/1';documentHash:string;extractionDigest:string;policy:string;entries:CandidateEntry[];revision:number;boundary:string;digest:string}
export const PROOF_CANDIDATE_POLICY:'wmt.proof-candidates/1';
export const CANDIDATE_ROLES:CandidateRole[];
export const ROLE_GROUPS:{id:string;label:string;roles:CandidateRole[]}[];
export function selectProofSpans(document:PdfDocument):Promise<ClaimSpan[]>;
export function extractProofCandidates(document:PdfDocument):Promise<Extraction>;
export function buildCandidateReview(document:PdfDocument,extraction:Extraction):Promise<CandidateReview>;
export function normalityInterpretations(statement:string):CandidateInterpretation[];
export function validateCandidateReview(review:CandidateReview,document:PdfDocument,extraction:Extraction):Promise<CandidateReview>;
export function updateCandidateFeedback(review:CandidateReview,candidateId:string,patch:Partial<CandidateFeedback>):Promise<CandidateReview>;
export function effectiveCandidateRole(entry:CandidateEntry):CandidateRole;
export function candidateGroups(review:CandidateReview,options?:{order?:'review'|'paper'|'related'}):{id:string;label:string;entries:CandidateEntry[]}[];
