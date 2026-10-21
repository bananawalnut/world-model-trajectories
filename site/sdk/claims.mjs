import {requireThat,closed,clone,digest,text,isoNow} from './hash.mjs';
import {EMPTY_IR,validateIR,mergeIR} from './ir.mjs';

export const DEMO_VOCABULARY={sort:'Thing',classes:{bird:'Bird',birds:'Bird',penguin:'Penguin',penguins:'Penguin',flier:'Flies',fliers:'Flies'},entities:{tweety:'tweety'}};
const normalized=s=>s.normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ');
export function controlledParser(vocabulary=DEMO_VOCABULARY) {
  const {sort,classes,entities}=vocabulary;
  const parse=async function parse(claim) {
    const sentence=normalized(claim.statement).replace(/[.!]$/,'').trim();let m;
    const ir=clone(EMPTY_IR);ir.sorts=[sort];let formula;
    const pred=(phrase,term)=>{
      const symbol=Object.hasOwn(classes,phrase)?classes[phrase]:null;
      requireThat(symbol,`Unknown class phrase “${phrase}”; define its vocabulary alias explicitly.`,'unsupported');
      if(!ir.preds.some(p=>p.name===symbol))ir.preds.push({name:symbol,args:[sort]});
      return {op:'pred',name:symbol,args:[term]};
    };
    if((m=sentence.match(/^(all|every|no) (.+?) (?:are|is) (?:a |an )?(.+)$/))) {
      const variable={t:'var',name:'x'},left=pred(m[2],variable),right=pred(m[3],variable);
      formula={op:'forall',vars:[{name:'x',sort}],body:{op:'imp',a:left,b:m[1]==='no'?{op:'not',x:right}:right}};
    } else if((m=sentence.match(/^(.+?) is (not )?(?:a |an )?(.+)$/))) {
      const symbol=Object.hasOwn(entities,m[1])?entities[m[1]]:null;
      requireThat(symbol,`Unknown entity phrase “${m[1]}”; define its vocabulary alias explicitly.`,'unsupported');
      ir.funcs=[{name:symbol,args:[],ret:sort}];formula=pred(m[3],{t:'app',name:symbol,args:[]});
      if(m[2])formula={op:'not',x:formula};
    } else requireThat(false,'Outside the controlled grammar. Supply an explicit formalizer adapter or authored WMT IR.','unsupported');
    ir.claims=[{id:claim.id,source:claim.statement,formula,weight:1}];return validateIR(ir);
  };
  parse.parserId='wmt.controlled-fol/1';return parse;
}

export async function formalizeClaims(extraction,{parse=controlledParser(),parserId=parse.parserId,vocabularyIR=EMPTY_IR}={}) {
  requireThat(extraction?.format==='wmt.claim-extraction/1','Expected source claim candidates.');
  text(parserId,'Explicit formalizer ID/version',200);
  let ir=clone(vocabularyIR);const mappings=[],unsupported=[];
  for(const candidate of extraction.claims) {
    let fragment;
    try {fragment=await parse(clone(candidate),clone(ir));}
    catch(error) {if(error.code!=='unsupported')throw error;unsupported.push({sourceClaimId:candidate.id,reason:error.message});continue;}
    validateIR(fragment);requireThat(fragment.claims.length>0,'A formalizer must produce a formula or explicitly mark a candidate unsupported.');
    ir=mergeIR(ir,fragment);mappings.push({sourceClaimId:candidate.id,formalClaimIds:fragment.claims.map(c=>c.id)});
  }
  return makeProposal(extraction,{ir,mappings,unsupported,parserId});
}
export async function makeProposal(extraction,{ir,mappings,unsupported=[],parserId='author.wmt-ir/1'}) {
  validateIR(ir);requireThat(Array.isArray(mappings),'Formalization needs explicit source-to-formula mappings.');
  const sourceIds=new Set(extraction.claims.map(c=>c.id)),formalIds=new Set(ir.claims.map(c=>c.id)),seen=new Set();
  for(const mapping of mappings) {
    closed(mapping,['sourceClaimId','formalClaimIds'],'formalization mapping');
    requireThat(sourceIds.has(mapping.sourceClaimId) && Array.isArray(mapping.formalClaimIds) && mapping.formalClaimIds.length>0,'Each mapping needs an existing source claim and nonempty formal claim IDs.');
    for(const id of mapping.formalClaimIds){requireThat(formalIds.has(id) && !seen.has(id),'Each formal claim must map to exactly one source claim.');seen.add(id);}
  }
  requireThat(seen.size===formalIds.size,'Unmapped formal claims are not allowed.');
  const payload={format:'wmt.formalization/1',documentHash:extraction.documentHash,ir:clone(ir),mappings:clone(mappings),unsupported:clone(unsupported),parserId:text(parserId,'Parser ID',200)};
  return {...payload,digest:await digest('formalization',payload)};
}
export async function reviewProposal(proposal,extraction,{actorId,sourceClaimIds}) {
  requireThat(Array.isArray(sourceClaimIds) && sourceClaimIds.length>0 && new Set(sourceClaimIds).size===sourceClaimIds.length,'Select the source claims whose formalization you reviewed.');
  const rebuilt=await makeProposal(extraction,proposal);
  requireThat(rebuilt.digest===proposal.digest,'Formalization digest mismatch.');
  const selected=new Set(sourceClaimIds),mapped=new Set(proposal.mappings.map(m=>m.sourceClaimId));
  requireThat(sourceClaimIds.every(id=>mapped.has(id)),'Review can confirm only mapped source claims.');
  const keep=new Set(proposal.mappings.filter(m=>selected.has(m.sourceClaimId)).flatMap(m=>m.formalClaimIds));
  const ir={...clone(proposal.ir),claims:proposal.ir.claims.filter(c=>keep.has(c.id)).map(clone)};
  return {format:'wmt.formalization-review/1',actorId:text(actorId,'Reviewer ID',200),proposalDigest:proposal.digest,
    sourceClaimIds:[...selected],ir,irDigest:await digest('ir',ir),reviewedAt:isoNow(),
    boundary:'Self-attributed confirmation of this formalization subset; no claim of extraction completeness or truth.'};
}
export function encodeBase64(bytes) {
  let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(raw);
}
export function decodeBase64(value,maxBytes=12000000) {
  requireThat(typeof value==='string' && value.length<=Math.ceil(maxBytes/3)*4 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'Invalid or oversized base64 asset.');
  const raw=atob(value);requireThat(raw.length<=maxBytes,'Asset exceeds byte budget.','resource_limit');return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
