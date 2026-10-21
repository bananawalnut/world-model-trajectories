# Replaceable browser kernels

This experiment connects one real veri7vn quantity operation to WMT's existing
Rust/Wasm claim engine and Z3. Open `site/kernel-lab.html` through the same static
server as the workbench. No Isabelle or OCaml installation is needed to use the
committed browser builds.

The reference is exported from veri7vn commit
`093b59af26ff1aecaada0f5e7bda998fb2f8b6d1`. It invokes the existing
`Quantity.kernel (MassOf material (Some (volume, U_litre)) U_kilogram)`.
The browser interface supports water, steel and petrol from its reference table.
The generated OCaml module is `site/kernels/quantity.ml`; it is not a hand-written
reimplementation of the formula.

## Try it

1. Start `python3 -m http.server 8799 --directory site` at the repository root.
2. Open `http://localhost:8799/kernel-lab.html`.
3. Run the initial water / 100 litres / 120 kilograms example. Both kernels
   compute 100 kg; Z3 finds a conflict under the selected comparison.
4. Change the claim to 100 kg. Run again: the position is coherent.
5. Edit `user_mass` to double its result, choose **My OCaml kernel**, and claim
   200 kg. The selected model accepts it while the reference still computes 100 kg.
6. Change `user_equals` independently, for example to express a tolerance.
   This changes the concrete comparison, not object identity or universal equality.
7. Save the two alternatives, reload, and restore them. Restoration re-executes
   the code and solver. Saved summaries are never treated as current checks.

The default backend is `wasm_of_ocaml` (WebAssembly GC). Add `?runtime=js` to run
the same source through `js_of_ocaml`. There is no performance claim between the
backends. Modern Wasm-GC support is required for the default; the JavaScript
backend provides a comparison and a fallback. The toplevel/compiler runtime is
an additional download; source is compiled locally in a worker, not on a server.

## Contract

The editable OCaml interface is:

```ocaml
user_mass : (Z.t * Z.t) -> (Z.t * Z.t) -> (Z.t * Z.t) option
user_equals : (Z.t * Z.t) -> (Z.t * Z.t) -> bool
```

Pairs are exact numerator/denominator fractions. Inputs are volume in litres
and reference density in kg/m³; output is mass in kg. Positive denominators are
required. `None` means unsupported. A malformed result, compile failure,
exception or 20-second worker timeout produces no accepted consequence.

The worker calculates the reference before loading user bindings, so shadowing
a module in user code cannot replace the recorded baseline. The requested
density is checked against the actual extracted `browser_density` result.

User code may reuse the extracted module. Its replacement result is still
labelled as a user implementation; a proof is never inferred from agreement.
The worker has normal browser-worker capabilities; this is a trusted-code
experiment, not a security boundary for hostile scripts.

## Connection to claims

Three input claims describe the volume, density assumption, and asserted mass
plus the expectation that it matches the selected model. A fourth claim records
the executed comparison **conditional on those exact three numeric values**.
Z3 then checks these four formulas with WMT's existing analysis driver.

This is a concrete, ground comparison. Arbitrary OCaml is not translated into
SMT, and its result is not asserted as a universally quantified definition.
Retracting an input premise releases the corresponding conclusion. Changing
inputs, selected kernel or code invalidates the visible verdict until a fresh run.

Each run records the input/schema, selected implementation, reference commit,
generated-source hash, user-source hash, both results, and current active claims.
The run hash and position hash distinguish the computation from the active
claim selection. Named alternatives persist under `wmt.kernel-lab.v1`; they
include source and can also be downloaded as JSON. Existing workbench data under
`wmt.tree.v2` is untouched. This experiment uses WMT snapshots; adopting Universal
Weave and a general knowledge-graph schema layer remain subsequent work.

## What is checked

The scoped Isabelle build imports the original quantity theory and checks the
oracle dependencies of `mass_from_volume` and `kernel_exact_sound`. The former
states, for an exact mass result:

```text
kernel (MassOf m (Some V) u) = Exact k y
  ==> k = K_mass
      AND dim_of (snd V) = D_volume
      AND dim_of u = D_mass
      AND y * scale u = density m * siq V
```

The outer OCaml/JSON adapter, numeric runtime stubs, compiler and browser runtime
remain trusted/tested components. The wrapper's nonnegative-input guard is an
application restriction. No claim about all specialist panels or all veri7vn
families is made. The table is a chosen reference model, not evidence that a
particular physical sample has that density.

`site/kernels/build-receipt.json` identifies the successful proof attempt,
source hashes and emitted runtime files. It is a build record, not a signed
attestation or an independent proof of the entire browser stack.

## Rebuild

Use Isabelle2026-RC1, OCaml 5.3.0, `js_of_ocaml`/`wasm_of_ocaml-compiler` 6.4.1,
`js_of_ocaml-toplevel`, `js_of_ocaml-ppx`, Zarith 1.14, and Binaryen 133.
The pinned Zarith browser primitive implementations are included under
`vendor/zarith-stubs/`; their JS and Wasm versions must be kept together.

Obtain a checkout of veri7vn at the pinned commit, then run:

```sh
python3 tools/build-kernel-lab.py \
  --veri7vn /path/to/veri7vn \
  --isabelle /path/to/isabelle \
  --ocaml-prefix /path/to/opam/switch \
  --binaryen-bin /path/to/binaryen/bin
```

The script adds an export session in that scratch veri7vn checkout and invokes
its required `tools/dev/check-native` driver. Existing upstream theory files
must match the pinned commit. It exports the kernel to OCaml and rebuilds both
browser toplevels. Runtime files are committed because the site is static.

## Verify

```sh
node --test e2e/kernel-model.test.mjs
cd e2e && npm ci
BASE=http://localhost:8799/ node kernels.mjs
BASE=http://localhost:8799/ node e2e.mjs
```

Use `PW_CHANNEL=chrome` for an installed Chrome, or install Playwright Chromium.
The new browser test runs real OCaml/Wasm and Z3: exact mass/decimal/large-number
cases, reference/replacement disagreement, a changed comparison, premise
retraction, unsupported and invalid programs, timeout, persistence/re-execution,
and JavaScript-backend parity. See `THIRD_PARTY.md` for runtime notices.
