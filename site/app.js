// world-model-trajectories — the instrument.
// wmt-core (Rust→wasm) owns the typed IR, the IR↔SMT compiler, the English
// renderer, the trajectory, and the lattice/repair drivers. Z3 (wasm) is
// the only solver. The human reads their sentence + our English render —
// never logic syntax. Per-commit cache-busting: __WMTVER__ is replaced
// with the short commit SHA at deploy (locally a harmless query value).
const VER = '__WMTVER__';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const short = (id) => id.replace(/^c_/, '').replace(/_/g, ' ');
let engine, Z3, z3ok = false;

async function boot() {
  const m = await import(`./pkg/wmt_core.js?v=${VER}`);
  // the z3-solver browser bundle is CJS→ESM: only a default export (the
  // exports object) — there is no named `init`. (A real-browser headless
  // test caught this; it had been latently broken.)
  const z3mod = await import('./vendor/z3/z3-solver.bundle.mjs');
  const z3Init = (z3mod.default && z3mod.default.init) || z3mod.init;
  await m.default(`./pkg/wmt_core_bg.wasm?v=${VER}`);
  engine = new m.WmtEngine();
  try {
    const z = await z3Init();
    Z3 = z.Z3; z3ok = true;
    const el = $('#z3'); el.textContent = 'Z3 ready'; el.classList.add('rdy');
  } catch (e) { $('#z3').textContent = 'Z3 failed'; console.error(e); }
  wire();
  refresh();
}

async function run(script) {
  const cfg = Z3.mk_config();
  const ctx = Z3.mk_context(cfg);
  const out = await Z3.eval_smtlib2_string(ctx, script);
  try { Z3.del_context(ctx); } catch (_) {}
  return String(out).trim();
}
const z3head = (o) => (o.split('\n').map((x) => x.trim()).find(Boolean) || '');

async function driveDriver() {
  engine.analyze_begin();
  let g = 0;
  for (let s = engine.analyze_next(); s; s = engine.analyze_next()) {
    engine.analyze_feed(await run(s));
    if (++g > 600) break;
  }
  return JSON.parse(engine.analyze_result());
}
async function driveLattice() {
  engine.lattice_begin();
  let g = 0;
  for (let s = engine.lattice_next(); s; s = engine.lattice_next()) {
    engine.lattice_feed(await run(s));
    if (++g > 4096) break;
  }
  return JSON.parse(engine.lattice_result());
}
async function driveDefeasible() {
  engine.defeasible_begin();
  let g = 0;
  for (let s = engine.defeasible_next(); s; s = engine.defeasible_next()) {
    engine.defeasible_feed(await run(s));
    if (++g > 800) break;
  }
  return JSON.parse(engine.defeasible_result());
}
async function driveWitness(formulaObj) {
  engine.witness_begin(JSON.stringify(formulaObj));
  let g = 0;
  for (let s = engine.witness_next(); s; s = engine.witness_next()) {
    engine.witness_feed(await run(s));
    if (++g > 200) break;
  }
  return JSON.parse(engine.witness_result());
}

let META = { claims: [] };

function renderClaims(statusOf) {
  const box = $('#claims');
  box.innerHTML = META.claims.length ? '' :
    '<p class="muted small">empty — load the penguin trajectory, or add a claim.</p>';
  for (const c of META.claims) {
    const st = c.active ? (statusOf ? statusOf(c.id) : 'coherent') : 'inactive';
    const d = document.createElement('div');
    d.className = `claim ${c.active ? st : 'inactive'}`;
    d.id = 'cl-' + c.id;
    const back = c.back
      ? `<div class="back">your LLM read it back as: <i>${esc(c.back)}</i></div>` : '';
    d.innerHTML =
      `<div class="src">${esc(c.source || c.gloss || c.id)}</div>` + back +
      `<div class="ren">${esc(c.render)}</div>` +
      `<div class="foot">` +
      `<span class="cid">${esc(c.id)}</span>` +
      `<span class="wt">w<input type="number" min="1" max="99" value="${c.weight}" data-w="${esc(c.id)}"></span>` +
      `<label class="dfz" title="a default — may be overridden by a more-specific or higher-priority claim instead of contradicting"><input type="checkbox" data-d="${esc(c.id)}"${c.defeasible ? ' checked' : ''}>default</label>` +
      `<span class="dot ${c.active ? st : 'inactive'}" title="${st}"></span>` +
      (c.active
        ? `<button class="btn tiny ghost" data-a="retract" data-id="${esc(c.id)}">retract</button>`
        : `<button class="btn tiny ghost" data-a="reactivate" data-id="${esc(c.id)}">restore</button>`) +
      `<button class="btn tiny ghost" data-a="remove" data-id="${esc(c.id)}">×</button>` +
      `</div>`;
    box.appendChild(d);
  }
  box.querySelectorAll('button[data-a]').forEach((b) => b.onclick = () => {
    const { a, id } = b.dataset;
    if (a === 'retract') engine.retract(id);
    else if (a === 'reactivate') engine.reactivate(id);
    else engine.remove(id);
    refresh();
  });
  box.querySelectorAll('input[data-w]').forEach((i) => i.onchange = () => {
    engine.set_weight(i.dataset.w, parseInt(i.value, 10) || 1); refresh();
  });
  box.querySelectorAll('input[data-d]').forEach((i) => i.onchange = () => {
    engine.set_defeasible(i.dataset.d, i.checked); refresh();
  });
}

function svgField(activeIds, muses) {
  const n = activeIds.length;
  if (!n) return '';
  const W = 640, H = Math.max(260, 90 + n * 26), cx = 210, cy = H / 2, R = Math.min(cy - 40, 150);
  const pt = (i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  };
  const hues = ['#b9534a', '#d99a3f', '#5b8a5a', '#2a3a55', '#8a6a47'];
  let hulls = '';
  muses.forEach((m, k) => {
    const col = hues[k % hues.length];
    const pts = m.map((id) => pt(activeIds.indexOf(id))).filter((p) => p[0] !== undefined);
    if (pts.length >= 2) {
      const dpath = pts.map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + ' Z';
      hulls += `<path d="${dpath}" fill="${col}22" stroke="${col}" stroke-width="1.5" stroke-dasharray="${pts.length === 2 ? '4 3' : '0'}"/>`;
    }
  });
  let nodes = '';
  activeIds.forEach((id, i) => {
    const [x, y] = pt(i);
    nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#faf6ea" stroke="#241f19" stroke-width="1.5"/>` +
      `<text x="${(x + (x < cx ? -10 : 10)).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="12" font-family="'JetBrains Mono',monospace" fill="#241f19" text-anchor="${x < cx ? 'end' : 'start'}">${esc(short(id))}</text>`;
  });
  let legend = '';
  muses.forEach((m, k) => {
    legend += `<rect x="430" y="${28 + k * 22}" width="12" height="12" fill="${hues[k % hues.length]}33" stroke="${hues[k % hues.length]}"/>` +
      `<text x="450" y="${38 + k * 22}" font-size="12" font-family="'JetBrains Mono',monospace" fill="#241f19">disagreement ${k + 1} (${m.length})</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="conflict structure">${hulls}${nodes}${legend}</svg>`;
}

function afBlock(af,groups) {
  const row = (label, ids, klass, note) =>
    `<div class="acc ${klass}"><b>${label}</b> <span class="muted small">${note}</span><div>` +
    (ids.length ? ids.map((x) => `<code class="tok">${esc(short(x))}</code>`).join(' · ') : '—') +
    `</div></div>`;
  return `<div class="fieldlabel">Collective conflicts · acceptance across coherent positions</div>` +
    svgField(LAST.active, groups) +
    `<div class="accept">` +
    row('skeptical', af.skeptical, 'necessary', 'in every maximal coherent position') +
    row('contested', af.credulous.filter((x) => !af.skeptical.includes(x)), 'contested', 'defensible, but some position rejects it') +
    row('defeated', af.defeated, 'defeated', 'no coherent position keeps it') +
    `</div><p class="small muted">Each shaded group is a whole minimal conflict. Removing any member makes that group consistent. Pair co-membership is not a binary attack: P, Q, and ¬(P ∧ Q) conflict together while all pairs are consistent. Acceptance counts come from the maximal coherent positions, not binary Dung extensions.</p>`;
}

// Increment C — the forkable trajectory tree. A branch is a snapshot of
// the whole world-model (engine.export_state, guaranteed round-trip).
// Fork = save here; switch = load a snapshot; compare = two summaries +
// the claim-set delta, side by side. Persisted so a trajectory survives
// reload. The engine owns (de)serialization; the tree lives here.
const LSKEY = 'wmt.tree.v2';
let TREE = (() => { try { return JSON.parse(localStorage.getItem(LSKEY)) || { nodes: [], seq: 0 }; } catch (_) { return { nodes: [], seq: 0 }; } })();
let CUR = null;       // id of the branch the live engine was loaded from
let SEL = [];         // up to two node ids selected for compare
let LAST = { active: [], summary: null };
const persist = () => { try { localStorage.setItem(LSKEY, JSON.stringify(TREE)); } catch (_) {} };
const nodeOf = (id) => TREE.nodes.find((x) => x.id === id);
function depthOf(id) { let d = 0, p = nodeOf(id); while (p && p.parent) { d++; p = nodeOf(p.parent); } return d; }

function claimsOfState(state) {
  try { return (JSON.parse(state).claims || []); } catch (_) { return []; }
}
function claimDelta(sa, sb) {
  const A = new Map(claimsOfState(sa).map((c) => [c.id, JSON.stringify(c.formula) + '|' + (c.active !== false)]));
  const B = new Map(claimsOfState(sb).map((c) => [c.id, JSON.stringify(c.formula) + '|' + (c.active !== false)]));
  const onlyA = [], onlyB = [], changed = [];
  for (const k of A.keys()) (B.has(k) ? (A.get(k) !== B.get(k) && changed.push(k)) : onlyA.push(k));
  for (const k of B.keys()) if (!A.has(k)) onlyB.push(k);
  return { onlyA, onlyB, changed };
}

function saveBranch(name) {
  const id = 'b' + TREE.seq++;
  TREE.nodes.push({
    id, name: name || `branch ${TREE.seq}`, parent: CUR,
    ts: Date.now(), state: engine.export_state(), summary: LAST.summary,
  });
  CUR = id; persist(); renderTree();
}
async function switchTo(id) {
  const nd = nodeOf(id); if (!nd) return;
  JSON.parse(engine.import_state(nd.state));
  CUR = id; SEL = []; await refresh();
}
function delBranch(id) {
  TREE.nodes = TREE.nodes.filter((x) => x.id !== id);
  TREE.nodes.forEach((x) => { if (x.parent === id) x.parent = null; });
  if (CUR === id) CUR = null;
  SEL = SEL.filter((x) => x !== id);
  persist(); renderTree();
}
const sumChip = (s) => s
  ? `<span class="bchip ${s.status}">${s.status}${s.status === 'inconsistent' ? ` · ${s.conflicts} conflict${s.conflicts === 1 ? '' : 's'} · ${s.positions} pos` : ` · ${s.kept} claims`}</span>`
  : `<span class="bchip muted">unanalyzed</span>`;

function renderTree() {
  const box = document.querySelector('#branches');
  if (!box) return;
  if (!TREE.nodes.length) {
    box.innerHTML = '<p class="muted small">No branches yet. Get to a state worth keeping, then “Save this state as a branch”. Fork it, change a claim, save again — compare the two.</p>';
    document.querySelector('#cmp').innerHTML = '';
    return;
  }
  box.innerHTML = TREE.nodes.map((nd) => {
    const sel = SEL.includes(nd.id);
    return `<div class="bnode${nd.id === CUR ? ' cur' : ''}${sel ? ' sel' : ''}" style="margin-left:${depthOf(nd.id) * 16}px">` +
      `<div class="brow"><b>${esc(nd.name)}</b> ${sumChip(nd.summary)}${nd.id === CUR ? '<span class="bchip cur">loaded</span>' : ''}</div>` +
      `<div class="bact">` +
      `<button class="btn tiny" data-b="load" data-id="${nd.id}">switch to</button>` +
      `<button class="btn tiny ghost" data-b="cmp" data-id="${nd.id}">${sel ? '✓ compare' : 'compare'}</button>` +
      `<button class="btn tiny ghost" data-b="del" data-id="${nd.id}">×</button>` +
      `</div></div>`;
  }).join('');
  box.querySelectorAll('button[data-b]').forEach((btn) => btn.onclick = () => {
    const { b, id } = btn.dataset;
    if (b === 'load') switchTo(id);
    else if (b === 'del') delBranch(id);
    else {
      SEL = SEL.includes(id) ? SEL.filter((x) => x !== id) : [...SEL, id].slice(-2);
      renderTree(); renderCompare();
    }
  });
  renderCompare();
}

function renderCompare() {
  const out = document.querySelector('#cmp'); if (!out) return;
  if (SEL.length !== 2) { out.innerHTML = SEL.length === 1 ? '<p class="muted small">Select one more branch to compare.</p>' : ''; return; }
  const [a, b] = SEL.map(nodeOf);
  if (!a || !b) { out.innerHTML = ''; return; }
  const col = (nd) => {
    const s = nd.summary;
    return `<div class="cmpcol"><h4>${esc(nd.name)}</h4>${sumChip(s)}` +
      (s ? `<ul class="small">` +
        `<li>skeptical: ${s.skeptical.map((x) => `<code class="tok">${esc(short(x))}</code>`).join(' ') || '—'}</li>` +
        `<li>contested: ${s.contested.map((x) => `<code class="tok">${esc(short(x))}</code>`).join(' ') || '—'}</li>` +
        `<li>defeated: ${s.defeated.map((x) => `<code class="tok">${esc(short(x))}</code>`).join(' ') || '—'}</li>` +
        `</ul>` : '<p class="small muted">no analysis captured</p>') + `</div>`;
  };
  const d = claimDelta(a.state, b.state);
  const list = (t, xs) => `<div><b>${t}</b> ${xs.length ? xs.map((x) => `<code class="tok">${esc(short(x))}</code>`).join(' · ') : '—'}</div>`;
  out.innerHTML = `<div class="fieldlabel">Branch compare</div><div class="cmpgrid">${col(a)}${col(b)}</div>` +
    `<div class="cmpdelta">` +
    list(`only in ${esc(a.name)}:`, d.onlyA) +
    list(`only in ${esc(b.name)}:`, d.onlyB) +
    list('reformulated / toggled between them:', d.changed) +
    `</div>`;
}

async function forced() {
  // probe 0-ary propositions AND ground atoms (predicates on declared
  // constants) — "you never asserted this but are committed to it".
  const probes = [
    ...(META.bool_atoms || []).map((a) => ({ label: a, formula: { op: 'pred', name: a, args: [] } })),
    ...(META.ground_atoms || []),
  ];
  const out = [];
  for (const p of probes) {
    let val = null, formula = null;
    if (z3head(await run(engine.smt_entails_json(JSON.stringify(p.formula)))) === 'unsat') {
      val = true; formula = p.formula;
    } else if (z3head(await run(engine.smt_entails_json(JSON.stringify({ op: 'not', x: p.formula })))) === 'unsat') {
      val = false; formula = { op: 'not', x: p.formula };
    }
    if (val === null) continue;
    // explanation witness: the minimal set of claims that forces it.
    let because = [];
    if (out.length < 8) { // bound the extra solver work, honestly
      const w = await driveWitness(formula);
      if (w.entailed) because = w.witness || [];
    }
    out.push([p.label, val, because]);
  }
  return out.length
    ? `<div class="fieldlabel">What you're committed to</div><div class="forced">` +
      out.map(([a, v, b]) =>
        `<div><code class="tok">${esc(a)}</code> = ${v ? 'true' : 'false'}` +
        (b && b.length ? ` <span class="muted">— because ${b.map((x) => `<code class="tok">${esc(short(x))}</code>`).join(' · ')}</span>` : '') +
        `</div>`).join('') +
      `</div>` : '';
}

// Z3-wasm runs one async session at a time; a click during an in-flight
// analysis would start a second and crash it. Serialize: at most one
// refresh runs; the latest requested state re-runs once it finishes.
let _refreshing = false, _rerun = false;
async function refresh() {
  if (_refreshing) { _rerun = true; return; }
  _refreshing = true;
  try { await doRefresh(); }
  finally {
    _refreshing = false;
    if (_rerun) { _rerun = false; refresh(); }
  }
}
async function doRefresh() {
  META = JSON.parse(engine.meta());
  renderClaims(null);
  const status = $('#status'), field = $('#field');
  if (!z3ok) { status.className = 'statusbar warn'; status.innerHTML = '<span>Z3 not loaded</span>'; return; }
  const active = META.claims.filter((c) => c.active).map((c) => c.id);
  LAST.active = active;
  if (!active.length) {
    status.className = 'statusbar muted';
    status.innerHTML = '<span>no active claims</span>'; field.innerHTML = '';
    LAST.summary = { status: 'empty', kept: 0, conflicts: 0, positions: 0, skeptical: [], contested: [], defeated: [] };
    return;
  }
  status.className = 'statusbar muted';
  status.innerHTML = '<span class="spin"></span><span>analyzing the trajectory with Z3…</span>';
  field.innerHTML = '';

  const drv = await driveDriver();
  const lat = await driveLattice();

  // dialectical status per active claim
  let statusOf;
  if (lat.consistent || drv.status === 'consistent') {
    statusOf = () => 'coherent';
  } else if (lat.capped || !lat.mss || !lat.mss.length) {
    // budget reached: the conflicts found are real, but the position
    // set is partial — only claim contested/coherent, never necessary
    // or defeated (those need the full lattice). Honest under-claim.
    const inMus = new Set((lat.mus || []).flat());
    statusOf = (id) => (inMus.has(id) ? 'contested' : 'coherent');
  } else {
    const P = lat.mss;
    statusOf = (id) => {
      const k = P.filter((p) => p.includes(id)).length;
      return k === P.length ? 'necessary' : k === 0 ? 'defeated' : 'contested';
    };
  }
  renderClaims(statusOf);

  if (drv.status === 'unknown' || lat.unknown) {
    status.className = 'statusbar warn';
    status.innerHTML = '<span class="big">undecided</span><span>Z3 returned <code>unknown</code> (or the IR was ill-formed) — this is <b>not</b> a verdict, and <b>not</b> assumed consistent. Surfaced, never masked.</span>';
    LAST.summary = { status: 'unknown', kept: active.length, conflicts: 0, positions: 0, skeptical: [], contested: [], defeated: [] };
    renderTree();
    return;
  }
  if (lat.consistent || drv.status === 'consistent') {
    status.className = 'statusbar ok';
    status.innerHTML = '<span class="big">coherent</span><span>every active claim holds together — one position: all of them.</span>';
    // Capture the summary + render the tree *synchronously*, before the
    // async forced() — otherwise a save triggered the instant the status
    // text flips to "coherent" snapshots the stale (pre-repair) summary.
    // (The real-browser e2e on slower CI Chromium caught exactly this.)
    LAST.summary = { status: 'coherent', kept: active.length, conflicts: 0, positions: 1, skeptical: active.slice(), contested: [], defeated: [] };
    renderTree();
    field.innerHTML = await forced();
    return;
  }

  // Defeasible reading: if any active claim is a default, a "conflict"
  // may just be a default overridden by a more-specific / higher-priority
  // claim. Specificity is derived from the user's OWN strict claims
  // (Poole) and the survivors are a Brewka preferred subtheory — all
  // checked by Z3, none hand-ranked. Strict-only conflicts are NOT
  // rescued (honest): then we fall through to the hard view.
  const anyDef = META.claims.some((c) => c.active && c.defeasible);
  if (anyDef) {
    const df = await driveDefeasible();
    const rOf = (id) => { const c = META.claims.find((x) => x.id === id); return c ? (c.source || c.render || id) : id; };
    if (df.status === 'coherent' || df.status === 'defeasibly-coherent') {
      const soft = df.status === 'defeasibly-coherent';
      status.className = 'statusbar ok';
      status.innerHTML = `<span class="big">${soft ? 'coherent — a default was overridden' : 'coherent'}</span><span>${soft
        ? 'not a contradiction: the specific beats the general, derived from your own claims.'
        : 'every claim (defaults included) holds together.'}</span>`;
      let h = '';
      if (soft) {
        h += `<div class="fieldlabel">Defaults overridden · the specific beats the general</div>`;
        df.overridden.forEach((o) => {
          const by = (o.by || []).map((b) => `<code class="tok">${esc(short(b))}</code>`).join(' · ');
          h += `<div class="ovr"><b>${esc(short(o.id))}</b> — <span class="muted">“${esc(rOf(o.id))}”</span><div class="small">overridden by ${by || 'the surviving position'} ${df.specificity.some(([m, l]) => l === o.id) ? '<span class="muted">(more specific — entailed by your strict claims)</span>' : '<span class="muted">(higher entrenchment)</span>'}</div></div>`;
        });
        h += `<div class="fieldlabel">Held position · the preferred subtheory</div><div class="pos"><div class="keeps small">${df.position.map((p) => `<code class="tok">${esc(short(p))}</code>`).join(' · ')}</div></div>`;
        h += `<p class="small muted">Poole specificity + Brewka preferred subtheory, every step checked by Z3. Mark a claim strict (uncheck “default”) to forbid overriding it. Strict-only contradictions are never papered over.</p>`;
      }
      LAST.summary = { status: 'coherent', kept: active.length, conflicts: 0, positions: 1, skeptical: df.position.slice(), contested: [], defeated: df.overridden.map((o) => o.id) };
      renderTree();
      field.innerHTML = h + (await forced());
      return;
    }
    // df.status === 'inconsistent' → strict core genuinely conflicts
  }

  // inconsistent
  status.className = 'statusbar bad';
  status.innerHTML = `<span class="big">inconsistent</span><span>${lat.mus.length} irreducible disagreement${lat.mus.length > 1 ? 's' : ''}, ${lat.mss.length} coherent position${lat.mss.length > 1 ? 's' : ''}${lat.capped ? ' <b>so far</b> — enumeration budget reached; these are real but not exhaustive' : ''}</span>`;

  const muses = (lat.mus && lat.mus.length) ? lat.mus : [drv.mus || []];
  let html = svgField(active, muses);

  // Offer the defeasible lens: many "contradictions" in a world-model
  // are really a general rule with a specific exception (the penguin).
  const ruleIds = META.claims.filter((c) => c.active && /^for every/.test(c.render || '')).map((c) => c.id);
  if (ruleIds.length >= 2 && !anyDef) {
    html += `<div class="pos suggested"><h4>Is this really a contradiction?</h4>` +
      `<div class="keeps small">If some of these are <em>defaults</em> (“birds fly”) with a more-specific exception (“penguins don’t”), this isn’t inconsistent — the specific overrides the general. Specificity is derived from your own strict claims, not hand-ranked.</div>` +
      `<div class="row"><button class="btn warm sm" id="asdefaults">Treat the universal rules as defaults</button></div></div>`;
  }
  const triMus = (muses[0] && muses[0].length) ? muses[0] : (drv.mus || []);
  if (orKey() && triMus.length) {
    html += `<div class="pos"><h4>Real disagreement, or mis-formalization?</h4>` +
      `<div class="keeps small">Ask your model whether this minimal conflict is a genuine belief clash or a translation artifact. Any fix it proposes is re-run through Z3 first — it is applied only if the solver confirms the conflict is gone. Model proposes, solver disposes.</div>` +
      `<div class="row"><button class="btn sm" id="triage">Ask the model about <code class="tok">${triMus.map((x) => esc(short(x))).join(' · ')}</code></button></div>` +
      `<div id="triageout"></div></div>`;
  }

  // optimal repair (min total entrenchment) from the driver
  const drop = (drv.repair && drv.repair.drop) || [];
  html += `<div class="fieldlabel">Optimal repair · least entrenchment to give up</div>`;
  html += `<div class="pos suggested"><h4><span class="star">★</span> drop ${drop.map((x) => `<code class="tok">${esc(short(x))}</code>`).join(' · ')} <span class="muted small">(weight ${esc(drv.repair ? drv.repair.weight : '?')})</span></h4>` +
    `<div class="keeps small">the cheapest way back to coherence by your entrenchment weights — a suggestion, not a verdict. The selection is yours.</div>` +
    `<div class="row"><button class="btn warm sm" id="applyrep">adopt this repair</button></div></div>`;

  // Positions & conflicts: MARCO gives the real sets even when the
  // budget caps enumeration — render them, display-cap long lists with
  // an honest "+N more" (the computation is complete to the budget; only
  // the on-screen list is trimmed).
  const POS_SHOW = 12;
  const positions = lat.mss || [];
  html += `<div class="fieldlabel">Positions · maximal sets that cohere${positions.length > POS_SHOW ? ` <span class="muted">(${POS_SHOW} of ${positions.length})</span>` : ''}</div><div class="positions">`;
  positions.slice(0, POS_SHOW).forEach((p, i) => {
    const gives = active.filter((id) => !p.includes(id));
    const isSug = drop.length && gives.length === drop.length && drop.every((d) => gives.includes(d));
    html += `<div class="pos${isSug ? ' suggested' : ''}"><h4>${isSug ? '<span class="star">★</span>' : ''}Position ${String.fromCharCode(65 + (i % 26))} <span class="muted small">keeps ${p.length}/${active.length}</span></h4>` +
      `<div class="gives">concedes: ${gives.map((g) => `<code class="tok">${esc(short(g))}</code>`).join(' · ') || '—'}</div>` +
      `<div class="row"><button class="btn ghost sm" data-pos='${esc(JSON.stringify(gives))}'>adopt — retract the conceded</button></div></div>`;
  });
  html += `</div>`;
  html += `<div class="fieldlabel">Irreducible disagreements${(lat.mus || []).length > POS_SHOW ? ` <span class="muted">(${POS_SHOW} of ${lat.mus.length})</span>` : ''}</div>`;
  (lat.mus || []).slice(0, POS_SHOW).forEach((m, k) => {
    html += `<div class="mus"><b>conflict ${k + 1}:</b> these cannot all hold — ${m.map((x) => `<code class="tok">${esc(short(x))}</code>`).join(' · ')}</div>`;
  });
  if (lat.capped) {
    html += `<p class="small muted">Enumeration stopped at the honest budget — the conflicts and positions above are real and solver-verified, but there may be more. Never silently truncated.</p>`;
  }

  const af = lat.af || { attacks: [], skeptical: [], credulous: [], defeated: [] };
  if (!lat.capped) html += afBlock(af,lat.mus);
  const contested = af.credulous.filter((x) => !af.skeptical.includes(x));
  LAST.summary = {
    status: 'inconsistent',
    kept: active.length,
    conflicts: (lat.mus || []).length,
    positions: (lat.mss || []).length,
    skeptical: af.skeptical.slice(),
    contested,
    defeated: af.defeated.slice(),
  };
  field.innerHTML = html;
  renderTree();

  $('#asdefaults')?.addEventListener('click', () => { ruleIds.forEach((id) => engine.set_defeasible(id, true)); refresh(); });
  $('#triage')?.addEventListener('click', () => triageConflict(triMus));
  $('#applyrep')?.addEventListener('click', () => { drop.forEach((id) => engine.retract(id)); refresh(); });
  field.querySelectorAll('button[data-pos]').forEach((b) => b.onclick = () => {
    JSON.parse(b.dataset.pos).forEach((id) => engine.retract(id)); refresh();
  });
}

// Optional auto-formalize seam: OpenRouter, bring-your-own-key. This is
// the ONLY path that sends data off the tab — explicitly opt-in, the
// user's key, stored only in localStorage. It does not weaken the honest
// seam: the model still only proposes the typed IR; the engine still
// compiles & checks it; the human still confirms the English render.
const OR = 'wmt.or.v1';
function loadOR() {
  try { return JSON.parse(localStorage.getItem(OR)) || {}; } catch (_) { return {}; }
}
function saveOR(k, m) {
  try { localStorage.setItem(OR, JSON.stringify({ k, m })); } catch (_) {}
}
// Robust: models sometimes wrap JSON in prose/fences despite instruction.
function extractJSON(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON object in the model reply');
  return text.slice(a, b + 1);
}
const orModel = () => (($('#ormodel') && $('#ormodel').value) || '').trim()
  || (loadOR().m) || 'anthropic/claude-sonnet-4';
const orKey = () => (($('#orkey') && $('#orkey').value) || '').trim() || (loadOR().k) || '';
// Shared OpenRouter call. Returns the message content or throws.
async function orCall(prompt) {
  const key = orKey(), model = orModel();
  if (!key) throw new Error('no OpenRouter API key');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'world-model-trajectories',
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0 }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && (j.error.message || JSON.stringify(j.error))) || ('HTTP ' + r.status));
  const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!reply) throw new Error('empty reply: ' + JSON.stringify(j).slice(0, 300));
  return reply;
}

async function autoFormalize() {
  const key = orKey(), model = orModel();
  const nl = ($('#nl').value || '').trim();
  const stat = $('#orstat'), errs = $('#errs');
  errs.innerHTML = '';
  if (!key) { stat.textContent = 'need an OpenRouter API key'; return; }
  if (!nl) { stat.textContent = 'enter a claim in Step 1 first'; return; }
  saveOR(key, model);
  stat.innerHTML = `formalizing with ${esc(model)} <span class="spin"></span>`;
  let reply;
  try { reply = await orCall(engine.prompt(nl)); }
  catch (e) {
    stat.textContent = '';
    errs.innerHTML = '<div class="errbox">OpenRouter: ' + esc(e.message || e) + '</div>';
    return;
  }
  // Surface what the model produced (the seam stays visible, not hidden).
  let ir;
  try { ir = extractJSON(reply); } catch (e) {
    stat.textContent = '';
    $('#json').value = reply;
    errs.innerHTML = '<div class="errbox">model did not return parseable IR JSON (' + esc(e.message) + ') — its raw reply is in Step 2 for you to inspect/fix</div>';
    return;
  }
  $('#json').value = ir;
  let res;
  try { res = JSON.parse(engine.ingest(ir)); }
  catch (e) { stat.textContent = ''; errs.innerHTML = '<div class="errbox">engine error: ' + esc(e) + '</div>'; return; }
  if (!res.ok) {
    stat.textContent = 'IR rejected — see errors (raw IR kept in Step 2)';
    errs.innerHTML = '<div class="errbox">' + res.errors.map(esc).join('\n') + '</div>';
    return;
  }
  stat.textContent = 'formalized & ingested — confirm the English renders below';
  $('#json').value = '';
  refresh();
}

// Increment F — conflict triage (abductive). The model judges whether a
// minimal conflict is a genuine disagreement or a formalization artifact,
// and may propose corrected IR. Its proposal is NOT trusted: we apply it
// to a snapshot, re-run the solver, and only surface an "apply" button if
// Z3 confirms the conflict actually disappears. Model proposes, solver
// disposes.
async function triageConflict(musIds) {
  const out = $('#triageout');
  if (!musIds || !musIds.length) { out.innerHTML = '<div class="errbox">no conflict to triage</div>'; return; }
  out.innerHTML = `<span class="muted small">asking ${esc(orModel())} <span class="spin"></span></span>`;
  let parsed;
  try {
    const reply = await orCall(engine.triage_prompt_json(JSON.stringify(musIds)));
    parsed = JSON.parse(extractJSON(reply));
  } catch (e) { out.innerHTML = '<div class="errbox">triage: ' + esc(e.message || e) + '</div>'; return; }
  const verdict = String(parsed.verdict || '').toLowerCase();
  const reason = esc(parsed.reason || '(no reason given)');
  if (verdict === 'intrinsic' || !parsed.fix) {
    out.innerHTML = `<div class="ovr"><b>genuine disagreement</b> — ${reason}<div class="small muted">The model judges these sentences themselves to conflict; the resolution is yours (a position / repair above).</div></div>`;
    return;
  }
  // formalization claim — verify the model's fix with Z3 before trusting.
  const fixStr = JSON.stringify(parsed.fix);
  const snap = engine.export_state();
  let fixedConsistent = false;
  try {
    const ir = JSON.parse(engine.ingest(fixStr));
    if (ir.ok) {
      // Verify with the SAME reasoning the app shows: strict, OR — if
      // the fix turns a claim into a default — the defeasible reading.
      const lat = await driveLattice();
      const drv = await driveDriver();
      fixedConsistent = !!(lat.consistent || drv.status === 'consistent');
      if (!fixedConsistent) {
        const df = await driveDefeasible();
        fixedConsistent = df.status === 'coherent' || df.status === 'defeasibly-coherent';
      }
    }
  } catch (_) {}
  JSON.parse(engine.import_state(snap)); // always restore; nothing applied yet
  if (fixedConsistent) {
    out.innerHTML = `<div class="ovr"><b>mis-formalization</b> — ${reason}` +
      `<div class="small">Z3 re-checked the model's corrected IR: the conflict disappears. <b>✓ verified</b></div>` +
      `<div class="row"><button class="btn warm sm" id="applyfix">Apply the verified fix</button></div></div>`;
    $('#applyfix').onclick = () => { engine.ingest(fixStr); refresh(); };
  } else {
    out.innerHTML = `<div class="ovr"><b>model said mis-formalization — but Z3 disagrees</b><div class="small">${reason}<br>Its proposed fix does <b>not</b> remove the conflict, so nothing was changed. The model is never trusted over the solver.</div></div>`;
  }
}

function wire() {
  $('#seed').onclick = () => { engine.reset(); engine.seed_demo(); refresh(); };
  $('#scenario') && ($('#scenario').onclick = () => { engine.reset(); engine.seed_scenario(); refresh(); });
  { const s = loadOR(); if (s.k) $('#orkey').value = s.k; if (s.m) $('#ormodel').value = s.m; }
  $('#autoform').onclick = autoFormalize;
  $('#mkprompt').onclick = () => { $('#prompt').value = engine.prompt($('#nl').value || ''); };
  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('#prompt').value); $('#copy').textContent = 'Copied'; setTimeout(() => ($('#copy').textContent = 'Copy'), 1200); }
    catch (_) { $('#prompt').select(); }
  };
  $('#ingest').onclick = () => {
    let r;
    try { r = JSON.parse(engine.ingest($('#json').value || '')); }
    catch (e) { $('#errs').innerHTML = '<div class="errbox">engine error: ' + esc(e) + '</div>'; return; }
    $('#errs').innerHTML = r.ok ? '' : '<div class="errbox">' + r.errors.map(esc).join('\n') + '</div>';
    if (r.ok) { $('#json').value = ''; }
    refresh();
  };
  $('#savebranch').onclick = () => {
    const nm = ($('#branchname').value || '').trim();
    saveBranch(nm); $('#branchname').value = '';
  };
  renderTree();
}

boot();
