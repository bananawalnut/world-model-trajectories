import {primitiveDraft,predicateDefinitionDraft,assumePrimitive,draftMath,emptyDrafts,validateDrafts,draftStorageKey} from './formal-drafts.mjs';
import {validateIR} from '../sdk/ir.mjs';
import {clone} from '../sdk/hash.mjs';
import {renderMathText} from './math-text.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createFormalDraftStore(review,extraction,onChange=()=>{}){
 let bundle=emptyDrafts(review),notice='';const pending=new Map(),listeners=new Set();
 try{const raw=localStorage.getItem(draftStorageKey(bundle));if(raw)bundle=validateDrafts(JSON.parse(raw),review,extraction);}catch{notice='Saved formal drafts could not be loaded. Export a copy after editing.';}
 function persist(){try{localStorage.setItem(draftStorageKey(bundle),JSON.stringify(bundle));notice='Saved locally. Draft only; proof inputs and buckets are unchanged.';}catch{notice='Saved in memory. Browser storage unavailable; export a copy.';}onChange(clone(bundle));}
 return {pending,listeners,get notice(){return notice;},get bundle(){return clone(bundle);},get(id){return bundle.drafts.find(d=>d.candidateId===id);},
  save(candidate,ir){validateIR(ir);const next=clone(bundle);next.drafts=next.drafts.filter(d=>d.candidateId!==candidate.id);next.drafts.push({candidateId:candidate.id,source:candidate.statement,ir:clone(ir)});validateDrafts(next,review,extraction);bundle=next;pending.set(candidate.id,JSON.stringify(ir,null,2));persist();for(const notify of listeners)notify(candidate.id);},
  import(next){validateDrafts(next,review,extraction);bundle=clone(next);pending.clear();persist();for(const notify of listeners)notify();}
 };
}
export function mountFormalEditor(root,{candidate,definition=false,label,store}){
 if(!root)return;
 const id=candidate.id,initial=store.get(id)?.ir??primitiveDraft(candidate,{definition,label});
 let code=store.pending.get(id)??JSON.stringify(initial,null,2);
 root.innerHTML=`<details class="formal-editor" ${definition?'open':''}><summary>Mathematical form &amp; editable formal code</summary><p class="small">${store.get(id)?'Saved review draft.':'New review draft: an editable primitive placeholder, not a translation of the passage’s internal structure.'} Names here belong to this paper.</p><div class="formal-math" data-draft-math></div><p class="small" data-draft-meaning></p><label>Formal code · WMT typed IR (JSON)<textarea data-formal-code spellcheck="false" rows="12" aria-label="Formal code for this source passage">${esc(code)}</textarea></label><div class="candidate-actions"><button class="btn ghost sm" data-save-formal>Validate &amp; save draft</button><button class="btn ghost sm" data-primitive-formal>Use a paper-local primitive</button>${definition?'<button class="btn ghost sm" data-predicate-formal>Draft a predicate definition</button>':''}${!definition?'<button class="btn ghost sm" data-assume-formal>Propose primitive as an assumption</button>':''}</div><p class="small" data-formal-status role="status"></p><details class="formal-context"><summary>Modeling choices</summary><p class="small">The primitive keeps this passage’s meaning opaque. No dictionary, embedding, equality rule or hidden ontology is added. A predicate definition is a proposed interpretation for you to inspect. Type validation checks the code’s structure; it does not verify that the interpretation matches the paper or prove any claim.</p></details></details>`;
 const input=root.querySelector('[data-formal-code]'),status=root.querySelector('[data-formal-status]');
 function preview(){
  store.pending.set(id,input.value);
  try{if(input.value.length>500000)throw new Error('Code exceeds the editor byte budget.');const ir=validateIR(JSON.parse(input.value));root.querySelector('[data-draft-math]').innerHTML=draftMath(ir).map(t=>`<div>${renderMathText('$$'+t+'$$')}</div>`).join('')||'<p class="small">Empty IR.</p>';root.querySelector('[data-draft-meaning]').textContent=ir.claims.length?`${ir.claims.length} proposed formula(s). These are review drafts, not checked conclusions.`:'Declarations only. No proposition is asserted and no inference about the wording follows.';status.textContent='Valid typed IR · unsaved preview.';return ir;}catch(e){root.querySelector('[data-draft-math]').textContent='Mathematical preview unavailable until the code is valid.';root.querySelector('[data-draft-meaning]').textContent='';status.textContent='Not saved: '+e.message;return null;}
 }
 function replace(ir){input.value=JSON.stringify(ir,null,2);preview();}
 input.oninput=preview;
 root.querySelector('[data-save-formal]').onclick=()=>{const ir=preview();if(ir){try{store.save(candidate,ir);status.textContent=store.notice;}catch(e){status.textContent='Not saved: '+e.message;}}};
 root.querySelector('[data-primitive-formal]').onclick=()=>replace(primitiveDraft(candidate,{definition,label}));
 root.querySelector('[data-predicate-formal]')?.addEventListener('click',()=>{replace(predicateDefinitionDraft(candidate,{predicate:label?primitiveDraft(candidate,{label}).preds[0].name:'Accepted',primitive:'MeetsCriterion'}));status.textContent='Template only: Entity is a new sort and MeetsCriterion is primitive. Edit the names and formula to match the source, then save explicitly.';});
 root.querySelector('[data-assume-formal]')?.addEventListener('click',()=>{try{const ir=preview();if(ir)replace(assumePrimitive(ir,candidate));}catch(e){status.textContent=e.message;}});
 // Drop detached listeners when the paginated candidate view is rebuilt.
 for(const notify of store.listeners)if(!notify.root.isConnected)store.listeners.delete(notify);
 const notify=changed=>{if(changed&&changed!==id)return;input.value=store.pending.get(id)??JSON.stringify(store.get(id)?.ir??initial,null,2);preview();status.textContent=store.notice;};notify.root=root;store.listeners.add(notify);
 preview();if(store.get(id))status.textContent='Loaded saved review draft.';else if(store.notice)status.textContent=store.notice;
}
