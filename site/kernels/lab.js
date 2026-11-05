import init, { WmtEngine } from '../pkg/wmt_core.js';
import z3Module from '../vendor/z3/z3-solver.bundle.mjs';
import { MATERIALS, fraction, displayFraction, equalFractions, claimsFor, digest } from './model.mjs';

const $ = id => document.getElementById(id);
const escape = s => String(s).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE = 'wmt.kernel-lab.v1';
const RUNTIME = new URLSearchParams(location.search).get('runtime') === 'js' ? 'js' : 'wasm';
let engine, Z3, build, example, worker, current = null, revision = 0, busy = false;
let positions = [];
try { const saved = JSON.parse(localStorage.getItem(STORE)); if (saved?.format === 1 && Array.isArray(saved.positions)) positions = saved.positions; } catch {}

function invalidate() {
  revision++;
  current = null;
  $('lab-verdict').textContent = 'Inputs or code changed — run again to check this position.';
  $('lab-verdict').className = 'statusbar warn';
  $('lab-verdict').dataset.status = 'stale';
  $('kernel-results').classList.add('stale');
  $('run-receipt').textContent = '';
  $('lab-conflict').textContent = '';
  $('lab-claims').replaceChildren();
  $('save-position').disabled = true;
  $('export-position').disabled = true;
}
function inputs() {
  const material = Number($('material').value);
  const volume = fraction($('volume').value), claimed = fraction($('mass').value);
  if (BigInt(volume[0]) < 0n || BigInt(claimed[0]) < 0n) throw new Error('Volume and mass must be nonnegative.');
  return {material,volume,claimed,density:MATERIALS[material].density,source:$('user-source').value,selected:$('selected-kernel').value};
}
function execute(input) {
  worker?.terminate();
  worker = new Worker(new URL('./worker.js', import.meta.url));
  const owned = worker;
  return new Promise((resolve,reject) => {
    const timeout = setTimeout(() => { owned.terminate(); reject(new Error('OCaml exceeded the 20-second execution limit.')); },20000);
    owned.onerror = e => { clearTimeout(timeout); owned.terminate(); reject(new Error(e.message || 'OCaml worker failed.')); };
    owned.onmessage = ({data}) => { clearTimeout(timeout); owned.terminate(); data.ok ? resolve(data) : reject(new Error(data.error)); };
    owned.postMessage({id:1,runtime:RUNTIME,...input});
  });
}
async function solve() {
  engine.analyze_begin();
  let steps = 0;
  for (let script = engine.analyze_next(); script; script = engine.analyze_next()) {
    if (++steps > 200) throw new Error('Analysis budget exhausted.');
    const config = Z3.mk_config();
    const context = Z3.mk_context(config);
    let answer;
    try { answer = await Z3.eval_smtlib2_string(context,script); }
    finally { Z3.del_context(context); Z3.del_config(config); }
    engine.analyze_feed(String(answer).trim());
  }
  return JSON.parse(engine.analyze_result());
}
function resultCards(results, selected) {
  $('kernel-results').classList.remove('stale');
  $('kernel-results').innerHTML = ['reference','user'].map(key => {
    const result = results[key];
    const title = key === 'reference' ? 'veri7vn · extracted OCaml' : 'My kernel · editable OCaml';
    return `<div class="kernel-card ${key===selected?'selected':''}" data-kernel="${key}"><b>${title}</b>${key===selected?' · selected':''}<div class="value">${result.status==='answered'?escape(displayFraction(result.value))+' kg':'Unsupported'}</div><span>${result.status==='answered'?(result.matches?'Claim matches':'Claim does not match'):'No consequence asserted'}</span><p class="small muted">${key==='reference'?'Upstream mass theorem; browser adapter tested separately.':'User implementation; no proof attached.'}</p></div>`;
  }).join('') + (results.reference.status==='answered' && results.user.status==='answered' ? `<p id="agreement">The calculated masses ${equalFractions(results.reference.value,results.user.value)?'agree exactly':'differ'}. The comparison policies may differ independently.</p>` : '');
}
function showClaims() {
  const meta = JSON.parse(engine.meta());
  $('lab-claims').innerHTML = meta.claims.map(c => `<label class="lab-claim"><input type="checkbox" data-claim="${c.id}" ${c.active?'checked':''}><span>${escape(c.source)}</span><code>${c.id}</code></label>`).join('');
  document.querySelectorAll('[data-claim]').forEach(box => box.onchange = async () => {
    if (busy || !current) return;
    busy = true;
    setBusy(true);
    const stamp = revision;
    try {
      box.checked ? engine.reactivate(box.dataset.claim) : engine.retract(box.dataset.claim);
      const analysis = await solve();
      if (stamp !== revision || !current) return;
      current.analysis = analysis;
      current.engineState = engine.export_state();
      current.receipt.activeClaimIds = JSON.parse(engine.meta()).claims.filter(c=>c.active).map(c=>c.id);
      current.receipt.positionHash = await digest({state:current.engineState,run:current.receipt.runHash});
      renderAnalysis(analysis);
      $('run-receipt').textContent = JSON.stringify(current.receipt,null,2);
    } catch (error) { fail(error); }
    finally { busy=false; setBusy(false); }
  });
}
function renderAnalysis(analysis) {
  const status = analysis.status;
  $('lab-verdict').dataset.status = status;
  $('lab-verdict').className = 'statusbar '+(status==='inconsistent'?'warn':status==='consistent'?'ok':'muted');
  $('lab-verdict').textContent = status==='inconsistent' ? 'Conflict: the mass claim does not match the selected model under these premises.' : status==='consistent' ? 'Coherent under the selected model and active claims.' : 'Undecided — no consistency verdict.';
  $('lab-conflict').textContent = analysis.mus?.length ? 'Minimal conflict: '+analysis.mus.join(', ') : '';
}
function setBusy(value) {
  $('run-kernels').disabled = value;
  document.querySelectorAll('[data-claim]').forEach(b=>b.disabled=value);
  document.querySelectorAll('[data-load]').forEach(b=>b.disabled=value);
  $('save-position').disabled = value || !current;
  $('export-position').disabled = value || !current;
}
function fail(error) {
  current = null;
  $('kernel-error').textContent = String(error.message || error);
  $('lab-verdict').textContent = 'No current verdict — execution or analysis failed.';
  $('lab-verdict').dataset.status = 'error';
  $('lab-verdict').className = 'statusbar warn';
  $('lab-conflict').textContent = '';
  $('run-receipt').textContent = '';
}
async function run() {
  if (busy) return;
  busy = true;
  invalidate();
  const stamp = revision;
  setBusy(true);
  $('kernel-error').textContent = '';
  $('run-progress').textContent = 'Running OCaml, then checking claims…';
  try {
    const input = inputs();
    const results = await execute(input);
    if (stamp !== revision) return;
    resultCards(results,input.selected);
    const result = results[input.selected];
    if (result.status !== 'answered') throw new Error('Selected kernel does not support this input. No consequence was asserted.');
    const ir = claimsFor(input,result,input.selected);
    engine.reset();
    const ingested = JSON.parse(engine.ingest(JSON.stringify(ir)));
    if (!ingested.ok) throw new Error(ingested.errors.join('\n'));
    const analysis = await solve();
    if (stamp !== revision) return;
    const runHash = await digest({input,results,build});
    const receipt = {
      format:'wmt.kernel-run/1',runHash,
      kernel:input.selected==='reference'?'veri7vn.quantity.mass':'user.ocaml.mass',
      referenceCommit:build.upstreamCommit,
      referenceSourceHash:build.generatedSourceSha256,
      userSourceHash:await digest(input.source),
      schema:'wmt.sample.mass/1',input,results,
      runtime:RUNTIME,
      theorem:input.selected==='reference'?'Quantity.mass_from_volume':null,
      guarantee:input.selected==='reference'?'Upstream kernel theorem; OCaml and JSON adapter tested, not proved.':'Executed user function; no proof attached.',
      scope:'Concrete comparison on the supplied fractions; no universal equality axiom.',
      activeClaimIds:ir.claims.map(c=>c.id),
    };
    const engineState = engine.export_state();
    receipt.positionHash = await digest({state:engineState,run:runHash});
    current = {input,results,analysis,receipt,engineState};
    showClaims(); renderAnalysis(analysis);
    $('run-receipt').textContent = JSON.stringify(receipt,null,2);
  } catch (error) { if (stamp===revision) fail(error); }
  finally { busy=false; setBusy(false); $('run-progress').textContent=''; }
}
function renderPositions() {
  $('positions').innerHTML = positions.map((p,i)=>`<div class="saved-position"><b>${escape(p.name)}</b><span>${escape(p.analysis.status)} · ${p.input.selected==='reference'?'veri7vn':'user kernel'} · ${escape(p.input.volume.join('/'))} litres</span><button class="btn ghost tiny" data-load="${i}">Restore</button></div>`).join('');
  document.querySelectorAll('[data-load]').forEach(button=>button.onclick=async()=>{
    if (busy) return;
    const p=positions[Number(button.dataset.load)];
    $('material').value=p.input.material;
    $('volume').value=p.volumeText;
    $('mass').value=p.massText;
    $('selected-kernel').value=p.input.selected;
    $('user-source').value=p.input.source;
    invalidate();
    // Always execute again. A saved receipt is history, never a fresh verdict.
    await run();
    if (current) {
      const wanted=JSON.parse(p.engineState).claims.filter(c=>!c.active).map(c=>c.id);
      for (const id of wanted) engine.retract(id);
      if (wanted.length) {
        busy=true;setBusy(true);
        const stamp=revision;
        try {
          const analysis=await solve();
          if(stamp!==revision || !current)return;
          current.analysis=analysis;current.engineState=engine.export_state();
          current.receipt.activeClaimIds=JSON.parse(engine.meta()).claims.filter(c=>c.active).map(c=>c.id);
          current.receipt.positionHash=await digest({state:current.engineState,run:current.receipt.runHash});
          showClaims();renderAnalysis(current.analysis);
          $('run-receipt').textContent=JSON.stringify(current.receipt,null,2);
        } catch(error) {fail(error);}
        finally {busy=false;setBusy(false);}
      }
    }
  });
}
async function boot() {
  try {
    const [_, z, code, receipt] = await Promise.all([
      init(), (z3Module.init || z3Module.default?.init)(),
      fetch('./kernels/user-kernel.ml').then(r=>{if(!r.ok)throw new Error('OCaml example unavailable');return r.text();}),
      fetch('./kernels/build-receipt.json').then(r=>{if(!r.ok)throw new Error('Kernel build record unavailable');return r.json();}),
    ]);
    engine=new WmtEngine();Z3=z.Z3;example=code;build=receipt;
    $('user-source').value=example;
    $('lab-ready').textContent=`Z3 ready · OCaml ${RUNTIME === 'wasm' ? 'Wasm' : 'JavaScript'} worker available`;
    $('lab-ready').classList.add('rdy');
    $('run-kernels').disabled=false;
    $('run-kernels').onclick=run;
    for (const id of ['material','volume','mass','selected-kernel','user-source']) $(id).addEventListener('input',invalidate);
    $('reset-code').onclick=()=>{$('user-source').value=example;invalidate();};
    $('save-position').onclick=()=>{
      if(!current)return;
      const position=structuredClone({...current,name:$('snapshot-name').value.trim()||`Position ${positions.length+1}`,volumeText:$('volume').value,massText:$('mass').value});
      const next=[...positions,position];
      try {localStorage.setItem(STORE,JSON.stringify({format:1,positions:next}));positions=next;renderPositions();}
      catch { $('kernel-error').textContent='Could not save this position in browser storage. Download it instead.'; }
    };
    $('export-position').onclick=()=>{
      if(!current)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify({format:'wmt.kernel-position/1',...current},null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='wmt-kernel-position.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    renderPositions();
  } catch(error) { $('lab-ready').textContent='Could not start kernel experiment';fail(error); }
}
boot();
