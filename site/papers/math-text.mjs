import katex from '../vendor/katex/katex.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Render a presentation copy only. Stored statements, hashes and PDF offsets stay exact.
for(const relative of ['../vendor/katex/katex.min.css','./math-text.css']) {
  const href=new URL(relative,import.meta.url).href;
  if(!document.querySelector(`link[href="${href}"]`)) {
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);
  }
}
function math(tex,displayMode=false) {
  try {
    return `<span class="math-fragment${displayMode?' math-display':''}">${katex.renderToString(tex,{displayMode,throwOnError:true,trust:false,strict:'ignore',maxExpand:1000,output:'htmlAndMathml'})}</span>`;
  } catch {
    return escape(tex); // Keep unsupported/malformed source visible without breaking the card.
  }
}
export function renderMathText(value) {
  const text=String(value??'');
  // Some PDF spans are standalone formula bodies whose Markdown fences were omitted.
  if(/^\s*\\[A-Za-z]+/.test(text)&&!/(?<!\\)\$/.test(text))return math(text.trim());
  const pattern=/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$([^$]+?)(?<!\\)\$/g;
  let out='',last=0;
  for(const match of text.matchAll(pattern)) {
    out+=escape(text.slice(last,match.index));
    out+=math(match[1]??match[2]??match[3]??match[4],match[1]!==undefined||match[2]!==undefined);
    last=match.index+match[0].length;
  }
  return out+escape(text.slice(last));
}
