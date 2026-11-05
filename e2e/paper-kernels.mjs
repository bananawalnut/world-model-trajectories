import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.env.BASE||'http://127.0.0.1:8799/';
const browser=await chromium.launch({headless:true,...(process.env.PW_CHANNEL?{channel:process.env.PW_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function idle(){await page.waitForFunction(()=>document.querySelector('#cancel-paper-operation')?.disabled===true,null,{timeout:90000});assert.equal(await page.locator('#paper-error').textContent(),'');}
async function click(selector){await page.click(selector);await idle();}
try{
 await page.goto(base+'papers.html#paper-kernel-panel');await page.waitForFunction(()=>document.querySelector('#paper-ready')?.classList.contains('rdy'));
 assert(await page.locator('[data-kernel-run]').isDisabled());
 await click('#load-kernel-paper');assert.equal(await page.locator('[data-review-source]:enabled').count(),1);
 await page.locator('[data-review-source]:enabled').check();await click('#confirm-paper-review');
 await page.locator('summary').filter({hasText:'Create a named bucket'}).click();await click('#create-bucket');
 await click('[data-kernel-run]');assert.match(await page.locator('[data-kernel-run-status]').textContent(),/executed.*true/);
 assert(await page.locator('[data-kernel-admit]').isDisabled());
 await page.locator('[data-kernel-ack]').check();await click('[data-kernel-review]');assert.match(await page.locator('[data-kernel-review-status]').textContent(),/Reviewed by person:me/);
 await click('[data-kernel-admit]');assert.match(await page.locator('[data-kernel-last]').textContent(),/inserted.*v1 → v2/,await page.locator('#bucket-receipt').textContent());
 assert.match(await page.locator('#paper-proofs').textContent(),/wmt.kernel-execution\/1.*checked/s);
 const receipt=JSON.parse(await page.locator('#bucket-receipt').textContent());assert.equal(receipt.outcome,'inserted');assert.equal(receipt.addedClaimIds.length,2);
 const [download]=await Promise.all([page.waitForEvent('download'),page.click('[data-kernel-sidecar]')]);
 const sidecar=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(sidecar.submission.proofReceipts[0].result.status,'checked');assert.equal(sidecar.submission.proofReceipts[0].result.run.result.output,true);
 assert.equal(sidecar.submission.proofs[0].evidence.request.kernel.source.includes('let run'),true);
 if(process.env.PAPER_ARTIFACTS){await mkdir(process.env.PAPER_ARTIFACTS,{recursive:true});await page.locator('#paper-kernel-panel').screenshot({path:process.env.PAPER_ARTIFACTS+'/paper-kernels-admitted.png',style:'.nav { visibility:hidden !important; }'});}
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,null,{timeout:5000});
 if(process.env.PAPER_ARTIFACTS)await page.locator('#paper-kernel-panel').screenshot({path:process.env.PAPER_ARTIFACTS+'/paper-kernels-mobile.png',style:'.nav { visibility:hidden !important; }'});
 await page.setViewportSize({width:1440,height:1100});
 const imported={kernel:sidecar.submission.proofs[0].evidence.request.kernel,inputs:sidecar.submission.proofs[0].evidence.request.inputs};
 await page.setInputFiles('[data-kernel-import]',{name:'my-kernel.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await idle();
 assert.equal(await page.locator('[data-kernel-run-status]').count(),0);assert.match(await page.locator('[data-kernel-notice]').textContent(),/No code has run/);
 console.log('PASS real PDF → reviewed claim → local OCaml/Wasm execution → explicit IR review → fresh replay → SAT bucket append → complete sidecar');
 await click('[data-kernel-example="embedding"]');await click('[data-kernel-run]');assert.match(await page.locator('[data-kernel-run-status]').textContent(),/executed.*true/);
 await page.locator('[data-kernel-ack]').check();await click('[data-kernel-review]');
 await page.locator('[data-kernel-observation]').fill('{"sorts":[],"preds":[],"funcs":[],"claims":[]}');assert(await page.locator('[data-kernel-admit]').isDisabled());assert(!(await page.locator('[data-kernel-ack]').isChecked()));
 const inputs=JSON.parse(await page.locator('[data-kernel-inputs]').inputValue());inputs.rightSpace.revision='incompatible';await page.locator('[data-kernel-inputs]').fill(JSON.stringify(inputs));assert.equal(await page.locator('[data-kernel-admit]').count(),0);
 await click('[data-kernel-run]');assert.match(await page.locator('[data-kernel-run-status]').textContent(),/error.*Embedding spaces must match/s);assert.equal(await page.locator('[data-kernel-admit]').count(),0);
 await click('[data-kernel-example="reference"]');await click('[data-kernel-run]');assert.match(await page.locator('[data-kernel-run-status]').textContent(),/executed.*kilograms.*100.*1/);
 console.log('PASS custom embedding equality, incompatible embedding rejection, edit-invalidated review and real pinned veri7vn quantity execution');
 await page.locator('[data-kernel-code]').fill('let run = syntax error ;;;');await click('[data-kernel-run]');assert.match(await page.locator('[data-kernel-run-status]').textContent(),/error/);assert.equal(await page.locator('[data-kernel-admit]').count(),0);
 await page.locator('[data-kernel-code]').fill('let run (_:Wmt_Paper_Kernel.json) : Wmt_Paper_Kernel.json = while true do () done; Bool true;;');
 await page.click('[data-kernel-run]');await page.waitForFunction(()=>!document.querySelector('#cancel-paper-operation').disabled);await page.click('#cancel-paper-operation');await idle();
 assert.match(await page.locator('[data-kernel-run-status]').textContent(),/cancelled/);assert.equal(await page.locator('#bucket-summary [data-version]').getAttribute('data-version'),'2');
 const [file]=await Promise.all([page.waitForEvent('download'),page.click('[data-kernel-sidecar]')]);
 const prior=JSON.parse(await readFile(await file.path(),'utf8'));assert.equal(prior.submission.proofReceipts[0].result.status,'checked');
 const runtimeChecks=await page.evaluate(async()=>{
  const sdk=await import('./sdk/index.mjs'),{createBrowserOCamlExecutor}=await import('./sdk/kernel-browser.mjs'),{createKernelExampleSubmission}=await import('./papers/kernel-example.mjs');
  const client=sdk.createWorkerClient(()=>new Worker(new URL('./papers/worker.js',location.href)));
  let paper=await createKernelExampleSubmission(client);paper=await sdk.reviewSubmission(paper,{actorId:'test',sourceClaimIds:paper.proposal.mappings.map(m=>m.sourceClaimId)});
  const buildReceipt=await fetch('./kernels/build-receipt.json').then(r=>r.json()),results=[];
  for(const runtime of ['wasm','js']){
   const executor=await createBrowserOCamlExecutor({runtimeBaseURL:new URL('./kernels/',location.href),buildReceipt,runtime}),executors=new Map([[executor.id,executor]]);
   const inputs={text:'é λ 🐦 "\\\n);; failwith "data is not code";;',values:[null,true,false,-2,0.125],nested:{foo:'bar'}};
   const kernel={format:'wmt.kernel/1',id:'test:echo',revision:'1',executorId:executor.id,language:'ocaml',interface:'wmt.json-kernel/1',source:'open Wmt_Paper_Kernel;; let run request = field "inputs" request;;',libraries:[]};
   const request=await sdk.createKernelRequest(paper,{kernel,inputs,claimIds:[paper.review.ir.claims[0].id]}),run=await sdk.runPaperKernel(paper,request,{executors});
   results.push({runtime,status:run.result.status,identical:run.result.status==='executed'&&sdk.canonical(run.result.output)===sdk.canonical(inputs)});
   if(runtime==='wasm'){
    const looping=await sdk.createKernelRequest(paper,{kernel:{...kernel,source:'let run (_:Wmt_Paper_Kernel.json) : Wmt_Paper_Kernel.json = while true do () done; Bool true;;'},inputs,claimIds:request.claimIds});
    results.push({timeout:(await sdk.runPaperKernel(paper,looping,{executors,wallTimeMs:2000})).result.status});
   }
  }
  return results;
 });
 assert.deepEqual(runtimeChecks,[{runtime:'wasm',status:'executed',identical:true},{timeout:'timeout'},{runtime:'js',status:'executed',identical:true}]);
 if(process.env.PAPER_ARTIFACTS){await mkdir(process.env.PAPER_ARTIFACTS,{recursive:true});await page.locator('#paper-kernel-panel').screenshot({path:process.env.PAPER_ARTIFACTS+'/paper-kernels.png'});}
 assert.deepEqual(errors,[]);console.log('PASS compile errors/cancellation cannot append; Wasm and JS preserve Unicode/JSON exactly; real infinite worker times out; no browser exceptions');
}finally{await browser.close();}
