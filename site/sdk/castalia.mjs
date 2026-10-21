import {requireThat,isoNow} from './hash.mjs';
// Explicit projection into Castalia's closed publication contracts. Canonical
// IDs/revisions are allocated by the caller, never invented as repository acts.
export function toCastaliaClaimSet(submission,{id,revision,publicationRevision,claimIdMap}) {
  requireThat(/^PCS-\d{4,}$/.test(id) && /^rev-claim-set-[a-z0-9-]+$/.test(revision) && /^rev-publication-[a-z0-9-]+$/.test(publicationRevision),'Supply valid Castalia claim-set and publication identities.');
  const mapped=new Set(submission.proposal?.mappings.map(m=>m.sourceClaimId)??[]),reviewed=new Set(submission.review?.sourceClaimIds??[]),seen=new Set();
  function publicId(sourceId) {
    const value=claimIdMap?.[sourceId];requireThat(/^CLM-\d{4,}$/.test(value),'Every source claim requires an explicitly allocated Castalia CLM ID.');return value;
  }
  return {schemaVersion:'castalia.publication-claim-set.v1',id,revision,publicationRevision,
    extractionStatus:submission.review?'reviewed_partial':'candidate_partial',coverageNote:submission.extraction.coverageNote,
    claims:submission.extraction.claims.map(c=>{
      const id=publicId(c.id);requireThat(!seen.has(id),'Castalia claim IDs must be unique.');seen.add(id);
      return {id,statement:c.statement,kind:c.kind,epistemicGrade:c.epistemicGrade,
        sourceLocator:{pages:String(c.locator.page),section:`Extracted text offsets ${c.locator.start}–${c.locator.end}; page text SHA-256 ${c.locator.textHash}`},
        reviewState:reviewed.has(c.id)?'confirmed':'candidate',formalizationStatus:mapped.has(c.id)?'drafted':'unformalized',dependencies:c.dependencies.map(publicId)};
    }),createdAt:isoNow()};
}
export function toCastaliaAnalysis(receipt,{id,targetId,snapshotId}) {
  requireThat(/^PAS-\d{4,}$/.test(id) && /^FMT-\d{4,}$/.test(targetId) && /^PMS-[A-Z0-9-]+$/.test(snapshotId),'Supply valid Castalia analysis, target and snapshot IDs.');
  const a=receipt.analysis,complete=a.complete && a.stopReason==='completed';
  const status=complete?(a.status==='consistent'?'exhausted':'counterexample_found'):['error','solver_error','invalid_input'].includes(a.stopReason)?'error':'unsupported';
  return {schemaVersion:'castalia.paper-analysis-semantic.v1',id,targetId,snapshotId,
    engine:'wmt-core + z3-solver',engineRevision:a.runtime?.engineRevision??'no-completed-engine-result',
    limits:Object.entries(receipt.budgets).map(([k,v])=>`${k}=${v}`),status,
    stopReason:`${a.stopReason}: ${a.message??a.status}; bucket=${receipt.before.id}@${receipt.before.version}; input=${receipt.inputDigest}`,
    conclusionBoundary:receipt.boundary,createdAt:receipt.createdAt};
}
export function exportSidecar(submission,{bucketReceipts=[],buckets=[]}={}) {
  const related=bucketReceipts.filter(r=>r.submissionId===submission.id),receiptIds=new Set(related.map(r=>r.id));
  const wanted=new Set(related.flatMap(r=>[r.before.digest,r.after.digest]));
  for(const bucket of buckets)if(receiptIds.has(bucket.provenance?.receiptId))wanted.add(bucket.digest);
  let changed=true;
  while(changed){changed=false;for(const bucket of buckets)if(wanted.has(bucket.digest) && bucket.parent && !wanted.has(bucket.parent.digest)){wanted.add(bucket.parent.digest);changed=true;}}
  return {format:'wmt.paper-sidecar/1',delivery:'local_not_published',submission,bucketReceipts:related,buckets:buckets.filter(b=>wanted.has(b.digest)),
    boundary:'SDK interchange for a Castalia RFC/journal host. Not repository acceptance, a signed WMT release, a Lean receipt, or evidence that extraction is complete.'};
}
