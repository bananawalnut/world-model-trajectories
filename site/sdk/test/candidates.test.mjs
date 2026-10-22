import {syntheticPdf} from '../../papers/synthetic-review.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {extractProofCandidates,buildCandidateReview,validateCandidateReview,updateCandidateFeedback,normalityInterpretations,candidateGroups,extractClaims,formalizeClaims,reviewProposal,createSubmission,toCastaliaClaimSet,sha256,clone} from '../node.mjs';
import {client} from './helpers.mjs';
async function documentOf(pages){return {format:'wmt.pdf-document/1',sha256:await sha256(new TextEncoder().encode(pages.join('\f'))),pages:await Promise.all(pages.map(async(text,i)=>({page:i+1,text,textHash:await sha256(new TextEncoder().encode(text))}))),pageCount:pages.length};}
async function bundle(pages){const document=await documentOf(pages),extraction=await extractProofCandidates(document),review=await buildCandidateReview(document,extraction);return {document,extraction,review};}
test('structured selection retains wrapped claims, full labeled results and exact source spans',async()=>{
 const b=await bundle(['All penguins\nare birds.\nAxiom 1. Every penguin flies.\nLemma 2. Let x be a real. Then x = x.\nCorollary 3. The result holds.\nTheorem 4. All birds are fliers.']);
 assert(b.extraction.claims.some(c=>c.statement==='All penguins\nare birds.'));
 for(const role of ['axiom','lemma','corollary','theorem'])assert(b.review.entries.some(e=>e.classification.role===role),role);
 const child=b.review.entries.find(e=>e.scope.parentCandidateId);assert(child);assert.equal(child.scope.type,'local');assert.match(child.scope.label,/Lemma 2/);
 assert.equal(b.extraction.extractionStatus,'candidate_partial');
 for(const c of b.extraction.claims)assert.equal(b.document.pages[c.locator.page-1].text.slice(c.locator.start,c.locator.end),c.statement);
 assert.deepEqual((await extractProofCandidates(b.document)).claims,b.extraction.claims);const reversed={...b.extraction,claims:[...b.extraction.claims].reverse()},r=await buildCandidateReview(b.document,reversed);assert.deepEqual(r.entries.map(e=>e.candidateId),b.review.entries.map(e=>e.candidateId));
});
test('normality is retained as an ambiguous statement, never silently weakened or made universal',async()=>{
 const b=await bundle(['Birds are normally fliers.']);assert.equal(b.extraction.claims.length,1);
 const e=b.review.entries[0];assert.equal(e.classification.role,'statement');assert(e.ambiguities.some(a=>a.code==='normality'));assert.equal(e.feedback.interpretationId,null);
 assert.deepEqual(e.interpretations.map(i=>i.id),['default','existential','statistical','normal-context']);
 const p=await formalizeClaims(b.extraction);assert.equal(p.ir.claims.length,0);assert.equal(p.unsupported.length,1);
 const r=await updateCandidateFeedback(b.review,e.candidateId,{role:'axiom',interpretationId:'existential',disposition:'needs_change',note:'Possible personal axiom; confirm domain.'});
 assert.equal(r.entries[0].feedback.role,'axiom');assert.equal(b.review.entries[0].feedback.role,null);await validateCandidateReview(r,b.document,b.extraction);
 assert.equal(normalityInterpretations('More generally, a quarter of items qualify.').length,0);assert.equal(p.ir.claims.length,0);assert.match(normalityInterpretations('Birds normally fly.')[2].requires.join(','),/measure/);
});
test('definitions index includes late declarations without making them global; bound variables stay expression-bound',async()=>{
 const b=await bundle([String.raw`Theorem 1. A result holds.
$Choose_k(x)$ $\coloneqq$ a selection relation indexed by k.
\forall k \in \mathcal{D} \text{ there exists } \operatorname{measure}_k : \mathcal{R} \to \{-1,0,1\}
Then ( By A1 ):`,String.raw`Let n = 1.`]);
 const choice=b.review.entries.find(e=>e.declarations.some(d=>d.symbol==='Choose_k(x)'));assert(choice);assert.equal(choice.scope.type,'unresolved');assert(choice.scope.contextCandidateId);
 const bound=b.review.entries.flatMap(e=>e.declarations).find(d=>d.symbol==='k'&&d.kind==='bound in expression');assert(bound);assert.equal(bound.extent,'expression only');
 assert(b.review.entries.some(e=>e.relations.some(r=>r.label==='A1'&&r.targetCandidateId===null)&&e.ambiguities.some(a=>a.code==='unresolved-reference')));
 assert(candidateGroups(b.review).find(g=>g.id==='definitions').entries.includes(choice));
 const paper=candidateGroups(b.review,{order:'paper'})[0].entries;assert.deepEqual(paper.map(e=>e.sourceOrder),[...paper.map(e=>e.sourceOrder)].sort((a,b)=>a-b));
});
test('feedback is bounded, checked against exact extraction and cannot rewrite source annotations',async()=>{
 const a=await bundle(['Definition 1. Let x be a real.']),b=await bundle(['Definition 1. Let x be an integer.']);
 await assert.rejects(()=>validateCandidateReview(a.review,b.document,b.extraction),/another extraction/);
 const id=a.review.entries[0].candidateId;
 await assert.rejects(()=>updateCandidateFeedback(a.review,id,{role:'made_up'}),/Invalid candidate role/);
 await assert.rejects(()=>updateCandidateFeedback(a.review,id,{note:'x'.repeat(4001)}),/limit/);
 await assert.rejects(()=>updateCandidateFeedback(a.review,id,{interpretationId:'existential'}),/Invalid interpretation/);
 const changed=clone(a.review);changed.entries[0].classification.role='axiom';await assert.rejects(()=>validateCandidateReview(changed,a.document,a.extraction),/annotations/);
 const r=await updateCandidateFeedback(a.review,id,{scopeType:'local',scopeLabel:'Only within the proof',note:'Check this scope.'});assert.equal(r.revision,1);await validateCandidateReview(JSON.parse(JSON.stringify(r)),a.document,a.extraction);
});
test('legacy extraction IDs and strict proof review remain unchanged; richer roles project to pinned Castalia kinds',async()=>{
 const d=await documentOf(['Tweety is a bird.']);const a=await extractClaims(d),b=await extractClaims(d);assert.deepEqual(a,b);assert.equal(a.policy,'wmt.pdf-text-sentences/1');
 const extraction=await extractProofCandidates(await documentOf(['Lemma 1. Tweety is a bird.\nCorollary 2. Tweety is a bird.']));
 assert(extraction.claims.every(c=>c.kind==='theorem'));
 const submission={extraction,proposal:null,review:null},ids=Object.fromEntries(extraction.claims.map((c,i)=>[c.id,'CLM-'+String(i+1).padStart(4,'0')]));
 const projected=toCastaliaClaimSet(submission,{id:'PCS-0001',revision:'rev-claim-set-review',publicationRevision:'rev-publication-review',claimIdMap:ids});
 const schema=JSON.parse(await readFile(new URL('./castalia/publication-claim-set.schema.json',import.meta.url))),ajv=new Ajv2020({strict:false});addFormats(ajv);const validate=ajv.compile(schema);assert(validate(projected),JSON.stringify(validate.errors));
});
test('synthetic PDF keeps theorem/corollary labels, indexed declarations and exact span hashes',async()=>{
 const bytes=syntheticPdf();
 const p=await createSubmission({bytes,fileName:'synthetic-review.pdf',title:'Local extraction review test',authors:['Test actor']},client);
 const ex=await extractProofCandidates(p.document),r=await buildCandidateReview(p.document,ex);
 assert.equal(r.entries.filter(e=>e.classification.role==='corollary').length,3);assert(r.entries.some(e=>e.classification.label==='Theorem 1'));
 for(const symbol of ['score_k','\\operatorname{measure}_k','\\mathcal{D}','\\mathcal{R}','Choose_k(x)'])assert(r.entries.some(e=>e.declarations.some(d=>d.symbol===symbol)),symbol);
 assert(r.entries.some(e=>e.ambiguities.some(a=>a.code==='normality')));
 const proposal=await formalizeClaims(ex);assert.equal(proposal.ir.claims.length,0);await validateCandidateReview(r,p.document,ex);
});
