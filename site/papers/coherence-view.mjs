// A read-only projection of exact solver receipts. No solver calls or bucket writes.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sameSet=(a,b)=>a.length===b.length && a.every(id=>b.includes(id));
export function coherenceModel(receipt) {
  const a=receipt.analysis,complete=a.complete===true && a.stopReason==='completed' && ['consistent','inconsistent'].includes(a.status);
  const positions=complete?a.positions:[];
  const check=receipt.consistency,known=check?.complete===true && check.stopReason==='completed' && check.inputDigest===receipt.inputDigest && ['consistent','inconsistent'].includes(check.status),verdict=known?check.status:complete?a.status:'unknown';
  return {complete,verdict,positions,conflicts:a.conflicts??[],claims:receipt.inputIR.claims.map((c,i)=>{
    const count=positions.filter(p=>p.keep.includes(c.id)).length;
    return {...c,label:'C'+(i+1),count,acceptance:!complete?'unresolved':count===positions.length?'every':count?'some':'none'};
  }),repair:complete?a.repair:null};
}
const acceptanceText={every:'Every position',some:'Some positions',none:'No position',unresolved:'Unresolved'};
function conflictSVG(model,page,selectedClaim,selectedConflict) {
  const conflicts=model.conflicts.slice(page*8,page*8+8),W=650,H=Math.max(190,model.claims.length*48+44,conflicts.length*62+44);
  const y=i=>40+i*48,cy=i=>40+i*62;
  const label=new Map(model.claims.map((c,i)=>[c.id,{...c,y:y(i)}]));
  const lines=conflicts.flatMap((ids,i)=>ids.map(id=>{const c=label.get(id);return c?`<path class="conflict-link ${selectedClaim===id || selectedConflict===page*8+i?'focused':''}" data-conflict-edge="${page*8+i}" d="M 125 ${c.y} C 290 ${c.y}, 330 ${cy(i)}, 480 ${cy(i)}"/>`:'';})).join('');
  const claims=model.claims.map((c,i)=>`<g class="map-claim ${c.acceptance} ${selectedClaim===c.id?'selected':''}" role="button" tabindex="0" data-map-claim="${i}" aria-label="${esc(c.label+': '+c.source+'. '+acceptanceText[c.acceptance])}" aria-pressed="${selectedClaim===c.id}"><title>${esc(c.source)}</title><rect x="16" y="${y(i)-17}" width="110" height="34" rx="17"/><text x="71" y="${y(i)+5}" text-anchor="middle">${c.label}</text></g>`).join('');
  const groups=conflicts.map((ids,i)=>`<g class="map-conflict ${selectedConflict===page*8+i?'selected':''}" role="button" tabindex="0" data-map-conflict="${page*8+i}" aria-label="Conflict ${page*8+i+1}: ${ids.length} claims must not all hold together" aria-pressed="${selectedConflict===page*8+i}"><rect x="480" y="${cy(i)-19}" width="154" height="38" rx="6"/><text x="557" y="${cy(i)+5}" text-anchor="middle">Conflict ${page*8+i+1} · ${ids.length}</text></g>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Claim to conflict membership map">${lines}${claims}${groups}</svg>`;
}
export function mountCoherenceView(root,{receipt,submission,beforeBucket,onPosition=()=>{}}) {
  const model=coherenceModel(receipt),claims=new Map(model.claims.map(c=>[c.id,c]));
  const oldIds=new Set(beforeBucket?.ir.claims.map(c=>c.id)??[]),locators=new Map();
  for(const mapping of submission?.proposal?.mappings??[]) {
    const source=submission.extraction.claims.find(c=>c.id===mapping.sourceClaimId);
    if(source)for(const id of mapping.formalClaimIds)locators.set(id,source.locator);
  }
  let selectedClaim=null,selectedConflict=null,position=null,matrixPage=0,conflictPage=0;
  function render() {
    const scrolls=['.conflict-map','.position-matrix','.claim-inspector'].map(selector=>{const el=root.querySelector(selector);return {selector,top:el?.scrollTop??0,left:el?.scrollLeft??0};});
    const counts=Object.fromEntries(['every','some','none'].map(k=>[k,model.claims.filter(c=>c.acceptance===k).length]));
    const suggested=model.positions.flatMap((p,i)=>sameSet(p.drop,model.repair?.drop??[])?[i]:[]);
    root.innerHTML=`<div class="coherence-view"><div class="section-heading"><div><p class="kick">Coherence field · exact check</p><h3>See what can hold together</h3></div><span class="solver-state ${model.verdict}">${model.verdict==='consistent'?'SAT · all claims together':model.verdict==='inconsistent'?'UNSAT · full claim set':'Unresolved · consistency unknown'}</span></div>
      <p class="small muted">${esc(beforeBucket?.name??receipt.before.id)} v${receipt.before.version} + the reviewed paper. ${model.complete?'Each position is a maximal satisfiable subset of these claims.':'No exhaustive positions, acceptance or repair can be inferred.'} This is claim-set satisfiability, not a truth assignment or a proof of the paper.</p>
      ${model.complete?`<div class="sat-metrics"><span><b>${model.positions.length}</b> coherent positions</span><span><b>${model.conflicts.length}</b> minimal conflicts</span><span><b>${counts.every}</b> in every position</span><span><b>${counts.some}</b> in some</span><span><b>${counts.none}</b> in none</span></div>`:`<p class="unresolved-note">${model.verdict==='inconsistent'?'The full conjunction is known to conflict. ':''}${esc(receipt.analysis.message??receipt.analysis.stopReason)}. Alternative positions and repairs are not exhaustively available; the original bucket is unchanged.</p>`}
      <div class="coherence-columns"><section><h4>Conflict structure</h4><p class="small muted">Lines mean membership in a conflict group. All claims in a group cannot hold together; a line does not assert a pairwise contradiction. Select a claim or group.</p>
      <div class="map-legend">${model.complete?'<span class="every">● Every position</span><span class="some">◐ Some positions</span><span class="none">○ No position</span>':'<span>○ Unresolved</span>'}</div>
      ${model.conflicts.length?`<p class="scroll-hint">Scroll sideways to explore the full map →</p><div class="conflict-map" tabindex="0" aria-label="Scrollable conflict structure">${conflictSVG(model,conflictPage,selectedClaim,selectedConflict)}</div>${model.conflicts.length>8?`<div class="map-pagination"><button class="btn ghost sm" data-conflict-page="-1" ${conflictPage===0?'disabled':''}>Previous groups</button><span>Groups ${conflictPage*8+1}–${Math.min(model.conflicts.length,conflictPage*8+8)} of ${model.conflicts.length}</span><button class="btn ghost sm" data-conflict-page="1" ${(conflictPage+1)*8>=model.conflicts.length?'disabled':''}>Next groups</button></div>`:''}`:'<p class="no-conflicts">'+(model.complete?'No conflict groups. All input claims can hold together.':'No conflict groups available from this check.')+'</p>'}</section>
      <section class="claim-inspector" aria-label="Selected claim or conflict"><h4>${selectedConflict!==null?'Conflict '+(selectedConflict+1):selectedClaim?esc(claims.get(selectedClaim).label):'Read the claims'}</h4><div id="coherence-inspector"></div></section></div>
      ${model.complete?`<section class="position-matrix-section"><div class="section-heading"><h4>Claims × coherent positions</h4><label>Inspect position<select data-position-choice><option value="">All positions</option>${model.positions.map((p,i)=>`<option value="${i}" ${position===i?'selected':''}>Position ${i+1}${suggested.includes(i)?' · least-cost repair':''}</option>`).join('')}</select></label></div><p class="small muted">Keep / Give up refers to the claim as written, including its negation. Giving it up leaves it unasserted; it does not assert the opposite. Colors summarize all ${model.positions.length} positions.</p>
      <p class="scroll-hint">Scroll sideways for more position columns →</p><div class="position-matrix" tabindex="0" aria-label="Scrollable claim by position table"><table><caption>Solver-verified membership · positions ${matrixPage*8+1}–${Math.min(model.positions.length,matrixPage*8+8)} of ${model.positions.length}</caption><thead><tr><th scope="col">Claim / source</th><th scope="col">Acceptance</th>${model.positions.slice(matrixPage*8,matrixPage*8+8).map((p,j)=>{const i=matrixPage*8+j;return `<th scope="col"><button data-position="${i}" aria-pressed="${position===i}">P${i+1}${suggested.includes(i)?' ★':''}</button></th>`;}).join('')}</tr></thead><tbody>${model.claims.map((c,i)=>`<tr class="${selectedClaim===c.id?'selected':''}" data-claim-row="${i}"><th scope="row"><button data-inspect-claim="${i}" aria-pressed="${selectedClaim===c.id}"><b>${c.label}</b> ${esc(c.source)}</button><span class="claim-origin">${oldIds.has(c.id)?'Bucket':locators.has(c.id)?'Paper · p. '+locators.get(c.id).page:'Reviewed claim'}</span><span class="mobile-acceptance ${c.acceptance}">${acceptanceText[c.acceptance]} · ${c.count}/${model.positions.length}</span></th><td><span class="acceptance ${c.acceptance}">${acceptanceText[c.acceptance]} · ${c.count}/${model.positions.length}</span></td>${model.positions.slice(matrixPage*8,matrixPage*8+8).map((p,j)=>`<td class="${p.keep.includes(c.id)?'kept':'given-up'} ${position===matrixPage*8+j?'position-selected':''}">${p.keep.includes(c.id)?'✓ Keep':'− Give up'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${model.positions.length>8?`<div class="map-pagination"><button class="btn ghost sm" data-matrix-page="-1" ${matrixPage===0?'disabled':''}>Previous positions</button><span>Page ${matrixPage+1} of ${Math.ceil(model.positions.length/8)}</span><button class="btn ghost sm" data-matrix-page="1" ${(matrixPage+1)*8>=model.positions.length?'disabled':''}>Next positions</button></div>`:''}
      ${model.repair?`<div class="repair-guide"><b>★ Least entrenchment to give up: ${esc(model.repair.weight)}</b><p class="small">${model.repair.drop.map(id=>esc(claims.get(id)?.label+': '+claims.get(id)?.source)).join(' · ')||'Nothing — all claims cohere.'} Weights reflect your inputs, not truth or evidence quality. Other equal-cost positions may exist.</p></div>`:''}<p class="small" data-position-summary aria-live="polite"></p></section>`:''}</div>`;
    const inspector=root.querySelector('#coherence-inspector');
    const selected=selectedConflict!==null?model.conflicts[selectedConflict]:selectedClaim?[selectedClaim]:model.claims.map(c=>c.id);
    inspector.innerHTML=(selectedConflict!==null?'<p class="small">This whole set is unsatisfiable; each proper subset is satisfiable.</p>':'')+selected.map(id=>{
      const c=claims.get(id),loc=locators.get(id);if(!c)return '';
      const rendered=receipt.analysis.renderedClaims?.find(r=>r.id===id)?.render;
      return `<article class="inspected-claim ${c.acceptance}"><button data-inspect-claim="${model.claims.indexOf(c)}"><b>${c.label}</b> ${esc(c.source)}</button><p class="small">${acceptanceText[c.acceptance]}${model.complete?' · '+c.count+'/'+model.positions.length:''} · Weight ${esc(c.weight??1)}</p>${selectedClaim===id?`<p class="small">${oldIds.has(id)?'Present in the original bucket. ':''}${loc?'PDF page '+loc.page+' · text '+loc.start+'–'+loc.end:!oldIds.has(id)?'No PDF locator for this claim.':''}</p>${rendered?`<p class="small">WMT reads: ${esc(rendered)}</p>`:''}<code>${esc(id)}</code>`:''}</article>`;
    }).join('')||'<p class="small muted">No assumptions in this claim set.</p>';
    function focusClaim(index){selectedClaim=model.claims[index].id;selectedConflict=null;render();root.querySelector(`[data-inspect-claim="${index}"]`)?.focus({preventScroll:true});}
    root.querySelectorAll('[data-inspect-claim]').forEach(b=>b.onclick=()=>focusClaim(Number(b.dataset.inspectClaim)));
    root.querySelectorAll('[data-map-claim]').forEach(b=>activate(b,()=>focusClaim(Number(b.dataset.mapClaim))));
    root.querySelectorAll('[data-map-conflict]').forEach(b=>activate(b,()=>{selectedConflict=Number(b.dataset.mapConflict);selectedClaim=null;render();root.querySelector(`[data-map-conflict="${selectedConflict}"]`)?.focus({preventScroll:true});}));
    function choose(i){position=i;matrixPage=i===null?matrixPage:Math.floor(i/8);render();onPosition(i);root.querySelector('[data-position-choice]')?.focus({preventScroll:true});}
    root.querySelectorAll('[data-position]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.position)));
    const choice=root.querySelector('[data-position-choice]');if(choice)choice.onchange=()=>choose(choice.value===''?null:Number(choice.value));
    root.querySelectorAll('[data-matrix-page]').forEach(b=>b.onclick=()=>{matrixPage+=Number(b.dataset.matrixPage);render();});
    root.querySelectorAll('[data-conflict-page]').forEach(b=>b.onclick=()=>{conflictPage+=Number(b.dataset.conflictPage);render();});
    const summary=root.querySelector('[data-position-summary]');if(summary)summary.textContent=position===null?'Select a column to highlight its matching position card below.':`Position ${position+1}: keeps ${model.positions[position].keep.length}/${model.claims.length}; gives up ${model.positions[position].drop.length}. See the matching card below${receipt.outcome==='conflict'?' to create a separate bucket fork':''}.`;
    for(const {selector,top,left} of scrolls){const el=root.querySelector(selector);if(el){el.scrollTop=top;el.scrollLeft=left;}}
  }
  render();
}
function activate(element,fn){element.onclick=fn;element.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}};}

export function trajectoryRows(workspace) {
  const key=r=>JSON.stringify([r.id,r.version,r.digest]),nodes=new Map(workspace.versions.map(v=>[key(v),v])),children=new Map();
  for(const v of nodes.values())if(v.parent && nodes.has(key(v.parent))){const k=key(v.parent);children.set(k,[...(children.get(k)??[]),v]);}
  const rows=[],seen=new Set();
  function walk(v,depth){const k=key(v);if(seen.has(k))return;seen.add(k);rows.push({bucket:v,depth,missingParent:!!v.parent&&!nodes.has(key(v.parent))});for(const c of children.get(k)??[])walk(c,depth+1);}
  for(const v of nodes.values())if(!v.parent||!nodes.has(key(v.parent)))walk(v,0);
  for(const v of nodes.values())walk(v,0);
  return rows;
}
export function mountTrajectoryView(root,{workspace,activeId,onSelect}) {
  const rows=trajectoryRows(workspace),heads=new Set(workspace.heads.map(r=>JSON.stringify([r.id,r.version,r.digest])));
  root.innerHTML=rows.length?`<div class="trajectory-heading"><h3>World-model trajectories</h3><p class="small muted">Each node is an immutable bucket version. Connected children are appends or coherent forks. Select a version to compare with its current bucket.</p></div><ol class="bucket-trajectory" aria-label="Bucket versions and forks">${rows.map(({bucket:b,depth,missingParent},i)=>`<li style="--depth:${Math.min(depth,5)}" class="${depth?'trajectory-child':''} ${b.id===activeId?'active-trajectory':''}"><button data-trajectory-node="${i}" aria-label="${esc(b.name)} version ${b.version}${heads.has(JSON.stringify([b.id,b.version,b.digest]))?', current head':''}"><span class="trajectory-dot" aria-hidden="true"></span><span><b>${esc(b.name)} <span>v${b.version}</span></b><span class="trajectory-meta">${esc(b.scope)} · ${b.ir.claims.length} claims · ${esc(b.provenance.operation==='adopt_coherent_position'?'Coherent fork':b.provenance.operation==='append'?'Append':'Created')}${heads.has(JSON.stringify([b.id,b.version,b.digest]))?' · current head':''}</span>${b.parent?`<span class="trajectory-meta">From ${esc(nodesName(b.parent))} v${b.parent.version}${missingParent?' · parent outside this workspace':''}</span>`:''}</span></button></li>`).join('')}</ol>`:'<p class="small muted">Create a bucket to begin a trajectory.</p>';
  function nodesName(ref){return workspace.versions.find(v=>v.id===ref.id && v.version===ref.version && v.digest===ref.digest)?.name??ref.id;}
  root.querySelectorAll('[data-trajectory-node]').forEach(b=>b.onclick=()=>onSelect(rows[Number(b.dataset.trajectoryNode)].bucket));
}
