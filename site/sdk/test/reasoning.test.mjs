import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {client,demoPaper} from './helpers.mjs';
import {createAnalysisRunner,clone,DEFEASIBLE_POLICY,makeWitnessProof,checkProof} from '../index.mjs';
const atom=name=>({op:'pred',name,args:[]}),not=x=>({op:'not',x}),imp=(a,b)=>({op:'imp',a,b});
const ir=(claims,names=['P','Q','R'])=>({sorts:[],preds:names.map(name=>({name,args:[]})),funcs:[],claims:Object.entries(claims).map(([id,formula])=>({id,source:id,formula}))});
const trio=()=>ir({p:atom('P'),q:atom('Q'),n:not({op:'and',xs:[atom('P'),atom('Q')]})});
function penguins(){const v={t:'var',name:'x'},pred=name=>({op:'pred',name,args:[v]}),all=f=>({op:'forall',vars:[{name:'x',sort:'Animal'}],body:f}),t={t:'app',name:'tweety',args:[]};return {sorts:['Animal'],preds:['Bird','Penguin','Fly'].map(name=>({name,args:['Animal']})),funcs:[{name:'tweety',args:[],ret:'Animal'}],claims:[
 {id:'taxonomy',source:'Penguins are birds',formula:all(imp(pred('Penguin'),pred('Bird')))},
 {id:'fact',source:'Tweety is a penguin',formula:{op:'pred',name:'Penguin',args:[t]}},
 {id:'birds',source:'Birds normally fly',weight:100,formula:all(imp(pred('Bird'),pred('Fly')))},
 {id:'penguins',source:'Penguins normally do not fly',weight:1,formula:all(imp(pred('Penguin'),not(pred('Fly'))))},
 {id:'target',source:'Tweety flies',formula:{op:'pred',name:'Fly',args:[t]}}
]};}
test('a three-way MUS stays collective; every pair is SAT and MSS acceptance is not binary Dung acceptance',async()=>{
 const input=trio(),a=await client.analyze(input);assert(a.complete);assert.equal(a.status,'inconsistent');assert.equal(a.conflicts.length,1);assert.deepEqual(new Set(a.conflicts[0]),new Set(['p','q','n']));assert.equal(a.positions.length,3);assert(a.positions.every(p=>p.keep.length===2));assert.equal(a.conflictSemantics.collectiveAttacks.length,3);assert(a.conflictSemantics.collectiveAttacks.every(a=>a.from.length===2));assert.equal(a.acceptance.attackSemantics,'legacy-co-membership-only');
 for(const drop of input.claims){const pair={...input,claims:input.claims.filter(c=>c!==drop)};assert.equal((await client.analyze(pair)).status,'consistent');}
});
test('the Rust witness finder discovers minimal support, excludes the target, and supports empty tautology witnesses',async()=>{
 const input=ir({p:atom('P'),pq:imp(atom('P'),atom('Q')),noise:atom('R'),target:atom('Q')});
 const w=await client.witness(input,{targetClaimId:'target'});assert.equal(w.status,'checked',JSON.stringify(w));assert.deepEqual(new Set(w.premiseClaimIds),new Set(['p','pq']));assert.equal(w.necessity.length,2);assert.equal(w.minimality,'inclusion');assert.equal(w.complete,true);
 const fail=await client.witness(input,{targetClaimId:'target',candidatePremiseIds:['noise']});assert.equal(fail.status,'failed');
 const circular=await client.witness(input,{targetClaimId:'target',candidatePremiseIds:['target']});assert.equal(circular.complete,false);
 const taut=await client.witness(ir({p:atom('P'),target:{op:'eq',a:{t:'int',v:1},b:{t:'int',v:1}}}),{targetClaimId:'target'});assert.equal(taut.status,'checked');assert.deepEqual(taut.premiseClaimIds,[]);
});
test('witnesses refuse vacuity, stop on budgets/cancellation, and bind source/formula/pool through proof receipts',async()=>{
 const input=ir({p:atom('P'),np:not(atom('P')),target:atom('Q')});assert.equal((await client.witness(input,{targetClaimId:'target'})).status,'failed');
 assert.equal((await client.witness(input,{targetClaimId:'target'},{limits:{maxSteps:1}})).status,'failed');
 const c=new AbortController();c.abort();assert.equal((await client.witness(input,{targetClaimId:'target'},{signal:c.signal})).stopReason,'cancelled');
 const paper=await demoPaper(),ids=paper.review.ir.claims.map(c=>c.id),proof=await makeWitnessProof(paper,{id:'auto',targetClaimId:ids[3],candidatePremiseIds:[ids[0],ids[2]]});
 const receipt=await checkProof(proof,paper,client);assert.equal(receipt.result.status,'checked');assert.deepEqual(new Set(receipt.result.premiseClaimIds),new Set([ids[0],ids[2]]));const wrong=clone(proof);wrong.binding.irDigest='0'.repeat(64);assert.equal((await checkProof(wrong,paper,client)).result.status,'not_checked');
});
test('strict specificity defeats a higher-weight general default and retains exact rejection witnesses',async()=>{
 const input=penguins(),r=await client.defeasible(input,{defaultClaimIds:['birds','penguins'],targetClaimId:'target'});assert.equal(r.status,'selected',JSON.stringify(r));assert.equal(r.policy,DEFEASIBLE_POLICY);assert.deepEqual(r.specificity,[['penguins','birds']]);assert.deepEqual(r.order,['penguins','birds']);assert.equal(r.conclusion.status,'refuted_in_selected_subtheory');assert.deepEqual(new Set(r.overridden[0].conflict),new Set(['taxonomy','fact','penguins','birds']));
 assert.equal((await client.analyze(input)).status,'inconsistent');assert.equal(input.claims[2].defeasible,undefined);
 const strict=await client.defeasible(input,{defaultClaimIds:[],targetClaimId:'target'});assert.equal(strict.status,'strict_inconsistent');
 const reversed=await client.defeasible(input,{defaultClaimIds:['penguins','birds'],targetClaimId:'target'});assert.deepEqual(reversed.acceptedClaimIds,r.acceptedClaimIds);
});
test('equivalent antecedents use priorities rather than false specificity; incomparable sorts and impossible antecedents stay explicit',async()=>{
 const input=penguins();input.claims.find(c=>c.id==='taxonomy').formula={op:'forall',vars:[{name:'x',sort:'Animal'}],body:{op:'iff',a:{op:'pred',name:'Bird',args:[{t:'var',name:'x'}]},b:{op:'pred',name:'Penguin',args:[{t:'var',name:'x'}]}}};
 let r=await client.defeasible(input,{defaultClaimIds:['birds','penguins'],targetClaimId:'target'});assert.equal(r.status,'selected',JSON.stringify(r));assert.deepEqual(r.specificity,[]);assert.equal(r.order[0],'birds');assert.equal(r.conclusion.status,'supported_in_selected_subtheory');
 const mixed=clone(input);mixed.sorts.push('Plant');mixed.preds.push({name:'Tree',args:['Plant']});mixed.claims.push({id:'tree_default',source:'Trees are trees',formula:{op:'forall',vars:[{name:'tree',sort:'Plant'}],body:imp({op:'pred',name:'Tree',args:[{t:'var',name:'tree'}]},{op:'pred',name:'Tree',args:[{t:'var',name:'tree'}]})}});
 r=await client.defeasible(mixed,{defaultClaimIds:['birds','penguins','tree_default'],targetClaimId:'target'});assert.equal(r.status,'selected',JSON.stringify(r));assert.deepEqual(r.specificity,[]);
 const impossible=ir({rule:imp(atom('P'),atom('Q')),np:not(atom('P')),target:atom('Q')});r=await client.defeasible(impossible,{defaultClaimIds:['rule'],targetClaimId:'target'});assert.equal(r.specificityEligibility[0].status,'impossible_antecedent');assert.equal(r.conclusion.status,'undetermined');
 const stopped=await client.defeasible(input,{defaultClaimIds:['birds','penguins'],targetClaimId:'target'},{limits:{maxSteps:1}});assert.equal(stopped.complete,false);assert.equal(stopped.acceptedClaimIds,undefined);
});
test('unknown or invalid solver replies never become a selected default set or a checked witness',async()=>{
 const {default:init,WmtEngine}=await import('../runtime/wmt_core.js');await init({module_or_path:await readFile(new URL('../runtime/wmt_core_bg.wasm',import.meta.url))});
 for(const output of ['unknown','sat\n(error "sort mismatch")']){const r=createAnalysisRunner({createEngine:()=>new WmtEngine(),evaluate:async()=>output,runtime:{}});assert.equal((await r.witness(trio(),{targetClaimId:'n'})).complete,false);assert.equal((await r.defeasible(trio(),{defaultClaimIds:['n']})).complete,false);}
});
test('specificity handles conjunctions, alpha-renamed binders, fresh names and priority-only defaults',async()=>{
 const input=JSON.parse(JSON.stringify(penguins())),bird=input.claims.find(c=>c.id==='birds'),penguin=input.claims.find(c=>c.id==='penguins');
 bird.formula.vars[0].name='wmt_specificity_0';bird.formula.body.a.args[0].name='wmt_specificity_0';bird.formula.body.b.args[0].name='wmt_specificity_0';
 penguin.formula.body.a={op:'and',xs:[penguin.formula.body.a,{op:'pred',name:'Bird',args:[{t:'var',name:'x'}]}]};
 let r=await client.defeasible(input,{defaultClaimIds:['birds','penguins'],targetClaimId:'target'});assert.equal(r.status,'selected',JSON.stringify(r));assert.deepEqual(r.specificity,[['penguins','birds']]);
 const ties=ir({a:atom('P'),b:not(atom('P')),target:atom('Q')});r=await client.defeasible(ties,{defaultClaimIds:['b','a'],targetClaimId:'target'});assert.deepEqual(r.order,['a','b']);assert(r.specificityEligibility.every(e=>e.status==='priority_only'));assert.deepEqual(r.overridden[0].conflict,['a','b']);
 const self=await client.defeasible(ties,{defaultClaimIds:['target'],targetClaimId:'target'});assert.equal(self.complete,false);
 const limited=await client.witness(ir({p:atom('P'),target:atom('P')}),{targetClaimId:'target'},{limits:{maxSteps:1}});assert.equal(limited.complete,false);assert.equal(limited.stopReason,'step_budget');
});
