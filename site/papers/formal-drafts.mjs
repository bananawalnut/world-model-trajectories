import {validateIR} from '../sdk/ir.mjs';
import {closed,requireThat,clone} from '../sdk/hash.mjs';

// Review drafts are deliberately outside submissions, evidence receipts and buckets.
export const DRAFT_FORMAT='wmt.paper-formal-drafts/1';
export const draftStorageKey=r=>'wmt.formal-drafts.v1.'+r.documentHash+'.'+r.extractionDigest;
export function logicalName(label,candidate){
 const s=String(label??'').replace(/\\(?:text|operatorname|mathrm|mathcal)\{([^}]+)\}/g,'$1').replace(/\\[A-Za-z]+/g,'').replace(/[^A-Za-z0-9_]/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'').slice(0,55);
 return 'Paper_'+(s||candidate.id.replace(/^c_/,''));
}
export function primitiveDraft(candidate,{label,definition=false}={}){
 const name=logicalName(label,candidate),gloss=candidate.statement.slice(0,10000);
 return definition?{sorts:['PaperMeaning'],preds:[],funcs:[{name,args:[],ret:'PaperMeaning',gloss}],claims:[]}:
  {sorts:[],preds:[{name,args:[],gloss}],funcs:[],claims:[]};
}
export function predicateDefinitionDraft(candidate,{sort='Entity',predicate='Accepted',primitive='MeetsCriterion'}={}){
 const x={t:'var',name:'x'};
 return validateIR({sorts:[sort],preds:[{name:predicate,args:[sort]},{name:primitive,args:[sort],gloss:'Uninterpreted primitive selected explicitly by the reviewer.'}],funcs:[],claims:[{id:'c_definition',source:candidate.statement,formula:{op:'forall',vars:[{name:'x',sort}],body:{op:'iff',a:{op:'pred',name:predicate,args:[x]},b:{op:'pred',name:primitive,args:[x]}}}}]});
}
export function assumePrimitive(ir,candidate){
 validateIR(ir);requireThat(ir.claims.length===0&&ir.preds.length===1&&ir.preds[0].args.length===0,'An opaque assumption needs exactly one proposition and no existing claims.');
 const next=clone(ir);next.claims.push({id:candidate.id,source:candidate.statement,formula:{op:'pred',name:ir.preds[0].name,args:[]}});return validateIR(next);
}
export function emptyDrafts(review){return {format:DRAFT_FORMAT,documentHash:review.documentHash,extractionDigest:review.extractionDigest,drafts:[]};}
export function validateDrafts(bundle,review,extraction){
 closed(bundle,['format','documentHash','extractionDigest','drafts'],'formal drafts');
 requireThat(bundle.format===DRAFT_FORMAT&&bundle.documentHash===review.documentHash&&bundle.extractionDigest===review.extractionDigest,'Formal drafts do not match this exact source and extraction.');
 requireThat(Array.isArray(bundle.drafts)&&bundle.drafts.length<=extraction.claims.length,'Invalid formal draft count.');
 requireThat(JSON.stringify(bundle).length<=4000000,'Formal draft bundle exceeds the review budget.');
 const ids=new Set(),claims=new Map(extraction.claims.map(c=>[c.id,c]));
 for(const d of bundle.drafts){closed(d,['candidateId','source','ir'],'formal draft');requireThat(claims.has(d.candidateId)&&!ids.has(d.candidateId)&&claims.get(d.candidateId).statement===d.source,'Formal draft source differs from its recorded passage.');ids.add(d.candidateId);validateIR(d.ir);}
 return bundle;
}
const sym=s=>'\\mathrm{'+s.replaceAll('_','\\_')+'}';
const par=s=>'\\left('+s+'\\right)';
function term(t){
 if(t.t==='var')return sym(t.name);
 if(t.t==='int')return t.v<0?par(String(t.v)):String(t.v);
 if(t.t==='real'){const m=t.v.match(/^\(\/ (-?\d+) ([1-9]\d*)\)$/);return m?'\\frac{'+m[1]+'}{'+m[2]+'}':t.v;}
 if(t.t==='app')return sym(t.name)+(t.args?.length?par(t.args.map(term).join(',\\,')):'');
 const xs=t.args.map(term);return par(t.op==='-'&&xs.length===1?'-'+xs[0]:xs.join(t.op==='*'?'\\cdot ':t.op));
}
function formula(f){
 if(f.op==='pred')return sym(f.name)+(f.args?.length?par(f.args.map(term).join(',\\,')):'');
 if(f.op==='eq'||f.op==='cmp')return par(term(f.a)+({eq:'=', '<':'<','<=':'\\le ', '>':'>','>=':'\\ge '}[f.op==='eq'?'eq':f.rel])+term(f.b));
 if(f.op==='not')return '\\neg '+par(formula(f.x));
 if(f.op==='and'||f.op==='or')return f.xs.length?par(f.xs.map(formula).join(f.op==='and'?'\\land ':'\\lor ')):(f.op==='and'?'\\top':'\\bot');
 if(f.op==='imp'||f.op==='iff')return par(formula(f.a)+(f.op==='imp'?'\\Rightarrow ':'\\Leftrightarrow ')+formula(f.b));
 return (f.op==='forall'?'\\forall ':'\\exists ')+f.vars.map(v=>sym(v.name)+':'+sym(v.sort)).join(',\\,')+'\\;'+par(formula(f.body));
}
// Every accepted strict-IR node is rendered; validation precedes recursion.
export function draftMath(ir){
 validateIR(ir);const lines=[];
 for(const sort of ir.sorts)lines.push(sym(sort)+'\\;\\text{ is a sort}');
 for(const s of [...ir.funcs,...ir.preds.map(p=>({...p,ret:'Bool'}))])lines.push(sym(s.name)+':'+(s.args.length?s.args.map(sym).join('\\times ')+'\\to ':'')+sym(s.ret));
 for(const c of ir.claims)lines.push(formula(c.formula));
 return lines;
}
