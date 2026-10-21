import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSchemas, validateGraph, prepareComparison, ocamlString, graphBindings, snapshotHashes, entityClaims} from '../site/kernels/entity-model.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../site/kernels/'+name,import.meta.url)));
const fixtures=()=>({graph:load('entity-graph.json'),document:load('entity-schemas.json')});

test('schema overrides preserve inherited fields and can independently change equals',()=>{
  const {document}=fixtures(), schemas=resolveSchemas(document);
  const base=schemas.get('contact/1'), child=schemas.get('contact-semantic/1');
  assert.deepEqual(child.fields,base.fields);
  assert.notEqual(child.equals.id,base.equals.id);
  assert.equal(child.policyOwner,child.id);
  delete document.schemas[1].equals;
  const inherited=resolveSchemas(document).get(child.id);
  assert.equal(inherited.policyOwner,base.id);
  assert.deepEqual(inherited.equals,base.equals);
  document.schemas[1].fields={email:'number'};
  assert.throws(()=>resolveSchemas(document),/inherited type/);
});
test('cycles, missing parents, invalid policies and undeclared requirements fail',()=>{
  for(const mutate of [
    d=>{d.schemas[0].extends='contact-colleague/1';},
    d=>{d.schemas[0].extends='absent';},
    d=>{d.schemas[0].equals.requires={undeclared:'string'};},
    d=>{d.schemas[0].equals.source=42;},
    d=>{d.schemas.push(d.schemas[0]);},
  ]){const {document}=fixtures();mutate(document);assert.throws(()=>resolveSchemas(document));}
});
test('cross-schema comparison checks the explicit shared policy interface',()=>{
  const {graph,document}=fixtures();
  const p=prepareComparison(graph,document,'contact-semantic/1','person:alice','person:alias');
  assert.notEqual(p.left.schema,p.right.schema);
  assert.throws(()=>prepareComparison(graph,document,'contact-semantic/1','person:alice','org:lab'),/does not implement/);
  // A different schema with the required typed field is structurally compatible.
  document.schemas.push({id:'vector-only/1',fields:{embedding:'embedding'},equals:document.schemas[1].equals});
  graph.entities.push({id:'vector:1',schema:'vector-only/1',attributes:{embedding:graph.entities[0].attributes.embedding}});
  assert.doesNotThrow(()=>prepareComparison(graph,document,'contact-semantic/1','person:alice','vector:1'));
});
test('graph validation rejects dangling edges, duplicate IDs, missing fields and invalid values',()=>{
  for(const mutate of [
    g=>{g.edges[0].object='missing';},g=>{g.entities.push(g.entities[0]);},
    g=>{delete g.entities[0].attributes.embedding;},g=>{g.entities[0].attributes.embedding.values=[Infinity];},
    g=>{delete g.entities[0].attributes.embedding.space.revision;},
    g=>{g.entities[0].attributes.email=3;},g=>{g.entities[0].attributes.extra='undeclared';},
    g=>{g.entities[0].id='control\u0000id';},
  ]){const {graph,document}=fixtures();mutate(graph);assert.throws(()=>validateGraph(graph,resolveSchemas(document)));}
  // A well-shaped zero or wrong-length vector reaches OCaml and returns unknown.
  const {graph,document}=fixtures();graph.entities[0].attributes.embedding.values=[0];
  assert.doesNotThrow(()=>validateGraph(graph,resolveSchemas(document)));
});
test('OCaml data encoding quotes Unicode and control bytes without injecting code',()=>{
  assert.equal(ocamlString('λ"\\\n'), '"\\206\\187\\034\\092\\010"');
  const {graph,document}=fixtures();graph.entities[0].attributes.label='";; failwith "injection";;';
  const bindings=graphBindings(graph,resolveSchemas(document),'person:alice','person:alias');
  assert(bindings.includes('\\034;; failwith \\034injection\\034;;'));
});
test('receipts bind the complete graph, schema, executable helper and runtime snapshots',async()=>{
  const {graph,document}=fixtures();
  const hashes=await snapshotHashes(graph,document,'contact-semantic/1','prelude',{runtime:'build'},'wasm');
  graph.edges.pop();
  const changedGraph=await snapshotHashes(graph,document,'contact-semantic/1','prelude',{runtime:'build'},'wasm');
  assert.notEqual(hashes.graphHash,changedGraph.graphHash);assert.equal(hashes.policyHash,changedGraph.policyHash);
  document.schemas[1].equals.source+='\nlet extra = 1;;';
  const changedCode=await snapshotHashes(graph,document,'contact-semantic/1','prelude',{runtime:'build'},'wasm');
  assert.notEqual(changedGraph.sourceHash,changedCode.sourceHash);assert.notEqual(changedGraph.policyHash,changedCode.policyHash);
  const changedPrelude=await snapshotHashes(graph,document,'contact-semantic/1','changed',{runtime:'build'},'js');
  assert.notEqual(changedCode.preludeHash,changedPrelude.preludeHash);assert.notEqual(changedCode.policyHash,changedPrelude.policyHash);
});
test('SMT observes an ordered pair under all snapshot premises, never universal equality',()=>{
  const hashes={graphHash:'ff'.repeat(32),schemaHash:'aa'.repeat(32),policyHash:'bb'.repeat(32)};
  const input={leftId:'a',rightId:'b',schemaId:'schema/1',expected:true};
  const ir=entityClaims(input,{status:'no-match'},hashes);
  const rule=ir.claims.find(c=>c.id==='c_equals').formula;
  assert.equal(rule.op,'imp');assert.equal(rule.a.xs.length,3);assert.equal(rule.b.a.op,'pred');
  assert.deepEqual(rule.b.a.args.map(x=>x.name),['entity_left','entity_right']);
  const graphClaim=ir.claims.find(c=>c.id==='c_graph').formula;
  assert.equal(graphClaim.xs[1].op,'not'); // Separate IDs are distinct even if matches.
  assert.equal(graphClaim.xs[0].b.v,BigInt('0x'+hashes.graphHash).toString());
  assert.throws(()=>entityClaims(input,{status:'unknown'},hashes));
  const self=entityClaims({...input,rightId:'a'},{status:'match'},hashes);
  assert.deepEqual(self.claims.find(c=>c.id==='c_expect').formula.args,[{t:'app',name:'entity_left',args:[]},{t:'app',name:'entity_left',args:[]}]);
});
