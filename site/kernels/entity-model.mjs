import { digest } from './model.mjs';

const TYPES = ['string', 'number', 'boolean', 'embedding'];
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
function check(ok, message) { if (!ok) throw new Error(message); }
function identifier(s) { return typeof s === 'string' && s.length > 0 && s.length <= 200 && !/[\u0000-\u001f\u007f]/.test(s); }
function fields(x, where) {
  check(object(x) && Object.keys(x).length <= 100, `${where}: expected a field interface.`);
  for (const [key, type] of Object.entries(x))
    check(identifier(key) && TYPES.includes(type), `${where}: unsupported field ${key} / ${type}.`);
}

// A derived schema can add fields and replace equals, but cannot silently
// reinterpret an inherited field. Policies declare the interface they read.
export function resolveSchemas(document) {
  check(document?.format === 'wmt.entity-schemas/1' && Array.isArray(document.schemas), 'Expected wmt.entity-schemas/1.');
  check(document.schemas.length > 0 && document.schemas.length <= 50, 'Use between 1 and 50 schemas.');
  const raw = new Map(), resolved = new Map(), visiting = new Set();
  for (const schema of document.schemas) {
    check(object(schema) && identifier(schema.id) && !raw.has(schema.id), 'Schema IDs must be unique, nonempty strings.');
    raw.set(schema.id, schema);
  }
  function visit(id) {
    if (resolved.has(id)) return resolved.get(id);
    check(raw.has(id), `Unknown schema: ${id}.`);
    check(!visiting.has(id), `Schema inheritance cycle at ${id}.`);
    visiting.add(id);
    const schema = raw.get(id);
    check(schema.extends === undefined || identifier(schema.extends), `Invalid parent for ${id}.`);
    const parent = schema.extends ? visit(schema.extends) : null;
    fields(schema.fields ?? {}, id);
    const interfaceFields = Object.assign(Object.create(null), parent?.fields ?? {});
    for (const [name, type] of Object.entries(schema.fields ?? {})) {
      check(!own(interfaceFields, name) || interfaceFields[name] === type, `${id} changes the inherited type of ${name}.`);
      interfaceFields[name] = type;
    }
    const policy = schema.equals ?? parent?.equals;
    check(object(policy) && identifier(policy.id) && typeof policy.source === 'string' && policy.source.length <= 30000,
      `${id} must define or inherit equals with an ID and OCaml source.`);
    fields(policy.requires, `${id}.equals.requires`);
    for (const [name, type] of Object.entries(policy.requires))
      check(interfaceFields[name] === type, `${id}.equals requires ${name}: ${type}, absent from its schema.`);
    const result = { id, fields: interfaceFields, equals: structuredClone(policy),
      policyOwner: schema.equals ? id : parent.policyOwner, lineage: [...(parent?.lineage ?? []), id] };
    visiting.delete(id); resolved.set(id, result); return result;
  }
  for (const id of raw.keys()) visit(id);
  return resolved;
}

function validValue(type, value) {
  if (type === 'string') return typeof value === 'string' && value.length <= 10000;
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'embedding') {
    const space = value?.space;
    return object(value) && object(space) &&
      ['model', 'revision', 'preprocessing', 'normalization'].every(k => identifier(space[k])) &&
      Number.isInteger(space.dimensions) && space.dimensions > 0 && space.dimensions <= 4096 &&
      Array.isArray(value.values) && value.values.length <= 4096 &&
      value.values.every(n => typeof n === 'number' && Number.isFinite(n));
  }
  return false;
}
export function validateGraph(graph, schemas) {
  check(graph?.format === 'wmt.entity-graph/1' && Array.isArray(graph.entities) && Array.isArray(graph.edges), 'Expected wmt.entity-graph/1 with entities and edges.');
  check(graph.entities.length > 0 && graph.entities.length <= 100 && graph.edges.length <= 1000, 'Limit the experiment to 100 entities and 1000 edges.');
  const entities = new Map();
  for (const entity of graph.entities) {
    check(object(entity) && identifier(entity.id) && !entities.has(entity.id), 'Entity IDs must be unique, nonempty strings.');
    const schema = schemas.get(entity.schema);
    check(schema, `Unknown schema for ${entity.id}: ${entity.schema}.`);
    check(object(entity.attributes), `Missing attributes for ${entity.id}.`);
    for (const [key, type] of Object.entries(schema.fields))
      check(own(entity.attributes, key) && validValue(type, entity.attributes[key]), `${entity.id}: missing or invalid ${key} (${type}).`);
    for (const key of Object.keys(entity.attributes)) check(own(schema.fields, key), `${entity.id}: undeclared attribute ${key}.`);
    entities.set(entity.id, entity);
  }
  for (const edge of graph.edges)
    check(object(edge) && entities.has(edge.subject) && entities.has(edge.object) && identifier(edge.predicate), 'Every edge needs existing subject/object IDs and a predicate.');
  return entities;
}
export function prepareComparison(graph, document, schemaId, leftId, rightId) {
  const schemas = resolveSchemas(document), entities = validateGraph(graph, schemas);
  const schema = schemas.get(schemaId), left = entities.get(leftId), right = entities.get(rightId);
  check(schema && left && right, 'Choose a comparison schema and two existing entities.');
  for (const entity of [left, right])
    for (const [field, type] of Object.entries(schema.equals.requires))
      check(schemas.get(entity.schema).fields[field] === type,
        `${entity.id} does not implement the selected policy interface: ${field}: ${type}.`);
  return { schema, left, right, schemas };
}

// Encode UTF-8 bytes using OCaml's decimal escapes, not JavaScript's \u syntax.
export function ocamlString(text) {
  return '"' + [...new TextEncoder().encode(text)].map(b => b >= 32 && b < 127 && b !== 34 && b !== 92
    ? String.fromCharCode(b) : '\\' + String(b).padStart(3, '0')).join('') + '"';
}
const list = xs => '[' + xs.join('; ') + ']';
const float = n => `float_of_string ${ocamlString(String(n))}`;
function valueSource(type, value) {
  if (type === 'string') return `Text ${ocamlString(value)}`;
  if (type === 'number') return `Number (${float(value)})`;
  if (type === 'boolean') return `Flag ${value}`;
  const s = value.space;
  return `Embedding {space={model=${ocamlString(s.model)}; revision=${ocamlString(s.revision)}; preprocessing=${ocamlString(s.preprocessing)}; normalization=${ocamlString(s.normalization)}; dimensions=${s.dimensions}}; values=[|${value.values.map(float).join('; ')}|]}`;
}
export function graphBindings(graph, schemas, leftId, rightId) {
  const entities = graph.entities.map(e => `{id=${ocamlString(e.id)}; schema=${ocamlString(e.schema)}; attributes=${list(Object.entries(e.attributes).map(([k,v]) => `(${ocamlString(k)}, ${valueSource(schemas.get(e.schema).fields[k], v)})`))}}`);
  const edges = graph.edges.map(e => `{subject=${ocamlString(e.subject)}; predicate=${ocamlString(e.predicate)}; object_id=${ocamlString(e.object)}}`);
  return `open Wmt_Entity;;\nlet wmt_graph : Wmt_Entity.graph = {entities=${list(entities)}; edges=${list(edges)}};;\nlet wmt_left = List.find (fun (e : Wmt_Entity.entity) -> e.id = ${ocamlString(leftId)}) wmt_graph.entities;;\nlet wmt_right = List.find (fun (e : Wmt_Entity.entity) -> e.id = ${ocamlString(rightId)}) wmt_graph.entities;;`;
}

export async function snapshotHashes(graph, document, schemaId, prelude, runtimeBuild, runtime) {
  const schema = resolveSchemas(document).get(schemaId);
  const graphHash = await digest(graph), schemaHash = await digest(document);
  const sourceHash = await digest(schema.equals.source), preludeHash = await digest(prelude);
  const policyHash = await digest({schemaId, policy: schema.equals, preludeHash, runtimeBuild, runtime});
  return {graphHash, schemaHash, sourceHash, preludeHash, policyHash};
}
const term = name => ({t:'app', name, args:[]});
// WMT's Int literal decoder is i64; Real accepts exact SMT numeral strings.
// Use exact integral Reals for the full 256-bit snapshot tokens (no rounding).
const eq = (name, hash) => ({op:'eq', a:term(name), b:{t:'real', v:BigInt('0x'+hash).toString()}});
export function entityClaims(input, result, hashes) {
  check(['match', 'no-match'].includes(result.status), 'An unknown comparison cannot assert a match consequence.');
  const same = input.leftId === input.rightId;
  const match = {op:'pred', name:'matches_selected_policy', args:[term('entity_left'), term(same ? 'entity_left' : 'entity_right')]};
  const graph = {op:'and', xs:[eq('graph_snapshot', hashes.graphHash), ...(same ? [] : [{op:'not', x:{op:'eq', a:term('entity_left'), b:term('entity_right')}}])]},
    schema = eq('schema_snapshot', hashes.schemaHash), policy = eq('policy_snapshot', hashes.policyHash);
  return {sorts:['Entity'],
    funcs:[{name:'entity_left',args:[],ret:'Entity'}, ...(same?[]:[{name:'entity_right',args:[],ret:'Entity'}]),
      ...['graph_snapshot','schema_snapshot','policy_snapshot'].map(name=>({name,args:[],ret:'Real'}))],
    preds:[{name:'matches_selected_policy',args:['Entity','Entity']}],
    claims:[
      {id:'c_graph',weight:5,source:`Graph snapshot ${hashes.graphHash.slice(0,12)}; IDs ${input.leftId} and ${input.rightId}${same ? ' identify the same entity' : ' remain distinct'}.`,formula:graph},
      {id:'c_schema',weight:5,source:`Schema snapshot ${hashes.schemaHash.slice(0,12)} with selected schema ${input.schemaId}.`,formula:schema},
      {id:'c_policy',weight:5,source:`Execute policy snapshot ${hashes.policyHash.slice(0,12)} on this ordered pair.`,formula:policy},
      {id:'c_expect',weight:2,source:`I claim ${input.leftId} ${input.expected ? 'matches' : 'does not match'} ${input.rightId} under this policy.`,formula:input.expected ? match : {op:'not',x:match}},
      {id:'c_equals',weight:10,source:`The executed OCaml policy returned ${result.status} for this pair, conditional on all three snapshots.`,
        formula:{op:'imp',a:{op:'and',xs:[graph,schema,policy]},b:{op:'iff',a:match,b:{op:'eq',a:{t:'int',v:0},b:{t:'int',v:result.status==='match'?0:1}}}}},
    ]};
}
