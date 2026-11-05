import type {WmtIR,SourceClaim,Extraction} from '../sdk/index.mjs';
export interface DraftBinding {documentHash:string;extractionDigest:string}
export interface FormalDraft {candidateId:string;source:string;ir:WmtIR}
export interface FormalDraftBundle extends DraftBinding {format:'wmt.paper-formal-drafts/1';drafts:FormalDraft[]}
export const DRAFT_FORMAT:'wmt.paper-formal-drafts/1';
export function draftStorageKey(binding:DraftBinding):string;
export function logicalName(label:string|undefined,candidate:SourceClaim):string;
export function primitiveDraft(candidate:SourceClaim,options?:{label?:string;definition?:boolean}):WmtIR;
export function predicateDefinitionDraft(candidate:SourceClaim,options?:{sort?:string;predicate?:string;primitive?:string}):WmtIR;
export function assumePrimitive(ir:WmtIR,candidate:SourceClaim):WmtIR;
export function emptyDrafts(binding:DraftBinding):FormalDraftBundle;
export function validateDrafts(bundle:FormalDraftBundle,binding:DraftBinding,extraction:Extraction):FormalDraftBundle;
export function draftMath(ir:WmtIR):string[];
