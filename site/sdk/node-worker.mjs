import {parentPort} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extractPdf} from './pdf.mjs';
import {createAnalysisRunner,lowLevelEvaluator,renderIR} from './analysis.mjs';
import {sha256,requireThat} from './hash.mjs';
parentPort.once('message',async({action,payload,limits})=>{
  try {
    let value;
    if(action==='extract')value=await extractPdf(payload.bytes,{fileName:payload.fileName,
      standardFontDataUrl:fileURLToPath(new URL('./standard_fonts/',import.meta.resolve('pdfjs-dist/package.json')))});
    else {
      const [{default:init,WmtEngine},{init:initZ3},record]=await Promise.all([
        import('./runtime/wmt_core.js'),import('z3-solver'),readFile(new URL('./runtime/manifest.json',import.meta.url),'utf8')]);
      const runtime=JSON.parse(record),wasm=await readFile(new URL('./runtime/wmt_core_bg.wasm',import.meta.url));
      requireThat(await sha256(wasm)===runtime.files['wmt_core_bg.wasm'],'WMT binary checksum mismatch.','binding_mismatch');
      await init({module_or_path:wasm});
      if(action==='render'){value=renderIR(()=>new WmtEngine(),payload.ir);parentPort.postMessage({type:'wmt.sdk.reply/1',ok:true,value});return;}
      requireThat(await sha256(await readFile(new URL('./build/z3-built.wasm',import.meta.resolve('z3-solver/package.json'))))===runtime.solverWasmSha256,'Solver binary checksum mismatch.','binding_mismatch');
      const z3=await initZ3();
      const runner=createAnalysisRunner({createEngine:()=>new WmtEngine(),evaluate:lowLevelEvaluator(z3.Z3),runtime});
      if(action==='consistency')value=await runner.consistency(payload.ir,limits);
      else if(action==='extensions')value=await runner.extensions(payload.ir,payload.request,limits);
      else if(action==='analyze')value=await runner.analyze(payload.ir,limits);
      else if(action==='witness')value=await runner.witness(payload.ir,payload.evidence,limits);
      else if(action==='defeasible')value=await runner.defeasible(payload.ir,payload.request,limits);
      else if(action==='entailment')value=await runner.entailment(payload.ir,payload.proof,limits);
      else throw new Error('Unknown worker operation.');
    }
    parentPort.postMessage({type:'wmt.sdk.reply/1',ok:true,value});
  } catch(error){parentPort.postMessage({type:'wmt.sdk.reply/1',ok:false,error:String(error.message??error),code:error.code??'error'});}
});
