# Reusable paper reasoning and definition review checkpoint

This branch checkpoints the reusable implementation developed after the guided
PDF walkthrough. The SDK is `@wmt/paper-sdk@0.1.0-experimental.5`; this is not an
npm publication or a journal acceptance/release gate.

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

```sh
npm ci --prefix site/sdk
npm ci --prefix e2e
node --test --test-concurrency=1 site/sdk/test/*.test.mjs
npm run test:types --prefix site/sdk
node --test e2e/kernel-model.test.mjs e2e/entity-model.test.mjs e2e/coherence-view.test.mjs e2e/walkthrough-model.test.mjs
python3 -m http.server 8799 --directory site
# In another terminal, after installing a Playwright Chromium:
cd e2e
BASE=http://localhost:8799/ PW_CHANNEL=chromium node definitions.mjs
BASE=http://localhost:8799/ PW_CHANNEL=chromium node reasoning.mjs
```

GitHub CI also runs the original app, kernel, entity, paper and guided-walkthrough
browser suites. All examples execute the actual pinned runtime rather than
mocking a successful solver result. The current local checkpoint verification
and commit identity are recorded separately in the task's checkpoint report.
