import {buildCandidateReview} from '../sdk/proof-candidates.mjs';
import {mountCandidateReview,restoreCandidateFeedback} from './candidate-review.mjs';
import {renderMathText} from './math-text.mjs';
import {createWorkerClient,createSubmission,formalizeSubmission,reviewSubmission,controlledParser,mergeIR,
  makeEntailmentProof,verifySubmissionProofs,BucketRepository,exportSidecar,requireThat} from '../sdk/index.mjs';
import * as pdfjs from '../vendor/pdfjs/pdf.mjs';
import {mountCoherenceView,mountTrajectoryView} from './coherence-view.mjs';
import {PASSAGES,STEPS,passageCandidates,formulaText,formulaNodes,sourceRanges} from './walkthrough-model.mjs';

let candidateReview=null,candidateNotice='';const candidateView={order:'review',filter:'all',search:'',page:0};
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const client=createWorkerClient(()=>new Worker(new URL('./worker.js',import.meta.url)));
let step=0,unlocked=0,busy=false,controller,pdf,bytes,paper=null,rendered=[],sourceKey='A1',formalKey='A1',nodeIndex=0,pageNumber=1,zoom=1;
let scenario=null,probe=null,repository=new BucketRepository(client),receipts=[],receiptIndex=0,fork=null,selectedPosition=null;
let renderJob,ticket=0,resizeTimer;
const candidates=()=>paper?passageCandidates(paper):PASSAGES;
const passage=key=>candidates().find(p=>p.key===key);
const claimId=key=>{const p=passage(key);return paper?.proposal?.mappings.find(m=>m.sourceClaimId===p.candidate?.id)?.formalClaimIds[0];};
const formalClaim=key=>paper?.proposal?.ir.claims.find(c=>c.id===claimId(key));
const stageDone=()=>[!!pdf,!!paper,!!paper?.proposal,!!paper?.review,paper?.proofReceipts.length===2&&paper.proofReceipts.every(r=>r.result.status==='checked'),!!fork,true][step];
const gateNotes=['Read either page, then continue.','Extract the candidates to continue.','Run the parser to inspect its typed output.','Confirm the five mappings and defer unresolved language.','Check the lemma and theorem before continuing.','Check both buckets and choose a coherent fork.','Your run is ready to export.'];

async function task(label,fn) {
  if(busy)return;busy=true;controller=new AbortController();$('walk-error').textContent='';$('walk-progress').textContent=label;
  document.querySelectorAll('button,input,select').forEach(e=>e.disabled=true);$('walk-cancel').hidden=false;$('walk-cancel').disabled=false;
  try{await fn(controller.signal);}catch(error){$('walk-error').textContent=String(error.message??error);}
  finally{busy=false;$('walk-progress').textContent='';$('walk-cancel').hidden=true;render();updatePdfControls();}
}
async function showSource(key) {
  sourceKey=key;const p=passage(key);pageNumber=p.page;
  $('pdf-selection').innerHTML=`<b>${esc(p.key)} · ${esc(p.role)}</b><div>“${renderMathText(p.quote)}”</div><span>${p.candidate?`PDF page ${p.page} · text ${p.candidate.locator.start}–${p.candidate.locator.end} · ${esc(p.candidate.id)}`:'Author-annotated example passage; extraction has not run yet.'}</span>`;
  await drawPage();
}
function updatePdfControls() {
  $('pdf-prev').disabled=busy||!pdf||pageNumber<=1;$('pdf-next').disabled=busy||!pdf||pageNumber>=pdf.numPages;
  $('pdf-zoom').disabled=busy||!pdf;$('pdf-page-label').textContent=`Page ${pageNumber} / ${pdf?.numPages??2}`;
  $('pdf-zoom').textContent=zoom===1?'Enlarge':'Fit page';
}
async function drawPage() {
  if(!pdf || $('pdf-scroll').clientWidth<40)return;
  const current=++ticket;renderJob?.cancel();
  try {
    if(renderJob)try{await renderJob.promise;}catch{}
    const page=await pdf.getPage(pageNumber);if(current!==ticket)return;
    const width=Math.max(240,$('pdf-scroll').clientWidth-22),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:width/base.width*zoom});
    const canvas=$('pdf-canvas'),dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.floor(viewport.width*dpr);canvas.height=Math.floor(viewport.height*dpr);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
    canvas.setAttribute('aria-label',`Page ${pageNumber} of the synthetic example paper`);$('pdf-sheet').style.width=viewport.width+'px';$('pdf-sheet').style.height=viewport.height+'px';
    renderJob=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});await renderJob.promise;
    if(current!==ticket)return;
    const content=await page.getTextContent(),{text,ranges}=sourceRanges(content.items),p=passage(sourceKey),quote=p?.page===pageNumber?p.quote:null;
    if(paper)requireThat(text===paper.document.pages[pageNumber-1].text,'Rendered/extracted PDF text differs; source highlighting stopped.');
    const start=quote?text.indexOf(quote):-1,end=start+(quote?.length??0);
    const hits=start<0?[]:ranges.filter(r=>r.end>start && r.start<end && r.item.str.trim());
    $('pdf-highlights').innerHTML=hits.map(r=>{
      const transform=pdfjs.Util.transform(viewport.transform,r.item.transform),h=Math.max(8,r.item.height*viewport.scale),w=r.item.width*viewport.scale;
      const left=Math.max(0,start-r.start)/r.item.str.length,right=Math.min(r.item.str.length,end-r.start)/r.item.str.length;
      return `<span class="pdf-highlight" style="left:${transform[4]+w*left}px;top:${transform[5]-h}px;width:${w*(right-left)}px;height:${h+3}px"></span>`;
    }).join('');
    $('pdf-page-text').textContent=paper?.document.pages[pageNumber-1].text??'Available after extraction in step 2.';
    $('pdf-error').textContent='';updatePdfControls();
  }catch(error){if(current===ticket && error.name!=='RenderingCancelledException')$('pdf-error').textContent=String(error.message??error);}
}
function header(title,lede){return `<p class="kick">${step+1} / ${STEPS.length} · ${STEPS[step][0]}</p><h2 id="stage-title" tabindex="-1">${title}</h2><p>${lede}</p>`;}
function sourceCard(p,{status='',review=false}={}) {
  return `<article class="walk-card ${sourceKey===p.key?'selected':''}" data-passage="${esc(p.key)}"><span class="role">${esc(p.key)} · ${esc(p.role)}</span><blockquote>${renderMathText(p.quote)}</blockquote><p class="small">${esc(p.note)}</p>${p.candidate?`<div class="walk-metadata">Page ${p.page} · text ${p.candidate.locator.start}–${p.candidate.locator.end} · SDK kind: ${esc(p.candidate.kind)}</div>`:''}${status?`<p class="small">${esc(status)}</p>`:''}<button class="source-jump" data-source="${esc(p.key)}">Show this passage in the PDF</button>${review?`<label class="walk-check"><input type="checkbox" data-confirm="${esc(p.key)}" ${paper.review?'checked disabled':''}>I confirm that this formula captures this source statement.</label><div class="formula-line">${esc(formulaText(formalClaim(p.key).formula))}</div>`:''}</article>`;
}
function renderInspect() {
  return header('Start with the actual paper.','Use the page arrows or select a passage. The highlighted text stays in its printed context.')+
    `<div class="walk-note">This two-page example contains explicit author labels. They describe the author’s intent; a heading called “Theorem” is not evidence that a theorem has been proved.</div>
    <h3>What to look for</h3>${PASSAGES.filter(p=>['A1','O1','L1','T1','U1'].includes(p.key)).map(p=>sourceCard(p)).join('')}
    <p class="small muted">The next step extracts candidates from these same bytes. No claims or proof verdicts are preloaded.</p>`;
}
function renderExtract() {
  let body=header('From page text to candidate claims.','Run the real PDF text extractor. Each candidate carries its exact page, character offsets, quotation, and source hash.')+
    `<button class="btn" id="walk-extract" ${paper?'disabled':''}>${paper?'PDF extracted':'Extract from this PDF'}</button>`;
  if(!paper)return body+'<p class="small muted">Author labels will be shown separately from the SDK’s heuristic claim kinds.</p>';
  const known=new Set(candidates().map(p=>p.candidate.id)),other=paper.extraction.claims.filter(c=>!known.has(c.id));
  return body+`<div class="walk-note"><b>${paper.document.pageCount} pages · ${paper.extraction.claims.length} candidates · candidate_partial</b><p class="small">Seven annotated passages guide this demo; ${other.length} additional text candidates are retained as context. Candidate extraction is not a complete paper understanding.</p><code class="walk-metadata">PDF SHA-256 ${esc(paper.document.sha256)}</code></div>`+
    `<details open><summary>Review roles, scope and ambiguity interpretations</summary><div id="walk-candidate-review"></div></details>`+candidates().map(p=>sourceCard(p)).join('')+`<details><summary>Other extracted candidates (${other.length})</summary>${other.map(c=>`<div class="walk-card"><blockquote>${renderMathText(c.statement)}</blockquote><p class="walk-metadata">p. ${c.locator.page} · ${c.locator.start}–${c.locator.end} · ${esc(c.kind)}</p></div>`).join('')}</details>`;
}
function renderFormalize() {
  let body=header('See the primitives, then the composition.','The controlled parser builds typed WMT formulas. Symbols and logical operators carry the meaning; the JSON is their inspectable representation.')+
    `<button class="btn" id="walk-formalize" ${paper?.proposal?'disabled':''}>${paper?.proposal?'Typed proposal created':'Parse supported candidates'}</button>`;
  if(!paper?.proposal)return body+'<p class="small muted">Five source statements fit the declared grammar. Ambiguous and contextual language will stay unsupported.</p>';
  const formal=candidates().filter(p=>claimId(p.key)),c=formalClaim(formalKey),nodes=formulaNodes(c.formula),r=rendered.find(r=>r.id===c.id);
  return body+`<div class="primitive-strip"><span>Thing · sort</span>${paper.proposal.ir.preds.map(p=>`<span>${esc(p.name)} : ${esc(p.args.join(' × '))} → Bool</span>`).join('')}<span>tweety : Thing · constant</span></div>
    <p class="small">These vocabulary declarations come from the configured example lexicon. A sort and a predicate declare an interface; they do not, by themselves, assert which individuals satisfy it.</p>
    <label>Inspect a formalized passage<select id="formal-passage">${formal.map(p=>`<option value="${p.key}" ${formalKey===p.key?'selected':''}>${p.key} · ${esc(p.quote)}</option>`).join('')}</select></label>
    ${sourceCard(passage(formalKey))}<div class="formula-line">${esc(formulaText(c.formula))}</div><p class="small"><b>WMT reads:</b> ${esc(r?.render)}</p>
    <h3>Build the expression from its parts</h3><p class="small muted">Select an operator or term to see its job. The indentation shows composition.</p><ol class="ast-nodes">${nodes.map((n,i)=>`<li><button data-node="${i}" style="--depth:${n.depth}" aria-pressed="${i===nodeIndex}"><b>${esc(n.kind)}</b> · ${esc(n.text)}</button></li>`).join('')}</ol><div class="primitive-explanation" aria-live="polite"><b>${esc(nodes[nodeIndex]?.kind)}</b><p>${esc(nodes[nodeIndex]?.explanation)}</p><code class="walk-metadata">${esc(nodes[nodeIndex]?.path)}</code></div>
    <details><summary>Exact typed WMT IR for this claim</summary><pre>${esc(JSON.stringify(c,null,2))}</pre></details><p class="small muted">${paper.proposal.ir.claims.length} formulas proposed; ${paper.proposal.unsupported.length} candidates remain unsupported. ${paper.review?'These mappings have already been reviewed; this is the same inspectable proposal.':'Nothing has been reviewed or put into a bucket yet.'}</p>`;
}
function renderResolve() {
  return header('Ambiguity is a decision point.','Review the five supported source-to-formula mappings. Keep the two unresolved passages visible instead of silently strengthening or binding them.')+
    `<div class="walk-note"><b>Roles are author annotations.</b> This walkthrough associates A1/A2/O1/L1/T1 with the printed labels. The SDK’s heuristic may call them “model” candidates; it does not reliably recognize arbitrary theorems or lemmas.</div>`+
    ['U1','U2'].map(key=>sourceCard(passage(key),{status:paper.proposal.unsupported.find(u=>u.sourceClaimId===passage(key).candidate.id)?.reason})).join('')+
    `<h3>Try one possible reading</h3><p class="small">Replacing “normally” with “all” produces <code>∀ x:Thing. Bird(x) → Flies(x)</code>. That is a stronger, authored interpretation. Test its effect without adopting it.</p><button class="btn ghost sm" id="test-strict-reading">Test the strict universal reading</button>${scenario?`<div class="walk-note" data-ambiguity-result><b>${scenario.complete?scenario.status.toUpperCase():'UNRESOLVED'}</b><p class="small">${scenario.complete&&scenario.status==='inconsistent'?`This scenario has ${scenario.conflicts.length} minimal conflicts with the supported paper claims. The stronger reading was not added to the proposal.`:scenario.message??'Scenario checked. No interpretation was adopted.'}</p></div>`:''}
    <h3>Your selected formalization subset</h3>${candidates().filter(p=>claimId(p.key)).map(p=>sourceCard(p,{review:true})).join('')}
    <label class="walk-check"><input id="defer-ambiguity" type="checkbox" ${paper.review?'checked disabled':''}>Defer U1 (“normally”) and U2 (“it”). I have not resolved their meaning, and they will stay outside the strict bucket input.</label>
    <button class="btn" id="walk-review" ${paper.review?'disabled':''}>${paper.review?'Five mappings confirmed; ambiguity deferred':'Confirm these mappings and deferrals'}</button>${paper.review?'<p class="small" data-review-complete>Review recorded. The lemma and theorem are still only source-stated until their checks run.</p>':''}`;
}
function renderProofs() {
  const result=new Map(paper.proofReceipts.map(r=>[r.proofId,r]));
  return header('A theorem label becomes a checked obligation.','The built-in checker asks whether the named, consistent premises entail the exact conclusion. It excludes the conclusion from its own premises.')+
    ['L1','T1'].map(key=>{const p=passage(key),r=result.get('proof:walk:'+key);return `<article class="walk-card"><span class="role">${key} · ${p.role}</span><div class="walk-proof-flow">${p.premises.map(k=>`<button data-source="${k}">${k}</button>`).join('<span>+</span>')}<span>⊢</span><button data-source="${key}">${key}</button></div><div class="formula-line">${esc(formulaText(formalClaim(key).formula))}</div><p class="small">${p.premises.map(k=>esc(k+': '+passage(k).quote)).join(' + ')}</p><p class="proof-status ${esc(r?.result.status)}" data-proof-result="${key}">${esc(r?.result.status??'Not checked')} · ${esc(r?.result.reason??'Source-stated; run the checker.')}</p>${r?`<details><summary>Exact proof binding and receipt</summary><pre>${esc(JSON.stringify(r,null,2))}</pre></details>`:''}</article>`;}).join('')+
    `<button id="walk-prove" class="btn" ${paper.proofReceipts.length===2&&paper.proofReceipts.every(r=>r.result.status==='checked')?'disabled':''}>${paper.proofReceipts.length===2&&paper.proofReceipts.every(r=>r.result.status==='checked')?'Both entailments checked':'Check lemma and theorem'}</button>
    <h3>What if a premise is missing?</h3><p class="small">Try proving T1 from A2 alone, without O1. This is a separate diagnostic; it does not replace the attached proof.</p><button class="btn ghost sm" id="walk-probe">Try without the observation</button>${probe?`<div class="walk-note" data-missing-premise><b>${esc(probe.status)}</b><p class="small">${esc(probe.reason??probe.message)}</p><p class="small">Failure to entail means “not established from these premises”; it does not establish the opposite.</p></div>`:''}
    <p class="small muted">Axiom and observation inputs remain assumptions. A checked entailment establishes a conditional result over this formalization; the PDF’s proof sketch is not itself executed.</p>`;
}
function renderBuckets() {
  return header('One paper. Different starting assumptions.','Form an RFC bucket from the reviewed paper, then test it against a personal bucket that assumes “All birds are fliers.” Both use the actual WMT/Z3 solver.')+
    `<button class="btn" id="walk-buckets" ${receipts.length===2?'disabled':''}>${receipts.length===2?'Both bucket checks complete':'Form and check both buckets'}</button>`+
    (receipts.length?`<div class="walk-bucket-actions">${receipts.map((r,i)=>`<button class="btn ghost sm" data-receipt="${i}" aria-pressed="${receiptIndex===i}">${i===0?'RFC: paper model':'Personal: broad flight rule'} · ${esc(r.outcome)}</button>`).join('')}</div><div class="walk-note" id="walk-bucket-outcome"></div><div id="walk-coherence"></div><div id="walk-positions" class="walk-position-list"></div><div class="walk-note"><b>Proof dependencies and bucket membership are different.</b><p class="small">This SDK treats every reviewed formula as an assertion when computing coherence. A fork can retain a theorem while dropping one of its original proof premises; that does not create a new proof from the fork. Proof receipts retain their exact premise bindings.</p></div><div id="walk-trajectories"></div>${fork?`<p data-fork-complete><b>Created “${esc(fork.name)}”.</b> The original personal bucket stays at v1. You can inspect either check above before continuing.</p>`:''}`:'<p class="small muted">The demo workspace is separate from your paper workbench. No existing buckets will be changed.</p>');
}
function renderExport() {
  return header('Take the whole chain with you.','The result is an inspectable record: PDF bytes, exact source spans, typed formulas, your selected subset, checked computational evidence, and version-bound bucket receipts.')+
    `<div class="walk-card"><h3>Your run</h3><p>Two pages → ${paper.extraction.claims.length} candidate spans → five reviewed formulas → two checked entailments → an RFC model and a separate coherent fork.</p><p class="small">U1 and U2 remain unresolved and excluded. ${paper.extraction.claims.length-7} other contextual candidates remain in the extraction record.</p></div>
    <div class="walk-export"><button class="btn" id="walk-download-sidecar">Download paper + evidence sidecar</button><button class="btn ghost" id="walk-download-workspace">Download bucket workspace</button><button class="btn ghost" id="walk-download-reading">Download reading annotations</button></div>
    <p class="small">To continue in the <a href="papers.html">paper workbench</a>, restore the downloaded bucket workspace. Bucket heads are rechecked, and you will confirm the paper mappings and proof checks again. The author-role annotations are a separate reading aid.</p>
    <div id="walk-trajectories"></div><details><summary>What actually ran, and what remains a seam?</summary><ul class="small"><li>Real PDF.js text extraction and rendering, typed IR construction, WMT/Z3 entailment and full coherence enumeration, immutable bucket append/fork operations.</li><li>A controlled grammar and a configured example vocabulary. The example’s author-role annotations are curated, not general theorem extraction.</li><li>No OCR, external model, Lean/Isabelle project check, empirical validation, or journal publication in this walkthrough.</li></ul></details><p class="small"><a href="papers/walkthrough.pdf" target="_blank" rel="noopener">Reopen the source PDF</a> · <a href="sdk/README.md">SDK / API guide</a></p>`;
}
function render() {
  $('walk-steps').innerHTML=STEPS.map(([name],i)=>`<li><button data-step="${i}" ${i>unlocked||busy?'disabled':''} ${i===step?'aria-current="step"':''}><span>${i+1}${i<unlocked?' ✓':''}</span>${name}</button></li>`).join('');
  document.querySelector('.walk-main').dataset.step=step;
  $('walk-stage').innerHTML=[renderInspect,renderExtract,renderFormalize,renderResolve,renderProofs,renderBuckets,renderExport][step]();
  $('walk-back').disabled=busy||step===0;$('walk-next').disabled=busy||!stageDone();$('walk-next').hidden=step===6;
  $('walk-gate').textContent=stageDone()&&step<6?'Explore this step, or continue.':gateNotes[step];
  document.querySelectorAll('[data-step]').forEach(b=>{if(b.tagName==='BUTTON')b.onclick=()=>navigate(Number(b.dataset.step));});
  document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{showSource(b.dataset.source).then(()=>{if(innerWidth<=1000)document.querySelector('.paper-reader').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});document.querySelectorAll('[data-passage]').forEach(card=>card.classList.toggle('selected',card.dataset.passage===sourceKey));});
  if(step===1&&paper&&candidateReview)mountCandidateReview($('walk-candidate-review'),{document:paper.document,extraction:paper.extraction,review:candidateReview,view:candidateView,notice:candidateNotice,onChange:r=>{candidateReview=r;},onLocate:c=>{const p=candidates().find(p=>p.candidate.id===c.id);if(p)showSource(p.key);else {pageNumber=c.locator.page;drawPage();}}});
  $('walk-extract')?.addEventListener('click',()=>task('Extracting text and exact source-located candidates…',async signal=>{
    const next=await createSubmission({bytes:bytes.slice(),fileName:'walkthrough.pdf',title:'A small theory of Tweety',authors:['WMT synthetic teaching paper']},client,{signal});
    requireThat(passageCandidates(next).every(p=>p.candidate),'The PDF text did not match every annotated passage. No demo claims were fabricated.');paper=next;const review=await buildCandidateReview(paper.document,paper.extraction),restored=await restoreCandidateFeedback(review,paper.document,paper.extraction);candidateReview=restored.review;candidateNotice=restored.notice;await showSource(sourceKey);
  }));
  $('walk-formalize')?.addEventListener('click',()=>task('Parsing the supported candidates into typed WMT claims…',async signal=>{
    const next=await formalizeSubmission(paper);requireThat(next.proposal.ir.claims.length===5,'Expected exactly five supported source statements.');
    const meta=await client.request('render',{ir:next.proposal.ir},{signal});requireThat(Array.isArray(meta.claims),meta.message??'Typed rendering failed.');paper=next;rendered=meta.claims;await showSource(formalKey);
  }));
  $('formal-passage')?.addEventListener('change',e=>{formalKey=e.target.value;nodeIndex=0;showSource(formalKey);render();});
  document.querySelectorAll('[data-node]').forEach(b=>b.onclick=()=>{nodeIndex=Number(b.dataset.node);render();document.querySelector(`[data-node="${nodeIndex}"]`)?.focus({preventScroll:true});});
  $('test-strict-reading')?.addEventListener('click',()=>task('Testing the stronger authored interpretation, without adopting it…',async signal=>{
    const strict=await controlledParser()({id:'c_walk_strict_scenario',statement:'All birds are fliers.'});
    scenario=await client.analyze(mergeIR(paper.proposal.ir,strict),{signal});
  }));
  $('walk-review')?.addEventListener('click',()=>{
    const selected=[...document.querySelectorAll('[data-confirm]:checked')].map(e=>e.dataset.confirm),defer=$('defer-ambiguity').checked;
    task('Recording your explicit source/formula review and ambiguity deferral…',async()=>{
      requireThat(selected.length===5 && defer,'Confirm all five source/formula mappings and the deferral of both ambiguous passages.');
      paper=await reviewSubmission(paper,{actorId:'person:walkthrough',sourceClaimIds:selected.map(k=>passage(k).candidate.id)});
    });
  });
  $('walk-prove')?.addEventListener('click',()=>task('Checking two exact entailments from their named, consistent premises…',async signal=>{
    paper.proofs=[];
    for(const key of ['L1','T1'])paper.proofs.push(await makeEntailmentProof(paper,{id:'proof:walk:'+key,targetClaimId:claimId(key),premiseClaimIds:passage(key).premises.map(claimId)}));
    paper=await verifySubmissionProofs(paper,client,{signal});
  }));
  $('walk-probe')?.addEventListener('click',()=>task('Checking the theorem from A2 alone, excluding its observation and conclusion…',async signal=>{
    probe=await client.entailment(paper.review.ir,{targetClaimId:claimId('T1'),premiseClaimIds:[claimId('A2')]},{signal});
  }));
  $('walk-buckets')?.addEventListener('click',()=>task('Forming two separate buckets and checking their exact inputs…',async signal=>{
    const next=new BucketRepository(client),owner='person:walkthrough';
    const rfc=await next.create({id:'bucket:walk-rfc',name:'Paper RFC model',scope:'rfc',rfcRef:'RFC-WALKTHROUGH@1',owner,signal});
    const background=await controlledParser()({id:'c_walk_background',statement:'All birds are fliers.'});
    const personal=await next.create({id:'bucket:walk-personal',name:'My broad flight assumption',owner,ir:background,signal});
    const results=[];
    for(const bucket of [rfc,personal])results.push((await next.submit(bucket.id,{expectedVersion:bucket.version,expectedDigest:bucket.digest,actorId:owner,submission:paper,idempotencyKey:'walk:'+bucket.id,signal})).receipt);
    requireThat(results[0].outcome==='inserted' && results[1].outcome==='conflict','The solver did not complete both expected checks. No partial demo workspace was adopted.');
    repository=next;receipts=results;receiptIndex=0;
  }));
  document.querySelectorAll('[data-receipt]').forEach(b=>b.onclick=()=>{receiptIndex=Number(b.dataset.receipt);selectedPosition=null;render();});
  if(receipts.length && step===5)renderBucketEvidence();
  if((step===5||step===6)&&receipts.length)mountTrajectoryView($('walk-trajectories'),{workspace:repository.export(),activeId:fork?.id??receipts[receiptIndex].after.id,onSelect:b=>{
    const index=receipts.findIndex(r=>r.before.id===b.id);if(index>=0){receiptIndex=index;step=5;selectedPosition=null;render();}else $('walk-gate').textContent=`${b.name} v${b.version} · ${b.ir.claims.length} retained assertions. Parent: ${b.parent?.id??'none'} v${b.parent?.version??''}.`;
  }});
  $('walk-download-sidecar')?.addEventListener('click',()=>download(exportSidecar(paper,{bucketReceipts:repository.export().receipts,buckets:repository.export().versions}),'wmt-walkthrough-sidecar.json'));
  $('walk-download-workspace')?.addEventListener('click',()=>download({format:'wmt.paper-workspace/1',bucketWorkspace:repository.export(),submission:paper},'wmt-walkthrough-workspace.json'));
  $('walk-download-reading')?.addEventListener('click',()=>download({format:'wmt.walkthrough-reading/1',documentHash:paper.document.sha256,annotationSource:'Curated author labels in a synthetic teaching paper; not an SDK extraction guarantee',passages:candidates().map(({candidate,...p})=>({...p,sourceClaimId:candidate.id,locator:candidate.locator,formalClaimId:claimId(p.key)??null,deferred:p.key.startsWith('U')}))},'wmt-walkthrough-reading.json'));
}
function renderBucketEvidence() {
  const r=receipts[receiptIndex],b=repository.get(r.before.id,r.before.version);
  $('walk-bucket-outcome').innerHTML=r.outcome==='inserted'?'<b>RFC bucket: formed at v2.</b><p class="small">The empty v1 accepted all five reviewed formulas. This records coherence; it does not validate the observation.</p>':'<b>Personal bucket: unchanged at v1.</b><p class="small">The broad flight rule conflicts with the paper. Explore the maximal coherent positions and choose a new fork. The original bucket is preserved.</p>';
  mountCoherenceView($('walk-coherence'),{receipt:r,submission:paper,beforeBucket:b,onPosition:i=>{
    selectedPosition=i;document.querySelectorAll('[data-fork-position]').forEach(card=>card.classList.toggle('selected',Number(card.dataset.forkPosition)===i));
  }});
  if(r.outcome!=='conflict')return;
  const sources=new Map(r.inputIR.claims.map(c=>[c.id,c.source]));
  $('walk-positions').innerHTML=r.analysis.positions.map((p,i)=>`<article class="walk-card ${selectedPosition===i?'selected':''}" data-fork-position="${i}"><h3>Position ${i+1}</h3><p class="small">Keeps ${p.keep.length}/${r.inputIR.claims.length} claims. Gives up:</p><ul class="small">${p.drop.map(id=>`<li>${esc(sources.get(id))}</li>`).join('')}</ul><button class="btn ghost sm" data-fork="${i}" ${fork?'disabled':''}>${fork?'A fork has been created':'Create this coherent fork'}</button></article>`).join('');
  document.querySelectorAll('[data-fork]').forEach(button=>button.onclick=()=>task('Creating a new bucket from this exact solver-verified position…',async()=>{
    const p=r.analysis.positions[Number(button.dataset.fork)];
    fork=await repository.fork(b.id,{receiptId:r.id,keepIds:p.keep,newId:'bucket:walk-fork',name:'My reviewed alternative',actorId:b.owner,expectedVersion:b.version,expectedDigest:b.digest});
  }));
}
function navigate(next) {
  if(busy||next<0||next>unlocked)return;
  step=next;render();$('stage-title').focus({preventScroll:true});
  const key=['A1','A1',formalKey,'U1','L1',null,null][step];if(key)showSource(key);
  document.querySelector('.walk-steps').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function download(value,name) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('walk-back').onclick=()=>navigate(step-1);
$('walk-next').onclick=()=>{if(stageDone()&&step<6){unlocked=Math.max(unlocked,step+1);navigate(step+1);}};
$('pdf-prev').onclick=()=>{pageNumber--;drawPage();};$('pdf-next').onclick=()=>{pageNumber++;drawPage();};
$('pdf-zoom').onclick=()=>{zoom=zoom===1?1.5:1;drawPage();};$('walk-cancel').onclick=()=>controller?.abort();
new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>drawPage(),150);}).observe($('pdf-scroll'));
addEventListener('pagehide',()=>{controller?.abort();renderJob?.cancel();pdf?.destroy();});
render();
await task('Opening the example PDF for inspection…',async()=>{
  const response=await fetch(new URL('./walkthrough.pdf',import.meta.url),{credentials:'omit'});requireThat(response.ok,'Example PDF unavailable.');bytes=new Uint8Array(await response.arrayBuffer());
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  pdf=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,useSystemFonts:false,standardFontDataUrl:new URL('../vendor/pdfjs/standard_fonts/',import.meta.url).href}).promise;
  await showSource('A1');$('walk-ready').textContent='Ready · local · step by step';$('walk-ready').classList.add('rdy');
});
