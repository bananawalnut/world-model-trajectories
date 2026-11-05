import {requireThat,digest,sha256,clone} from './hash.mjs';

// Runtime assets are a host-installed dependency, never URLs selected by paper
// text. The shipped static site hosts the existing OCaml builds in /kernels/.
export async function createBrowserOCamlExecutor({runtimeBaseURL,buildReceipt,runtime='wasm',libraries=[]}){
 requireThat(['wasm','js'].includes(runtime),'Choose the wasm or js OCaml runtime.');
 const base=new URL(runtimeBaseURL,location.href);requireThat(base.origin===location.origin,'OCaml runtime assets must be same-origin.');
 const files=clone(buildReceipt.runtimeFilesSha256),installed=new Map();
 requireThat(files&&typeof files==='object','Install a pinned OCaml build receipt.');
 for(const lib of libraries){requireThat(typeof lib.id==='string'&&!installed.has(lib.id)&&await sha256(new TextEncoder().encode(lib.source))===lib.sha256,'Invalid or duplicate installed OCaml library.');installed.set(lib.id,clone(lib));}
 const script=runtime==='js'?'ocaml-runtime.js':'ocaml-wasm.js';
 const selected=Object.entries(files).filter(([name])=>runtime==='js'?name===script:name===script||name.endsWith('.wasm'));
 requireThat(selected.some(([name])=>name===script),'Runtime script is missing from the pinned build receipt.');
 // Check installed assets once before allowing code to run. Worker/browser
 // caching serves the same same-origin immutable build on subsequent loads.
 for(const [name,hash]of selected){requireThat(!name.includes('..')&&!name.startsWith('/')&&/^[0-9a-f]{64}$/.test(hash),'Invalid runtime asset path/hash.');const r=await fetch(new URL(name,base),{credentials:'omit'});requireThat(r.ok&&await sha256(await r.arrayBuffer())===hash,'OCaml runtime checksum mismatch.','binding_mismatch');}
 const adapterURL=new URL('./ocaml-kernel-worker.mjs',import.meta.url),adapter=await fetch(adapterURL,{credentials:'omit'});requireThat(adapter.ok,'OCaml worker adapter unavailable.');
 const revision=await digest('ocaml-executor',{interface:'wmt.json-kernel/1',runtime,files:Object.fromEntries(selected),libraries:[...installed.values()].map(({id,sha256})=>({id,sha256})),adapterSha256:await sha256(await adapter.arrayBuffer())});
 return {id:'wmt.ocaml.browser/1',revision,execute(request,{signal}={}){
  requireThat(request.kernel.language==='ocaml'&&request.kernel.interface==='wmt.json-kernel/1','This executor supports the OCaml JSON interface only.','unsupported');
  requireThat(request.kernel.libraries.every(id=>installed.has(id)),'Kernel requires an uninstalled OCaml library.','unsupported');
  if(signal?.aborted)return Promise.reject(new Error('Kernel operation cancelled.'));
  return new Promise((resolve,reject)=>{
   const worker=new Worker(adapterURL);let done=false;
   const finish=(error,value)=>{if(done)return;done=true;signal?.removeEventListener('abort',cancel);worker.terminate();error?reject(error):resolve(value);};
   const cancel=()=>finish(new Error('Kernel operation cancelled.'));signal?.addEventListener('abort',cancel,{once:true});
   worker.onmessage=e=>e.data?.ok?finish(null,e.data.output):finish(new Error(e.data?.error??'Invalid OCaml worker response.'));
   worker.onerror=e=>finish(new Error(e.message));worker.onmessageerror=()=>finish(new Error('Malformed OCaml worker reply.'));
   worker.postMessage({runtimeScriptURL:new URL(script,base).href,source:request.kernel.source,libraries:request.kernel.libraries.map(id=>installed.get(id).source),inputs:request.inputs,claims:request.ir.claims.filter(c=>request.claimIds.includes(c.id))});
  });
 }};
}
