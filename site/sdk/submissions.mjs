import {requireThat,clone,digest,text,isoNow,sha256,canonical} from './hash.mjs';
import {extractClaims} from './pdf.mjs';
import {encodeBase64,decodeBase64,formalizeClaims,makeProposal,reviewProposal} from './claims.mjs';
import {checkProof,validateProof} from './proofs.mjs';
export async function createSubmission({bytes,fileName='paper.pdf',title,authors,rfcRef=null,publicationRef=null,proofs=[]},client,options={}) {
  requireThat(Array.isArray(authors) && authors.length>0 && authors.length<=30,'At least one author is required.');authors.forEach(a=>text(a,'Author name',200));
  for(const [label,value] of Object.entries({rfcRef,publicationRef}))if(value!==null)text(value,label,500);
  requireThat(Array.isArray(proofs) && proofs.length<=16,'Limit a submission to 16 proof artifacts.');
  requireThat(canonical(proofs).length<=18000000,'Submission proof artifacts exceed the byte budget.','resource_limit');
  const source=new Uint8Array(bytes),document=await client.extract(source,fileName,options);
  requireThat(document.format==='wmt.pdf-document/1',document.message??'PDF extraction failed.',document.stopReason??'extraction_error');
  requireThat(document.sha256===await sha256(source),'Extraction source checksum mismatch.','binding_mismatch');
  const extraction=await extractClaims(document,options.claimExtractor?{policy:options.claimExtractor.id,selectCandidates:options.claimExtractor.select}:{});
  for(const proof of proofs)await validateProof(proof);
  const metadata={title:text(title,'Paper title',500),authors:clone(authors),rfcRef,publicationRef,documentHash:document.sha256};
  return {format:'wmt.paper-submission/1',id:'paper_'+await digest('submission',metadata),...metadata,document,extraction,
    source:{fileName,mediaType:'application/pdf',sha256:document.sha256,base64:encodeBase64(source)},
    proposal:null,review:null,proofs:clone(proofs),proofReceipts:[],createdAt:isoNow()};
}
export async function formalizeSubmission(submission,options={}) {
  const proposal=options.ir?await makeProposal(submission.extraction,options):await formalizeClaims(submission.extraction,options);
  return {...clone(submission),proposal,review:null,proofReceipts:[]};
}
export async function reviewSubmission(submission,options) {
  requireThat(submission.proposal,'Formalize the candidate claims first.');
  const review=await reviewProposal(submission.proposal,submission.extraction,options);
  return {...clone(submission),review,proofReceipts:[]};
}
export async function verifySubmissionProofs(submission,client,options={}) {
  requireThat(Array.isArray(submission.proofs) && submission.proofs.length<=16 && canonical(submission.proofs).length<=18000000,'Proof artifacts exceed the submission budget.','resource_limit');
  const receipts=[];
  for(const proof of submission.proofs)receipts.push(await checkProof(proof,submission,client,options));
  return {...clone(submission),proofReceipts:receipts};
}
export async function restoreSubmission(saved,client,options={}) {
  requireThat(saved?.format==='wmt.paper-submission/1' && saved.source?.mediaType==='application/pdf','Expected a saved paper submission.');
  let fresh=await createSubmission({bytes:decodeBase64(saved.source.base64),fileName:saved.source.fileName,title:saved.title,
    authors:saved.authors,rfcRef:saved.rfcRef,publicationRef:saved.publicationRef,proofs:saved.proofs},client,options);
  requireThat(fresh.id===saved.id && fresh.document.sha256===saved.source.sha256,'Saved paper source/metadata checksum mismatch.');
  if(saved.proposal)fresh=await formalizeSubmission(fresh,saved.proposal);
  return fresh; // Re-extracted, with no current review or proof-check verdict.
}
