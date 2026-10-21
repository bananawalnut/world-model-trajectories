/* Fresh, bounded worker per SDK request. Only pinned same-origin runtime assets
   are loaded. Paper text and proof artifacts are never executed as scripts. */
self.onmessage=async({data:{action,payload,limits}})=>{
  try {
    let value;
    if(action==='extract') {
      const [{extractPdf},pdfjs]=await Promise.all([import('../sdk/pdf.mjs'),import('../vendor/pdfjs/pdf.mjs')]);
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.mjs',self.location.href).href;
      const port=new Worker(pdfjs.GlobalWorkerOptions.workerSrc,{type:'module',credentials:'omit'}),worker=new pdfjs.PDFWorker({port});
      try {value=await extractPdf(payload.bytes,{pdfjs,worker,fileName:payload.fileName,
        standardFontDataUrl:new URL('../vendor/pdfjs/standard_fonts/',self.location.href).href});}
      finally {worker.destroy();port.terminate();}
    } else {
      if(action==='render') {
        const [{default:init,WmtEngine},{renderIR}]=await Promise.all([import('../sdk/runtime/wmt_core.js'),import('../sdk/analysis.mjs')]);
        await init();value=renderIR(()=>new WmtEngine(),payload.ir);self.postMessage({type:'wmt.sdk.reply/1',ok:true,value});return;
      }
      importScripts('../vendor/z3/z3-built.js');
      const initOriginal=self.initZ3;
      self.initZ3=options=>initOriginal({...options,
        locateFile:path=>new URL('../vendor/z3/'+path,self.location.href).href,
        mainScriptUrlOrBlob:new URL('../vendor/z3/z3-built.js',self.location.href).href});
      const [{default:init,WmtEngine},{default:z3Module},{createAnalysisRunner,lowLevelEvaluator},runtime]=await Promise.all([
        import('../sdk/runtime/wmt_core.js'),import('../vendor/z3/z3-solver.bundle.mjs'),import('../sdk/analysis.mjs'),
        fetch('../sdk/runtime/manifest.json',{credentials:'omit'}).then(r=>{if(!r.ok)throw new Error('SDK runtime manifest unavailable.');return r.json();})]);
      await init();const z=await(z3Module.init||z3Module.default?.init)();
      const runner=createAnalysisRunner({createEngine:()=>new WmtEngine(),evaluate:lowLevelEvaluator(z.Z3),runtime});
      if(action==='analyze')value=await runner.analyze(payload.ir,limits);
      else if(action==='entailment')value=await runner.entailment(payload.ir,payload.proof,limits);
      else throw new Error('Unknown SDK worker operation.');
    }
    self.postMessage({type:'wmt.sdk.reply/1',ok:true,value});
  } catch(error){self.postMessage({type:'wmt.sdk.reply/1',ok:false,error:String(error.message??error),code:error.code??'error'});}
};
