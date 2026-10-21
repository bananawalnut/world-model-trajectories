import {requireThat,clone,digest,canonical,text,isoNow,closed,isObject} from './hash.mjs';
import {EMPTY_IR,validateIR,mergeIR,LOGIC_PROFILE} from './ir.mjs';
import {reviewProposal} from './claims.mjs';
import {limitsFor} from './analysis.mjs';
const identity=b=>({id:b.id,version:b.version,digest:b.digest});
async function snapshot(value) {const {digest:previous,...payload}=value;return validateBucket({...payload,digest:await digest('bucket',payload)});}
export async function validateBucket(bucket) {
  closed(bucket,['format','id','name','scope','owner','rfcRef','version','parent','ir','provenance','createdAt','digest'],'bucket');
  const {digest:expected,...payload}=bucket;
  requireThat(bucket.format==='wmt.bucket/1' && expected===await digest('bucket',payload),'Bucket snapshot digest mismatch.');
  for(const key of ['id','name','owner'])text(bucket[key],`Bucket ${key}`,200);
  requireThat(['personal','rfc'].includes(bucket.scope) && Number.isSafeInteger(bucket.version) && bucket.version>0 && bucket.version<=1000000000,'Invalid bucket identity/version.');
  requireThat(bucket.rfcRef===null || typeof bucket.rfcRef==='string' && bucket.rfcRef.length>0 && bucket.rfcRef.length<=500,'Invalid RFC reference.');
  requireThat(bucket.scope!=='rfc' || bucket.rfcRef!==null,'RFC bucket requires its reference.');
  requireThat(isObject(bucket.provenance) && typeof bucket.createdAt==='string' && Number.isFinite(Date.parse(bucket.createdAt)),'Invalid bucket provenance/timestamp.');
  if(bucket.parent!==null){closed(bucket.parent,['id','version','digest'],'parent reference');text(bucket.parent.id,'Parent bucket ID',200);requireThat(Number.isSafeInteger(bucket.parent.version) && bucket.parent.version>0 && /^[0-9a-f]{64}$/.test(bucket.parent.digest),'Invalid parent bucket reference.');}
  validateIR(bucket.ir);return bucket;
}
export async function createBucket({id,name,scope='personal',owner,rfcRef=null,ir=EMPTY_IR,parent=null,client,signal}) {
  text(id,'Bucket ID',200);text(name,'Bucket name',200);text(owner,'Bucket owner',200);
  requireThat(['personal','rfc'].includes(scope) && (scope!=='rfc' || typeof rfcRef==='string' && rfcRef.length>0),'RFC-scoped buckets require an explicit RFC revision reference.');
  validateIR(ir);
  let creationEvidence=null;
  if(ir.claims.length) {
    requireThat(client?.analyze,'A nonempty initial bucket requires a real consistency check.');
    const result=await client.analyze(ir,{signal});
    requireThat(result.complete && result.status==='consistent' && result.stopReason==='completed' && result.inputDigest===await digest('ir',ir),'Initial bucket did not pass its consistency check.');
    creationEvidence={inputDigest:result.inputDigest,runtime:result.runtime};
  }
  return snapshot({format:'wmt.bucket/1',id,name,scope,owner,rfcRef,version:1,parent,
    ir:clone(ir),provenance:{operation:'create',creationEvidence},createdAt:isoNow()});
}
export async function submitToBucket({bucket,expectedVersion,expectedDigest,actorId,submission,client,limits={},signal}) {
  await validateBucket(bucket);
  requireThat(expectedVersion===bucket.version && expectedDigest===bucket.digest,'Bucket version changed; reload and check again.','stale_version');
  requireThat(actorId===bucket.owner,'Only the declared bucket owner can append in this local SDK.','owner_mismatch');
  requireThat(submission?.proposal && submission?.review,'Formalization review is required before a bucket operation.','review_required');
  const review=await reviewProposal(submission.proposal,submission.extraction,{actorId:submission.review.actorId,sourceClaimIds:submission.review.sourceClaimIds});
  requireThat(review.irDigest===submission.review.irDigest && review.proposalDigest===submission.review.proposalDigest && submission.document.sha256===submission.extraction.documentHash,'Review or source binding changed.','binding_mismatch');
  const inputIR=mergeIR(bucket.ir,review.ir),inputDigest=await digest('ir',inputIR),budgets=limitsFor(limits);
  const analysis=await client.analyze(inputIR,{limits:budgets,signal});
  const complete=analysis.complete===true && analysis.stopReason==='completed' && ['consistent','inconsistent'].includes(analysis.status) && analysis.inputDigest===inputDigest;
  const oldIds=new Set(bucket.ir.claims.map(c=>c.id)),addedClaimIds=review.ir.claims.map(c=>c.id).filter(id=>!oldIds.has(id));
  const operation={actorId,bucket:identity(bucket),submissionId:submission.id,documentHash:submission.document.sha256,
    proposalDigest:submission.proposal.digest,reviewDigest:await digest('review',submission.review),inputDigest,
    logicProfile:LOGIC_PROFILE,budgets,analysis:clone(analysis)};
  const operationDigest=await digest('bucket-operation',operation);
  let next=bucket,outcome=complete?(analysis.status==='inconsistent'?'conflict':addedClaimIds.length?'inserted':'unchanged'):'stopped';
  if(outcome==='inserted')next=await snapshot({...clone(bucket),version:bucket.version+1,parent:identity(bucket),ir:inputIR,
    provenance:{operation:'append',operationDigest,submissionId:submission.id,documentHash:submission.document.sha256},createdAt:isoNow(),digest:undefined});
  // Exclude the previous digest from the new payload (JSON never stores undefined).
  const receiptPayload={format:'wmt.bucket-receipt/1',...operation,operationDigest,outcome,
    before:identity(bucket),after:identity(next),addedClaimIds:outcome==='inserted'?addedClaimIds:[],inputIR,
    boundary:'Attributed consistency evidence for this bucket version and formalization; no truth, peer review, publication or governance authority.',createdAt:isoNow()};
  const receipt={...receiptPayload,id:'receipt_'+(await digest('bucket-receipt',receiptPayload))};
  return {bucket:clone(next),receipt};
}
export function compareBuckets(a,b) {
  const left=new Map(a.ir.claims.map(c=>[c.id,canonical(c)])),right=new Map(b.ir.claims.map(c=>[c.id,canonical(c)]));
  return {left:identity(a),right:identity(b),onlyLeft:[...left.keys()].filter(k=>!right.has(k)),onlyRight:[...right.keys()].filter(k=>!left.has(k)),changed:[...left.keys()].filter(k=>right.has(k) && left.get(k)!==right.get(k))};
}

// In-memory by design. A host can persist these immutable snapshots explicitly.
// CAS occurs after the awaited solver call, so racing appends cannot overwrite.
export class BucketRepository {
  #heads=new Map();#versions=new Map();#receipts=new Map();#operations=new Map();#archived=[];
  constructor(client){this.client=client;}
  list(){return [...this.#heads.values()].map(clone);}
  get(id,version){const value=version?this.#versions.get(`${id}@${version}`):this.#heads.get(id);requireThat(value,'Bucket not found.','not_found');return clone(value);}
  receipt(id){const value=this.#receipts.get(id);requireThat(value,'Receipt not found.','not_found');return clone(value);}
  export(){return {format:'wmt.bucket-workspace/1',heads:this.list().map(identity),versions:[...this.#versions.values()].map(clone),receipts:[...this.#archived,...this.#receipts.values()].map(clone)};}
  async restore(workspace,{signal}={}) {
    requireThat(this.#heads.size===0 && workspace?.format==='wmt.bucket-workspace/1','Restore into an empty repository using wmt.bucket-workspace/1.');
    requireThat(Array.isArray(workspace.versions) && workspace.versions.length<=256 && Array.isArray(workspace.heads) && workspace.heads.length<=32 && Array.isArray(workspace.receipts) && workspace.receipts.length<=256,'Workspace exceeds snapshot/receipt limits.');
    const versions=new Map(),heads=new Map();
    for(const bucket of workspace.versions){await validateBucket(bucket);const key=`${bucket.id}@${bucket.version}`;requireThat(!versions.has(key),'Duplicate bucket version.');versions.set(key,clone(bucket));}
    for(const ref of workspace.heads) {
      const bucket=versions.get(`${ref.id}@${ref.version}`);requireThat(bucket && bucket.digest===ref.digest && !heads.has(ref.id),'Invalid workspace head.');
      requireThat([...versions.values()].filter(v=>v.id===ref.id).every(v=>v.version<=ref.version),'Workspace head would roll back an existing immutable version.');
      const result=await this.client.analyze(bucket.ir,{signal});
      requireThat(result.complete && result.status==='consistent' && result.inputDigest===await digest('ir',bucket.ir),'Restored bucket did not pass a fresh consistency check.');heads.set(ref.id,bucket);
    }
    requireThat([...versions.values()].every(v=>heads.has(v.id)),'Every restored bucket needs an explicit head.');
    for(const bucket of versions.values())if(bucket.parent?.id===bucket.id)requireThat(bucket.parent.version<bucket.version && versions.get(`${bucket.parent.id}@${bucket.parent.version}`)?.digest===bucket.parent.digest,'Invalid bucket version parent.');
    for(const receipt of workspace.receipts){const {id,...payload}=receipt;requireThat(id==='receipt_'+await digest('bucket-receipt',payload),'Archived receipt digest mismatch.');}
    this.#heads=heads;this.#versions=versions;this.#archived=clone(workspace.receipts);
    // Historical receipts are retained for inspection, never eligible for a new
    // fork. A fresh submission must re-run the solver first.
    return this.list();
  }
  #commit(bucket){this.#heads.set(bucket.id,clone(bucket));this.#versions.set(`${bucket.id}@${bucket.version}`,clone(bucket));}
  async create(options) {
    requireThat(!this.#heads.has(options.id),'Bucket ID already exists.','revision_conflict');
    const bucket=await createBucket({...options,client:this.client});
    requireThat(!options.signal?.aborted,'Operation cancelled before bucket creation.','cancelled');
    requireThat(!this.#heads.has(bucket.id),'Bucket was created concurrently.','revision_conflict');this.#commit(bucket);return clone(bucket);
  }
  async submit(id,options) {
    const {signal,...persisted}=options;
    const key=text(options.idempotencyKey,'Idempotency key',200),requestDigest=await digest('append-request',{id,...persisted});
    const scopedKey=canonical([id,options.actorId,key]),previous=this.#operations.get(scopedKey);
    if(previous){requireThat(previous.digest===requestDigest,'Idempotency key was reused with different input.','revision_conflict');return clone(await previous.promise);}
    const promise=(async()=>{
      const before=this.get(id);
      const result=await submitToBucket({...options,bucket:before,client:this.client});
      requireThat(!options.signal?.aborted || result.receipt.outcome==='stopped','Operation cancelled before commit.','cancelled');
      requireThat(this.get(id).digest===before.digest,'Another operation changed this bucket; no append was made.','stale_version');
      if(result.receipt.outcome==='inserted')this.#commit(result.bucket);
      this.#receipts.set(result.receipt.id,clone(result.receipt));return result;
    })();
    this.#operations.set(scopedKey,{digest:requestDigest,promise});
    try{return clone(await promise);}catch(error){this.#operations.delete(scopedKey);throw error;}
  }
  async fork(id,{receiptId,keepIds,newId,name,actorId,expectedVersion,expectedDigest}) {
    const parent=this.get(id);requireThat(actorId===parent.owner,'Only the declared bucket owner may fork.','owner_mismatch');
    requireThat(parent.version===expectedVersion && parent.digest===expectedDigest,'Bucket changed before fork.','stale_version');
    const receipt=this.receipt(receiptId);
    requireThat(receipt.before.digest===parent.digest && receipt.analysis.complete && receipt.analysis.stopReason==='completed','Fork requires a complete result for this exact parent version.');
    requireThat(Array.isArray(keepIds) && new Set(keepIds).size===keepIds.length,'Invalid kept claims.');
    const chosen=[...keepIds].sort();
    requireThat(receipt.analysis.positions.some(p=>canonical([...p.keep].sort())===canonical(chosen)),'Choose a solver-verified maximal coherent position.');
    requireThat(!this.#heads.has(newId),'Fork ID already exists.','revision_conflict');text(newId,'Fork ID',200);text(name,'Fork name',200);
    const ir={...clone(receipt.inputIR),claims:receipt.inputIR.claims.filter(c=>chosen.includes(c.id)).map(clone)};
    const bucket=await snapshot({format:'wmt.bucket/1',id:newId,name,scope:parent.scope,owner:parent.owner,rfcRef:parent.rfcRef,
      version:1,parent:identity(parent),ir,provenance:{operation:'adopt_coherent_position',receiptId,keptClaimIds:chosen},createdAt:isoNow()});
    requireThat(!this.#heads.has(newId) && this.get(id).digest===parent.digest,'Bucket changed during fork.','stale_version');this.#commit(bucket);return clone(bucket);
  }
}
