/* Classic worker: compile and execute OCaml away from the UI thread. */
let ready;
async function initialize(runtime) {
  importScripts(runtime === 'wasm' ? './ocaml-wasm.js' : './ocaml-runtime.js');
  const started = Date.now();
  while (!self.wmtOCaml) {
    if (Date.now() - started > 15000) throw new Error('OCaml runtime did not initialize');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const source = await fetch('./quantity.ml').then(r => {
    if (!r.ok) throw new Error('The extracted quantity module is unavailable');
    return r.text();
  });
  const loaded = self.wmtOCaml.evaluate(source + '\n;;\n');
  if (!loaded.ok) throw new Error(loaded.errors || 'Could not load extracted OCaml');
}
const quoted = s => JSON.stringify(String(s));
const z = s => `(Z.of_string ${quoted(s)})`;
const pair = ([n, d]) => `(${z(n)}, ${z(d)})`;
self.onmessage = async ({ data }) => {
  try {
    await (ready ||= initialize(data.runtime));
    const { id, material, volume, density, claimed, source } = data;
    if (!Number.isInteger(material) || material < 0 || material > 2)
      throw new Error('Unknown material');
    for (const p of [volume, density, claimed]) {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(x => /^-?\d+$/.test(x)))
        throw new Error('Invalid fraction');
      if (BigInt(p[1]) <= 0n) throw new Error('Fraction denominator must be positive');
    }
    // Compute the reference before loading user bindings. A user module may
    // reuse or shadow names, but cannot thereby change the baseline result.
    const prelude = `
let () =
  let show tag result matches = match result with
    | None -> print_endline (tag ^ ":unsupported")
    | Some (n, d) ->
      if Z.sign d <= 0 then failwith "Kernel returned a nonpositive denominator";
      print_endline (tag ^ ":" ^ Z.to_string n ^ ":" ^ Z.to_string d ^ ":" ^ string_of_bool (matches (n,d)))
  in
  let v = ${pair(volume)} and claim = ${pair(claimed)} in
  let density = ${pair(density)} in
  (match Wmt_Quantity.browser_density ${z(material)} with
   | Some (n,d) when Z.equal (Z.mul n (snd density)) (Z.mul (fst density) d) -> ()
   | _ -> failwith "The input density does not match the pinned reference table");
  let reference = Wmt_Quantity.browser_mass ${z(material)} (fst v) (snd v) in
  show "REFERENCE" reference (fun (n,d) -> Z.equal (Z.mul n (snd claim)) (Z.mul (fst claim) d))
;;`;
    const baseline = self.wmtOCaml.evaluate(prelude);
    if (!baseline.ok) throw new Error(baseline.errors || 'Reference computation failed');
    const program = `${source}\n;;\n
let () = match user_mass ${pair(volume)} ${pair(density)} with
  | None -> print_endline "USER:unsupported"
  | Some (n,d) ->
    if Z.sign d <= 0 then failwith "Kernel returned a nonpositive denominator";
    print_endline ("USER:" ^ Z.to_string n ^ ":" ^ Z.to_string d ^ ":" ^ string_of_bool (user_equals (n,d) ${pair(claimed)}))
;;`;
    const answer = self.wmtOCaml.evaluate(program);
    if (!answer.ok) throw new Error(answer.errors || 'OCaml execution failed');
    const results = {};
    for (const line of (baseline.output + '\n' + answer.output).trim().split('\n')) {
      const [kind, n, d, matches] = line.trim().split(':');
      if (!['REFERENCE', 'USER'].includes(kind)) continue;
      if (n === 'unsupported') results[kind.toLowerCase()] = { status: 'unsupported' };
      else if (/^-?\d+$/.test(n) && /^\d+$/.test(d) && ['true', 'false'].includes(matches))
        results[kind.toLowerCase()] = { status: 'answered', value: [n,d], matches: matches === 'true' };
    }
    if (!results.reference || !results.user) throw new Error('Incomplete OCaml reply');
    self.postMessage({ id, ok: true, ...results });
  } catch (error) {
    self.postMessage({ id: data.id, ok: false, error: String(error.message || error) });
  }
};
