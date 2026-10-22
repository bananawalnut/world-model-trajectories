import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.BASE||'http://127.0.0.1:8799/';
const browser=await chromium.launch({headless:true,...(process.env.PW_CHANNEL?{channel:process.env.PW_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let wasmFetched=false;
page.on('request',r=>{if(/ocaml-wasm\.assets\/.*\.wasm/.test(r.url()))wasmFetched=true;});
async function boot(suffix='') {
  await page.goto(base+'entity-lab.html'+suffix);
  await page.waitForFunction(()=>document.querySelector('#run-entities')?.disabled===false,null,{timeout:90000});
}
async function run(status='consistent') {
  await page.click('#run-entities');
  await page.waitForFunction(()=>!document.querySelector('#run-entities').disabled,null,{timeout:60000});
  assert.equal(await page.locator('#entity-error').textContent(),'');
  assert.equal(await page.locator('#entity-verdict').getAttribute('data-status'),status);
  return JSON.parse(await page.locator('#entity-receipt').textContent());
}
async function expectError(pattern) {
  await page.click('#run-entities');await page.waitForFunction(()=>!document.querySelector('#run-entities').disabled,null,{timeout:30000});
  assert.match(await page.locator('#entity-error').textContent(),pattern);
  assert.equal(await page.locator('#entity-verdict').getAttribute('data-status'),'error');
  assert.equal(await page.locator('#entity-receipt').textContent(),'');
  assert.equal(await page.locator('[data-entity-claim]').count(),0);assert(await page.locator('#save-entity-position').isDisabled());
}
async function editJSON(id,value) {
  await page.locator('#'+id).evaluate(el=>el.closest('details').open=true);
  await page.fill('#'+id,JSON.stringify(value,null,2));
}
async function reset() {await page.click('#reset-entities');}
async function select(id,value) {await page.selectOption('#'+id,value);}
try {
  await boot();
  await page.evaluate(()=>localStorage.setItem('wmt.entity-lab.v1',JSON.stringify({format:'wmt.entity-positions/1',positions:[{format:'wmt.entity-position/1',input:{},receipt:{}}]})));
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#run-entities').disabled);
  assert.equal(await page.locator('.saved-position').count(),0,'Ignore malformed saved records');
  await page.evaluate(()=>{localStorage.setItem('wmt.tree.v2','existing-workbench');localStorage.setItem('wmt.kernel-lab.v1','existing-mass-lab');});
  const graph=JSON.parse(await page.locator('#graph-source').inputValue());
  const document=JSON.parse(await page.locator('#schema-source').inputValue());
  const semantic=await page.locator('#equals-source').inputValue();
  let receipt=await run();
  assert(wasmFetched);assert.equal(receipt.result.status,'match');assert(Math.abs(receipt.result.score-Math.cos(Math.PI/9))<1e-12);
  assert.equal(receipt.theorem,null);assert.equal(receipt.policyOwner,'contact-semantic/1');
  assert.match(await page.locator('[data-entity-claim="c_graph"]').locator('..').textContent(),/remain distinct/);
  await page.fill('#entity-position-name','Semantic match');await page.click('#save-entity-position');
  const defaultHash=receipt.runHash;
  await page.fill('#equals-source',semantic.replace('0.92','0.99'));
  receipt=await run('inconsistent');assert.equal(receipt.result.status,'no-match');assert.notEqual(receipt.runHash,defaultHash);
  for(const id of ['c_graph','c_schema','c_policy','c_expect','c_equals']) assert((await page.locator('#entity-conflict').textContent()).includes(id));
  for(const id of ['c_graph','c_schema','c_policy']) {
    await page.locator(`[data-entity-claim="${id}"]`).uncheck();
    await page.waitForFunction(()=>document.querySelector('#entity-verdict').dataset.status==='consistent');
    await page.locator(`[data-entity-claim="${id}"]`).check();
    await page.waitForFunction(()=>document.querySelector('#entity-verdict').dataset.status==='inconsistent');
  }
  await page.locator('[data-entity-claim="c_graph"]').uncheck();
  await page.waitForFunction(()=>document.querySelector('#entity-verdict').dataset.status==='consistent');
  await page.fill('#entity-position-name','Retracted snapshot');await page.click('#save-entity-position');
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#run-entities').disabled);
  await page.locator('[data-entity-load="1"]').click();
  await page.waitForFunction(()=>document.querySelector('#entity-verdict').dataset.status==='consistent',null,{timeout:60000});
  assert.equal(await page.locator('[data-entity-claim="c_graph"]').isChecked(),false);
  await page.locator('[data-entity-load="0"]').click();
  await page.waitForFunction(()=>document.querySelector('#entity-verdict').dataset.status==='consistent',null,{timeout:60000});
  receipt=JSON.parse(await page.locator('#entity-receipt').textContent());assert.equal(receipt.runHash,defaultHash);
  console.log('PASS real OCaml/Wasm cosine, distinct IDs, all snapshot premises, persistence and re-execution');

  await select('entity-schema','contact/1');receipt=await run('inconsistent');assert.equal(receipt.policy.id,'email-casefold/1');
  const casefold=structuredClone(graph);casefold.entities[1].attributes.email=' ALICE@EXAMPLE.ORG ';
  await editJSON('graph-source',casefold);await run();
  await reset();await select('entity-schema','contact-semantic/1');await page.click('#inherit-equals');
  receipt=await run('inconsistent');assert.equal(receipt.policyOwner,'contact/1');
  const inheritedDoc=JSON.parse(await page.locator('#schema-source').inputValue());
  assert(!inheritedDoc.schemas[1].equals);assert.deepEqual(inheritedDoc.schemas[0].fields,document.schemas[0].fields);
  await page.fill('#equals-source','open Wmt_Entity;;\nlet equals (_:graph) (_:entity) (_:entity) : comparison = decision true;;');
  receipt=await run();assert.equal(receipt.policyOwner,'contact-semantic/1');
  assert.equal(JSON.parse(await page.locator('#schema-source').inputValue()).schemas[0].equals.source,document.schemas[0].equals.source);
  console.log('PASS schema-owned email policy, inheritance and an independent user override');

  await reset();await select('entity-schema','contact-semantic/1');
  for(const [left,right,expected] of [['person:alice','person:alias','match'],['person:alias','person:neighbor','match'],['person:alice','person:neighbor','no-match']]) {
    await select('entity-left',left);await select('entity-right',right);await select('entity-expected',expected);
    receipt=await run();assert.equal(receipt.result.status,expected);
  }
  console.log('PASS cosine is pairwise and nontransitive (A~B, B~C, A does not match C)');

  await reset();await select('entity-schema','contact-semantic/1');await select('entity-left','person:alice');await select('entity-right','person:other-space');
  receipt=await run('unknown');assert.match(receipt.result.reason,/Incompatible embedding spaces/);
  assert.equal(receipt.activeClaimIds.length,0);assert.equal(await page.locator('[data-entity-claim]').count(),0);
  await select('entity-right','person:alias');
  for(const [values,reason] of [[[0,0,0],/zero vector/],[[1,0],/dimensions/]]) {
    const invalid=structuredClone(graph);invalid.entities[1].attributes.embedding.values=values;
    await editJSON('graph-source',invalid);receipt=await run('unknown');assert.match(receipt.result.reason,reason);
  }
  const extreme=structuredClone(graph);extreme.entities[0].attributes.embedding.values=[1e300,0,0];extreme.entities[1].attributes.embedding.values=[1e-300,0,0];
  await editJSON('graph-source',extreme);receipt=await run();assert.equal(receipt.result.score,1);
  await page.fill('#equals-source',semantic.replace('0.92','1.1'));receipt=await run('unknown');assert.match(receipt.result.reason,/Threshold/);
  console.log('PASS incompatible spaces, zero/invalid vectors, finite extremes and invalid thresholds');

  await reset();await select('entity-schema','contact-semantic/1');
  await page.fill('#equals-source','open Wmt_Entity;; let equals (_:graph) (a:entity) (b:entity) = exact_embedding "embedding" a b;;');
  await select('entity-expected','no-match');receipt=await run();assert.equal(receipt.result.status,'no-match');
  await select('entity-right','person:alice');await select('entity-expected','match');receipt=await run();assert.deepEqual(receipt.pair,['person:alice','person:alice']);
  console.log('PASS exact embedding override and self comparison');

  await reset();await select('entity-schema','contact-colleague/1');await select('entity-right','person:alias');
  receipt=await run();const graphHash=receipt.graphHash;
  const detached=structuredClone(graph);detached.edges=detached.edges.filter(e=>e.subject!=='person:alias');
  await editJSON('graph-source',detached);receipt=await run('inconsistent');assert.equal(receipt.result.status,'no-match');assert.notEqual(receipt.graphHash,graphHash);
  console.log('PASS runnable equals reads graph relationships; changed graph recomputes');

  await reset();await select('entity-schema','contact-semantic/1');await select('entity-right','org:lab');await expectError(/does not implement/);
  await select('entity-right','person:alias');const missing=structuredClone(graph);delete missing.entities[1].attributes.embedding;
  await editJSON('graph-source',missing);await expectError(/missing or invalid embedding/);
  await reset();await select('entity-schema','contact-semantic/1');
  for(const source of ['let equals _ _ _ = true;;','let equals _ _ _ = failwith "intentional failure";;','let equals = !!!']) {
    await page.fill('#equals-source',source);await expectError(/.+/s);
  }
  await page.fill('#equals-source','open Wmt_Entity;; let equals _ _ _ = {outcome=Match;score=Some nan};;');await expectError(/non-finite/);
  console.log('PASS missing interfaces, malformed data, typed compile errors, exceptions and invalid result clear the verdict');

  await reset();await select('entity-schema','contact-semantic/1');await select('entity-left','person:alice');await select('entity-right','person:alias');
  await page.click('#run-entities');await page.fill('#equals-source',semantic+'\n(* changed during execution *)');
  await page.waitForFunction(()=>!document.querySelector('#run-entities').disabled,null,{timeout:60000});
  assert.equal(await page.locator('#entity-verdict').getAttribute('data-status'),'stale');
  assert.equal(await page.locator('#entity-receipt').textContent(),'');assert(await page.locator('#save-entity-position').isDisabled());
  await page.fill('#equals-source','open Wmt_Entity;; let rec forever () = forever ();; let equals _ _ _ = forever ();;');await expectError(/20-second/);
  console.log('PASS edits during execution invalidate results; nonterminating equals is stopped');

  await boot('?runtime=js');receipt=await run();assert.equal(receipt.runtime,'js');assert.equal(receipt.result.status,'match');
  assert(Math.abs(receipt.result.score-Math.cos(Math.PI/9))<1e-12);
  // Exercise byte-safe graph encoding with Unicode, quotes and newlines in data.
  const encoded=structuredClone(graph);encoded.entities[0].attributes.email=encoded.entities[1].attributes.email='λ "quoted" \\ newline\n';
  encoded.entities[0].id='person:λ"\\';encoded.edges[0].subject=encoded.entities[0].id;
  await editJSON('graph-source',encoded);await select('entity-left',encoded.entities[0].id);await select('entity-schema','contact/1');await run();
  assert.equal(await page.evaluate(()=>localStorage.getItem('wmt.tree.v2')),'existing-workbench');
  assert.equal(await page.evaluate(()=>localStorage.getItem('wmt.kernel-lab.v1')),'existing-mass-lab');
  assert.deepEqual(errors,[]);
  console.log('PASS JavaScript backend parity, UTF-8/data escaping, existing stores untouched, no browser errors');

  if(process.env.ENTITY_ARTIFACTS) {
    await boot();receipt=await run();
    writeFileSync(process.env.ENTITY_ARTIFACTS+'/entity-run.json',JSON.stringify(receipt,null,2));
    await page.screenshot({path:process.env.ENTITY_ARTIFACTS+'/entity-lab-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');
    await page.screenshot({path:process.env.ENTITY_ARTIFACTS+'/entity-lab-mobile.png',fullPage:true});
  }
} finally {await browser.close();}
