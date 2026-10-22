import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.BASE||'http://127.0.0.1:8799/';
const browser=await chromium.launch({headless:true,...(process.env.PW_CHANNEL?{channel:process.env.PW_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(!r.url().startsWith(base) && !/fonts\.(googleapis|gstatic)\.com|^blob:|^data:/.test(r.url()))external.push(r.url());});
async function idle(){await page.waitForFunction(()=>document.querySelector('#cancel-paper-operation')?.disabled===true,null,{timeout:90000});assert.equal(await page.locator('#paper-error').textContent(),'');}
async function click(id){await page.click('#'+id);await idle();}
const receipt=async()=>JSON.parse(await page.locator('#bucket-receipt').textContent());
try {
  await page.goto(base+'papers.html');await page.waitForFunction(()=>document.querySelector('#paper-ready')?.classList.contains('rdy'),null,{timeout:90000});
  await page.evaluate(()=>{localStorage.setItem('wmt.tree.v2','original-branches');localStorage.setItem('wmt.entity-lab.v1','original-entity-lab');});
  await click('load-bucket-demo');assert.equal(await page.locator('#bucket-summary [data-version]').getAttribute('data-version'),'1');
  await page.fill('#paper-title','Uploaded SDK paper');await page.fill('#paper-authors','Test author');
  await page.setInputFiles('#pdf-file',new URL('../site/papers/demo.pdf',import.meta.url).pathname);await click('extract-paper');
  assert.match(await page.locator('#paper-source-summary').textContent(),/candidate_partial/);
  assert((await page.locator('.source-claim').count())>=4);assert(await page.locator('#submit-to-bucket').isDisabled());
  await click('formalize-paper');assert.equal(await page.locator('[data-review-source]:enabled').count(),4);
  assert.equal(await page.locator('.formal-render').count(),4);assert((await page.locator('.source-claim .unsupported').count())>0);
  for(const checkbox of await page.locator('[data-review-source]:enabled').all())await checkbox.check();
  await click('confirm-paper-review');assert.match(await page.locator('#paper-review-status').textContent(),/4 formal claims/);
  await click('build-entailment');assert.match(await page.locator('#paper-proofs').textContent(),/attached, not checked/);
  await click('check-paper-proofs');assert.equal(await page.locator('.evidence-card.checked').count(),1);
  console.log('PASS real PDF upload, exact source locators, partial extraction, controlled parser, human confirmation and entailment checking');
  await click('submit-to-bucket');let r=await receipt();
  const diagnostic=JSON.stringify({outcome:r.outcome,consistency:r.consistency,analysis:r.analysis});
  assert.equal(r.outcome,'conflict',diagnostic);assert.equal(r.analysis.complete,true,diagnostic);assert.equal(r.analysis.positions.length,4,diagnostic);assert.equal(r.analysis.conflicts.length,2,diagnostic);
  assert.equal(await page.locator('#bucket-summary [data-version]').getAttribute('data-version'),'1');
  assert.equal(await page.locator('[data-adopt-position]').count(),4);
  assert.match(await page.locator('.solver-state').textContent(),/UNSAT/);
  assert.equal(await page.locator('[data-map-conflict]').count(),2);
  assert.equal(await page.locator('[data-map-claim]').count(),r.inputIR.claims.length);
  assert.equal(await page.locator('[data-conflict-edge]').count(),r.analysis.conflicts.reduce((n,c)=>n+c.length,0));
  assert.equal(await page.locator('.position-matrix tbody tr').count(),r.inputIR.claims.length);
  for(const [i,p] of r.analysis.positions.entries()) {
    const cells=await page.locator(`.position-matrix tbody tr td:nth-of-type(${i+2})`).allTextContents();
    assert.deepEqual(cells,r.inputIR.claims.map(c=>p.keep.includes(c.id)?'✓ Keep':'− Give up'));
  }
  await page.locator('[data-position="1"]').click();
  assert.equal(await page.locator('.selected-position').getAttribute('data-position-card'),'1');
  await page.locator('[data-map-conflict="0"]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#coherence-inspector .inspected-claim').count(),r.analysis.conflicts[0].length);
  const mappedIndex=r.inputIR.claims.findIndex(c=>c.id!=='c_background');
  await page.locator(`[data-map-claim="${mappedIndex}"]`).focus();await page.keyboard.press('Space');
  assert.match(await page.locator('#coherence-inspector').textContent(),/PDF page 1/);
  if(process.env.PAPER_ARTIFACTS){await mkdir(process.env.PAPER_ARTIFACTS,{recursive:true});await page.locator('#bucket-coherence').screenshot({path:process.env.PAPER_ARTIFACTS+'/paper-coherence-desktop.png',style:'.nav { visibility:hidden !important; }'});}
  await page.locator('[data-fork-name="0"]').fill('Reviewed alternative');await page.locator('[data-adopt-position="0"]').click();await idle();
  assert.match(await page.locator('#bucket-summary').textContent(),/Reviewed alternative/);
  assert.match(await page.locator('#bucket-summary').textContent(),/From bucket:personal-demo @ v1/);
  assert.equal(await page.locator('#bucket-trajectories .trajectory-child').count(),1);
  assert.match(await page.locator('#bucket-trajectories').textContent(),/Coherent fork/);
  assert.equal(await page.locator('#bucket-coherence').textContent(),'','Fork clears stale receipt visualizations');
  await page.selectOption('#bucket-select','bucket:personal-demo');assert.equal(await page.locator('#bucket-summary [data-version]').getAttribute('data-version'),'1');
  const compareOption=await page.locator('#bucket-compare option').evaluateAll(opts=>opts.find(o=>o.textContent.includes('Reviewed alternative')).value);
  await page.selectOption('#bucket-compare',compareOption);assert.match(await page.locator('#bucket-comparison').textContent(),/Only in/);
  console.log('PASS original WMT lattice, immutable personal conflict, coherent fork and versioned bucket comparison');
  await page.selectOption('#bucket-select','bucket:rfc-demo');await click('submit-to-bucket');r=await receipt();
  assert.equal(r.outcome,'inserted');assert.equal(r.after.version,2);assert.equal(r.addedClaimIds.length,4);
  assert.match(await page.locator('.solver-state').textContent(),/SAT · all/);
  assert.equal(await page.locator('[data-map-conflict]').count(),0);
  assert.equal(await page.locator('.position-matrix .given-up').count(),0);
  if(process.env.PAPER_ARTIFACTS)await page.locator('#bucket-trajectories').screenshot({path:process.env.PAPER_ARTIFACTS+'/paper-trajectories-desktop.png',style:'.nav { visibility:hidden !important; }'});
  const v1=await page.locator('[data-trajectory-node]').evaluateAll(nodes=>nodes.find(n=>n.getAttribute('aria-label')==='RFC paper model version 1').dataset.trajectoryNode);
  await page.locator(`[data-trajectory-node="${v1}"]`).click();
  assert.match(await page.locator('#bucket-comparison').textContent(),/v2 ↔ RFC paper model v1/);
  assert.equal(await page.locator('#bucket-coherence').textContent(),'');
  await click('submit-to-bucket');r=await receipt();assert.equal(r.outcome,'unchanged');assert.equal(r.after.version,2);
  const [sidecarDownload]=await Promise.all([page.waitForEvent('download'),page.click('#download-paper-sidecar')]);
  const sidecar=JSON.parse(await readFile(await sidecarDownload.path(),'utf8'));
  assert.equal(sidecar.format,'wmt.paper-sidecar/1');assert.equal(sidecar.delivery,'local_not_published');
  assert.equal(sidecar.submission.proofReceipts[0].result.status,'checked');assert(sidecar.submission.source.base64.length>0);
  assert(sidecar.bucketReceipts.some(r=>r.outcome==='conflict'));assert(sidecar.bucketReceipts.some(r=>r.outcome==='inserted'));
  const [workspaceDownload]=await Promise.all([page.waitForEvent('download'),page.click('#download-workspace')]);
  const workspacePath=await workspaceDownload.path();
  await page.reload();await page.waitForFunction(()=>document.querySelector('#paper-ready')?.classList.contains('rdy'));
  assert.equal(await page.locator('#bucket-select option').count(),1,'No implicit SDK persistence');
  await page.setInputFiles('#workspace-file',workspacePath);await idle();assert.equal(await page.locator('#bucket-select option').count(),4);
  assert(await page.locator('#submit-to-bucket').isDisabled(),'Fresh paper review is required');
  assert.equal(await page.locator('.evidence-card.checked').count(),0,'Historical receipt is not a fresh proof verdict');
  await page.selectOption('#bucket-select','bucket:rfc-demo');assert.equal(await page.locator('#bucket-summary [data-version]').getAttribute('data-version'),'2');
  assert.equal(await page.evaluate(()=>localStorage.getItem('wmt.tree.v2')),'original-branches');
  assert.equal(await page.evaluate(()=>localStorage.getItem('wmt.entity-lab.v1')),'original-entity-lab');
  for(const checkbox of await page.locator('[data-review-source]:enabled').all())await checkbox.check();
  await click('confirm-paper-review');await click('check-paper-proofs');assert.equal(await page.locator('.evidence-card.checked').count(),1);
  await page.selectOption('#bucket-select','bucket:personal-demo');await click('submit-to-bucket');assert.equal((await receipt()).outcome,'conflict');
  console.log('PASS separate RFC append, exact versions, full sidecar export, explicit workspace restore and original stores preserved');
  // A genuine three-way MUS: all pairs are satisfiable. The picture must keep
  // one conflict group with three incidence lines, never three pairwise attacks.
  const triple=await page.evaluate(async()=>{
    const {createWorkerClient}=await import('./sdk/index.mjs');
    const client=createWorkerClient(()=>new Worker(new URL('./papers/worker.js',location.href)));
    const pred=name=>({op:'pred',name,args:[]});
    const ir={sorts:[],preds:[{name:'A',args:[]},{name:'B',args:[]}],funcs:[],claims:[
      {id:'c_a',source:'<img src=x onerror="window.injected=true"> A holds.',formula:pred('A')},
      {id:'c_b',source:'B holds.',formula:pred('B')},
      {id:'c_not_both',source:'A and B do not both hold.',formula:{op:'not',x:{op:'and',xs:[pred('A'),pred('B')]}}}
    ]};
    const analysis=await client.analyze(ir),pairs=[];
    for(let i=0;i<3;i++)pairs.push((await client.analyze({...ir,claims:ir.claims.filter((c,j)=>i!==j)})).status);
    const {mountCoherenceView}=await import('./papers/coherence-view.mjs');
    const root=document.querySelector('#bucket-coherence');
    const receipt={inputIR:ir,analysis,before:{id:'Three-way model',version:1},outcome:'conflict'};
    mountCoherenceView(root,{receipt});
    window.renderCoherenceFixture=analysis=>mountCoherenceView(root,{receipt:{...receipt,analysis}});
    return {analysis,pairs};
  });
  assert.equal(triple.analysis.conflicts.length,1);assert.equal(triple.analysis.conflicts[0].length,3);
  assert.deepEqual(triple.pairs,['consistent','consistent','consistent']);
  assert.equal(await page.locator('[data-map-conflict]').count(),1);assert.equal(await page.locator('[data-conflict-edge]').count(),3);
  assert.equal(await page.locator('#bucket-coherence img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert.match(await page.locator('#bucket-coherence').textContent(),/Some positions · 2\/3/);
  await page.evaluate(()=>window.renderCoherenceFixture({complete:false,status:'unknown',stopReason:'solver_unknown',message:'Search incomplete',positions:[{keep:['c_a'],drop:[]}],conflicts:[['c_a','c_b','c_not_both']],repair:{drop:[],weight:0}}));
  assert.match(await page.locator('.solver-state').textContent(),/Unresolved/);
  assert.equal(await page.locator('.position-matrix').count(),0);assert.equal(await page.locator('.repair-guide').count(),0);
  assert.equal(await page.locator('.map-claim.every,.map-claim.some,.map-claim.none').count(),0);
  // All positions and conflict groups remain reachable when the view paginates.
  await page.evaluate(()=>window.renderCoherenceFixture({complete:true,status:'inconsistent',stopReason:'completed',positions:Array.from({length:10},()=>({keep:['c_a','c_b'],drop:['c_not_both']})),conflicts:Array.from({length:10},()=>['c_a','c_b','c_not_both']),repair:{drop:['c_not_both'],weight:1}}));
  assert.equal(await page.locator('[data-position]').count(),8);
  await page.locator('[data-matrix-page="1"]').click();assert.equal(await page.locator('[data-position]').count(),2);
  await page.locator('[data-position="9"]').click();assert.match(await page.locator('[data-position-summary]').textContent(),/Position 10/);
  await page.locator('[data-conflict-page="1"]').click();assert.equal(await page.locator('[data-map-conflict]').count(),2);
  console.log('PASS exact SAT position matrix, group conflicts, keyboard inspection, source anchors, trajectory parents, partial results, escaping and paginated views');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  if(process.env.PAPER_ARTIFACTS) {
    await mkdir(process.env.PAPER_ARTIFACTS,{recursive:true});
    await writeFile(process.env.PAPER_ARTIFACTS+'/paper-sidecar-example.json',JSON.stringify(sidecar,null,2));
    await click('submit-to-bucket');
    await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise(requestAnimationFrame));
    await page.screenshot({path:process.env.PAPER_ARTIFACTS+'/paper-workbench-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#bucket-coherence').screenshot({path:process.env.PAPER_ARTIFACTS+'/paper-coherence-mobile.png',style:'.nav { visibility:hidden !important; }'});
    await page.screenshot({path:process.env.PAPER_ARTIFACTS+'/paper-workbench-mobile.png',fullPage:true});
  }
  console.log('PASS no browser errors or unexpected external calls; desktop and mobile layout');
} finally {await browser.close();}
