# Paper review SDK and executable kernel checkpoint

Status reviewed on **2026-11-05**. This branch checkpoints the reusable paper
review implementation and its paper-kernel integration. The SDK is
`@wmt/paper-sdk@0.1.0-experimental.6`. It is an experimental source/package
checkpoint, not an npm publication or a journal acceptance/release gate.

## What is complete in this checkpoint

“Complete” below means implemented and covered by the verification recorded
here, within the stated limits. It does not mean production-ready or formally
verified.

| Area | Implemented behavior |
| --- | --- |
| Original WMT | Typed claims, real Rust/Wasm and Z3 consistency checks, collective conflicts, coherent positions and trajectory views. |
| Paper review | PDF text extraction with source locators, controlled/configured formalization, candidate and definition organization, editable typed IR and explicit source-to-formula review. |
| Versioned buckets | Personal/RFC scopes, whole-conjunction SAT admission, unchanged conflict/stopped results, version/digest concurrency checks, idempotency, separately checked forks and export/restore. |
| Reasoning | Nonvacuous entailment and minimal witnesses, explicit defaults, finite named normal extensions, alternate extensions and checked bucket forks. |
| Executable experiments | Replaceable OCaml runtimes, schema-defined entity equality and a pinned veri7vn quantity example. |
| New in SDK .6 | Paper-bound kernel requests, explicit execution, authored observation IR, separate observation review, fresh replay before bucket admission and exportable execution evidence. |
| Browser .6 flow | Synthetic kernel PDF, code/input editor, score/embedding/quantity examples, JSON import without execution, cancellation, review invalidation after edits and checked sidecar download. |
| Integration | JavaScript exports and TypeScript declarations, loopback sidecar API, OpenAPI contract and pinned Castalia projection fixtures. Kernel authoring is a JS SDK API; no new HTTP authoring routes are claimed. |

### Changes since .5

- Added `kernels.mjs` and declarations for request/run/observation artifacts and
  `wmt.kernel-execution/1` replay verification.
- Added the `@wmt/paper-sdk/kernels/browser` entry point and a fresh-worker OCaml
  adapter supporting the existing Wasm-GC and JavaScript runtime builds.
- Connected execution, exact observation review and replay to `papers.html`.
  The general workbench submission path also rechecks attached kernel evidence.
- Added SDK failure/binding tests and a real-browser paper-kernel suite, including
  Unicode/JSON round trips, compilation errors, cancellation and a looping-worker
  timeout. The walkthrough test now waits for the actual PDF highlight paint.
- Updated package/API version metadata, runtime adapter checksums and SDK usage
  documentation. Rust/Wasm, Z3 and OCaml compiler binaries are unchanged.

## What is not complete or not provided

| Area | Remaining boundary or work |
| --- | --- |
| Production release | No published npm release, signing/provenance release pipeline or completed Castalia Gate 0 acceptance. |
| Identity and authority | Review identities are self-attributed. No authenticated author endorsement, peer-review decision, repository acceptance or journal publication is implemented by this SDK. |
| Durable hosting | Browser and loopback repository state is in memory with explicit export/restore. Durable multi-user storage, server authorization and production deployment are host responsibilities. |
| General scientific parsing | The built-in parser has a controlled grammar. General prose needs configured extraction/formalization adapters or authored IR; OCR is not installed by default. Ambiguous candidates stay explicit. |
| Formal assurance | Reproducing a kernel result does not prove program correctness, validate an output-to-formula interpretation or establish empirical truth. The quantity example does not transfer a theorem to arbitrary user code. |
| Untrusted execution | Workers provide lifecycle isolation and cancellation, not a hostile-code security sandbox. The browser executor requires trusted same-origin runtime assets and explicitly installed libraries. No native Node OCaml executor is bundled. |
| Solver coverage | Strict-IR, grounding and enumeration budgets remain. UNKNOWN, timeout, cancellation and incomplete enumeration are not successful proofs or adoptable extensions. |
| Host integration | Lower-level bucket APIs check consistency, not mandatory kernel replay. Hosts must use `submitKernelObservation` or enforce equivalent fresh verification. Hosts supply additional executors/checkers and honor cancellation. |
| Compatibility coverage | The recorded browser verification covers Chromium on macOS; other browsers, operating systems and hostile-code hardening are not established by those tests. No native compiler rebuild is part of this checkpoint. |

## Repository and upstream workflow

The working branch is `spike/pluggable-browser-kernels` in
[bananawalnut/world-model-trajectories](https://github.com/bananawalnut/world-model-trajectories).
`origin` refers to that fork; `upstream` refers to
[emberian/world-model-trajectories](https://github.com/emberian/world-model-trajectories).
Development stays on the fork branch. The fork's draft PR tracks integration
into the fork's `main`; a separate upstream draft PR proposes the work to
Emberian. Neither PR constitutes acceptance or a release.

This checkpoint integrates upstream `main` at
`b4bc12d59ab54306e55a2f984abe434e0948fc1e`, including Action SHA pinning
(`70bccea`) and read-only workflow permissions (`b4bc12d`). Both SDK and browser
CI jobs retain those restrictions. Existing feature history is preserved by a
merge; no force push or rewrite is required. New upstream changes should be
fetched and merged into this branch after local changes have been committed.

Maintainer handoff:

1. Review this scope and the SDK semantics before treating the draft PR as ready.
2. Check the latest commit's GitHub SDK/browser jobs. Cross-fork workflow runs
   can require upstream maintainer approval; local checks are recorded separately.
3. Agree which experimental features belong in upstream and whether the proposal
   should be split before merging. No merge into either `main` is part of this
   checkpoint.
4. Address the production boundaries above before publishing or hosting it as an
   authenticated, durable service. The current review flow is a local tool.

## Paper review and reasoning semantics

The public [definition example](site/definitions.html) generates its own PDF.
It exercises source extraction, a single symbol binding with its definition and
uses, retained ambiguous candidates, editable strict IR and mathematical preview,
explicit source-to-formula review, and actual SAT/UNSAT bucket operations.
Uninterpreted primitives remain explicit; a declaration alone asserts nothing.

The [reasoning examples](site/reasoning.html) preserve whole conflict groups,
discover nonvacuous inclusion-minimal supports, ground normal defaults for named
entities, enumerate all complete extensions within reported budgets, preserve
tied preferred alternatives, and independently check selected bucket forks.
A bucket's whole conjunction controls admission. Optional repair enumeration
does not erase a completed UNSAT verdict or permit an incomplete append.

## Included

- Source-bound candidate taxonomy, review feedback, definition identity and uses,
  merge/separate/undo, retained principles, and import/export validation.
- KaTeX rendering and editable browser drafts with a mathematical preview.
- A generic authored-draft adapter: exact source mapping, paper/revision-qualified
  symbols, separate local review, and immutable bucket receipts/workspaces.
- Collective-conflict displays, explanation witnesses, explicit whole-rule
  defaults, finite named normal extensions, and direct conjunction checks.
- SDK/API/type contracts, synthetic fixtures, and browser regression coverage.

## Kept outside public commits

Private paper sources/PDFs, extracted passages, case-specific formalizations,
assessment JSON, private receipts/sidecars, screenshots and source-bearing parser
report snapshots remain in the original external preview workspace. Its files
were preserved rather than moved. Ignore rules guard the known local case paths.
Public tests import only independently authored synthetic fixtures and the
existing public examples. No private source is required to install or test.

## Compatibility and limits

The Rust/Wasm compiler, Z3 and executable-kernel binaries are unchanged. Existing
strict submissions and bucket records remain readable. Candidate/definition
review and browser draft artifacts are separate from formalization review.
New conflict metadata and extension receipts are additive. A restored historical
receipt does not authorize a fresh fork. Self-attributed review is not an
authenticated author signature or empirical verification.

The explicit strict-IR and grounding budgets remain in force. UNKNOWN, timeout,
cancellation or incomplete enumeration never becomes a successful proof or an
adoptable extension. See the [SDK guide](site/sdk/README.md) for exact profiles.

## Verification

Local verification date: 2026-11-05, macOS arm64, Node 26.8.2. CI uses Node 20
on Ubuntu; its result must be checked separately for the pushed commit.

- SDK/API suite: **59 tests passed**, including six kernel-specific tests.
- TypeScript consumer and authored-draft declarations: **passed**.
- Kernel/entity/coherence/walkthrough model and artifact suite: **17 tests passed**.
- Real-browser suites: **all eight passed** (`e2e`, `kernels`, `entities`,
  `papers`, `walkthrough`, `reasoning`, `definitions`, `paper-kernels`), using
  Playwright 1.64.1 / Chromium 156.0.8078.4. Tests include desktop/mobile layouts;
  the paper-kernel desktop/mobile screenshots were also inspected locally.
- Independently packed/installed `.6` SDK: **passed** public entry-point imports,
  actual PDF extraction and Z3 admission, kernel replay/admission, adapter
  checksum verification and the TypeScript consumer against installed exports.
  This was a local tarball installation, not an npm publication.
- `actionlint` and `git diff --check`: **passed** after upstream integration.

The runtime under test is committed in `f56ee86`; upstream integration and SDK
Action pinning are in `6e943d4`. Subsequent checkpoint edits document these
results and remove an unused workflow-loop variable; they do not change the
runtime. Remote CI is deliberately not claimed here before it runs.

The initial sandboxed HTTP tests could not bind loopback sockets (`EPERM`).
The full SDK/API suite was rerun with local-server permission and passed; that
environmental failure is not reported as a successful initial run.

```sh
npm ci --prefix site/sdk
npm ci --prefix e2e
node --test --test-concurrency=1 site/sdk/test/*.test.mjs
npm run test:types --prefix site/sdk
site/sdk/node_modules/.bin/tsc --noEmit --strict --skipLibCheck --module NodeNext --target ES2022 --lib ES2022,DOM site/papers/formal-drafts.d.mts site/papers/reviewed-draft.d.mts
node --test e2e/kernel-model.test.mjs e2e/entity-model.test.mjs e2e/coherence-view.test.mjs e2e/walkthrough-model.test.mjs
python3 -m http.server 8799 --bind 127.0.0.1 --directory site
# In another terminal, after installing a Playwright Chromium:
cd e2e
for suite in e2e kernels entities papers walkthrough reasoning definitions paper-kernels; do
  BASE=http://127.0.0.1:8799/ PW_CHANNEL=chromium node "$suite.mjs" || exit 1
done
```

GitHub CI includes all eight browser suites above. Browser integration tests
execute the actual pinned runtimes; SDK executor unit tests also use explicit
host callbacks to exercise replay and failure policies. A passing suite checks
these fixtures, not arbitrary papers or all possible programs. See the
[SDK guide](site/sdk/README.md#paper-kernels) for the API, artifact bindings,
limits and interpretation boundary, and
[kernel experiment guide](experiments/kernels/README.md) for runtime provenance.
