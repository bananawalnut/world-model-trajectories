// Run after updating the core or npm dependencies. No compiler rebuild needed.
import {readFile,writeFile,mkdir,copyFile,cp,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),sdk=new URL('site/sdk/',root),runtime=new URL('runtime/',sdk),pdf=new URL('site/vendor/pdfjs/',root);
await mkdir(runtime,{recursive:true});await mkdir(pdf,{recursive:true});
const sha=async url=>createHash('sha256').update(await readFile(url)).digest('hex');
const files={};
for(const name of ['wmt_core.js','wmt_core_bg.wasm','wmt_core.d.ts']) {
  await copyFile(new URL('site/pkg/'+name,root),new URL(name,runtime));files[name]=await sha(new URL(name,runtime));
}
for(const name of ['pdf.mjs','pdf.worker.mjs'])await copyFile(new URL('node_modules/pdfjs-dist/legacy/build/'+name,sdk),new URL(name,pdf));
await copyFile(new URL('node_modules/pdfjs-dist/LICENSE',sdk),new URL('LICENSE',pdf));
await cp(new URL('node_modules/pdfjs-dist/standard_fonts/',sdk),new URL('standard_fonts/',pdf),{recursive:true});
const version=JSON.parse(await readFile(new URL('node_modules/pdfjs-dist/package.json',sdk))).version;
const adaptersSha256={};
for(const name of (await readdir(sdk)).filter(name=>name.endsWith('.mjs')).sort())adaptersSha256[name]=await sha(new URL(name,sdk));
const standardFontsSha256={};
for(const name of (await readdir(new URL('standard_fonts/',pdf))).sort())standardFontsSha256[name]=await sha(new URL('standard_fonts/'+name,pdf));
const sdkVersion=JSON.parse(await readFile(new URL('package.json',sdk))).version;
const manifest={format:'wmt.sdk-runtime/1',sdkVersion,engine:'wmt-core',engineRevision:'sha256:'+files['wmt_core_bg.wasm'],
  solver:'z3-solver/4.16.0',solverWasmSha256:await sha(new URL('site/vendor/z3/z3-built.wasm',root)),logicProfile:'wmt.strict-many-sorted-fol/1',files,adaptersSha256,
  browserAdapterSha256:await sha(new URL('site/papers/worker.js',root)),
  pdfjs:{version,moduleSha256:await sha(new URL('pdf.mjs',pdf)),workerSha256:await sha(new URL('pdf.worker.mjs',pdf)),standardFontsSha256}};
await writeFile(new URL('manifest.json',runtime),JSON.stringify(manifest,null,2)+'\n');
console.log('Synchronized SDK core and PDF.js '+version+'.');
