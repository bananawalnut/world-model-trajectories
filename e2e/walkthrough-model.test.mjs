import test from 'node:test';
import assert from 'node:assert/strict';
import {PASSAGES,formulaNodes,formulaText,sourceRanges} from '../site/papers/walkthrough-model.mjs';
test('walkthrough proof roles point to explicit premise annotations, and ambiguity stays separate',()=>{
  const keys=new Set(PASSAGES.map(p=>p.key));assert.equal(keys.size,7);
  for(const p of PASSAGES)for(const key of p.premises??[])assert(keys.has(key)&&key!==p.key);
  assert.deepEqual(PASSAGES.find(p=>p.key==='T1').premises,['A2','O1']);
  assert(PASSAGES.filter(p=>p.key.startsWith('U')).every(p=>!p.premises));
});
test('formula inspection exposes actual quantifier, implication, predicates and bound terms',()=>{
  const x={t:'var',name:'x'},p=name=>({op:'pred',name,args:[x]});
  const f={op:'forall',vars:[{name:'x',sort:'Thing'}],body:{op:'imp',a:p('Penguin'),b:{op:'not',x:p('Flies')}}};
  assert.equal(formulaText(f),'∀ x:Thing. (Penguin(x) → ¬Flies(x))');
  assert.deepEqual(formulaNodes(f).map(n=>n.kind),['forall','imp','pred','var','not','pred','var']);
  assert.equal(formulaNodes(f).at(-1).path,'formula.body.b.x.args[0]');
});
test('PDF highlight ranges reproduce the SDK whitespace policy before binding a quote',()=>{
  const a={str:'  Prefix',hasEOL:true},b={str:'Tweety is'},c={str:'a bird.',hasEOL:true};
  const r=sourceRanges([a,b,c]);assert.equal(r.text,'Prefix\nTweety is a bird.');
  assert.equal(r.text.slice(r.ranges[1].start,r.ranges[2].end),'Tweety is a bird.');
});
