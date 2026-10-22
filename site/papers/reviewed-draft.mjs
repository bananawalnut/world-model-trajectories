import {validateIR,clone,digest,canonical,requireThat,makeProposal,reviewSubmission,BucketRepository} from '../sdk/index.mjs';

// The strict SDK contracts stay unchanged. This adapter binds one edited source
// passage to a real proposal; its other paper candidates remain unreviewed.
export async function prepareDraftSubmission({base,extraction,sourceClaimId,ir}){
 validateIR(ir);requireThat(ir.claims.length>0,'A primitive declaration is not yet an asserted definition. Rework it into a formula first.');
 requireThat(base.document.sha256===extraction.documentHash,'Source/extraction mismatch.');
 const candidate=extraction.claims.find(c=>c.id===sourceClaimId),page=base.document.pages.find(p=>p.page===candidate?.locator.page);
 requireThat(candidate&&page&&candidate.locator.textHash===page.textHash&&page.text.slice(candidate.locator.start,candidate.locator.end)===candidate.statement&&candidate.locator.quote===candidate.statement,'The definition needs an exact source passage.');
 const draftDigest=await digest('ir',ir),extractionDigest=await digest('extraction',extraction),namespace='w'+base.document.sha256.slice(0,8)+'_'+draftDigest.slice(0,8)+'_';
 const sortMap=new Map(ir.sorts.map((name,i)=>[name,namespace+'s'+i+'_'+name.slice(0,50)]));
 const symbolMap=new Map([...ir.preds,...ir.funcs].map((s,i)=>[s.name,namespace+'n'+i+'_'+s.name.slice(0,50)]));
 const sort=s=>sortMap.get(s)??s;
 const term=t=>t.t==='var'?clone(t):t.t==='app'?{...clone(t),name:symbolMap.get(t.name),args:(t.args??[]).map(term)}:t.t==='arith'?{...clone(t),args:t.args.map(term)}:clone(t);
 const formula=f=>{
  if(f.op==='pred')return {...clone(f),name:symbolMap.get(f.name),args:(f.args??[]).map(term)};
  if(f.op==='eq'||f.op==='cmp')return {...clone(f),a:term(f.a),b:term(f.b)};
  if(f.op==='not')return {...clone(f),x:formula(f.x)};
  if(f.op==='and'||f.op==='or')return {...clone(f),xs:f.xs.map(formula)};
  if(f.op==='imp'||f.op==='iff')return {...clone(f),a:formula(f.a),b:formula(f.b)};
  return {...clone(f),vars:f.vars.map(v=>({...v,sort:sort(v.sort)})),body:formula(f.body)};
 };
 const qualified=validateIR({sorts:ir.sorts.map(sort),preds:ir.preds.map(s=>({...clone(s),name:symbolMap.get(s.name),args:s.args.map(sort)})),funcs:ir.funcs.map(s=>({...clone(s),name:symbolMap.get(s.name),args:s.args.map(sort),ret:sort(s.ret)})),claims:ir.claims.map((c,i)=>({...clone(c),id:namespace+'c'+i+'_'+c.id.slice(0,50),source:candidate.statement,formula:formula(c.formula)}))});
 const proposal=await makeProposal(extraction,{ir:qualified,mappings:[{sourceClaimId,formalClaimIds:qualified.claims.map(c=>c.id)}],unsupported:extraction.claims.filter(c=>c.id!==sourceClaimId).map(c=>({sourceClaimId:c.id,reason:'Outside this single-definition review.'})),parserId:'wmt.authored-paper-draft/1'});
 return {format:'wmt.reviewed-paper-draft/1',documentHash:base.document.sha256,extractionDigest,sourceClaimId,source:candidate.statement,locator:clone(candidate.locator),draftIR:clone(ir),draftDigest,namespace,symbols:[...sortMap,...symbolMap].map(([local,qualified])=>({local,qualified})),submission:{...clone(base),extraction:clone(extraction),proposal,review:null,proofs:[],proofReceipts:[]}};
}
async function validatePrepared(prepared){
 const fresh=await prepareDraftSubmission({base:prepared.submission,extraction:prepared.submission.extraction,sourceClaimId:prepared.sourceClaimId,ir:prepared.draftIR});
 for(const key of ['format','documentHash','extractionDigest','source','locator','draftDigest','namespace','symbols'])requireThat(canonical(fresh[key])===canonical(prepared[key]),'Prepared source/draft binding changed; prepare it again.');
 const actual=await makeProposal(prepared.submission.extraction,prepared.submission.proposal);
 requireThat(actual.digest===prepared.submission.proposal.digest&&fresh.submission.proposal.digest===actual.digest,'Prepared formalization changed; prepare it again.');return fresh;
}
export async function recordDraftReview(prepared,{actorId}){
 const fresh=await validatePrepared(prepared);
 return {...fresh,submission:await reviewSubmission(fresh.submission,{actorId,sourceClaimIds:[fresh.sourceClaimId]})};
}
export async function admitReviewedDraft(prepared,client,{signal,repository,bucketId='bucket:reviewed-definition',contrast=false}={}){
 requireThat(prepared.submission.review,'Record the exact formalization review first.');
 await validatePrepared(prepared);
 const repo=repository??new BucketRepository(client),owner=prepared.submission.review.actorId;
 let ir={sorts:[],preds:[],funcs:[],claims:[]};
 if(contrast){
  const q=prepared.submission.review.ir;ir={...clone(q),claims:[{id:prepared.namespace+'contrast',source:'Analyst contrast: reject the proposed definition. This fixture is not attributed to the submitted paper.',formula:{op:'not',x:clone(q.claims[0].formula)}}]};
 }
 let before;try{before=repo.get(bucketId);}catch(e){if(e.code!=='not_found')throw e;before=await repo.create({id:bucketId,name:contrast?'Contrast: rejects the definition':'Reviewed paper definition',owner,ir,signal});}
 const result=await repo.submit(before.id,{expectedVersion:before.version,expectedDigest:before.digest,actorId:owner,submission:prepared.submission,idempotencyKey:'definition-'+prepared.submission.proposal.digest+'-'+before.digest,enumeratePositions:false,signal});
 return {format:'wmt.definition-bucket-experiment/1',reviewedDraft:clone(prepared),before,after:result.bucket,receipt:result.receipt,workspace:repo.export(),boundary:'Local, self-attributed modeling review and consistency check; no author sign-off, empirical truth or canonical Hub change.'};
}
