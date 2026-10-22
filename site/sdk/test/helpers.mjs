import {readFile} from 'node:fs/promises';
import {createNodeClient,createSubmission,formalizeSubmission,reviewSubmission} from '../node.mjs';
export const client=createNodeClient();
export const demoBytes=()=>readFile(new URL('../../papers/demo.pdf',import.meta.url));
export async function demoPaper({review=true}={}) {
  let paper=await createSubmission({bytes:await demoBytes(),fileName:'demo.pdf',title:'SDK demo',authors:['Test author']},client);
  paper=await formalizeSubmission(paper);
  if(review)paper=await reviewSubmission(paper,{actorId:'person:test',sourceClaimIds:paper.proposal.mappings.map(m=>m.sourceClaimId)});
  return paper;
}
export function blankPdf() {
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const start=Buffer.byteLength(pdf);pdf+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('');
  pdf+=`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return new TextEncoder().encode(pdf);
}
