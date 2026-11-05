export const PASSAGES=[
  {key:'A1',role:'Axiom',page:1,quote:'All penguins are birds.',note:'An assumed universal inclusion. The checker does not prove an axiom.'},
  {key:'A2',role:'Axiom',page:1,quote:'No penguins are fliers.',note:'An assumed universal exclusion, interpreted strictly.'},
  {key:'O1',role:'Observation',page:1,quote:'Tweety is a penguin.',note:'An input fact. Coherence cannot establish its empirical truth.'},
  {key:'L1',role:'Lemma',page:2,quote:'Tweety is a bird.',premises:['A1','O1'],note:'A source-stated lemma. Its exact conclusion will be checked from A1 and O1.'},
  {key:'T1',role:'Theorem',page:2,quote:'Tweety is not a flier.',premises:['A2','O1'],note:'A source-stated theorem. Its exact conclusion will be checked from A2 and O1.'},
  {key:'U1',role:'Ambiguous generalization',page:2,quote:'Birds are normally fliers.',note:'“Normally” does not specify a strict universal. A default or statistical reading needs another logic/profile.'},
  {key:'U2',role:'Ambiguous reference',page:2,quote:'It is a flier.',note:'The pronoun has no confirmed entity binding. It must not silently become tweety.'},
];
export const STEPS=[['Inspect','Read the actual PDF'],['Extract','Find source-located candidates'],['Formalize','Inspect primitives and composition'],['Resolve','Review meaning and ambiguity'],['Prove','Check named premises and conclusions'],['Bucket','Form models and compare alternatives'],['Take away','Export the paper and its evidence']];
export function passageCandidates(paper) {
  return PASSAGES.map(p=>({...p,candidate:paper.extraction.claims.find(c=>c.statement===p.quote && c.locator.page===p.page)}));
}
export function formulaText(f) {
  if(f.t==='var')return f.name;
  if(f.t==='app')return f.args?.length?`${f.name}(${f.args.map(formulaText).join(', ')})`:f.name;
  if(f.t==='int'||f.t==='real')return String(f.v);
  if(f.op==='pred')return `${f.name}(${(f.args??[]).map(formulaText).join(', ')})`;
  if(f.op==='not')return `¬${formulaText(f.x)}`;
  if(f.op==='imp')return `(${formulaText(f.a)} → ${formulaText(f.b)})`;
  if(f.op==='iff')return `(${formulaText(f.a)} ↔ ${formulaText(f.b)})`;
  if(f.op==='and'||f.op==='or')return `(${f.xs.map(formulaText).join(f.op==='and'?' ∧ ':' ∨ ')})`;
  if(f.op==='forall'||f.op==='exists')return `${f.op==='forall'?'∀':'∃'} ${f.vars.map(v=>v.name+':'+v.sort).join(', ')}. ${formulaText(f.body)}`;
  if(f.op==='eq'||f.op==='cmp')return `${formulaText(f.a)} ${f.rel??'='} ${formulaText(f.b)}`;
  return JSON.stringify(f);
}
const explanations={forall:'Universal quantifier: the body holds for every individual in the declared sort.',exists:'Existential quantifier: at least one individual satisfies the body.',imp:'Implication: if the premise holds, the conclusion must hold.',not:'Negation: the inner proposition does not hold.',pred:'Predicate application: apply a declared relation to typed arguments; the result is Bool.',app:'Function application. With zero arguments this names a constant individual.',var:'Bound variable: its sort comes from the enclosing quantifier.',and:'Conjunction: all component propositions hold.',or:'Disjunction: at least one component proposition holds.'};
export function formulaNodes(formula) {
  const nodes=[];
  function visit(value,path,depth) {
    if(!value || typeof value!=='object')return;
    if(value.op||value.t)nodes.push({path,depth,kind:value.op??value.t,text:formulaText(value),explanation:explanations[value.op??value.t]??'Typed term or formula in the WMT intermediate representation.'});
    for(const [key,child] of Object.entries(value))if(Array.isArray(child))child.forEach((v,i)=>visit(v,path+'.'+key+'['+i+']',depth+1));else if(child && typeof child==='object')visit(child,path+'.'+key,depth+1);
  }
  visit(formula,'formula',0);return nodes;
}
export function sourceRanges(items) {
  let text='';const ranges=[];
  for(const item of items)if(typeof item.str==='string') {
    if(text && !/\s$/.test(text) && item.str && !/^\s/.test(item.str))text+=' ';
    const start=text.length;text+=item.str;ranges.push({start,end:text.length,item});if(item.hasEOL)text+='\n';
  }
  const leading=text.length-text.trimStart().length;
  return {text:text.trim(),ranges:ranges.map(r=>({...r,start:r.start-leading,end:r.end-leading}))};
}
