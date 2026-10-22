import {closed,requireThat,canonical,clone,digest} from './hash.mjs';
import {buildCandidateReview} from './proof-candidates.mjs';
export const DEFINITION_REVIEW_POLICY='wmt.definition-identity/1';
const kinds=['definition','introduction','application','reference'];
const unwrap=s=>s.replace(/\\(?:operatorname|textbf|text|mathrm|mathit)\s*\{([^{}]+)\}/g,'$1').trim();
const baseOf=s=>{
 const plain=unwrap(s).replace(/\$/g,'').trim();
 const styled=plain.match(/^\\(mathcal|mathbb|mathfrak)\s*\{([^}]+)\}/);if(styled)return {key:styled[1]+':'+styled[2],label:'\\'+styled[1]+'{'+styled[2]+'}',head:styled[2],styled:true};
 const m=plain.match(/^([A-Za-z][A-Za-z0-9]*)/);if(!m)return null;
 // Natural-language names can differ in capitalization. Single-letter symbols
 // remain case-sensitive, as do different mathematical alphabets (O, o, 𝒪).
 return {key:m[1].length>1?m[1].toLowerCase():m[1],label:m[1],head:m[1],styled:false};
};
function formOf(symbol){
 const s=unwrap(symbol),index=s.match(/_(?:\{([^}]+)\}|([A-Za-z0-9]+))/),call=s.match(/(?<!\s)\(([^()]*)\)/);
 return {notation:s,index:index?.[1]??index?.[2]??null,arguments:call?call[1].split(',').map(a=>a.trim()).filter(Boolean):[],kind:call?'application_pattern':index?'indexed_symbol':'symbol'};
}
const declarationScope=e=>['lemma','theorem','corollary','proposition','proof_step'].includes(e.classification.role)&&e.classification.label?{...clone(e.scope),type:'local',label:e.classification.label,parentCandidateId:e.candidateId,basis:'Declaration or use inside a labeled result.'}:clone(e.scope);
const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function exactSymbolSpan(statement,symbol){const at=statement.indexOf(symbol);return at<0?null:{start:at,end:at+symbol.length};}
const checkedLabel=value=>{requireThat(typeof value==='string' && value.trim().length>0 && value.length<=160,'A concept label needs 1–160 characters.');return value.trim();};
async function seal(review){delete review.digest;review.digest=await digest('definition-review',review);return review;}
export async function buildDefinitionReview(document,extraction){
 const annotations=await buildCandidateReview(document,extraction),claims=new Map(extraction.claims.map(c=>[c.id,c])),seeds=new Map(),occurrences=[];
 function add(c,e,symbol,kind,span,form,base){
  if(!span || span.end<=span.start)return;
  const key=[c.id,span.start,span.end,kind,base.identityKey??base.key].join(':');if(occurrences.some(o=>o.key===key))return;
  const id='occurrence_'+occurrences.length,quote=c.statement.slice(span.start,span.end);
  occurrences.push({id,key,candidateId:c.id,sourceOrder:e.sourceOrder,baseKey:base.key,identityKey:base.identityKey??base.key,symbol,kind,form,
   scope:declarationScope(e),locator:{page:c.locator.page,start:c.locator.start+span.start,end:c.locator.start+span.end,textHash:c.locator.textHash,quote}});
 }
 for(const e of annotations.entries){const c=claims.get(e.candidateId);
  for(const d of e.declarations.filter(d=>d.kind!=='bound in expression')){
   const base=baseOf(d.symbol);if(!base)continue;
   const scope=declarationScope(e);base.identityKey=base.key+(scope.type==='local'?'|local:'+scope.parentCandidateId:'|unresolved');
   if(!seeds.has(base.identityKey))seeds.set(base.identityKey,{...base,scopeParent:scope.type==='local'?scope.parentCandidateId:null,spellings:[]});const seed=seeds.get(base.identityKey);if(!seed.spellings.includes(base.head))seed.spellings.push(base.head);
   const span=exactSymbolSpan(c.statement,d.symbol),operator=/\\(?:coloneqq|eqqcolon|triangleq)|:=/.test(c.statement);
   add(c,e,d.symbol,!operator&&/\b(?:let.?s?\s+)?define\s+.+\bas\s+(?:such|follows)\s*:?$/i.test(c.statement.trim())?'introduction':'definition',span,formOf(d.symbol),base);
  }
 }
 // Find source uses only for declared heads. Full spans and exact offsets are
 // retained. These are suggested lexical links, not a type/equality proof.
 for(const e of annotations.entries){const c=claims.get(e.candidateId);
  for(const seed of seeds.values()){
   const local=declarationScope(e).parentCandidateId;
   if(seed.scopeParent!==null && seed.scopeParent!==local)continue;
   if(seed.scopeParent===null && [...seeds.values()].some(s=>s.key===seed.key&&s.scopeParent!==null&&s.scopeParent===local))continue;
   let pattern;
   if(seed.styled)pattern=new RegExp('\\\\'+seed.key.split(':')[0]+'\\s*\\{'+escapeRegExp(seed.head)+'\\}','g');
   else pattern=new RegExp('(?<![A-Za-z0-9_\\\\])(?:\\\\(?:operatorname|textbf|text|mathrm|mathit)\\s*\\{'+escapeRegExp(seed.head)+'\\}|'+escapeRegExp(seed.head)+')(?![A-Za-z0-9])'+String.raw`(?:_(?:\{[^}]+\}|[A-Za-z0-9]+))?(?:\s*\([^()\n]*\))?`,seed.head.length>1?'gi':'g');
   for(const m of c.statement.matchAll(pattern)){
    const start=m.index,end=start+m[0].length;
    // A declaration occurrence already records its expression form, rather
    // than also counting the LHS as a separate application statement.
    if(occurrences.some(o=>o.candidateId===c.id && o.identityKey===seed.identityKey && o.kind!=='reference' && o.kind!=='application' && start>=o.locator.start-c.locator.start && end<=o.locator.end-c.locator.start))continue;
    const form=formOf(m[0]);add(c,e,m[0],form.arguments.length?'application':'reference',{start,end},form,seed);
   }
  }
 }
 occurrences.sort((a,b)=>a.sourceOrder-b.sourceOrder||a.locator.start-b.locator.start||a.id.localeCompare(b.id));
 // Stable IDs depend on source locations and spelling, not enumeration order.
 for(const o of occurrences){o.id='occurrence_'+(await digest('definition-occurrence',o.key)).slice(0,24);delete o.key;}
 const concepts=[];
 for(const [key,seed] of seeds){const all=occurrences.filter(o=>o.identityKey===key);if(!all.length)continue;
  const declarations=all.filter(o=>o.kind==='definition');
  const preferred=seed.head.length>1?seed.spellings.find(s=>s[0]===s[0].toUpperCase())??seed.head:seed.label;
  concepts.push({id:'concept_'+(await digest('definition-concept',{documentHash:document.sha256,key})).slice(0,24),label:seed.styled?seed.label:preferred,occurrenceIds:all.map(o=>o.id),primaryDefinitionId:declarations.length===1?declarations[0].id:null,note:'',organization:'suggested'});
 }
 return seal({format:'wmt.definition-review/1',policy:DEFINITION_REVIEW_POLICY,documentHash:document.sha256,extractionDigest:await digest('candidate-extraction',extraction),occurrences,concepts,kindOverrides:[],revision:0,boundary:'Concept organization links source occurrences; it does not assert equality between distinct function signatures, extend scope, change source claims, or accept formalizations into a bucket.'});
}
export function effectiveOccurrenceKind(review,occurrence){return review.kindOverrides.find(k=>k.occurrenceId===occurrence.id)?.kind??occurrence.kind;}
function validateOrganization(review){
 requireThat(review.format==='wmt.definition-review/1' && review.policy===DEFINITION_REVIEW_POLICY && Number.isSafeInteger(review.revision)&&review.revision>=0,'Invalid definition review.');
 requireThat(Array.isArray(review.concepts) && review.concepts.length<=review.occurrences.length && Array.isArray(review.kindOverrides) && review.kindOverrides.length<=review.occurrences.length,'Invalid concept partition.');
 const ids=new Set(review.occurrences.map(o=>o.id)),assigned=new Set(),conceptIds=new Set(),overrides=new Set();
 for(const k of review.kindOverrides){closed(k,['occurrenceId','kind'],'occurrence kind override');requireThat(ids.has(k.occurrenceId)&&!overrides.has(k.occurrenceId)&&kinds.includes(k.kind),'Invalid occurrence kind override.');overrides.add(k.occurrenceId);}
 for(const c of review.concepts){closed(c,['id','label','occurrenceIds','primaryDefinitionId','note','organization'],'concept');requireThat(/^concept_[a-f0-9]{24}$/.test(c.id)&&!conceptIds.has(c.id),'Invalid or duplicate concept ID.');conceptIds.add(c.id);checkedLabel(c.label);
  requireThat(typeof c.note==='string'&&c.note.length<=2000 && ['suggested','reviewer_organized'].includes(c.organization),'Invalid concept feedback.');
  requireThat(Array.isArray(c.occurrenceIds)&&c.occurrenceIds.length>0,'Every concept needs a source occurrence.');
  for(const id of c.occurrenceIds){requireThat(ids.has(id)&&!assigned.has(id),'Each source occurrence must belong to exactly one concept.');assigned.add(id);}
  requireThat(c.primaryDefinitionId===null || c.occurrenceIds.includes(c.primaryDefinitionId)&&effectiveOccurrenceKind(review,review.occurrences.find(o=>o.id===c.primaryDefinitionId))==='definition','The main definition must be a defining occurrence of this concept.');
 }
 requireThat(assigned.size===ids.size,'Source occurrences cannot be removed by organization.');
}
export async function validateDefinitionReview(review,document,extraction){
 closed(review,['format','policy','documentHash','extractionDigest','occurrences','concepts','kindOverrides','revision','boundary','digest'],'definition review');
 const fresh=await buildDefinitionReview(document,extraction);
 requireThat(review.documentHash===fresh.documentHash && review.extractionDigest===fresh.extractionDigest && review.policy===fresh.policy && review.boundary===fresh.boundary,'Definition feedback belongs to another source/extraction.','binding_mismatch');
 requireThat(canonical(review.occurrences)===canonical(fresh.occurrences),'Source occurrences or scopes changed outside organization.','binding_mismatch');
 validateOrganization(review);const {digest:expected,...payload}=review;requireThat(expected===await digest('definition-review',payload),'Definition review checksum mismatch.','binding_mismatch');return review;
}
async function revise(review,change){const {digest:expected,...payload}=review;requireThat(expected===await digest('definition-review',payload),'Definition review checksum mismatch.','binding_mismatch');validateOrganization(review);const next=clone(review);await change(next);next.revision++;validateOrganization(next);return seal(next);}
export async function mergeDefinitionConcepts(review,{conceptIds,label,note}){
 return revise(review,next=>{requireThat(Array.isArray(conceptIds)&&new Set(conceptIds).size===conceptIds.length&&conceptIds.length>=2,'Choose at least two different concepts to merge.');const selected=conceptIds.map(id=>next.concepts.find(c=>c.id===id));requireThat(selected.every(Boolean),'Unknown concept.');
  const target=selected[0],sourceIds=new Set(conceptIds.slice(1));target.label=checkedLabel(label??target.label);const combinedNote=note??selected.filter(c=>c.note).map(c=>c.label+': '+c.note).join('\n\n');requireThat(typeof combinedNote==='string'&&combinedNote.length<=2000,'Merged notes exceed 2000 characters; consolidate the notes before merging.');target.note=combinedNote;target.organization='reviewer_organized';target.occurrenceIds=next.occurrences.filter(o=>selected.some(c=>c.occurrenceIds.includes(o.id))).map(o=>o.id);target.primaryDefinitionId=null;next.concepts=next.concepts.filter(c=>!sourceIds.has(c.id));});
}
export async function updateDefinitionConcept(review,conceptId,patch){
 closed(patch,['label','primaryDefinitionId','note'],'concept feedback');return revise(review,next=>{const c=next.concepts.find(c=>c.id===conceptId);requireThat(c,'Unknown concept.');Object.assign(c,clone(patch));if(patch.label!==undefined)c.label=checkedLabel(patch.label);c.organization='reviewer_organized';});
}
export async function moveDefinitionOccurrence(review,{occurrenceId,conceptId,kind}){
 return revise(review,next=>{const o=next.occurrences.find(o=>o.id===occurrenceId),target=next.concepts.find(c=>c.id===conceptId),old=next.concepts.find(c=>c.occurrenceIds.includes(occurrenceId));requireThat(o&&target&&old,'Unknown occurrence or concept.');if(kind!==undefined){requireThat(kinds.includes(kind),'Invalid occurrence kind.');next.kindOverrides=next.kindOverrides.filter(k=>k.occurrenceId!==occurrenceId).concat([{occurrenceId,kind}]);}
  if(old!==target){old.occurrenceIds=old.occurrenceIds.filter(id=>id!==occurrenceId);target.occurrenceIds.push(occurrenceId);}if(old.primaryDefinitionId===occurrenceId && (old!==target||effectiveOccurrenceKind(next,o)!=='definition'))old.primaryDefinitionId=null;old.organization=target.organization='reviewer_organized';next.concepts=next.concepts.filter(c=>c.occurrenceIds.length);});
}
export async function separateDefinitionOccurrences(review,{conceptId,occurrenceIds,label}){
 return revise(review,async next=>{const c=next.concepts.find(c=>c.id===conceptId);requireThat(c && Array.isArray(occurrenceIds)&&new Set(occurrenceIds).size===occurrenceIds.length&&occurrenceIds.length>0&&occurrenceIds.length<c.occurrenceIds.length&&occurrenceIds.every(id=>c.occurrenceIds.includes(id)),'Choose a proper nonempty subset of this concept’s occurrences.');
  const freshId='concept_'+(await digest('definition-concept-split',{parent:c.id,occurrenceIds:[...occurrenceIds].sort(),revision:next.revision+1})).slice(0,24);
  c.occurrenceIds=c.occurrenceIds.filter(id=>!occurrenceIds.includes(id));if(occurrenceIds.includes(c.primaryDefinitionId))c.primaryDefinitionId=null;c.organization='reviewer_organized';next.concepts.push({id:freshId,label:checkedLabel(label),occurrenceIds:clone(occurrenceIds),primaryDefinitionId:null,note:'',organization:'reviewer_organized'});});
}
export function definitionConcepts(review){
 validateOrganization(review);return review.concepts.map(c=>{const occurrences=review.occurrences.filter(o=>c.occurrenceIds.includes(o.id)).map(o=>({...clone(o),effectiveKind:effectiveOccurrenceKind(review,o)})),declarations=occurrences.filter(o=>o.effectiveKind==='definition'),introductions=occurrences.filter(o=>o.effectiveKind==='introduction'),uses=occurrences.filter(o=>['application','reference'].includes(o.effectiveKind));
  const forms=[...new Map(occurrences.filter(o=>['definition','application'].includes(o.effectiveKind)&&o.form.kind!=='symbol').map(o=>[canonical(o.form),{...o.form,declaredBy:declarations.filter(d=>canonical(d.form)===canonical(o.form)).map(d=>d.id),usedIn:uses.filter(u=>canonical(u.form)===canonical(o.form)).map(u=>u.id)}])).values()];
  return {...clone(c),occurrences,declarations,introductions,uses,forms,sourceOrder:Math.min(...(declarations.length||introductions.length?[...declarations,...introductions]:occurrences).map(o=>o.sourceOrder))};}).sort((a,b)=>a.sourceOrder-b.sourceOrder);
}
export async function restoreDefinitionOrganization(review,snapshot){
 const {digest:expected,...payload}=snapshot;requireThat(expected===await digest('definition-review',payload),'Undo snapshot checksum mismatch.','binding_mismatch');validateOrganization(snapshot);
 requireThat(snapshot.documentHash===review.documentHash&&snapshot.extractionDigest===review.extractionDigest&&canonical(snapshot.occurrences)===canonical(review.occurrences),'Undo belongs to another source/extraction.','binding_mismatch');
 return revise(review,next=>{next.concepts=clone(snapshot.concepts);next.kindOverrides=clone(snapshot.kindOverrides);});
}
