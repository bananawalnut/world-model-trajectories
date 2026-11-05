import type {PdfDocument,Extraction} from './index.mjs';
import type {CandidateEntry} from './proof-candidates.mjs';
export const DEFINITION_REVIEW_POLICY:'wmt.definition-identity/1';
export type DefinitionOccurrenceKind='definition'|'introduction'|'application'|'reference';
export interface DefinitionForm {notation:string;index:string|null;arguments:string[];kind:'application_pattern'|'indexed_symbol'|'symbol'}
export interface DefinitionOccurrence {id:string;candidateId:string;sourceOrder:number;baseKey:string;identityKey:string;symbol:string;kind:DefinitionOccurrenceKind;form:DefinitionForm;scope:CandidateEntry['scope'];locator:{page:number;start:number;end:number;textHash:string;quote:string}}
export interface DefinitionConcept {id:string;label:string;occurrenceIds:string[];primaryDefinitionId:string|null;note:string;organization:'suggested'|'reviewer_organized'}
export interface DefinitionReview {format:'wmt.definition-review/1';policy:typeof DEFINITION_REVIEW_POLICY;documentHash:string;extractionDigest:string;occurrences:DefinitionOccurrence[];concepts:DefinitionConcept[];kindOverrides:{occurrenceId:string;kind:DefinitionOccurrenceKind}[];revision:number;boundary:string;digest:string}
export interface DefinitionConceptView extends DefinitionConcept {occurrences:(DefinitionOccurrence&{effectiveKind:DefinitionOccurrenceKind})[];declarations:(DefinitionOccurrence&{effectiveKind:DefinitionOccurrenceKind})[];introductions:(DefinitionOccurrence&{effectiveKind:DefinitionOccurrenceKind})[];uses:(DefinitionOccurrence&{effectiveKind:DefinitionOccurrenceKind})[];forms:(DefinitionForm&{declaredBy:string[];usedIn:string[]})[];sourceOrder:number}
export function buildDefinitionReview(document:PdfDocument,extraction:Extraction):Promise<DefinitionReview>;
export function validateDefinitionReview(review:DefinitionReview,document:PdfDocument,extraction:Extraction):Promise<DefinitionReview>;
export function definitionConcepts(review:DefinitionReview):DefinitionConceptView[];
export function effectiveOccurrenceKind(review:DefinitionReview,occurrence:DefinitionOccurrence):DefinitionOccurrenceKind;
export function mergeDefinitionConcepts(review:DefinitionReview,input:{conceptIds:string[];label?:string;note?:string}):Promise<DefinitionReview>;
export function updateDefinitionConcept(review:DefinitionReview,conceptId:string,patch:Partial<Pick<DefinitionConcept,'label'|'primaryDefinitionId'|'note'>>):Promise<DefinitionReview>;
export function moveDefinitionOccurrence(review:DefinitionReview,input:{occurrenceId:string;conceptId:string;kind?:DefinitionOccurrenceKind}):Promise<DefinitionReview>;
export function separateDefinitionOccurrences(review:DefinitionReview,input:{conceptId:string;occurrenceIds:string[];label:string}):Promise<DefinitionReview>;
export function restoreDefinitionOrganization(review:DefinitionReview,snapshot:DefinitionReview):Promise<DefinitionReview>;
