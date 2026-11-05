import {sha256,extractProofCandidates,buildCandidateReview,createSubmission,PROOF_CANDIDATE_POLICY,selectProofSpans} from '../sdk/index.mjs';

// Authored solely as a public software fixture. This is not a submitted paper,
// a quotation from a private document, or a claim that these results are proved.
export const SYNTHETIC_PAGES=[String.raw`Synthetic definition review example.
lets define accepted as such:
\text{Accepted} \eqqcolon \text{satisfies the selected criterion}.
Statement 1. Accepted(alpha).
Lemma 1. Let z be a real. Then z = z.
Corollary 1. Every selected item is listed.
Corollary 2. Listed items remain listed.`,String.raw`Theorem 1. A chosen item is a member of the set.
\mathcal{D} \coloneqq \{d \mid d \text{ is a datum}\}
\mathcal{R} \coloneqq \text{the set of ratings}
\forall k \in K \text{ there exists } score_k: \mathcal{D} \to \{-1,0,1\}
\forall k \in K \text{ there exists } \operatorname{measure}_k: \mathcal{D} \to \{-1,0,1\}
\operatorname{Choose}(S) \coloneqq \text{a designated member of S}.
$Choose_k(x)$ $\coloneqq$ a relation selected by index k.
Statement 2. \operatorname{Choose}(alpha) = alpha.
Statement 3. \operatorname{measure}_k(Choose) = 1.
Corollary 3. A listed item is listed.
Birds are normally fliers.`];
export function syntheticPdf(){
 const quote=s=>s.replace(/[\\()]/g,c=>'\\'+c),objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'],kids=[];
 for(const page of SYNTHETIC_PAGES){const id=objects.length+1,stream='BT /F1 8 Tf 35 750 Td 14 TL\n'+page.split('\n').map((line,i)=>(i?'T* ':'')+'('+quote(line)+') Tj').join('\n')+'\nET';kids.push(id);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id+1} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);}
 objects[1]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(id=>id+' 0 R').join(' ')}] >>`;
 let pdf='%PDF-1.4\n';const offsets=[];for(const [i,obj]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;}
 const start=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return new TextEncoder().encode(pdf);
}
export async function syntheticReview(){
 const bytes=syntheticPdf(),document={format:'wmt.pdf-document/1',fileName:'synthetic-review.pdf',sha256:await sha256(bytes),byteSize:bytes.length,pageCount:SYNTHETIC_PAGES.length,pages:await Promise.all(SYNTHETIC_PAGES.map(async(text,i)=>({page:i+1,text,textHash:await sha256(new TextEncoder().encode(text))}))),extraction:{engine:'synthetic-text-fixture/1',policy:PROOF_CANDIDATE_POLICY,status:'text_extracted',imageOnlyPages:[]}};
 const extraction=await extractProofCandidates(document),review=await buildCandidateReview(document,extraction);return {document,extraction,review};
}
export function createSyntheticSubmission(client){return createSubmission({bytes:syntheticPdf(),fileName:'synthetic-review.pdf',title:'Synthetic definition review',authors:['Public software fixture']},client,{claimExtractor:{id:PROOF_CANDIDATE_POLICY,select:selectProofSpans}});}
export function acceptedCandidate(extraction){return extraction.claims.find(c=>/\\text\{Accepted\}\s*\\eqqcolon/.test(c.statement));}
