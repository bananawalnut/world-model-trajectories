import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syntheticReview,acceptedCandidate} from '../../papers/synthetic-review.mjs';
import {primitiveDraft,predicateDefinitionDraft,assumePrimitive,draftMath,validateDrafts,emptyDrafts} from '../../papers/formal-drafts.mjs';
import {validateIR} from '../ir.mjs';
const {extraction,review}=await syntheticReview(),c=acceptedCandidate(extraction);
test('actual Accepted source becomes an opaque paper meaning without asserting it',()=>{
 const ir=primitiveDraft(c,{definition:true,label:'Accepted'});validateIR(ir);assert.equal(ir.funcs[0].name,'Paper_Accepted');assert.equal(ir.funcs[0].gloss,c.statement);assert.equal(ir.claims.length,0);assert.deepEqual(ir.preds,[]);assert.match(draftMath(ir).join(' '),/Paper\\_Accepted/);
});
test('entity interpretation is an explicit quantified definition, not a Person/state ontology',()=>{
 const ir=predicateDefinitionDraft(c);validateIR(ir);assert.deepEqual(ir.sorts,['Entity']);assert.equal(ir.claims[0].source,c.statement);const math=draftMath(ir).join(' ');assert.match(math,/forall/);assert.match(math,/Leftrightarrow/);assert.match(math,/MeetsCriterion/);assert.doesNotMatch(JSON.stringify(ir),/Person|State/);
});
test('opaque propositions only become assumptions after an explicit operation',()=>{
 const ir=primitiveDraft(c,{label:'Accepted'});assert.equal(ir.claims.length,0);const proposed=assumePrimitive(ir,c);assert.equal(proposed.claims.length,1);assert.equal(ir.claims.length,0);assert.throws(()=>assumePrimitive(proposed,c));
});
test('formal draft imports retain exact source/extraction bindings and strict IR',()=>{
 const bundle=emptyDrafts(review);bundle.drafts.push({candidateId:c.id,source:c.statement,ir:predicateDefinitionDraft(c)});validateDrafts(bundle,review,extraction);
 for(const mutate of [b=>b.documentHash='bad',b=>b.extractionDigest='bad',b=>b.drafts[0].source='rewritten source',b=>{delete b.drafts[0].candidateId;delete b.drafts[0].source;},b=>b.drafts.push(b.drafts[0]),b=>b.drafts[0].ir.claims[0].formula.body.a.args[0].name='unbound']){const copy=structuredClone(bundle);mutate(copy);assert.throws(()=>validateDrafts(copy,review,extraction));}
 assert.throws(()=>draftMath({sorts:[],preds:[],funcs:[],claims:[{id:'c_bad',source:'bad',formula:{op:'javascript'}}]}));
});
test('math renderer covers all strict IR operators with grouping and exact rational values',()=>{
 const x={t:'var',name:'x'},n={t:'int',v:-2},real={t:'real',v:'(/ -3 2)'},app={t:'app',name:'F',args:[x]},pred={op:'pred',name:'P',args:[x]},cmp={op:'cmp',rel:'<=',a:{t:'arith',op:'-',args:[app]},b:n};
 const ir={sorts:[],preds:[{name:'P',args:['Int']}],funcs:[{name:'F',args:['Int'],ret:'Int'}],claims:[{id:'c_math',source:'fixture',formula:{op:'forall',vars:[{name:'x',sort:'Int'}],body:{op:'imp',a:{op:'not',x:pred},b:{op:'or',xs:[cmp,{op:'exists',vars:[{name:'y',sort:'Real'}],body:{op:'eq',a:{t:'arith',op:'*',args:[real,{t:'var',name:'y'}]},b:{t:'real',v:'1.5'}}},{op:'and',xs:[]},{op:'or',xs:[]}]}}}}]};
 const math=draftMath(ir).join(' ');for(const token of ['forall','exists','Rightarrow','neg','lor','le','frac{-3}{2}','cdot','top','bot'])assert(math.includes(token),token);
});
