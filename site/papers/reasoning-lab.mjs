import {mountDefaultExtensions} from './default-extensions-view.mjs';
import {extensionIR,extensionRequest} from './extensions-example.mjs';
const extensionsState={};
const conclusionText={supported_in_selected_subtheory:'Supported under the selected assumptions',refuted_in_selected_subtheory:'Its negation follows under the selected assumptions',undetermined:'Neither it nor its negation follows'};
import {createWorkerClient} from '../sdk/index.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const client=createWorkerClient(()=>new Worker(new URL('./worker.js',import.meta.url)));
const atom=name=>({op:'pred',name,args:[]}),not=x=>({op:'not',x}),imp=(a,b)=>({op:'imp',a,b});
const prop=claims=>({sorts:[],preds:['P','Q','R'].map(name=>({name,args:[]})),funcs:[],claims:Object.entries(claims).map(([id,formula])=>({id,source:id,formula}))});
const v={t:'var',name:'x'},pred=name=>({op:'pred',name,args:[v]}),all=body=>({op:'forall',vars:[{name:'x',sort:'Animal'}],body}),t={t:'app',name:'tweety',args:[]};
const examples={
 collective:{description:'Every pair is consistent. Only the full group conflicts. The three coherent positions each retain two claims.',labels:['P','Q','¬(P ∧ Q)'],ir:prop({p:atom('P'),q:atom('Q'),n:not({op:'and',xs:[atom('P'),atom('Q')]})})},
 witness:{description:'The target Q is a query, excluded from its own premises. The core should discover {P, P → Q} and discard irrelevant R.',labels:['P · premise','P → Q · premise','R · irrelevant premise','Q · target'],ir:prop({p:atom('P'),pq:imp(atom('P'),atom('Q')),r:atom('R'),target:atom('Q')})},
 defaults:{description:'Strict: penguins are birds; Tweety is a penguin. Explicit defaults: birds fly (weight 100), penguins do not fly (weight 1). Proper logical specificity takes priority over weight. Query: does Tweety fly?',labels:['Penguin → Bird · strict','Penguin(Tweety) · strict','Bird → Fly · default, weight 100','Penguin → ¬Fly · default, weight 1'],ir:{sorts:['Animal'],preds:['Bird','Penguin','Fly'].map(name=>({name,args:['Animal']})),funcs:[{name:'tweety',args:[],ret:'Animal'}],claims:[{id:'taxonomy',source:'Penguins are birds',formula:all(imp(pred('Penguin'),pred('Bird')))},{id:'fact',source:'Tweety is a penguin',formula:{op:'pred',name:'Penguin',args:[t]}},{id:'birds',source:'Birds normally fly',weight:100,formula:all(imp(pred('Bird'),pred('Fly')))},{id:'penguins',source:'Penguins normally do not fly',weight:1,formula:all(imp(pred('Penguin'),not(pred('Fly'))))},{id:'target',source:'Tweety flies',formula:{op:'pred',name:'Fly',args:[t]}}]}}
};
let controller,result;
function show(){const type=$('reason-example').value,extended=type==='extensions';$('reason-run').hidden=extended;$('reason-export').hidden=extended;$('default-extension-lab').hidden=!extended;if(extended){$('reason-description').textContent='Tweety is a penguin; Robin is a bird. Nixon has competing equally ranked defaults. Enumerate all four extensions, inspect the two preferred positions, and fork either one into its own checked bucket.';$('reason-input').innerHTML='<span>Robin’s bird default survives Tweety’s exception.</span><span>Nixon has two preferred positions.</span>';$('reason-result').replaceChildren();$('reason-progress').textContent='';mountDefaultExtensions($('default-extension-lab'),{client,candidateIR:extensionIR,request:extensionRequest,state:extensionsState});return;}const e=examples[type];$('reason-description').textContent=e.description;$('reason-input').innerHTML=e.labels.map(s=>`<span>${esc(s)}</span>`).join('');$('reason-result').replaceChildren();$('reason-export').disabled=true;result=null;}
$('reason-example').onchange=show;
$('reason-cancel').onclick=()=>controller?.abort();
$('reason-run').onclick=async()=>{
 const type=$('reason-example').value,e=examples[type];controller=new AbortController();$('reason-run').disabled=true;$('reason-example').disabled=true;$('reason-cancel').hidden=false;$('reason-progress').textContent='Loading the pinned runtime and checking…';$('reason-result').replaceChildren();
 try{
  if(type==='collective'){
   const analysis=await client.analyze(e.ir,{signal:controller.signal}),pairs=[];
   if(analysis.complete)for(const omit of e.ir.claims){if(controller.signal.aborted)break;const ir={...e.ir,claims:e.ir.claims.filter(c=>c!==omit)},a=await client.analyze(ir,{signal:controller.signal});pairs.push({keep:ir.claims.map(c=>c.id),status:a.status,complete:a.complete});}
   result={inputIR:e.ir,analysis,pairs};
   if(analysis.complete && pairs.length===3 && pairs.every(p=>p.complete))$('reason-result').innerHTML=`<div class="conflict-hub" data-collective-result><b>One whole conflict: {P, Q, ¬(P ∧ Q)}</b><p>No pairwise attack is inferred. Each collective attack requires the other two premises together.</p><ul>${analysis.conflictSemantics.collectiveAttacks.map(a=>`<li>{${esc(a.from.join(', '))}} collectively excludes ${esc(a.to)}</li>`).join('')}</ul></div><h3>Three maximal coherent positions</h3><div class="lab-claims">${analysis.positions.map(p=>`<span>{${esc(p.keep.join(', '))}}</span>`).join('')}</div><p data-pair-results>Independent pair checks: ${pairs.map(p=>'{'+esc(p.keep.join(', '))+'}: '+esc(p.status)).join(' · ')}</p>`;
  }else if(type==='witness'){
   result={inputIR:e.ir,analysis:await client.witness(e.ir,{targetClaimId:'target'},{signal:controller.signal})};const w=result.analysis;
   $('reason-result').innerHTML=`<article class="walk-card" data-lab-witness><h3>${esc(w.status)} · Q</h3><p>${esc(w.reason??w.message)}</p>${w.status==='checked'?`<div class="reason-flow"><div>P</div><div>P → Q</div><div>∴ Q</div></div><p>Discovered support: ${esc(w.premiseClaimIds.join(', '))}. Irrelevant R is absent.</p>`:''}</article>`;
  }else{
   result={inputIR:e.ir,analysis:await client.defeasible(e.ir,{defaultClaimIds:['birds','penguins'],targetClaimId:'target'},{signal:controller.signal})};const d=result.analysis;
   $('reason-result').innerHTML=`<article class="walk-card" data-lab-defaults><h3>${esc(d.status)} · penguin exception</h3><p>${esc(d.reason??d.message)}</p>${d.status==='selected'?`<div class="reason-flow"><div>Penguin is strictly more specific than Bird.</div><div>Retain penguin default first.</div><div>General bird default conflicts and yields.</div></div><p><b>Query:</b> ${esc(conclusionText[d.conclusion.status])}.</p><p>Retained: ${esc(d.acceptedClaimIds.join(', '))}.</p><p>Minimal blocking conflict: ${esc(d.overridden.map(o=>'{'+o.conflict.join(', ')+'}').join('; '))}.</p>`:''}</article>`;
  }
  $('reason-progress').textContent=result.analysis.complete?'Completed. Exact inputs and solver result are available below.':(result.analysis.message??result.analysis.reason??'Stopped without a complete result.');
  const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Inspect exact request, policy, runtime and result';pre.textContent=JSON.stringify(result,null,2);details.append(summary,pre);$('reason-result').append(details);$('reason-export').disabled=false;
 }catch(e){$('reason-progress').textContent=e.message;}finally{$('reason-run').disabled=false;$('reason-example').disabled=false;$('reason-cancel').hidden=true;}
};
$('reason-export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='wmt-reasoning-example.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};const initial=new URL(location.href).searchParams.get('example');if(initial==='extensions')$('reason-example').value=initial;show();
