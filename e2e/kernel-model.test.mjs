import test from 'node:test';
import assert from 'node:assert/strict';
import { fraction, displayFraction, equalFractions, claimsFor, canonical } from '../site/kernels/model.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('decimal inputs preserve exact values beyond JavaScript integer precision', () => {
  assert.deepEqual(fraction('9007199254740993'), ['9007199254740993','1']);
  assert.deepEqual(fraction('0.0745'), ['149','2000']);
  assert.deepEqual(fraction('-0.50'), ['-1','2']);
  assert(equalFractions(['100000','1000'],['100','1']));
  assert.equal(displayFraction(['100000','1000']),'100');
  assert.equal(displayFraction(['9007199254740993','1']),'9,007,199,254,740,993');
  for(const bad of ['NaN','Infinity','1e3','1/0','', '1'.repeat(41)]) assert.throws(()=>fraction(bad));
});
test('ground consequence is guarded by every input, including the claimed mass', () => {
  const input={material:0,volume:['100','1'],claimed:['120','1']};
  const ir=claimsFor(input,{status:'answered',value:['100','1'],matches:false},'reference');
  const rule=ir.claims.find(c=>c.id==='c_kernel').formula;
  assert.equal(rule.op,'imp');
  assert.deepEqual(rule.a.xs.map(x=>x.a.name),['sample_volume_l','sample_density_kg_m3','sample_mass_kg']);
  assert.equal(rule.b.op,'iff');
  assert.equal(rule.b.a.name,'sample_matches_model');
  assert.notEqual(rule.b.b.a.v,rule.b.b.b.v);
  assert.equal(ir.claims.find(c=>c.id==='c_mass').formula.xs[1].name,'sample_matches_model');
  assert.throws(()=>claimsFor(input,{status:'unsupported'},'user'));
});
test('receipt canonicalization is independent of object key order', () => {
  assert.equal(canonical({b:[2,3],a:1}),canonical({a:1,b:[2,3]}));
  assert.notEqual(canonical({a:'1'}),canonical({a:1}));
});
test('committed OCaml export and runtime artifacts match their build record', () => {
  const root = new URL('../',import.meta.url);
  const record=JSON.parse(readFileSync(new URL('site/kernels/build-receipt.json',root)));
  const sha = path => createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
  assert.equal(record.proofBuildStatus,'passed');
  assert.equal(record.proofMarker,'WMT_BROWSER_QUANTITY PASS oracles=0');
  assert.equal(record.generatedSourceSha256,sha('site/kernels/quantity.ml'));
  assert.equal(record.exportTheorySha256,sha('experiments/kernels/isabelle/Wmt_Browser_Quantity.thy'));
  for(const [path,hash] of Object.entries(record.runtimeFilesSha256))assert.equal(hash,sha('site/kernels/'+path));
});
