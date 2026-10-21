import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.env.BASE||'http://127.0.0.1:8799/',artifacts=process.env.WALK_ARTIFACTS;
const browser=await chromium.launch({headless:true,...(process.env.PW_CHANNEL?{channel:process.env.PW_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(!r.url().startsWith(base)&&!/^blob:|^data:|fonts\.(googleapis|gstatic)\.com/.test(r.url()))external.push(r.url());});
async function idle({error=false}={}){await page.waitForFunction(()=>document.querySelector('#walk-cancel')?.hidden===true,null,{timeout:180000});if(!error)assert.equal(await page.locator('#walk-error').textContent(),'');assert.equal(await page.locator('#pdf-error').textContent(),'');}
async function click(id,options){await page.click('#'+id);await idle(options);}
async function next(){await click('walk-next');}
async function screenshot(name){if(artifacts){await mkdir(artifacts,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:artifacts+'/'+name+'.png',fullPage:true,style:'.nav { position:relative !important; }'});}}
async function download(id){const [d]=await Promise.all([page.waitForEvent('download'),page.click('#'+id)]);return {path:await d.path(),value:JSON.parse(await readFile(await d.path(),'utf8'))};}
try {
  await page.goto(base+'walkthrough.html');await page.waitForFunction(()=>document.querySelector('#walk-ready')?.classList.contains('rdy'),null,{timeout:90000});await idle();
  assert.equal(await page.locator('#pdf-page-label').textContent(),'Page 1 / 2');assert(await page.locator('#pdf-highlights .pdf-highlight').count()>0);
  assert(await page.locator('[data-step="4"]').isDisabled());
  await page.click('[data-source="T1"]');await page.waitForFunction(()=>document.querySelector('#pdf-page-label').textContent==='Page 2 / 2');
  assert.match(await page.locator('#pdf-selection').textContent(),/Tweety is not a flier/);await screenshot('walkthrough-inspection-desktop');
  await next();assert(await page.locator('#walk-next').isDisabled());await click('walk-extract');
  assert.equal(await page.locator('[data-passage]').count(),7);assert.match(await page.locator('#walk-stage').textContent(),/candidate_partial/);
  assert.match(await page.locator('#pdf-selection').textContent(),/PDF page 1 · text/);
  assert.equal(await page.locator('#pdf-error').textContent(),'');
  console.log('PASS actual two-page PDF rendering, exact highlighted source, real extraction, partial candidate census and author-role distinction');
  await next();await click('walk-formalize');assert.equal(await page.locator('#formal-passage option').count(),5);
  assert.match(await page.locator('.formula-line').textContent(),/∀ x:Thing/);
  const kinds=await page.locator('[data-node] b').allTextContents();assert(kinds.includes('imp'));assert(kinds.includes('pred'));assert(kinds.includes('var'));
  await page.locator('[data-node="1"]').click();assert.match(await page.locator('.primitive-explanation').textContent(),/Implication/);
  await page.selectOption('#formal-passage','A2');assert((await page.locator('[data-node] b').allTextContents()).includes('not'));
  await screenshot('walkthrough-formalization-desktop');
  await next();await click('test-strict-reading');assert.match(await page.locator('[data-ambiguity-result]').textContent(),/INCONSISTENT/);
  await click('walk-review',{error:true});assert.match(await page.locator('#walk-error').textContent(),/Confirm all five/);assert(await page.locator('#walk-next').isDisabled());
  for(const box of await page.locator('[data-confirm]').all())await box.check();await page.check('#defer-ambiguity');await click('walk-review');
  assert.equal(await page.locator('[data-confirm]:disabled:checked').count(),5);assert.match(await page.locator('[data-review-complete]').textContent(),/still only source-stated/);
  console.log('PASS typed primitives and composition, stronger-reading solver experiment, explicit five-claim review and ambiguity deferral');
  await next();await click('walk-probe');assert.match(await page.locator('[data-missing-premise]').textContent(),/failed/);assert(await page.locator('#walk-next').isDisabled());
  await click('walk-prove');assert.equal(await page.locator('[data-proof-result].checked').count(),2);await screenshot('walkthrough-proofs-desktop');
  console.log('PASS exact lemma/theorem entailments, source premise links and genuinely failed missing-premise diagnostic');
  await next();await click('walk-buckets');assert.match(await page.locator('#walk-bucket-outcome').textContent(),/formed at v2/);assert.match(await page.locator('.solver-state').textContent(),/SAT/);
  await page.click('[data-receipt="1"]');assert.match(await page.locator('#walk-bucket-outcome').textContent(),/unchanged at v1/);assert.match(await page.locator('.solver-state').textContent(),/UNSAT/);
  const keepPaper=await page.locator('[data-fork-position]').evaluateAll(cards=>cards.find(c=>c.querySelectorAll('li').length===1&&c.querySelector('li').textContent==='All birds are fliers.').dataset.forkPosition);
  await page.click(`[data-fork="${keepPaper}"]`);await idle();assert.match(await page.locator('[data-fork-complete]').textContent(),/original personal bucket stays at v1/);
  assert.match(await page.locator('#walk-trajectories').textContent(),/Coherent fork/);await screenshot('walkthrough-buckets-desktop');
  await next();const sidecar=await download('walk-download-sidecar'),workspace=await download('walk-download-workspace'),reading=await download('walk-download-reading');
  assert.equal(sidecar.value.format,'wmt.paper-sidecar/1');assert.equal(sidecar.value.submission.review.ir.claims.length,5);
  assert.equal(sidecar.value.submission.proofReceipts.filter(r=>r.result.status==='checked').length,2);
  const document=sidecar.value.submission.document;
  assert.equal(createHash('sha256').update(Buffer.from(sidecar.value.submission.source.base64,'base64')).digest('hex'),document.sha256);
  for(const p of reading.value.passages){assert.equal(document.pages[p.locator.page-1].text.slice(p.locator.start,p.locator.end),p.quote);if(p.deferred)assert.equal(p.formalClaimId,null);}
  assert.equal(reading.value.passages.filter(p=>p.deferred).length,2);
  assert.equal(workspace.value.bucketWorkspace.heads.length,3);
  const original=workspace.value.bucketWorkspace.versions.find(v=>v.id==='bucket:walk-personal');assert.equal(original.version,1);assert.equal(original.ir.claims.length,1);
  console.log('PASS RFC formation, unchanged conflicting personal bucket, solver-verified fork and exact PDF/proof/role exports');
  await page.setViewportSize({width:390,height:844});
  for(const s of [0,2,5]){await page.click(`button[data-step="${s}"]`);await page.waitForTimeout(250);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(s===2)await screenshot('walkthrough-formalization-mobile');if(s===5)await screenshot('walkthrough-buckets-mobile');}
  // The real workspace export must continue in the existing paper workbench.
  await page.goto(base+'papers.html');await page.waitForFunction(()=>document.querySelector('#paper-ready')?.classList.contains('rdy'));
  await page.setInputFiles('#workspace-file',workspace.path);await page.waitForFunction(()=>document.querySelector('#cancel-paper-operation').disabled===true,null,{timeout:180000});
  assert.equal(await page.locator('#paper-error').textContent(),'');assert.equal(await page.locator('#bucket-select option').count(),4);assert(await page.locator('#submit-to-bucket').isDisabled());
  assert.equal(await page.locator('.evidence-card.checked').count(),0);assert.equal(await page.locator('.formal-render').count(),5);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  if(artifacts){await writeFile(artifacts+'/walkthrough-sidecar-example.json',JSON.stringify(sidecar.value,null,2));await writeFile(artifacts+'/walkthrough-reading-example.json',JSON.stringify(reading.value,null,2));}
  console.log('PASS 390px responsive walkthrough, workspace handoff with fresh review, no browser errors or unexpected external calls');
}finally{await browser.close();}
