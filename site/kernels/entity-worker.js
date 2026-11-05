/* Fresh OCaml toplevel per run; same two browser backends as the mass lab. */
self.onmessage = async ({data}) => {
  try {
    importScripts(data.runtime === 'js' ? './ocaml-runtime.js' : './ocaml-wasm.js');
    const started = Date.now();
    while (!self.wmtOCaml) {
      if (Date.now() - started > 15000) throw new Error('OCaml runtime did not initialize');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    function evaluate(source) {
      const answer = self.wmtOCaml.evaluate(source + '\n;;\n');
      if (!answer.ok) throw new Error(answer.errors || 'OCaml execution failed');
      return answer.output;
    }
    evaluate(data.prelude);
    evaluate(data.bindings);
    evaluate(data.source);
    const output = evaluate(`let () = Wmt_Entity.emit
      ((equals : Wmt_Entity.graph -> Wmt_Entity.entity -> Wmt_Entity.entity -> Wmt_Entity.comparison)
        wmt_graph wmt_left wmt_right);;`);
    const lines = output.trim().split('\n').filter(s => s.startsWith('WMT_ENTITY_RESULT:'));
    if (lines.length !== 1) throw new Error('Incomplete or ambiguous OCaml reply');
    const result = JSON.parse(lines[0].slice('WMT_ENTITY_RESULT:'.length));
    if (!['match','no-match','unknown'].includes(result.status) ||
        !(result.score === null || (typeof result.score === 'number' && Number.isFinite(result.score))) ||
        !(result.reason === null || typeof result.reason === 'string')) throw new Error('Invalid comparison result');
    self.postMessage({ok:true, result});
  } catch (error) { self.postMessage({ok:false, error:String(error.message || error)}); }
};
