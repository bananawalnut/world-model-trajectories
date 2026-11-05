import {requireThat,closed,clone,digest,canonical} from './hash.mjs';
import {extractClaims} from './pdf.mjs';

export const PROOF_CANDIDATE_POLICY='wmt.proof-candidates/1';
export const CANDIDATE_ROLES=['schema','definition','notation','axiom','assumption','hypothesis','conjecture','statement','proposition','lemma','theorem','corollary','proof_step','observation','example','construction','case','goal','algorithm','question'];
export const ROLE_GROUPS=[
  {id:'definitions',label:'Definitions, schemas and notation',roles:['schema','definition','notation']},
  {id:'premises',label:'Axioms, assumptions and hypotheses',roles:['axiom','assumption','hypothesis','conjecture']},
  {id:'results',label:'Statements and results',roles:['statement','proposition','lemma','theorem','corollary','observation']},
  {id:'proof',label:'Proof steps, constructions and questions',roles:['proof_step','example','construction','case','goal','algorithm','question']}
];
const named=/^\s*(schema|definition|notation|axiom|assumption|hypothesis|conjecture|statement|proposition|lemma|theorem|corollary|proof|construction|case|goal|algorithm)\b\s*(\d+(?:\.\d+)*|[A-Z]\d*)?\s*[.:]?\s*/i;
const declaration=/\\(?:coloneqq|eqqcolon|triangleq|overset)|:=|\b(?:let|define|defined as|denote|denotes|represents|we can say an observer is value aligned)\b/i;
const mathStart=s=>/^\s*(?:\$|\\|[|∀∃]|[A-Za-z][\w{}'_]*\s*(?:=|:=))/.test(s);
const clean=s=>s.replace(/^\s*\*+/,'').trim();
const norm=s=>s.replace(/\s+/g,' ').trim();
function lineRecords(page){let offset=0;return page.text.split('\n').map(value=>{const start=offset;offset+=value.length+1;return {value,start,end:start+value.length};});}
function isFurniture(s){return /^LOCAL WMT TEST\s*\/|^Source [0-9a-f]{16} · draft interpretations|^\d+$/.test(s);}
// Keep exact page slices: join wrapped prose for segmentation without changing offsets.
function pageBlocks(page){
  const lines=lineRecords(page),blocks=[];let current=null;
  const flush=()=>{if(current){blocks.push(current);current=null;}};
  for(const line of lines){const v=line.value.trim();if(!v||isFurniture(v)){flush();continue;}
    const kind=mathStart(v)?'math':named.test(v)?'named':/^(?:let\b|then\b|by\b|proof\b|now lets|now let|.*base case|.*inductive step|\*?thought experiment)/i.test(v)?'boundary':'prose';
    const previous=current?clean(page.text.slice(current.start,current.end)):'';
    const starts=kind==='named'||kind==='boundary'||kind==='math'&&(current?.kind!=='math'||/^\s*(?:\\forall|\\text\{Let|\\operatorname|\\mathcal[^\n]*(?:coloneqq|eqqcolon))/.test(v))||kind==='prose'&&current?.kind==='math'||current&&/[.!?]\s*$/.test(previous);
    if(starts&&!/\bLet\s*$|\\text\{Let\s*\}\s*$/i.test(previous))flush();
    if(!current)current={page:page.page,start:line.start+line.value.indexOf(v),end:line.end,kind};else {current.end=line.end;if(kind==='math')current.kind='math';}
  }flush();return blocks;
}
function trimSpan(page,start,end){while(start<end&&/\s/.test(page.text[start]))start++;while(end>start&&/\s/.test(page.text[end-1]))end--;return {page:page.page,start,end};}
function roleFor(statement){
 const s=clean(statement),m=s.match(named);
 // A name such as "Definition" alone is a heading, not evidence the following prose is proved.
 if(m){const role=m[1].toLowerCase();return {role:role==='proof'?'proof_step':role,label:m[2]?m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()+' '+m[2]:null,basis:'source label'};}
 if(/\?$/.test(s))return {role:'question',label:null,basis:'question form'};
 if(/\b(?:schema|interface)\b.*\b(?:fields?|attributes?|properties|type)\b/i.test(s))return {role:'schema',label:null,basis:'schema/interface wording'};
 if(declaration.test(s)||/:(?!:)\s*(?:\n|\s)*(?:\\mathcal|\\to)|\\operatorname\{experience\}.*:/s.test(s))return {role:/^let\b/i.test(s)&&!/\\(?:coloneqq|eqqcolon)|\bdefine/i.test(s)?'notation':'definition',label:null,basis:'declaration wording or notation'};
 if(/\b(?:assume|suppose|given that|under the assumption)\b/i.test(s))return {role:'assumption',label:null,basis:'assumption cue'};
 if(/\b(?:hypothes|conjectur|i posit|we posit)/i.test(s))return {role:'hypothesis',label:null,basis:'hypothesis cue'};
 if(/\b(?:measured|observed|experiment found|data show)/i.test(s))return {role:'observation',label:null,basis:'observation cue'};
 if(/^(?:then|therefore|thus|hence|it follows|by\s+\w)/i.test(s))return {role:'proof_step',label:null,basis:'inference cue'};
 if(/\b(?:thought experiment|for example|consider the case)\b/i.test(s))return {role:'example',label:null,basis:'example cue'};
 return {role:'statement',label:null,basis:'unclassified statement; reviewer may refine'};
}
const legacyKind=role=>['definition','notation','schema'].includes(role)?'definition':['lemma','theorem','corollary','proposition'].includes(role)?'theorem':['axiom','assumption'].includes(role)?'axiom':['hypothesis','conjecture'].includes(role)?'hypothesis':role==='observation'?'empirical':role==='question'?'interpretive':'model';
function eligible(s){return s.length>=4 && (/\\|\$|:=|∀|∃/.test(s)||named.test(clean(s))||/\b(?:is|are|was|were|has|have|must|can|cannot|implies|requires|assume|define|let|denote|represents|claim|hypothes|posit|show|find|found|observed|measured|normally|usually|typically|therefore|then)\b/i.test(s));}
export async function selectProofSpans(document){
 requireThat(document?.format==='wmt.pdf-document/1','Expected extracted PDF document.');
 const out=[];const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
 for(const page of document.pages)for(const block of pageBlocks(page)){
   const value=page.text.slice(block.start,block.end);
   // Labeled results and formula/declaration blocks stay whole, including their labels.
   const whole=block.kind==='named'||block.kind==='math'||declaration.test(value);
   let spans=whole?[{index:0,segment:value}]:[...segmenter.segment(value.replaceAll('\n',' '))];
   for(const segment of spans){const span=trimSpan(page,block.start+segment.index,block.start+segment.index+segment.segment.length),statement=page.text.slice(span.start,span.end);if(!eligible(statement))continue;
     if(statement.length>4000)continue;
     out.push({...span,kind:legacyKind(roleFor(statement).role),epistemicGrade:'source_stated'});
   }
 }
 // Additional exact declaration spans within named results retain their containing result in review.
 for(const page of document.pages)for(const block of pageBlocks(page)){
   if(block.kind!=='named')continue;const value=page.text.slice(block.start,block.end);
   const pattern=/\b(?:Let|let|Define|define|denote)\s+[^.!?\n]+[.!?]?/g;
   for(const m of value.matchAll(pattern)){const span=trimSpan(page,block.start+m.index,block.start+m.index+m[0].length);if(span.start>block.start&&span.end-span.start<=4000)out.push({...span,kind:'definition',epistemicGrade:'source_stated'});}
 }
 const unique=[...new Map(out.map(s=>[`${s.page}:${s.start}:${s.end}`,s])).values()].sort((a,b)=>a.page-b.page||a.start-b.start||b.end-a.end);
 return unique.slice(0,256);
}
export async function extractProofCandidates(document){
 return extractClaims(document,{policy:PROOF_CANDIDATE_POLICY,selectCandidates:selectProofSpans});
}
export function normalityInterpretations(statement){
 if(!/\b(normally|typically|usually|generally)\b/i.test(statement.replace(/\bmore\s+generally\b/gi,'')))return [];
 return [
  {id:'default',label:'Defeasible rule',description:'A rule with exceptions. Requires a defeasible reasoning profile; supplies no fixed frequency threshold.',requires:['exception/default policy','reference context']},
  {id:'existential',label:'Some instances',description:'An explicitly chosen weaker rewrite, e.g. some birds fly. Not automatically entailed by the ambiguous source wording.',requires:['class and property bindings','nonempty witness claim']},
  {id:'statistical',label:'Statistical prevalence or expectation',description:'Specify population, measure, time/context and threshold. For a binary flight indicator its expectation is the flight proportion under the chosen measure; “normally” does not choose that threshold.',requires:['reference population','sampling/weighting measure','time/context','threshold or target expectation']},
  {id:'normal-context',label:'Normal cases or conditions',description:'Define which cases/conditions count as normal; then state the property within that restricted context.',requires:['normality predicate/selection rule','domain and context']}
 ];
}
function ambiguities(statement){const out=[];
 if(normalityInterpretations(statement).length)out.push({code:'normality',message:'“Normally” needs an explicit interpretation; default, existence, prevalence and normal conditions are different readings.'});
 if(/\d+(?:\.\d+)?\s*%/.test(statement))out.push({code:'statistical-context',message:'An explicit percentage still needs its population/denominator, context and measure; preserve the stated threshold.'});
 if(/\b(?:it|this|that|they)\b/i.test(statement))out.push({code:'reference',message:'Possible contextual reference; confirm its referent rather than assuming a symbol binding.'});
 if(/\b(?:must|need not|should|ought|necessarily)\b/i.test(statement))out.push({code:'modality',message:'Modal or normative force needs semantics; it is not automatically a strict FOL implication.'});
 if(/\b(?:if so|assuming|under the assumption)\b/i.test(statement))out.push({code:'conditional-context',message:'This passage depends on a preceding condition or assumption; confirm its scope and antecedent.'});
 if(/\\(?:lim|Pr)\b|\b(?:over time|converg)/i.test(statement))out.push({code:'time-probability',message:'Time, probability or convergence requires a model and scope.'});
 if(/\\forall|∀|\b(?:all|every|each)\b/i.test(statement))out.push({code:'domain',message:'Confirm the quantifier domain and any local restrictions.'});
 return out;
}
function declarations(statement){
 const found=[],seen=new Set();
 const add=(symbol,kind='defined')=>{symbol=symbol.trim();if(symbol&&!seen.has(symbol)&&symbol.length<=160){seen.add(symbol);found.push({symbol,kind,extent:kind==='bound in expression'?'expression only':'unresolved'});}};
 const raw=statement.replace(/\$/g,'').replace(/\\(?:;|,|quad|qquad)\s*/g,' ');
 const atom=String.raw`(?:\\(?:mathcal|operatorname|text)\s*\{[^}]+\}|[A-Za-z][A-Za-z0-9]*)(?:_\{[^}]+\}|_[A-Za-z])?(?:\([^)]*\))?`;
 for(const m of raw.matchAll(new RegExp(`(${atom})\\s*(?:\\\\(?:coloneqq|eqqcolon|triangleq)|:=)`,'g')))add(m[1]);
 for(const m of raw.matchAll(new RegExp(`(${atom})\\s*:(?![=:])`,'g')))if(/\\|_|\(/.test(m[1]))add(m[1],'function/type declaration');
 const assignment=raw.match(new RegExp(`^\\s*(?:Let\\s+)?(${atom})\\s*(?:=(?!=)|\\\\equiv)`,'i'));if(assignment)add(assignment[1]);
 for(const m of raw.matchAll(/\b(?:let|define|denote)\s+([A-Za-z][\w']*)\b/gi))if(!['each','all','some','the','there','us','current','a','an'].includes(m[1].toLowerCase()))add(m[1]);
 for(const m of statement.matchAll(/(?:\\forall|\\exists|[∀∃])\s*([A-Za-z][\w]*)/g))add(m[1],'bound in expression');
 return found;
}
export async function buildCandidateReview(document,extraction){
 requireThat(document?.format==='wmt.pdf-document/1'&&extraction?.format==='wmt.claim-extraction/1'&&extraction.documentHash===document.sha256,'Candidate review needs matching source/extraction.');
 const entries=[],ordered=[...extraction.claims].sort((a,b)=>a.locator.page-b.locator.page||a.locator.start-b.locator.start||b.locator.end-a.locator.end);
 for(const [index,c] of ordered.entries()){
  const page=document.pages.find(p=>p.page===c.locator.page);requireThat(page&&page.textHash===c.locator.textHash&&page.text.slice(c.locator.start,c.locator.end)===c.statement&&c.locator.quote===c.statement,'Candidate locator no longer matches the source.','binding_mismatch');
  const classification=roleFor(c.statement),context=ordered.filter(other=>other.id!==c.id&&['lemma','theorem','corollary','proposition','proof_step'].includes(roleFor(other.statement).role)&&named.test(clean(other.statement))&&(other.locator.page<c.locator.page||other.locator.page===c.locator.page&&other.locator.start<c.locator.start)).at(-1),enclosing=ordered.find(other=>other.id!==c.id&&other.locator.page===c.locator.page&&other.locator.start<=c.locator.start&&other.locator.end>=c.locator.end&&named.test(clean(other.statement)));
  entries.push({candidateId:c.id,sourceOrder:index+1,classification:{...classification,status:'suggested'},scope:{type:enclosing?'local':'unresolved',label:enclosing?roleFor(enclosing.statement).label??'Containing source result':context?'After '+(roleFor(context.statement).label??'a proof/result')+'; boundary unresolved':'Extent not established',basis:enclosing?'contained in named source span':'Source position alone does not establish global scope.',parentCandidateId:enclosing?.id??null,contextCandidateId:context?.id??null},declarations:declarations(c.statement),ambiguities:ambiguities(c.statement),interpretations:normalityInterpretations(c.statement),relations:[],feedback:{disposition:'unreviewed',role:null,scopeType:null,scopeLabel:'',interpretationId:null,note:''}});
 }
 for(const entry of entries){const c=extraction.claims.find(c=>c.id===entry.candidateId);
  for(const m of c.statement.matchAll(/\b(?:by\s+)?(A\d+|(?:Lemma|Theorem|Corollary|Definition|Proposition)\s+\d+(?:\.\d+)*)\b/gi)){
    const label=norm(m[1]),target=entries.find(e=>e.classification.label?.toLowerCase()===label.toLowerCase());
    if(target?.candidateId!==entry.candidateId)entry.relations.push({kind:'source reference',label,targetCandidateId:target?.candidateId??null,status:target?'candidate link; verify':'unresolved reference'});if(!target)entry.ambiguities.push({code:'unresolved-reference',message:'Source reference '+label+' has no matching labeled candidate; identify the intended premise.'});
  }
 }
 const payload={format:'wmt.candidate-review/1',documentHash:document.sha256,extractionDigest:await digest('candidate-extraction',extraction),policy:extraction.policy,entries,revision:0,boundary:'Candidate roles, scope and interpretations are review annotations. They do not confirm formalizations, prove statements or change buckets.'};
 return {...payload,digest:await digest('candidate-review',payload)};
}
export async function validateCandidateReview(review,document,extraction){
 closed(review,['format','documentHash','extractionDigest','policy','entries','revision','boundary','digest'],'candidate review');
 const fresh=await buildCandidateReview(document,extraction);
 requireThat(review.format===fresh.format&&review.documentHash===fresh.documentHash&&review.extractionDigest===fresh.extractionDigest&&review.policy===fresh.policy&&review.boundary===fresh.boundary,'Feedback belongs to another extraction/source revision.','binding_mismatch');
 requireThat(Number.isSafeInteger(review.revision)&&review.revision>=0&&Array.isArray(review.entries)&&review.entries.length===fresh.entries.length,'Invalid candidate review revision or entry count.');
 for(const [i,e] of review.entries.entries()){
  const {feedback,...annotation}=e,{feedback:_,...original}=fresh.entries[i];requireThat(canonical(annotation)===canonical(original),'Candidate annotations were changed outside feedback.');
  validateFeedback(feedback,e);
 }
 const {digest:expected,...payload}=review;requireThat(expected===await digest('candidate-review',payload),'Candidate review checksum mismatch.','binding_mismatch');return review;
}
function validateFeedback(f,entry){
 closed(f,['disposition','role','scopeType','scopeLabel','interpretationId','note'],'candidate feedback');
 requireThat(['unreviewed','looks_right','needs_change','not_candidate'].includes(f.disposition),'Invalid review disposition.');
 requireThat(f.role===null||CANDIDATE_ROLES.includes(f.role),'Invalid candidate role.');
 requireThat(f.scopeType===null||['paper','section','local','bound','unresolved'].includes(f.scopeType),'Invalid candidate scope.');
 requireThat(typeof f.scopeLabel==='string'&&f.scopeLabel.length<=300&&typeof f.note==='string'&&f.note.length<=4000,'Feedback text exceeds its limit.');
 requireThat(f.interpretationId===null||entry.interpretations.some(i=>i.id===f.interpretationId),'Invalid interpretation choice.');
}
export async function updateCandidateFeedback(review,candidateId,patch){
 requireThat(review?.format==='wmt.candidate-review/1','Expected candidate review.');closed(patch,['disposition','role','scopeType','scopeLabel','interpretationId','note'],'feedback patch');
 const {digest:previous,...payload}=review;requireThat(previous===await digest('candidate-review',payload),'Candidate review checksum mismatch.','binding_mismatch');
 const next=clone(review),entry=next.entries.find(e=>e.candidateId===candidateId);requireThat(entry,'Unknown candidate.');entry.feedback={...entry.feedback,...patch};validateFeedback(entry.feedback,entry);
 next.revision++;delete next.digest;next.digest=await digest('candidate-review',next);return next;
}
export function effectiveCandidateRole(entry){return entry.feedback.role??entry.classification.role;}
export function candidateGroups(review,{order='review'}={}){
 requireThat(['review','paper','related'].includes(order),'Unknown candidate order.');
 const entries=[...review.entries];
 if(order==='paper')return [{id:'paper',label:'Source order',entries:entries.sort((a,b)=>a.sourceOrder-b.sourceOrder)}];
 if(order==='related')return entries.filter(e=>e.classification.label||entries.some(x=>x.scope.parentCandidateId===e.candidateId)).map(e=>({id:e.candidateId,label:e.classification.label??'Containing source passage #'+e.sourceOrder,entries:[e,...entries.filter(x=>x.candidateId!==e.candidateId&&(x.scope.parentCandidateId===e.candidateId||x.relations.some(r=>r.targetCandidateId===e.candidateId)))]})).concat([{id:'unlinked',label:'Not linked to a named result',entries:entries.filter(e=>!e.classification.label&&!e.scope.parentCandidateId&&!e.relations.some(r=>r.targetCandidateId))}]);
 return ROLE_GROUPS.map(g=>({...g,entries:entries.filter(e=>g.roles.includes(effectiveCandidateRole(e))).sort((a,b)=>a.sourceOrder-b.sourceOrder)}));
}
