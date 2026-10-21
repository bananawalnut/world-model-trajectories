import {createWorkerClient,BucketRepository,createSubmission,formalizeSubmission,reviewSubmission,restoreSubmission,
  controlledParser,DEMO_VOCABULARY,EMPTY_IR,mergeIR,formalizerPrompt,makeEntailmentProof,validateProof,verifySubmissionProofs,
  compareBuckets,exportSidecar,requireThat,clone} from '../sdk/index.mjs';
import {mountCoherenceView,mountTrajectoryView} from './coherence-view.mjs';

const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const client=createWorkerClient(()=>new Worker(new URL('./worker.js',import.meta.url)));
let repository=new BucketRepository(client),paper=null,rendered=[],receipt=null,busy=false,controller;
function activeBucket(){return $('bucket-select').value?repository.get($('bucket-select').value):null;}
function updateControls() {
  $('formalize-paper').disabled=busy||!paper;
  $('apply-authored-proposal').disabled=busy||!paper;
  $('build-paper-prompt').disabled=busy||!paper;
  $('confirm-paper-review').disabled=busy||!paper?.proposal?.ir.claims.length||rendered.length!==paper.proposal.ir.claims.length;
  $('submit-to-bucket').disabled=busy||!paper?.review||!$('bucket-select').value;
  $('build-entailment').disabled=busy||!paper?.review;
  $('check-paper-proofs').disabled=busy||!paper?.proofs.length;
  $('download-paper-sidecar').disabled=busy||!paper;
  $('cancel-paper-operation').disabled=!busy;
  $('cancel-paper-operation').hidden=!busy;
}
async function task(label,fn) {
  if(busy)return;busy=true;controller=new AbortController();$('paper-error').textContent='';$('paper-progress').textContent=label;
  const disabled=[...document.querySelectorAll('button,input,select,textarea')].map(e=>[e,e.disabled]);
  disabled.forEach(([e])=>e.disabled=true);$('cancel-paper-operation').disabled=false;$('cancel-paper-operation').hidden=false;
  try {await fn(controller.signal);}catch(error){$('paper-error').textContent=String(error.message??error);}
  finally {busy=false;disabled.forEach(([e,was])=>{if(e.isConnected)e.disabled=was;});$('paper-progress').textContent='';updateControls();}
}
function clearResult() {
  receipt=null;$('bucket-verdict').dataset.status='not_run';$('bucket-verdict').className='statusbar muted';
  $('bucket-verdict').textContent='No current check — review the paper and submit it to this exact bucket version.';
  $('bucket-positions').replaceChildren();$('bucket-conflicts').replaceChildren();$('bucket-receipt').textContent='';
  $('bucket-coherence').replaceChildren();
}
function renderBuckets(preferred=$('bucket-select').value) {
  const buckets=repository.list();
  $('bucket-select').innerHTML='<option value="">Choose a bucket</option>'+buckets.map(b=>`<option value="${escape(b.id)}">${escape(b.name)} · ${b.scope} · v${b.version}</option>`).join('');
  $('bucket-select').value=buckets.some(b=>b.id===preferred)?preferred:buckets[0]?.id??'';
  const compare=$('bucket-compare').value;
  $('bucket-compare').innerHTML='<option value="">Choose a version to compare</option>'+repository.export().versions.map(b=>`<option value="${escape(JSON.stringify({id:b.id,version:b.version}))}">${escape(b.name)} · v${b.version}</option>`).join('');
  $('bucket-compare').value=compare;renderBucketSummary();updateControls();
}
function renderBucketSummary() {
  mountTrajectoryView($('bucket-trajectories'),{workspace:repository.export(),activeId:$('bucket-select').value,onSelect:version=>{
    $('bucket-select').value=version.id;
    $('bucket-compare').value=JSON.stringify({id:version.id,version:version.version});
    renderBucketSummary();clearResult();updateControls();
  }});
  const b=activeBucket();
  if(!b){$('bucket-summary').innerHTML='<p class="muted">Create a bucket or load the two demo models.</p>';$('bucket-comparison').replaceChildren();return;}
  const versions=repository.export().versions.filter(v=>v.id===b.id);
  $('bucket-summary').innerHTML=`<div class="bucket-snapshot" data-bucket="${escape(b.id)}" data-version="${b.version}"><b>${escape(b.name)}</b> · ${escape(b.scope)} · version ${b.version}<p class="small">Owner: ${escape(b.owner)}${b.rfcRef?' · '+escape(b.rfcRef):''}</p><code>SHA-256 ${escape(b.digest)}</code>${b.parent?`<p class="small">From ${escape(b.parent.id)} @ v${b.parent.version}</p>`:''}<ul>${b.ir.claims.map(c=>`<li>${escape(c.source)}</li>`).join('')||'<li>No assumptions yet.</li>'}</ul><details><summary>${versions.length} immutable version${versions.length===1?'':'s'}</summary>${versions.map(v=>`<p class="small">v${v.version} · ${v.ir.claims.length} claims · ${escape(v.provenance.operation)} · <code>${escape(v.digest.slice(0,16))}</code></p>`).join('')}</details></div>`;
  renderComparison();
}
function renderComparison() {
  const b=activeBucket(),value=$('bucket-compare').value;
  if(!b||!value){$('bucket-comparison').replaceChildren();return;}
  const ref=JSON.parse(value),other=repository.get(ref.id,ref.version),d=compareBuckets(b,other);
  const sources=new Map([...b.ir.claims,...other.ir.claims].map(c=>[c.id,c.source]));
  $('bucket-comparison').innerHTML=`<div class="bucket-snapshot"><b>${escape(b.name)} v${b.version} ↔ ${escape(other.name)} v${other.version}</b><p class="small">Only in the active bucket: ${d.onlyLeft.map(id=>escape(sources.get(id))).join(' · ')||'none'}</p><p class="small">Only in the comparison: ${d.onlyRight.map(id=>escape(sources.get(id))).join(' · ')||'none'}</p><p class="small">Changed claim IDs: ${d.changed.map(escape).join(', ')||'none'}</p></div>`;
}
function renderPaper() {
  if(!paper){$('paper-source-summary').replaceChildren();$('paper-claims').innerHTML='<p class="muted">Load a PDF to extract candidate claims.</p>';$('paper-review-status').textContent='';updateControls();return;}
  const doc=paper.document,reviewed=new Set(paper.review?.sourceClaimIds??[]),mappings=new Map(paper.proposal?.mappings.map(m=>[m.sourceClaimId,m.formalClaimIds])??[]);
  const renders=new Map(rendered.map(c=>[c.id,c.render])),reasons=new Map(paper.proposal?.unsupported.map(u=>[u.sourceClaimId,u.reason])??[]);
  $('paper-source-summary').innerHTML=`<div class="bucket-snapshot"><b>${escape(paper.title)}</b><p class="small">${doc.pageCount} page${doc.pageCount===1?'':'s'} · ${paper.extraction.claims.length} candidate claims · <b>candidate_partial</b></p><code>PDF SHA-256 ${escape(doc.sha256)}</code>${doc.extraction.imageOnlyPages.length?`<p class="small unsupported">OCR required for pages ${doc.extraction.imageOnlyPages.join(', ')}.</p>`:''}</div>`;
  $('paper-claims').innerHTML=paper.extraction.claims.map(c=>{
    const ids=mappings.get(c.id),mapped=!!ids?.length;
    return `<article class="source-claim" data-source-id="${c.id}"><label class="review-line"><input type="checkbox" data-review-source="${c.id}" ${mapped?'':'disabled'} ${reviewed.has(c.id)?'checked':''}><span>Confirm this source → formalization mapping</span></label><blockquote>${escape(c.statement)}</blockquote><div class="locator">Page ${c.locator.page} · text ${c.locator.start}–${c.locator.end} · ${escape(c.kind)} · source-stated candidate</div>${mapped?ids.map(id=>`<div class="formal-render"><b>WMT reads:</b> ${escape(renders.get(id)??'Awaiting typed rendering…')}</div>`).join(''):`<p class="small unsupported">${escape(reasons.get(c.id)??'Not formalized yet.')}</p>`}<code>${c.id}</code></article>`;
  }).join('')||'<p class="muted">No text-layer claim candidates found. Supply OCR or a source-aware extraction adapter before formalizing.</p>';
  document.querySelectorAll('[data-review-source]').forEach(box=>box.onchange=()=>{paper.review=null;paper.proofReceipts=[];clearResult();renderReview();renderProofs();updateControls();});
  $('prompt-candidate').innerHTML=paper.extraction.claims.map(c=>`<option value="${c.id}">${escape(c.statement.slice(0,100))}</option>`).join('');
  renderReview();renderProofControls();renderProofs();updateControls();
}
function renderReview() {
  $('paper-review-status').textContent=paper?.review?`${paper.review.sourceClaimIds.length} source mappings confirmed by ${paper.review.actorId}; ${paper.review.ir.claims.length} formal claims selected. Extraction remains partial.`:'No confirmed formalization subset. Select mappings after reading their WMT renders.';
}
function renderProofControls() {
  const claims=paper?.review?.ir.claims??[];
  $('proof-target').innerHTML=claims.map(c=>`<option value="${c.id}">${escape(c.source)}</option>`).join('');
  if(claims.length)$('proof-target').value=claims.at(-1).id;
  $('proof-premises').innerHTML=claims.map((c,i)=>`<option value="${c.id}" ${i<claims.length-1?'selected':''}>${escape(c.source)}</option>`).join('');
}
function renderProofs() {
  const proofs=paper?.proofs??[],results=new Map(paper?.proofReceipts.map(r=>[r.proofId,r])??[]);
  $('paper-proofs').innerHTML=proofs.map(p=>{const r=results.get(p.id);return `<div class="evidence-card ${r?.result.status==='checked'?'checked':''}" data-proof-id="${escape(p.id)}"><b>${escape(p.id)}</b> · ${escape(p.kind)}<p class="small"><b>${escape(r?.result.status??'attached, not checked')}</b> · ${escape(r?.result.reason??'No checker has run for this artifact.')}</p>${r?.checker?`<code>${escape(r.checker.id)} · ${escape(r.checker.revision??'no completed revision')}</code>`:''}</div>`;}).join('')||'<p class="muted">No computational evidence attached.</p>';
}
async function setPaper(next,signal) {
  paper=next;rendered=[];clearResult();
  $('paper-title').value=paper.title;$('paper-authors').value=paper.authors.join(', ');
  if(paper.proposal){const meta=await client.request('render',{ir:paper.proposal.ir},{signal});requireThat(Array.isArray(meta.claims),meta.message??'Could not render the typed formalization.');rendered=meta.claims;}
  renderPaper();
}
function renderReceipt() {
  const r=receipt,a=r.analysis,status=a.complete?a.status:'unknown';
  $('bucket-verdict').dataset.status=status;$('bucket-verdict').className='statusbar '+(status==='consistent'?'ok':status==='inconsistent'?'warn':'muted');
  $('bucket-verdict').textContent=r.outcome==='inserted'?`Coherent — appended ${r.addedClaimIds.length} claims. Bucket ${r.after.id} is now version ${r.after.version}.`:r.outcome==='conflict'?`Conflict — bucket ${r.before.id} is unchanged at version ${r.before.version}.` : r.outcome==='unchanged'?'Coherent — these claims are already present. Bucket unchanged.':`No append — ${a.stopReason}: ${a.message??'No complete verdict.'}`;
  $('bucket-receipt').textContent=JSON.stringify(r,null,2);
  const source=new Map(r.inputIR.claims.map(c=>[c.id,c.source]));
  mountCoherenceView($('bucket-coherence'),{receipt:r,submission:paper,beforeBucket:repository.get(r.before.id,r.before.version),onPosition:index=>{
    document.querySelectorAll('[data-position-card]').forEach(card=>card.classList.toggle('selected-position',Number(card.dataset.positionCard)===index));
  }});
  $('bucket-conflicts').innerHTML=a.conflicts.map((ids,i)=>`<div class="bucket-snapshot"><b>Irreducible conflict ${i+1}</b><ul>${ids.map(id=>`<li>${escape(source.get(id))}</li>`).join('')}</ul></div>`).join('');
  if(!a.complete){$('bucket-positions').replaceChildren();return;}
  $('bucket-positions').innerHTML=`<h3 class="position-cards-heading">Choose a coherent trajectory</h3><div class="position-grid">${a.positions.map((p,i)=>`<article class="coherent-position" data-position-card="${i}"><h3>Position ${i+1}</h3><p>Keeps ${p.keep.length}/${r.inputIR.claims.length} claims.</p><b class="small">Concedes</b><ul>${p.drop.map(id=>`<li>${escape(source.get(id))}</li>`).join('')||'<li>Nothing.</li>'}</ul><details><summary>Retained claims</summary><ul>${p.keep.map(id=>`<li>${escape(source.get(id))}</li>`).join('')}</ul></details>${r.outcome==='conflict'?`<label>Fork name<input data-fork-name="${i}" value="Alternative ${i+1}"></label><button class="btn ghost sm" data-adopt-position="${i}">Adopt as a new bucket fork</button>`:''}</article>`).join('')}</div>`;
  document.querySelectorAll('[data-adopt-position]').forEach(button=>button.onclick=()=>task('Creating a fork of this solver-verified position…',async()=>{
    const i=Number(button.dataset.adoptPosition),name=document.querySelector(`[data-fork-name="${i}"]`).value;
    const fork=await repository.fork(r.before.id,{receiptId:r.id,keepIds:r.analysis.positions[i].keep,newId:'bucket:'+crypto.randomUUID(),name,
      actorId:$('actor-id').value,expectedVersion:r.before.version,expectedDigest:r.before.digest});
    renderBuckets(fork.id);clearResult();$('bucket-verdict').textContent=`Created ${fork.name} from ${r.before.id} v${r.before.version}. The original bucket is unchanged.`;
  }));
}
function download(value,name) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function parseInitial(lines) {
  let ir=clone(EMPTY_IR);const parse=controlledParser(JSON.parse($('paper-vocabulary').value));
  for(const [i,line] of lines.split('\n').map(s=>s.trim()).filter(Boolean).entries())ir=mergeIR(ir,await parse({id:'c_bucket_'+crypto.randomUUID().replaceAll('-','')+'_'+i,statement:line}));return ir;
}
$('paper-vocabulary').value=JSON.stringify(DEMO_VOCABULARY,null,2);
$('load-bucket-demo').onclick=()=>task('Checking the two demo bucket baselines…',async signal=>{
  const owner=$('actor-id').value;
  if(!repository.list().some(b=>b.id==='bucket:personal-demo')) {
    const ir=await controlledParser()({id:'c_background',statement:'All birds are fliers.'});
    await repository.create({id:'bucket:personal-demo',name:'My flight assumptions',owner,ir,signal});
  }
  if(!repository.list().some(b=>b.id==='bucket:rfc-demo'))await repository.create({id:'bucket:rfc-demo',name:'RFC paper model',scope:'rfc',owner,rfcRef:'RFC-0041@demo-revision',signal});
  renderBuckets('bucket:personal-demo');clearResult();
});
$('create-bucket').onclick=()=>task('Creating and checking this named bucket…',async signal=>{
  const bucket=await repository.create({id:'bucket:'+crypto.randomUUID(),name:$('new-bucket-name').value,scope:$('new-bucket-scope').value,
    owner:$('actor-id').value,rfcRef:$('new-bucket-scope').value==='rfc'?$('new-bucket-rfc').value:null,ir:await parseInitial($('initial-bucket-claims').value),signal});
  renderBuckets(bucket.id);clearResult();
});
$('bucket-select').onchange=()=>{renderBucketSummary();clearResult();updateControls();};$('bucket-compare').onchange=renderComparison;
$('load-paper-demo').onclick=()=>task('Extracting candidates from the real demo PDF…',async signal=>{
  const response=await fetch('./papers/demo.pdf',{credentials:'omit'});requireThat(response.ok,'Demo PDF unavailable.');
  $('paper-title').value='A small paper with a disputed flight model';$('paper-authors').value='WMT SDK demonstration';
  await setPaper(await createSubmission({bytes:await response.arrayBuffer(),fileName:'demo.pdf',title:$('paper-title').value,authors:[$('paper-authors').value]},client,{signal}),signal);
});
$('extract-paper').onclick=()=>task('Extracting PDF text and source-located candidates…',async signal=>{
  const file=$('pdf-file').files[0];requireThat(file,'Choose a PDF file first.');requireThat(file.size<=12000000,'PDF exceeds the 12 MB byte budget.');
  await setPaper(await createSubmission({bytes:await file.arrayBuffer(),fileName:file.name,title:$('paper-title').value,
    authors:$('paper-authors').value.split(',').map(s=>s.trim()).filter(Boolean)},client,{signal}),signal);
});
for(const id of ['pdf-file','paper-title','paper-authors'])$(id).addEventListener('input',()=>{paper=null;rendered=[];clearResult();renderPaper();renderProofs();});
$('formalize-paper').onclick=()=>task('Parsing supported candidates and rendering their WMT formulas…',async signal=>{
  requireThat(paper,'Load a PDF first.');await setPaper(await formalizeSubmission(paper,{parse:controlledParser(JSON.parse($('paper-vocabulary').value))}),signal);
});
$('apply-authored-proposal').onclick=()=>task('Validating the authored WMT IR and source mappings…',async signal=>{requireThat(paper,'Load a paper first.');await setPaper(await formalizeSubmission(paper,JSON.parse($('authored-proposal').value)),signal);});
$('confirm-paper-review').onclick=()=>task('Recording your confirmation of the selected mappings…',async()=>{
  const sourceClaimIds=[...document.querySelectorAll('[data-review-source]:checked')].map(e=>e.dataset.reviewSource);
  paper=await reviewSubmission(paper,{actorId:$('actor-id').value,sourceClaimIds});clearResult();renderReview();renderProofControls();renderProofs();
});
$('build-paper-prompt').onclick=()=>{
  const candidate=paper?.extraction.claims.find(c=>c.id===$('prompt-candidate').value);if(candidate)$('paper-model-prompt').value=formalizerPrompt(candidate,paper.proposal?.ir??activeBucket()?.ir??EMPTY_IR);
};
$('build-entailment').onclick=()=>task('Binding computational evidence to the exact PDF and reviewed formulas…',async()=>{
  const targetClaimId=$('proof-target').value,premiseClaimIds=[...$('proof-premises').selectedOptions].map(o=>o.value).filter(id=>id!==targetClaimId);
  const proof=await makeEntailmentProof(paper,{id:'proof:'+crypto.randomUUID(),targetClaimId,premiseClaimIds});
  paper.proofs.push(proof);paper.proofReceipts=[];renderProofs();
});
$('proof-file').onchange=()=>task('Attaching proof artifacts without running submitted code…',async()=>{
  requireThat(paper,'Load a paper first.');const file=$('proof-file').files[0];requireThat(file && file.size<=18000000,'Choose a proof sidecar JSON below 18 MB.');
  const value=JSON.parse(await file.text()),proofs=Array.isArray(value)?value:value.submission?.proofs??value.proofs??[value];
  requireThat(proofs.length<=16,'Limit proof artifacts to 16.');for(const p of proofs)await validateProof(p);
  requireThat(new Set(proofs.map(p=>p.id)).size===proofs.length,'Duplicate proof IDs.');paper.proofs=proofs;paper.proofReceipts=[];renderProofs();
});
$('check-paper-proofs').onclick=()=>task('Running installed checkers on the exact bound inputs…',async signal=>{paper=await verifySubmissionProofs(paper,client,{signal});renderProofs();});
$('submit-to-bucket').onclick=()=>task('Checking the full combined claim set and enumerating coherent positions…',async signal=>{
  const bucket=activeBucket();requireThat(bucket && paper?.review,'Choose a bucket and confirm the paper mappings first.');clearResult();
  const result=await repository.submit(bucket.id,{expectedVersion:bucket.version,expectedDigest:bucket.digest,actorId:$('actor-id').value,
    submission:paper,idempotencyKey:crypto.randomUUID(),signal});receipt=result.receipt;renderBuckets(bucket.id);renderReceipt();
});
$('download-paper-sidecar').onclick=()=>{if(paper)download(exportSidecar(paper,{bucketReceipts:repository.export().receipts,buckets:repository.export().versions}),'wmt-paper-sidecar.json');};
$('download-workspace').onclick=()=>download({format:'wmt.paper-workspace/1',bucketWorkspace:repository.export(),submission:paper},'wmt-paper-workspace.json');
$('workspace-file').onchange=()=>task('Restoring and rechecking bucket heads and PDF sources…',async signal=>{
  const file=$('workspace-file').files[0];requireThat(file && file.size<=34000000,'Choose a workspace JSON below 34 MB.');
  const workspace=JSON.parse(await file.text());requireThat(workspace.format==='wmt.paper-workspace/1','Expected a paper workspace.');
  const next=new BucketRepository(client);await next.restore(workspace.bucketWorkspace,{signal});
  const fresh=workspace.submission?await restoreSubmission(workspace.submission,client,{signal}):null;
  repository=next;renderBuckets();if(fresh)await setPaper(fresh,signal);else {paper=null;rendered=[];renderPaper();}clearResult();
});
$('paper-vocabulary').oninput=()=>{if(paper){paper.proposal=null;paper.review=null;paper.proofReceipts=[];rendered=[];clearResult();renderPaper();}};
$('cancel-paper-operation').onclick=()=>controller?.abort();
addEventListener('pagehide',()=>controller?.abort());
$('paper-ready').textContent='SDK ready · local · not published';$('paper-ready').classList.add('rdy');renderBuckets();renderPaper();updateControls();
