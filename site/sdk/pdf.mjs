import {requireThat,sha256,digest,text} from './hash.mjs';
export const EXTRACTION_POLICY='wmt.pdf-text-sentences/1';
export async function extractPdf(input,{pdfjs,worker,standardFontDataUrl,fileName='paper.pdf',maxBytes=12000000,maxPages=200,maxText=1000000}={}) {
  const bytes=new Uint8Array(input);
  requireThat(bytes.byteLength>0 && bytes.byteLength<=maxBytes,'PDF exceeds the byte budget.','resource_limit');
  requireThat(new TextDecoder('ascii').decode(bytes.slice(0,8)).startsWith('%PDF-'),'Expected PDF bytes.');
  pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs');
  const sourceHash=await sha256(bytes);
  const task=pdfjs.getDocument({data:bytes.slice(),worker,standardFontDataUrl,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,
    useWorkerFetch:!!worker,disableAutoFetch:true,disableStream:true,maxImageSize:0});
  try {
    const pdf=await task.promise;
    requireThat(pdf.numPages<=maxPages,'PDF exceeds the page budget.','resource_limit');
    const pages=[];let total=0;
    for(let page=1;page<=pdf.numPages;page++) {
      const p=await pdf.getPage(page),content=await p.getTextContent();
      let value='';
      for(const item of content.items)if(typeof item.str==='string') {
        if(value && !/\s$/.test(value) && item.str && !/^\s/.test(item.str))value+=' ';
        value+=item.str;if(item.hasEOL)value+='\n';
      }
      value=value.trim();total+=value.length;
      requireThat(total<=maxText,'PDF exceeds the extracted-text budget.','resource_limit');
      pages.push({page,text:value,textHash:await sha256(new TextEncoder().encode(value))});p.cleanup();
    }
    return {format:'wmt.pdf-document/1',fileName:text(fileName,'PDF filename',200),sha256:sourceHash,
      byteSize:bytes.byteLength,pageCount:pdf.numPages,pages,
      extraction:{engine:`pdfjs-dist/${pdfjs.version}`,policy:EXTRACTION_POLICY,
        status:total?'text_extracted':'ocr_required',imageOnlyPages:pages.filter(p=>!p.text).map(p=>p.page)}};
  } finally {await task.destroy();}
}
export async function extractClaims(document,{maxCandidates=256,selectCandidates,policy=EXTRACTION_POLICY}={}) {
  requireThat(document?.format==='wmt.pdf-document/1','Expected an extracted PDF document.');
  requireThat(Number.isSafeInteger(maxCandidates) && maxCandidates>0 && maxCandidates<=256,'Invalid candidate budget.');
  text(policy,'Extraction policy ID',200);
  if(selectCandidates) {
    const spans=await selectCandidates(structuredClone(document));
    requireThat(Array.isArray(spans) && spans.length<=maxCandidates,'Extractor returned too many candidates.','resource_limit');
    const claims=[],seen=new Set();
    for(const span of spans) {
      const page=document.pages.find(p=>p.page===span.page);
      requireThat(page && Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) && span.start>=0 && span.end>span.start && span.end<=page.text.length && span.end-span.start<=4000,'Extractor must return exact in-page source spans.');
      const statement=page.text.slice(span.start,span.end),locator={page:page.page,start:span.start,end:span.end,quote:statement,textHash:page.textHash};
      const id='c_'+(await digest('source-claim',{pdf:document.sha256,locator,policy})).slice(0,24);
      requireThat(!seen.has(id),'Extractor returned a duplicate source span.');seen.add(id);
      const kind=span.kind??'model',epistemicGrade=span.epistemicGrade??'source_stated';
      requireThat(['definition','axiom','theorem','empirical','model','hypothesis','interpretive'].includes(kind) && ['source_stated','derived','measured','speculative'].includes(epistemicGrade),'Extractor returned unsupported claim metadata.');
      claims.push({id,statement,kind,epistemicGrade,locator,reviewState:'candidate',dependencies:[]});
    }
    return {format:'wmt.claim-extraction/1',documentHash:document.sha256,policy,extractionStatus:'candidate_partial',claims,skipped:0,
      coverageNote:`Source-span candidates selected by ${policy}; incomplete and unreviewed. No completeness or PDF interpretation guarantee.`};
  }
  const claims=[];let skipped=0;
  const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
  for(const page of document.pages) {
    // Text-layer order is retained, never presented as a layout reconstruction.
    let offset=0;
    for(const line of page.text.split('\n')) {
      for(const segment of segmenter.segment(line)) {
        const raw=segment.segment,statement=raw.trim(),start=offset+segment.index+raw.indexOf(statement);
        if(statement.length<12 || /\?$/.test(statement) || !/\b(is|are|was|were|has|have|must|can|cannot|implies|requires|assume|define|definition|theorem|claim|hypothesis|show|find|found|observed|measured)\b/i.test(statement))continue;
        if(statement.length>4000 || claims.length>=maxCandidates){skipped++;continue;}
        const locator={page:page.page,start,end:start+statement.length,quote:statement,textHash:page.textHash};
        const id='c_'+(await digest('source-claim',{pdf:document.sha256,locator,policy})).slice(0,24);
        const kind=/^definition\b/i.test(statement)?'definition':/^theorem\b/i.test(statement)?'theorem':/^axiom\b/i.test(statement)?'axiom':/\b(measured|observed|experiment)\b/i.test(statement)?'empirical':/\b(hypothes|conjectur)/i.test(statement)?'hypothesis':'model';
        claims.push({id,statement,kind,epistemicGrade:'source_stated',locator,reviewState:'candidate',dependencies:[]});
      }
      offset+=line.length+1;
    }
  }
  return {format:'wmt.claim-extraction/1',documentHash:document.sha256,policy,
    extractionStatus:'candidate_partial',claims,skipped,
    coverageNote:'Heuristic candidates from the PDF text layer. Not a complete claim census. Formulas, tables, reading order and image-only pages require review or an OCR/extraction adapter.'};
}
