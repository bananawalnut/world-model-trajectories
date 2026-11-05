import test from 'node:test';
import assert from 'node:assert/strict';
import {coherenceModel,trajectoryRows} from '../site/papers/coherence-view.mjs';
const claims=['a','b','c','always','impossible'].map(id=>({id,source:id}));
const positions=[['a','b','always'],['a','c','always'],['b','c','always']].map(keep=>({keep,drop:claims.map(c=>c.id).filter(id=>!keep.includes(id))}));
test('acceptance comes from whole coherent positions, not pairwise conflict edges',()=>{
  const m=coherenceModel({inputIR:{claims},analysis:{complete:true,stopReason:'completed',status:'inconsistent',positions,conflicts:[['a','b','c'],['impossible']],acceptance:{skeptical:['a']},repair:{drop:['a','impossible'],weight:2}}});
  assert.equal(m.claims.find(c=>c.id==='a').acceptance,'some');
  assert.equal(m.claims.find(c=>c.id==='always').acceptance,'every');
  assert.equal(m.claims.find(c=>c.id==='impossible').acceptance,'none');
  assert.deepEqual(m.conflicts,[['a','b','c'],['impossible']]);
});
test('partial/unknown checks cannot display exhaustive acceptance, positions or repair',()=>{
  const m=coherenceModel({inputIR:{claims},analysis:{complete:false,stopReason:'enumeration_cap',status:'unknown',positions,conflicts:[['a','b','c']],repair:{weight:2}}});
  assert.equal(m.complete,false);assert.deepEqual(m.positions,[]);assert.equal(m.repair,null);
  assert(m.claims.every(c=>c.acceptance==='unresolved'));assert.equal(m.conflicts.length,1);
});
test('trajectory edges bind exact parent digests and versions, including external ancestry',()=>{
  const a={id:'a',version:1,digest:'a',parent:null},b={id:'a',version:2,digest:'b',parent:{...a}},fork={id:'fork',version:1,digest:'c',parent:{...a}};
  const external={id:'other',version:1,digest:'d',parent:{id:'a',version:1,digest:'wrong'}};
  const rows=trajectoryRows({versions:[b,fork,a,external]});
  assert.deepEqual(rows.map(r=>[r.bucket.digest,r.depth,r.missingParent]),[['a',0,false],['b',1,false],['c',1,false],['d',0,true]]);
});
