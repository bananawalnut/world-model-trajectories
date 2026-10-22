import {limitsFor,stopped} from './analysis.mjs';
// A fresh worker owns every request, including Z3's nested workers. The host
// terminates it on every outcome. No provider, UI, storage or credentials here.
export function createWorkerClient(spawn) {
  async function request(action,payload,{signal,limits={}}={}) {
    const budgets=limitsFor(limits);
    if(signal?.aborted)return stopped('cancelled','Operation cancelled before execution.');
    const worker=spawn();
    return new Promise(resolve=>{
      let settled=false;
      const finish=async value=>{
        if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
        try {await worker.terminate();} finally {resolve(value);}
      };
      const cancel=()=>finish(stopped('cancelled','Operation cancelled; worker terminated.'));
      const timer=setTimeout(()=>finish(stopped('timeout','Wall-clock budget reached; worker terminated.')),budgets.wallTimeMs);
      signal?.addEventListener('abort',cancel,{once:true});
      const reply=data=>{if(data?.type==='wmt.sdk.reply/1')finish(data.ok?data.value:stopped(data.code??'error',data.error??'Worker failed.'));};
      if(worker.addEventListener) {
        worker.addEventListener('message',e=>reply(e.data));
        worker.addEventListener('error',e=>finish(stopped('error',e.message)),{once:true});
        worker.addEventListener('messageerror',()=>finish(stopped('error','Malformed worker reply.')),{once:true});
      } else {
        worker.on('message',reply);worker.once('error',e=>finish(stopped('error',e.message)));
        worker.once('exit',code=>{if(!settled)finish(stopped('error',`Worker exited before replying (${code}).`));});
      }
      worker.postMessage({action,payload,limits:budgets});
    });
  }
  return {request,consistency:(ir,options)=>request('consistency',{ir},options),extensions:(ir,requestInput,options)=>request('extensions',{ir,request:requestInput},options),analyze:(ir,options)=>request('analyze',{ir},options),
    witness:(ir,evidence,options)=>request('witness',{ir,evidence},options),
    defeasible:(ir,requestInput,options)=>request('defeasible',{ir,request:requestInput},options),
    extract:(bytes,fileName,options)=>request('extract',{bytes:new Uint8Array(bytes),fileName},options),
    entailment:(ir,proof,options)=>request('entailment',{ir,proof},options)};
}
