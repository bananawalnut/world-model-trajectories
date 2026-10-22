import test from 'node:test';import assert from 'node:assert/strict';import {syntheticReview} from '../../papers/synthetic-review.mjs';
import {buildDefinitionReview,validateDefinitionReview,definitionConcepts,mergeDefinitionConcepts,separateDefinitionOccurrences,moveDefinitionOccurrence,updateDefinitionConcept,extractProofCandidates,sha256,digest,clone} from '../index.mjs';
async function paper(){const {document,extraction,review}=await syntheticReview();return {document,extraction,candidateReview:review,data:{ir:{sorts:[],preds:[],funcs:[],claims:[]}}};}
async function fixture(text){const document={format:'wmt.pdf-document/1',sha256:await sha256(new TextEncoder().encode(text)),pages:[{page:1,text,textHash:await sha256(new TextEncoder().encode(text))}],pageCount:1};const extraction=await extractProofCandidates(document);return {document,extraction,review:await buildDefinitionReview(document,extraction)};}
test('Synthetic source has one Accepted concept with introduction/body provenance and one Choose with two distinct parameterized forms',async()=>{
 const {document,extraction}=await paper(),r=await buildDefinitionReview(document,extraction),concepts=definitionConcepts(r),accepted=concepts.filter(c=>c.label==='Accepted'),choose=concepts.filter(c=>c.label==='Choose');assert.equal(accepted.length,1);assert.equal(accepted[0].declarations.length,1);assert.equal(accepted[0].introductions.length,1);assert(accepted[0].introductions[0].sourceOrder<accepted[0].declarations[0].sourceOrder);assert.equal(choose.length,1);assert.equal(choose[0].declarations.length,2);
 const fn=choose[0].forms.find(f=>f.notation==='Choose(S)'),predicate=choose[0].forms.find(f=>f.notation==='Choose_k(x)');assert(fn&&predicate);assert.deepEqual(fn.arguments,['S']);assert.deepEqual(predicate.arguments,['x']);assert.equal(predicate.index,'k');assert.equal(predicate.declaredBy.length,1);assert.equal(predicate.usedIn.length,0,'A declaration LHS is not a separately asserted application.');assert.equal(choose[0].primaryDefinitionId,null,'Distinct defining forms are not silently equated.');assert(choose[0].uses.length>0);
 for(const o of r.occurrences){const page=document.pages.find(p=>p.page===o.locator.page);assert.equal(page.text.slice(o.locator.start,o.locator.end),o.locator.quote);}await validateDefinitionReview(r,document,extraction);
});
test('statement applications link to their head definition and preserve arguments separately from concept identity',async()=>{
 const b=await fixture(String.raw`Let f : V -> V.
f(x) := x.
Statement 1. Then f(a) = a.
Definition 2. \operatorname{measure}_k : \mathcal{V} \to R.
Statement 3. \operatorname{measure}_k(Choose) = 1.`),concepts=definitionConcepts(b.review),f=concepts.find(c=>c.label==='f'),measure=concepts.find(c=>c.label==='measure');assert(f);assert(f.uses.some(o=>o.kind==='application'&&o.form.arguments.includes('a')));assert(measure);assert(measure.uses.some(o=>o.kind==='application'&&o.form.arguments.includes('Choose')));
});
test('local declarations with the same spelling stay separate and expression-bound variables are not global definitions',async()=>{
 const b=await fixture(String.raw`Lemma 1. Let X be a real. Then X = X.
Lemma 2. Let X be an integer. Then X = X.
Statement 3. \forall z \in Z, z = z.`),xs=definitionConcepts(b.review).filter(c=>c.label==='X');assert.equal(xs.length,2);assert(xs.every(c=>c.declarations.every(o=>o.scope.type==='local')));assert.notEqual(xs[0].declarations[0].scope.parentCandidateId,xs[1].declarations[0].scope.parentCandidateId);assert(!definitionConcepts(b.review).some(c=>c.label==='z'));
});
test('split/merge/primary-definition edits preserve every occurrence, source annotation and original candidate review',async()=>{
 const {document,extraction,candidateReview,data}=await paper(),before=JSON.stringify({document,extraction,candidateReview,ir:data.ir}),r=await buildDefinitionReview(document,extraction),accepted=definitionConcepts(r).find(c=>c.label==='Accepted');
 const split=await separateDefinitionOccurrences(r,{conceptId:accepted.id,occurrenceIds:[accepted.introductions[0].id],label:'accepted'}),isolated=split.concepts.find(c=>!r.concepts.some(x=>x.id===c.id));assert(isolated);const merged=await mergeDefinitionConcepts(split,{conceptIds:[accepted.id,isolated.id],label:'Accepted'});assert.equal(merged.concepts.length,r.concepts.length);assert.deepEqual(merged.occurrences,r.occurrences);assert.equal(merged.revision,2);
 const selected=await updateDefinitionConcept(merged,accepted.id,{primaryDefinitionId:accepted.declarations[0].id});await validateDefinitionReview(JSON.parse(JSON.stringify(selected)),document,extraction);assert.equal(JSON.stringify({document,extraction,candidateReview,ir:data.ir}),before);
 await assert.rejects(()=>mergeDefinitionConcepts(r,{conceptIds:[accepted.id,accepted.id]}),/different concepts/);
});
test('use/definition corrections and rebindings are explicit feedback with source/extraction validation',async()=>{
 const {document,extraction}=await paper(),r=await buildDefinitionReview(document,extraction),choose=definitionConcepts(r).find(c=>c.label==='Choose'),o=choose.declarations.find(o=>o.form.index==='k');const changed=await moveDefinitionOccurrence(r,{occurrenceId:o.id,conceptId:choose.id,kind:'application'});assert.equal(definitionConcepts(changed).find(c=>c.id===choose.id).uses.some(u=>u.id===o.id),true);assert.deepEqual(changed.occurrences,r.occurrences);await validateDefinitionReview(changed,document,extraction);
 const forged=clone(r);forged.occurrences[0].locator.start++;delete forged.digest;forged.digest=await digest('definition-review',forged);await assert.rejects(()=>validateDefinitionReview(forged,document,extraction),/Source occurrences/);
 const wrong=clone(document);wrong.sha256='0'.repeat(64);await assert.rejects(()=>validateDefinitionReview(r,wrong,extraction),/matching source|source\/extraction/);
 const dup=clone(r);dup.concepts[1].occurrenceIds.push(dup.concepts[0].occurrenceIds[0]);delete dup.digest;dup.digest=await digest('definition-review',dup);await assert.rejects(()=>validateDefinitionReview(dup,document,extraction),/exactly one concept/);
});
