import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createNodeClient} from './node.mjs';
import {BucketRepository,createSubmission,formalizeSubmission,reviewSubmission,verifySubmissionProofs,
  analyzeSubmissionDefaults,controlledParser,validateProof,decodeBase64,exportSidecar,closed,requireThat,digest,clone} from './index.mjs';

const errors={not_found:404,stale_version:409,revision_conflict:409,owner_mismatch:403,resource_limit:413,busy:503};
function json(response,status,value) {
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  response.end(JSON.stringify(value));
}
function body(request,maxBytes) {
  return new Promise((resolve,reject)=>{
    const chunks=[];let length=0,failed=false;
    request.on('data',chunk=>{
      length+=chunk.length;
      if(length>maxBytes){if(!failed){failed=true;reject(Object.assign(new Error('Request exceeds the body budget.'),{code:'resource_limit'}));}return;}
      if(!failed)chunks.push(chunk);
    });
    request.on('end',()=>{if(!failed)try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new Error('Malformed JSON body.'));}});
    request.on('error',reject);
  });
}
export function createSidecarServer({client=createNodeClient(),repository=new BucketRepository(client),verifiers=new Map(),formalizers=new Map(),claimExtractor,maxBodyBytes=34000000,maxConcurrent=2}={}) {
  const papers=new Map(),receipts=[],controllers=new Set();let active=0;
  const get=id=>{const entry=papers.get(id);requireThat(entry,'Submission not found.','not_found');return entry;};
  const commit=(id,expectedRevision,value)=>{
    const entry=get(id);requireThat(entry.revision===expectedRevision,'Submission changed; reload before updating.','stale_version');
    const next={...entry,revision:entry.revision+1,submission:value};papers.set(id,next);return clone({revision:next.revision,submission:value});
  };
  const server=createServer(async(request,response)=>{
    const controller=new AbortController();controllers.add(controller);request.on('aborted',()=>controller.abort());
    response.on('close',()=>{if(!response.writableEnded)controller.abort();});
    let acquired=false;
    try {
      requireThat(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host??''),'This sidecar accepts loopback Host headers only.','owner_mismatch');
      if(request.headers.origin)requireThat(request.headers.origin===`http://${request.headers.host}`,'Cross-origin mutation is unavailable.','owner_mismatch');
      const url=new URL(request.url,'http://'+request.headers.host),segments=url.pathname.split('/').filter(Boolean).map(decodeURIComponent),method=request.method;
      if(method==='GET' && url.pathname==='/v1/capabilities')return json(response,200,{
        format:'wmt.sidecar-capabilities/1',sdk:'0.1.0-experimental.5',releaseStatus:'experimental_unsigned',
        extraction:claimExtractor?.id??'PDF.js text layer; candidate_partial; OCR adapter not installed',formalizers:['wmt.controlled-fol/1',...formalizers.keys()],
        reasoningPolicies:['wmt.strict-specificity-greedy/1','wmt.named-normal-extensions/1'],proofCheckers:['smt-entailment','smt-explanation-witness',...verifiers.keys()],bucketScopes:['personal','rfc'],persistence:'memory_only',publication:'unavailable',
        runtime:JSON.parse(await readFile(new URL('./runtime/manifest.json',import.meta.url),'utf8'))});
      if(method==='GET' && url.pathname==='/v1/openapi.json')return json(response,200,JSON.parse(await readFile(new URL('./openapi.json',import.meta.url),'utf8')));
      if(method==='GET' && url.pathname==='/v1/buckets')return json(response,200,{buckets:repository.list()});
      if(method==='GET' && segments[0]==='v1' && segments[1]==='buckets' && segments.length===3) {
        const version=url.searchParams.has('version')?Number(url.searchParams.get('version')):undefined;
        if(version!==undefined)requireThat(Number.isSafeInteger(version) && version>0,'Invalid bucket version.');
        return json(response,200,{bucket:repository.get(segments[2],version)});
      }
      if(method==='GET' && segments[0]==='v1' && segments[1]==='receipts' && segments.length===3)return json(response,200,{receipt:repository.receipt(segments[2])});
      if(method==='GET' && segments[0]==='v1' && segments[1]==='submissions' && segments.length===3) {
        const p=get(segments[2]);return json(response,200,{revision:p.revision,submission:p.submission});
      }
      if(method==='GET' && segments[0]==='v1' && segments[1]==='submissions' && segments[3]==='sidecar' && segments.length===4) {
        const p=get(segments[2]),related=receipts.filter(r=>r.submissionId===p.submission.id);
        return json(response,200,exportSidecar(p.submission,{bucketReceipts:related,buckets:repository.export().versions,extensionReceipts:repository.export().extensionReceipts}));
      }
      if(method!=='POST')return json(response,method==='GET'?404:405,{format:'wmt.api-error/1',code:method==='GET'?'not_found':'method_unavailable',message:'Only documented GET/POST operations are available.'});
      requireThat((request.headers['content-type']??'').split(';')[0]==='application/json','Use application/json.');
      requireThat(active<maxConcurrent,'Sidecar is busy; retry after the active operation.','busy');active++;acquired=true;
      const input=await body(request,maxBodyBytes),options={signal:controller.signal};
      if(url.pathname==='/v1/submissions') {
        closed(input,['title','authors','rfcRef','publicationRef','pdf','proofs'],'submission request');closed(input.pdf,['fileName','base64'],'PDF asset');
        const requestDigest=await digest('submission-request',input);
        const submission=await createSubmission({...input,bytes:decodeBase64(input.pdf.base64),fileName:input.pdf.fileName},client,{...options,claimExtractor});
        if(papers.has(submission.id)) {
          const p=get(submission.id);requireThat(p.requestDigest===requestDigest,'Paper already exists with different input; use a revision-specific update.','revision_conflict');
          return json(response,200,{revision:p.revision,submission:p.submission});
        }
        papers.set(submission.id,{revision:1,submission,requestDigest});return json(response,201,{revision:1,submission});
      }
      if(url.pathname==='/v1/buckets') {
        closed(input,['id','name','scope','owner','rfcRef','ir'],'bucket request');return json(response,201,{bucket:await repository.create({...input,signal:controller.signal})});
      }
      if(segments[0]==='v1' && segments[1]==='submissions' && segments.length>=4) {
        const id=segments[2],entry=get(id),expectedRevision=input.expectedRevision;
        requireThat(expectedRevision===entry.revision,'Submission revision changed.','stale_version');
        const before=clone(entry.submission),action=segments.slice(3).join('/');let next;
        if(action==='formalizations') {
          closed(input,['expectedRevision','parserId','vocabulary','ir','mappings','unsupported'],'formalization request');
          if(input.ir)next=await formalizeSubmission(before,input);
          else {
            const parserId=input.parserId??'wmt.controlled-fol/1';
            const parse=parserId==='wmt.controlled-fol/1'?controlledParser(input.vocabulary):formalizers.get(parserId);
            requireThat(typeof parse==='function','Formalizer adapter is not installed.','unsupported');
            next=await formalizeSubmission(before,{parse,parserId});
          }
        } else if(action==='review') {
          closed(input,['expectedRevision','actorId','sourceClaimIds'],'review request');next=await reviewSubmission(before,input);
        } else if(action==='reasoning/defaults') {
          closed(input,['expectedRevision','request','limits'],'defaults analysis request');
          const receipt=await analyzeSubmissionDefaults(before,input.request,client,{...options,limits:input.limits??{}});
          requireThat(get(id).revision===expectedRevision,'Submission changed during analysis.','stale_version');
          return json(response,200,{revision:expectedRevision,receipt});
        } else if(action==='proofs') {
          closed(input,['expectedRevision','proofs'],'proof attachment request');requireThat(Array.isArray(input.proofs) && input.proofs.length<=16,'Limit proof artifacts to 16.');
          const ids=new Set();for(const proof of input.proofs){await validateProof(proof);requireThat(!ids.has(proof.id),'Proof IDs must be unique.');ids.add(proof.id);}
          next={...before,proofs:clone(input.proofs),proofReceipts:[]};
        } else if(action==='proofs/check') {
          closed(input,['expectedRevision','limits'],'proof check request');next=await verifySubmissionProofs(before,client,{...options,limits:input.limits??{},verifiers});
        } else return json(response,404,{code:'not_found',message:'Unknown submission operation.'});
        return json(response,200,commit(id,expectedRevision,next));
      }
      if(segments[0]==='v1' && segments[1]==='buckets' && segments.length===4) {
        const id=segments[2];
        if(segments[3]==='submissions') {
          closed(input,['expectedVersion','expectedDigest','actorId','submissionId','submissionRevision','idempotencyKey','limits','enumeratePositions'],'bucket submission request');
          const p=get(input.submissionId);requireThat(input.submissionRevision===p.revision,'Submission revision changed before checking.','stale_version');
          const result=await repository.submit(id,{...input,submission:clone(p.submission),signal:controller.signal});
          if(!receipts.some(r=>r.id===result.receipt.id))receipts.push(result.receipt);
          return json(response,200,result);
        }
        if(segments[3]==='default-extensions') {
          closed(input,['expectedVersion','expectedDigest','actorId','submissionId','submissionRevision','candidateIR','request','limits'],'bucket extension request');
          requireThat(input.candidateIR!==undefined?input.submissionId===undefined && input.submissionRevision===undefined:typeof input.submissionId==='string' && Number.isSafeInteger(input.submissionRevision),'Choose either candidate IR or a versioned submission.');
          let submission;
          if(input.submissionId!==undefined){const p=get(input.submissionId);requireThat(p.revision===input.submissionRevision,'Submission revision changed.','stale_version');submission=clone(p.submission);}
          const receipt=await repository.enumerateDefaults(id,{expectedVersion:input.expectedVersion,expectedDigest:input.expectedDigest,actorId:input.actorId,submission,candidateIR:input.candidateIR,request:input.request,limits:input.limits,signal:controller.signal});
          if(submission)requireThat(get(input.submissionId).revision===input.submissionRevision,'Submission changed during enumeration.','stale_version');
          return json(response,200,{receipt});
        }
        if(segments[3]==='extension-forks') {
          closed(input,['receiptId','extensionId','newId','name','actorId','expectedVersion','expectedDigest'],'extension adoption request');
          return json(response,201,{bucket:await repository.forkExtension(id,{...input,signal:controller.signal})});
        }
        if(segments[3]==='forks') {
          closed(input,['receiptId','keepIds','newId','name','actorId','expectedVersion','expectedDigest'],'bucket fork request');
          return json(response,201,{bucket:await repository.fork(id,input)});
        }
      }
      return json(response,404,{format:'wmt.api-error/1',code:'not_found',message:'Unknown API operation.'});
    } catch(error) {
      if(!response.headersSent)json(response,errors[error.code]??400,{format:'wmt.api-error/1',code:error.code??'invalid_input',message:String(error.message??error)});
    } finally {if(acquired)active--;controllers.delete(controller);}
  });
  return {server,repository,close:async()=>{for(const c of controllers)c.abort();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}};
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const index=process.argv.indexOf('--port'),port=index<0?8801:Number(process.argv[index+1]);
  requireThat(Number.isInteger(port) && port>=1 && port<=65535,'Invalid sidecar port.');
  const {server}=createSidecarServer();server.listen(port,'127.0.0.1',()=>console.log(`WMT paper SDK sidecar: http://127.0.0.1:${port}/v1/capabilities (memory only; not published)`));
}
