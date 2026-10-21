# WMT paper sidecar SDK

`@wmt/paper-sdk@0.1.0-experimental.1` is a runnable SDK and loopback HTTP API for
paper submissions, versioned personal/RFC buckets, and computational evidence.
The browser consumer is [`../papers.html`](../papers.html). The existing claim,
entity-equality and veri7vn mass workbenches remain available.

This is an **experimental unsigned package**, not a published npm release or a
completed Castalia Gate 0 release. Castalia remains responsible for identity,
registration, peer review, repository acceptance and journal publication. The
SDK produces attributed evidence, not any of those decisions.

## The central operation: a person's bucket

A bucket has a stable ID, owner, scope (`personal` or `rfc`), exact version,
content digest, parent reference, and typed WMT claims. Personal buckets and
RFC-scoped buckets are always separate. An RFC bucket additionally names its
exact RFC revision. Claim entrenchment weights are retained.

Submitting a paper to a bucket requires an explicit review of the selected
source-to-formula mappings and the bucket's exact pre-run version **and digest**.
The SDK merges that reviewed subset with the bucket and runs the existing
Rust/Wasm WMT MARCO lattice against real Z3:

- **Consistent, complete:** append new claims in one attributed operation and
  emit an insertion receipt for the new immutable bucket version.
- **Inconsistent, complete:** emit a conflict receipt and leave the bucket
  unchanged. Return every maximal coherent position and irreducible conflict.
- **Unknown, error, timeout, cancellation, enumeration cap, or step budget:**
  emit a stop result; never append or present a complete consistency verdict.
- **Already present:** emit an unchanged receipt; do not create another version.

Versions are compared again **after** solving. Concurrent writes cannot
overwrite one another. An idempotency key replays the exact original result;
reusing it with different input fails. Reusing a claim ID with different content
requires an explicit fork or new ID; bucket append does not silently revise it.

Adopting a solver-verified maximal position creates a **new bucket fork**, linked
to the exact parent version and computation receipt. It does not retract claims
from the original person's bucket. Comparing two buckets shows added, missing
and changed claims. Global minimum-weight repairs are chosen among the complete
lattice's correction sets, without the old single-conflict powerset driver.

## Run the browser consumer

From the repository root:

```sh
python3 -m http.server 8799 --directory site
# Open http://127.0.0.1:8799/papers.html
```

1. Load the two demo buckets. The personal bucket says “All birds are fliers.”
   The RFC bucket is empty.
2. Load the actual demo PDF or upload a text-layer PDF.
3. Parse candidates. Read each quoted source beside WMT's deterministic English
   rendering, select the mappings you accept, and confirm them.
4. Attach an entailment artifact and explicitly run the checker, or attach an
   author-provided proof sidecar.
5. Check the personal bucket: the demo yields two irreducible conflicts and four
   coherent positions, with no mutation. Adopt a position as a new fork if desired.
6. Check the separate RFC bucket: the four reviewed demo formulas append as v2.
7. Download the paper sidecar or the entire bucket workspace.

The SDK has no implicit storage. The browser UI holds this session in memory
until explicit download. Workspace restore rechecks bucket heads and re-extracts
the PDF, clears paper-review/proof verdicts, and requires fresh confirmation.
Historical receipts are retained but cannot authorize a new fork; re-run first.
Restore rejects digest changes and attempts to overwrite immutable future
versions. Existing `wmt.tree.v2` and kernel/entity-lab storage are untouched.

## Use from Node / a journal host

Node 20.19+ is required. Install the repository package locally (or the built
tarball); no Isabelle, OCaml or native Z3 installation is needed:

```sh
npm ci --prefix site/sdk
npm install ./site/sdk
```

```js
import {readFile} from 'node:fs/promises';
import {
  createNodeClient, BucketRepository, createSubmission,
  formalizeSubmission, reviewSubmission
} from '@wmt/paper-sdk/node';

const client = createNodeClient();
const buckets = new BucketRepository(client);
const bucket = await buckets.create({
  id: 'person:alice:model', name: 'Alice’s model', owner: 'person:alice'
});
let paper = await createSubmission({
  bytes: await readFile('./paper.pdf'), fileName: 'paper.pdf',
  title: 'My paper', authors: ['Alice']
}, client);
paper = await formalizeSubmission(paper);

// Render paper.proposal.ir through client.request('render', {ir: ...}).
// Your application displays source quotes and renders for a person's review.
// confirmedSourceClaimIds comes from that explicit review, not from the model.
paper = await reviewSubmission(paper, {
  actorId: 'person:alice', sourceClaimIds: confirmedSourceClaimIds
});
const {bucket: next, receipt} = await buckets.submit(bucket.id, {
  actorId: 'person:alice', submission: paper,
  expectedVersion: bucket.version, expectedDigest: bucket.digest,
  idempotencyKey: 'submission-operation-001'
});
```

`BucketRepository` is an in-memory reference implementation with immutable
snapshots and compare-and-swap writes. A host owns durable storage and its
transaction boundary. `export()` / `restore()` support explicit persistence;
restoring into a fresh repository rechecks heads before committing anything.
The standalone `submitToBucket` returns a proposed next snapshot plus receipt
for hosts with their own database/CAS implementation. The application must
commit only if the authoritative current version still matches `before`.

## PDF extraction is a separate stage

PDF.js 5.6.205 extracts the actual PDF text layer, page by page, in a bounded
worker. The source PDF bytes and SHA-256, page text/hash, UTF-16 character span
and exact quote travel with the submission. Text order is PDF text-layer order,
not a guarantee of multi-column reading order. Source bytes are included in
downloaded sidecars; no remote document is fetched. A paper sidecar includes only
its related bucket checks, affected snapshots and their ancestry; exporting the
whole workspace is a separate explicit action.

The bundled `wmt.pdf-text-sentences/1` selector finds heuristic sentence
candidates. Its result is always `candidate_partial`. It is not a complete
scientific claim census. Equations, references, tables, image-only pages and
layout can require better extraction or human review. A PDF without text yields
`ocr_required` and no invented claims. No OCR engine is bundled.

A host can install a scientific/model selector without changing the reasoning
engine. It must select **actual in-page source spans**. The SDK mints stable
claim IDs, quotes and locators itself and rejects invented/ambiguous quotes:

```js
import {createModelClaimSelector, createModelFormalizer} from '@wmt/paper-sdk';
import {createSidecarServer} from '@wmt/paper-sdk/server';

const select = createModelClaimSelector({
  completeJSON: sourceAwareModelCall // explicit host callback, not a bundled service
});
const parse = createModelFormalizer({
  id: 'my-provider/model-revision-and-prompt-v1',
  completeJSON: typedFormalizationModelCall
});
const {server} = createSidecarServer({
  claimExtractor: {id: 'my-scientific-extractor/1', select},
  formalizers: new Map([['my-provider/model-revision-and-prompt-v1', parse]])
});
server.listen(8801, '127.0.0.1');
```

Model calls are not supplied, invoked by default, or claimed as live-tested.
The host explicitly supplies any provider, credentials, disclosure policy,
timeouts and cancellation for its callbacks. The default browser/API performs
no remote model call. Callback adapters remain outside the bounded reasoning
worker; a host must isolate/budget any additional checker or model it installs.

## Parsing into WMT's language

The SDK uses WMT's existing many-sorted first-order JSON IR, not a new proof
language and not raw SMT-LIB. The `wmt.strict-many-sorted-fol/1` profile supports
Bool/Int/Real, uninterpreted sorts/functions, arithmetic, quantifiers and logical
connectives. IR is closed and type-checked before entering the core. Symbols
must be declared, Real literals are restricted to exact numerals/rationals,
variables must be bound, and inactive/default claims cannot hide in a strict
submission. This avoids feeding arbitrary solver text into the old Real field.

The executable built-in parser supports:

```text
All penguins are birds.
Every penguin is a bird.
No penguins are fliers.
Tweety is a penguin.
Tweety is not a flier.
```

Its vocabulary explicitly maps class phrases and entity names to logical
symbols. It does not guess plurals, synonyms or identity mappings. Unsupported
sentences remain visible with reasons; they do not become unrelated Boolean
atoms or false claims. The browser exposes vocabulary editing, a source-aware
model prompt, and authored-proposal JSON input.

For general prose, use a host-registered formalizer or submit authored
`{ir, mappings, parserId}`. Every formula must map to an existing source claim.
`createModelFormalizer` requires an explicit adapter/model revision, validates
structured output, preserves source claim IDs and the original quote, and can
return explicit unsupported status. A model's output is always a **draft**;
neither an extraction model nor a formalizer can confirm review or append.

The prior entity-equality experiment remains compatible: its concrete,
snapshot-guarded IR can be represented in an authored proposal with explicit
source mappings. Its OCaml receipt may travel as a custom proof artifact. A
host must install a matching verifier to re-execute it; importing JSON does
not inherit the veri7vn theorem or make an old computation freshly checked.
Namespace reusable ground symbols/claim IDs explicitly when composing multiple
observations; conflicting revisions are rejected rather than silently aliased.

## Computational proof sidecars

Submissions accept `wmt.computational-proof/1` artifacts containing:

- kind and stable artifact ID;
- exact PDF, proposal, reviewed-IR and target-claim bindings (or `null` if unbound);
- checker-specific evidence; and
- original named assets as base64 with SHA-256 checksums.

Author-supplied `status: checked` fields are rejected. Checksummed attachment is
not proof checking. Lean/Isabelle/custom sources are retained but remain
`not_checked` unless an installed host verifier handles their exact kind.
Submitted commands or source files are never automatically executed.

The built-in `smt-entailment` checker runs real Z3 against the **same WMT
formulas**: the declared premises must be consistent, and premises plus the
negation of the exact target must be unsatisfiable. The target cannot be one
of its own premises. This checks a concrete derivation; it does not establish
natural-language fidelity or empirical premises.

```js
import {makeEntailmentProof, verifySubmissionProofs} from '@wmt/paper-sdk';
paper.proofs = [await makeEntailmentProof(paper, {
  id: 'proof:bird', targetClaimId, premiseClaimIds
})];
paper = await verifySubmissionProofs(paper, client);
// Inspect paper.proofReceipts; matching files/names alone never yield checked.
```

Hosts can register `verifiers: Map<kind, {id, revision, verify}>`. A custom result
must name an installed checker revision and bind the exact input IR digest.
The host owns the checker's isolation, execution and guarantee. A replacement
comparison/checker gets no proof inherited from a reference implementation.
No `LeanReceipt` is fabricated by this SDK.

## HTTP API

```sh
npm ci --prefix site/sdk
npm start --prefix site/sdk -- --port 8801
# http://127.0.0.1:8801/v1/openapi.json
```

The CLI binds loopback only. It accepts bounded JSON, rejects unknown fields and
cross-origin requests, and stores data in memory. Actor IDs are **self-attributed**,
not authenticated. This is a local sidecar reference API; do not expose it as an
authenticated journal service. A journal host supplies identity/authorization,
durability, operational limits and publication workflow separately.

| Operation | Purpose |
| --- | --- |
| `GET /v1/capabilities` | Exact runtime profile, installed adapters and unsigned-release boundary |
| `POST /v1/submissions` | PDF `{fileName, base64}`, title/authors, optional RFC/publication refs and proof artifacts |
| `GET /v1/submissions/:id` | Current submission plus its exact revision counter |
| `POST /v1/submissions/:id/formalizations` | Controlled/configured parser, or authored IR and mappings |
| `POST /v1/submissions/:id/review` | Explicit reviewer ID and accepted source claim IDs |
| `POST /v1/submissions/:id/proofs` | Replace attached proof artifacts, clearing current proof receipts |
| `POST /v1/submissions/:id/proofs/check` | Run installed verifiers |
| `GET /v1/submissions/:id/sidecar` | Complete local, not-published paper/proof/bucket-evidence bundle |
| `GET /v1/buckets` | Named bucket heads |
| `POST /v1/buckets` | Create a named personal or RFC-scoped bucket |
| `GET /v1/buckets/:id?version=N` | Exact immutable snapshot (current if version omitted) |
| `POST /v1/buckets/:id/submissions` | Atomic conditional append or conflict/stop receipt |
| `POST /v1/buckets/:id/forks` | Adopt an exact computed coherent position as a new bucket |
| `GET /v1/receipts/:id` | Exact insertion/conflict/stop receipt |

Submission updates require `expectedRevision`. Bucket submission requires
`expectedVersion`, `expectedDigest`, `actorId`, `submissionId`,
`submissionRevision` and `idempotencyKey`. Stale input returns HTTP 409.
No endpoint publishes to Castalia, creates a PR, contacts authors, or grants
governance/reviewer authority. See [`openapi.json`](openapi.json) for shapes.

## Runtime, budgets and provenance

Each reasoning/PDF request gets a fresh worker, terminated on completion, error,
cancellation or deadline, including its child PDF/Z3 workers. Defaults are
30 seconds wall time, 1.5 seconds per solver script and 3000 driver steps, with
hard host ceilings. The SDK profile limits a combined IR to 64 claims, 24 levels
of formula depth and 10,000 AST nodes. PDF limits are 12 MB, 200 pages and one
million extracted characters; candidate count is 256. These are explicit SDK
budgets, not new limits on the original WMT workbench.

The adapter stops on every solver `unknown` or malformed reply, even during
lattice growth/shrink. It never lets the old driver interpret an error as
unsatisfiable. Partial/capped enumeration is discarded from append/fork
eligibility. A hard wall-clock limit also covers solver initialization.

`runtime/manifest.json` pins the unchanged WMT binary/bindings, Z3 wasm, SDK
adapters, PDF.js and standard-font assets by checksum. Node checks the engine
and solver binary hashes before analysis. The build tests check the complete
manifest; it is a build record, not a signed attestation of an isolated browser
deployment. Rebuild/synchronize after source/dependency changes:

```sh
npm ci --prefix site/sdk
node tools/sync-paper-sdk.mjs
```

Bucket receipts bind owner/scope, exact before/after snapshots, source PDF,
proposal/review/input digests, engine/solver/profile/budgets, complete result and
operation identity. Proof receipts bind exact checker inputs and target claims.
There are no inherited proofs from the mass kernel and no claim that arbitrary
OCaml/Lean/model output has been verified without its checker running.

## Castalia compatibility and remaining release work

The adapters `toCastaliaClaimSet` and `toCastaliaAnalysis` validate against the
closed publication schemas captured from Castalia Web commit
`b17705041334b49055e7a05d5dd9f36513657833`. Their exact source hashes live under
`test/castalia/source.json`. The caller allocates canonical `PCS`, `CLM`, `PAS`,
`FMT` and `PMS` identities; the SDK does not mint accepted repository artifacts.
Extraction never becomes `reviewed_complete`, and SMT entailment does not become
a Lean receipt or a whole-paper proof. Exact byte/source locators remain in the
full WMT sidecar alongside the narrower Castalia projection.

The existing Castalia contracts are not modified. `WmtEvidenceV1` and
`RfcBucketV1` are architecture requirements there, without implemented canonical
schemas in the inspected snapshot; this SDK uses its own versioned receipts
rather than inventing Castalia contract conformance.

A signed, reproducible, isolated browser-engine release is still a Castalia
Gate 0 prerequisite. Publication hosting, repository validation/acceptance,
authentication, production durable storage, OCR, live model configuration,
Lean/Isabelle project verification, and Universal Weave history integration are
not completed by this experimental SDK. The versioned bucket graph is ready
for a history/persistence adapter without coupling claim reasoning to it.

## Verification and package check

```sh
npm ci --prefix site/sdk
npm test --prefix site/sdk
npm run test:types --prefix site/sdk
node --test e2e/kernel-model.test.mjs e2e/entity-model.test.mjs
cd e2e && npm ci
BASE=http://127.0.0.1:8799/ PW_CHANNEL=chrome node papers.mjs
```

Tests execute real PDF.js, WMT/Wasm and Z3. They cover source locators, controlled
and injected-model seams, invalid typed IR, full coherent positions, conditional
append, unchanged conflicts, CAS races, idempotency, exact nonvacuous entailment,
unchecked Lean assets, digest mismatch, timeout/cancellation/caps, transactional
restore, Castalia schema projections and OpenAPI request contracts. A TypeScript
consumer checks the SDK exports. Browser tests upload an actual PDF, confirm
four mappings, check evidence, fork a coherent alternative, append to a separate
RFC bucket, export/reload, recheck, and preserve the original app's stores.
Live third-party model calls and external proof checkers are not CI-verified.
