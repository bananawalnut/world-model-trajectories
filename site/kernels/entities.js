import init, { WmtEngine } from '../pkg/wmt_core.js';
import z3Module from '../vendor/z3/z3-solver.bundle.mjs';
import { digest } from './model.mjs';
import { resolveSchemas, validateGraph, prepareComparison, graphBindings, snapshotHashes, entityClaims } from './entity-model.mjs';

const $ = id => document.getElementById(id);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE = 'wmt.entity-lab.v1';
const RUNTIME = new URLSearchParams(location.search).get('runtime') === 'js' ? 'js' : 'wasm';
let engine, Z3, prelude, build, demo, schemas, worker;
let ready = false, busy = false, revision = 0, current = null, positions = [];
try {
  const saved = JSON.parse(localStorage.getItem(STORE));
  if (saved?.format === 'wmt.entity-positions/1' && Array.isArray(saved.positions))
    positions = saved.positions.filter(p=>p?.format==='wmt.entity-position/1' && p.input &&
      typeof p.name==='string' && typeof p.receipt?.policy?.id==='string' &&
      ['match','no-match','unknown'].includes(p.result?.status)).slice(-20);
} catch {}

function documentFrom(id) {
  const source = $(id).value;
  if (source.length > 250000) throw new Error('Keep each JSON document below 250,000 characters.');
  return JSON.parse(source);
}
function invalidate() {
  revision++; current = null;
  $('entity-verdict').textContent = 'Inputs or policy changed — run again to check this position.';
  $('entity-verdict').dataset.status = 'stale';
  $('entity-verdict').className = 'statusbar warn';
  $('entity-result').replaceChildren(); $('entity-claims').replaceChildren();
  $('entity-conflict').textContent = ''; $('entity-receipt').textContent = '';
  $('entity-error').textContent = '';
  setBusy(busy);
}
function setBusy(value) {
  $('run-entities').disabled = !ready || value;
  $('save-entity-position').disabled = value || !current;
  $('export-entity-position').disabled = value || !current;
  document.querySelectorAll('[data-entity-claim], [data-entity-load]').forEach(b=>b.disabled=value);
}
function fail(error) {
  current = null;
  $('entity-error').textContent = String(error.message || error);
  $('entity-verdict').textContent = 'No current verdict — validation, execution or analysis failed.';
  $('entity-verdict').dataset.status = 'error'; $('entity-verdict').className = 'statusbar warn';
  $('entity-result').replaceChildren(); $('entity-claims').replaceChildren();
  $('entity-conflict').textContent = ''; $('entity-receipt').textContent = '';
  setBusy(busy);
}
function selectOptions(id, options, fallback) {
  const previous = $(id).value;
  $(id).innerHTML = options.map(([value,label])=>`<option value="${escape(value)}">${escape(label)}</option>`).join('');
  $(id).value = options.some(([value])=>value===previous) ? previous : (options.some(([value])=>value===fallback) ? fallback : options[0]?.[0]);
}
function graphSummary(graph) {
  const chosen = [$('entity-left').value, $('entity-right').value];
  $('entity-graph-summary').innerHTML = `<p class="small muted">${graph.entities.length} entities · ${graph.edges.length} directed relationships</p>` + graph.entities.map(e=>
    `<div class="entity-node ${chosen.includes(e.id)?'selected':''}"><b>${escape(e.attributes.label ?? e.id)}</b><code>${escape(e.id)} · ${escape(e.schema)}</code></div>`).join('') +
    graph.edges.map(e=>`<p class="entity-edge">${escape(e.subject)} → <b>${escape(e.predicate)}</b> → ${escape(e.object)}</p>`).join('');
}
function policySummary() {
  const schema = schemas.get($('entity-schema').value);
  $('policy-summary').textContent = `${schema.lineage.join(' → ')} · equals from ${schema.policyOwner} · requires ${Object.entries(schema.equals.requires).map(([k,v])=>`${k}: ${v}`).join(', ') || 'no fields'}`;
  const raw = documentFrom('schema-source').schemas.find(s=>s.id===schema.id);
  $('inherit-equals').disabled = !raw.extends || !raw.equals;
}
function loadPolicy() {
  const schema = schemas.get($('entity-schema').value);
  $('policy-id').value = schema.equals.id;
  $('equals-source').value = schema.equals.source;
  policySummary();
}
function refresh() {
  const document = documentFrom('schema-source'), graph = documentFrom('graph-source');
  schemas = resolveSchemas(document); validateGraph(graph, schemas);
  const options = graph.entities.map(e=>[e.id,e.id]);
  selectOptions('entity-left',options,'person:alice'); selectOptions('entity-right',options,'person:alias');
  selectOptions('entity-schema',document.schemas.map(s=>[s.id,s.id]),'contact-semantic/1');
  graphSummary(graph); loadPolicy();
}
function syncPolicy() {
  const document = documentFrom('schema-source');
  const selected = document.schemas.find(s=>s.id===$('entity-schema').value);
  if (!selected) throw new Error('Select an existing schema.');
  const inherited = selected.equals ?? schemas.get(selected.id).equals;
  selected.equals = {...structuredClone(inherited),id:$('policy-id').value,source:$('equals-source').value};
  $('schema-source').value = JSON.stringify(document,null,2);
  schemas = resolveSchemas(document); policySummary();
}
function inputs() {
  const graph = documentFrom('graph-source'), document = documentFrom('schema-source');
  const input = {graph, document, schemaId:$('entity-schema').value, leftId:$('entity-left').value,
    rightId:$('entity-right').value, expected:$('entity-expected').value==='match'};
  const prepared = prepareComparison(graph,document,input.schemaId,input.leftId,input.rightId);
  if (prepared.schema.equals.source !== $('equals-source').value || prepared.schema.equals.id !== $('policy-id').value)
    throw new Error('Fix the schema registry before editing this policy.');
  return {input, prepared};
}
function execute(input, prepared) {
  worker?.terminate();
  const owned = worker = new Worker(new URL('./entity-worker.js',import.meta.url));
  return new Promise((resolve,reject)=>{
    const timeout = setTimeout(()=>{owned.terminate();reject(new Error('OCaml exceeded the 20-second execution limit.'));},20000);
    owned.onerror = e=>{clearTimeout(timeout);owned.terminate();reject(new Error(e.message || 'OCaml worker failed.'));};
    owned.onmessage = ({data})=>{clearTimeout(timeout);owned.terminate();data.ok?resolve(data.result):reject(new Error(data.error));};
    owned.postMessage({runtime:RUNTIME,prelude,source:prepared.schema.equals.source,
      bindings:graphBindings(input.graph,prepared.schemas,input.leftId,input.rightId)});
  });
}
async function solve() {
  engine.analyze_begin(); let steps = 0;
  for (let script=engine.analyze_next();script;script=engine.analyze_next()) {
    if (++steps>200) throw new Error('Analysis budget exhausted.');
    const config=Z3.mk_config(), context=Z3.mk_context(config);
    let answer;
    try { answer=await Z3.eval_smtlib2_string(context,script); }
    finally {Z3.del_context(context);Z3.del_config(config);}
    engine.analyze_feed(String(answer).trim());
  }
  return JSON.parse(engine.analyze_result());
}
function renderAnalysis(analysis) {
  const status=analysis.status;
  $('entity-verdict').dataset.status=status;
  $('entity-verdict').className='statusbar '+(status==='inconsistent'?'warn':status==='consistent'?'ok':'muted');
  $('entity-verdict').textContent=status==='inconsistent' ? 'Conflict: your claim disagrees with this policy on these snapshots.' : status==='consistent' ? 'Coherent under the selected policy and active claims.' : 'Unknown comparison — no match consequence or consistency verdict.';
  $('entity-conflict').textContent=analysis.mus?.length ? 'Minimal conflict: '+analysis.mus.join(', ') : '';
}
function renderResult() {
  const result=current.result;
  $('entity-result').innerHTML=`<div class="kernel-card selected"><b>${escape(current.receipt.policy.id)} · executed OCaml</b><div class="value">${result.status==='match'?'Match':result.status==='no-match'?'No match':'Unknown'}</div>${result.score===null?'':`<p>Score: <b>${escape(result.score.toPrecision(8))}</b></p>`}${result.reason?`<p>${escape(result.reason)}</p>`:''}<p class="small muted">${escape(current.input.leftId)} → ${escape(current.input.rightId)}. Entity identity is unchanged. No proof attached.</p></div>`;
}
function renderReceipt() { $('entity-receipt').textContent=JSON.stringify(current.receipt,null,2); }
function showClaims() {
  const meta=JSON.parse(engine.meta());
  $('entity-claims').innerHTML=meta.claims.map(c=>`<label class="lab-claim"><input type="checkbox" data-entity-claim="${c.id}" ${c.active?'checked':''}><span>${escape(c.source)}</span><code>${c.id}</code></label>`).join('');
  document.querySelectorAll('[data-entity-claim]').forEach(box=>box.onchange=()=>changeClaims(box.dataset.entityClaim,box.checked));
}
async function changeClaims(id, active) {
  if (busy || !current) return;
  busy=true;setBusy(true);const stamp=revision;
  try {
    active?engine.reactivate(id):engine.retract(id);
    const analysis=await solve(), state=engine.export_state();
    const activeClaimIds=JSON.parse(engine.meta()).claims.filter(c=>c.active).map(c=>c.id);
    const positionHash=await digest({state,runHash:current?.receipt.runHash});
    if (stamp!==revision || !current) return;
    Object.assign(current,{analysis,engineState:state}); Object.assign(current.receipt,{activeClaimIds,positionHash});
    renderAnalysis(analysis);renderReceipt();
  } catch(error) {if(stamp===revision)fail(error);}
  finally {busy=false;setBusy(false);}
}
async function run(inactive=[]) {
  if (busy) return;
  busy=true;invalidate();setBusy(true);const stamp=revision;
  $('entity-progress').textContent='Running OCaml, then checking this claim…';
  try {
    const {input,prepared}=inputs();
    const result=await execute(input,prepared);
    if (stamp!==revision) return;
    const hashes=await snapshotHashes(input.graph,input.document,input.schemaId,prelude,build,RUNTIME);
    if (stamp!==revision) return;
    engine.reset();let ir=null,analysis={status:'unknown'},engineState=null;
    if (result.status!=='unknown') {
      ir=entityClaims(input,result,hashes);
      const ingested=JSON.parse(engine.ingest(JSON.stringify(ir)));
      if(!ingested.ok)throw new Error(ingested.errors.join('\n'));
      for(const id of inactive)if(ir.claims.some(c=>c.id===id))engine.retract(id);
      analysis=await solve();engineState=engine.export_state();
    }
    if (stamp!==revision) return;
    const runHash=await digest({input,result,hashes,runtime:RUNTIME});
    const receipt={format:'wmt.entity-run/1',runHash,...hashes,runtime:RUNTIME,
      schema:prepared.schema.id,policy:prepared.schema.equals,policyOwner:prepared.schema.policyOwner,
      pair:[input.leftId,input.rightId],expected:input.expected,result,
      theorem:null,guarantee:'Executed user OCaml; helpers, adapter and browser tested; no entity equality proof attached.',
      scope:'Ordered, concrete comparison on these snapshots; no universal, symmetric or transitive equality axiom; stable IDs unchanged.',
      activeClaimIds:ir?JSON.parse(engine.meta()).claims.filter(c=>c.active).map(c=>c.id):[],
      positionHash:await digest({state:engineState,runHash})};
    if (stamp!==revision) return;
    current={format:'wmt.entity-position/1',input,result,hashes,ir,analysis,receipt,engineState,
      execution:{prelude,runtimeBuild:build,runtime:RUNTIME}};
    renderResult();renderAnalysis(analysis);renderReceipt();
    if (ir) showClaims();
  } catch(error) {if(stamp===revision)fail(error);}
  finally {busy=false;setBusy(false);$('entity-progress').textContent='';}
}
function renderPositions() {
  $('entity-positions').innerHTML=positions.map((p,i)=>`<div class="saved-position"><b>${escape(p.name)}</b><span>${escape(p.receipt.policy.id)} · ${escape(p.result.status)}</span><button class="btn ghost tiny" data-entity-load="${i}">Restore</button></div>`).join('');
  document.querySelectorAll('[data-entity-load]').forEach(b=>b.onclick=async()=>{
    if(busy)return;
    try {
      const p=positions[Number(b.dataset.entityLoad)];
      $('graph-source').value=JSON.stringify(p.input.graph,null,2);$('schema-source').value=JSON.stringify(p.input.document,null,2);
      invalidate();refresh();
      $('entity-left').value=p.input.leftId;$('entity-right').value=p.input.rightId;
      $('entity-schema').value=p.input.schemaId;$('entity-expected').value=p.input.expected?'match':'no-match';
      loadPolicy();graphSummary(p.input.graph);
      const inactive=p.ir?.claims.filter(c=>!p.receipt.activeClaimIds.includes(c.id)).map(c=>c.id)??[];
      // The stored verdict is history. Use today's runtime/helpers and re-run.
      await run(inactive);
    } catch(error) {fail(error);}
  });
}
async function boot() {
  try {
    const fetchFile=async(name,json=false)=>{const r=await fetch('./kernels/'+name);if(!r.ok)throw new Error(`${name} unavailable`);return json?r.json():r.text();};
    const [_,z,p,b,g,s]=await Promise.all([init(),(z3Module.init||z3Module.default?.init)(),
      fetchFile('entity-prelude.ml'),fetchFile('build-receipt.json',true),fetchFile('entity-graph.json',true),fetchFile('entity-schemas.json',true)]);
    engine=new WmtEngine();Z3=z.Z3;prelude=p;build=b;demo={graph:g,document:s};
    $('graph-source').value=JSON.stringify(g,null,2);$('schema-source').value=JSON.stringify(s,null,2);refresh();
    ready=true;setBusy(false);
    $('entity-ready').textContent=`Z3 ready · OCaml ${RUNTIME==='wasm'?'Wasm':'JavaScript'} worker available`;$('entity-ready').classList.add('rdy');
    $('run-entities').onclick=()=>run();
    for(const id of ['graph-source','schema-source']) $(id).oninput=()=>{invalidate();try{refresh();}catch(e){$('entity-error').textContent=e.message;}};
    for(const id of ['equals-source','policy-id']) $(id).oninput=()=>{invalidate();try{syncPolicy();}catch(e){$('entity-error').textContent=e.message;}};
    for(const id of ['entity-left','entity-right','entity-expected']) $(id).onchange=()=>{invalidate();try{graphSummary(documentFrom('graph-source'));}catch{}};
    $('entity-schema').onchange=()=>{invalidate();try{loadPolicy();}catch(e){$('entity-error').textContent=e.message;}};
    $('inherit-equals').onclick=()=>{
      try {const d=documentFrom('schema-source');delete d.schemas.find(s=>s.id===$('entity-schema').value).equals;
        $('schema-source').value=JSON.stringify(d,null,2);invalidate();refresh();}catch(e){fail(e);}
    };
    $('reset-entities').onclick=()=>{
      $('graph-source').value=JSON.stringify(demo.graph,null,2);$('schema-source').value=JSON.stringify(demo.document,null,2);invalidate();refresh();
      $('entity-left').value='person:alice';$('entity-right').value='person:alias';
      $('entity-schema').value='contact-semantic/1';$('entity-expected').value='match';
      loadPolicy();graphSummary(demo.graph);
    };
    $('save-entity-position').onclick=()=>{
      if(!current || busy)return;
      const position=structuredClone({...current,name:$('entity-position-name').value.trim()||`Position ${positions.length+1}`});
      const next=[...positions,position].slice(-20);
      try{localStorage.setItem(STORE,JSON.stringify({format:'wmt.entity-positions/1',positions:next}));positions=next;renderPositions();}
      catch{$('entity-error').textContent='Could not save in browser storage. Download this position instead.';}
    };
    $('export-entity-position').onclick=()=>{
      if(!current || busy)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='wmt-entity-position.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    renderPositions();
  } catch(error) {$('entity-ready').textContent='Could not start entity experiment';fail(error);}
}
boot();
