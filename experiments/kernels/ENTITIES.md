# Schema-defined executable entity equality

Open `site/entity-lab.html` on the same static server as the workbench. The mass
lab links to it. The default example compares two contact profiles with different
emails and a cosine score of approximately 0.93969. Select `contact/1` to reject
the match using email, or `contact-semantic/1` to accept it at a 0.92 threshold.
Edit the source or threshold and run again to check the changed claim with Z3.
`?runtime=js` uses the alternative OCaml browser backend.

## Data and schema contract

Two editable JSON documents are supplied:

- `site/kernels/entity-graph.json` (`wmt.entity-graph/1`): entities with stable
  `id`, `schema` reference and `attributes`, plus directed edges with `subject`,
  `predicate` and `object` IDs. Both edge endpoints must exist. IDs, field names
  and space metadata strings are 1–200 characters without control characters.
- `site/kernels/entity-schemas.json` (`wmt.entity-schemas/1`): schema IDs,
  required typed `fields`, optional single-parent `extends`, and a defined or
  inherited `equals` policy. Fields support `string`, `number` (finite binary64),
  `boolean`, and `embedding`. Undeclared attributes and missing fields fail
  validation; optional fields and field mappings are not implemented.

A policy is defined **in the schema** as:

```json
{
  "id": "cosine-092/1",
  "requires": {"embedding": "embedding"},
  "source": "open Wmt_Entity;;\nlet equals (_:graph) (a:entity) (b:entity) = cosine ~threshold:0.92 \"embedding\" a b;;"
}
```

Derived schemas retain all parent fields, may add fields, and may override only
equals. They cannot change an inherited field's type. Selecting **Use parent's
equals** removes the local override. Editing the visible OCaml source creates
or changes the override on the selected schema, without editing the parent.
The source editor is synchronized with the registry JSON. Bump the policy ID
when publishing a new version; every local edit is also bound by a source hash.
Inheritance cycles, unresolved references and invalid interfaces are rejected.

Comparison uses one explicitly selected schema's resolved policy for **both**
entities. Each entity's schema must implement that policy's `requires` interface
with the same field types. Different schema IDs are allowed; arbitrary overlap
of unrelated keys is insufficient. Fields outside the required interface may
differ. The declared interface is checked before execution, but arbitrary OCaml
can inspect additional data and return unknown; it is not a static effect system.
There is no automatic asymmetric dispatch to each object's own method.

## Actual runnable OCaml

The existing OCaml toplevel runtimes compile and execute the source locally in a
fresh browser worker. No compiler or Isabelle installation is required to use
the committed builds. `entity-prelude.ml` defines:

```ocaml
equals : graph -> entity -> entity -> comparison
(* comparison = { outcome : Match | No_match | Unknown of string;
                  score : float option } *)
```

Use `decision bool`, `unknown reason`, `text`, `number`, `flag`, `embedding`,
`cosine`, and `exact_embedding`. The graph is an explicit argument; `related`
tests a directed edge and `targets` returns target IDs. The colleague example
requires a shared `worksAt` target as well as nearby embeddings. OCaml's records
and pattern matching also permit arbitrary custom functions over these values.
The helpers and their exact type definitions are ordinary, inspectable source.

Data strings are encoded as UTF-8 bytes with OCaml decimal escapes. They are not
interpolated as executable source. Entity numeric fields and scores use floating
point; the mass experiment's exact rational contract is unchanged.

The worker has a 20-second wall-clock budget and is terminated after each run.
Syntax/type errors, exceptions, malformed replies and non-finite result scores
clear the old verdict. Editing inputs during execution prevents a late reply
from becoming current. Arbitrary user functions have normal worker capabilities;
this is a trusted-code experiment, not a hostile-code sandbox. An OCaml function
can use effects; a receipt records one execution and does not promise replay is
deterministic. Restoring always executes again.

## Embeddings

An embedding contains `values` and a `space` with **all** of:

```json
{"model":"demo-embedding", "revision":"1", "preprocessing":"demo-vectors-v1",
 "normalization":"l2", "dimensions":3}
```

The built-in helpers require equal space metadata, not just equal vector length.
`cosine ~threshold:0.92 "embedding" a b` accepts scores greater than or equal to
the threshold; it returns the score for both match and no-match. The threshold
must be finite and in [-1,1]. Zero vectors, invalid dimensions, missing vectors
and incompatible spaces return unknown. Malformed JSON, non-finite input values
and missing required schema fields fail validation rather than returning false.
Vectors are scaled before calculating the dot product and norms to handle finite
extreme magnitudes. Scores are still binary64 and threshold boundaries have
floating-point precision; this is not a proved numerical algorithm.

`exact_embedding` compares vector components exactly in a compatible space; it
does not apply cosine or tolerate numerical differences. Users may replace
either helper with their own comparison and are responsible for that policy's
meaning. The demo vectors are synthetic. There is no embedding model/API call.

The three profiles demonstrate **A matches B**, **B matches C**, but **A does
not match C** at 0.92. Cosine threshold matching is generally nontransitive.
No equivalence laws, identity merges, substitution, symmetry, reflexivity or
transitive closure are automatically asserted for a custom policy.

## WMT and Z3 consequences

The existing Rust/Wasm WMT engine and Z3 are used unchanged. The adapter declares
an `Entity` sort, distinct constants for different selected stable IDs, and a
`matches_selected_policy(Entity, Entity)` predicate. For the selected ordered
pair it ingests five claims:

1. `c_graph`: exact graph snapshot token and distinctness of different IDs.
2. `c_schema`: exact schema registry snapshot token.
3. `c_policy`: exact resolved policy, helper and runtime snapshot token.
4. `c_expect`: the user's positive or negative match claim.
5. `c_equals`: the concrete returned match/no-match, conditional on all three
   snapshot premises.

Snapshot tokens retain all 256 SHA-256 bits as exact integral SMT Real numerals;
they never pass through a JavaScript number. (The existing Int literal decoder
is limited to i64.) Retracting a snapshot premise releases the consequence.
Changing graph, schema, code, selected pair or expectation requires a fresh run.
Unknown emits **no match consequence and no consistency verdict**.

Arbitrary OCaml is not translated into SMT and Z3 does not prove it correct.
This predicate is a scoped observation; Z3's mathematical `=` keeps its normal
meaning. The example remains coherent when two distinct entity constants match.
No entity comparison inherits veri7vn's mass theorem. That optional verified
baseline remains available separately in `kernel-lab.html`.

## Provenance, alternatives and compatibility

Receipts (`wmt.entity-run/1`) bind the complete graph/schema hashes, selected
policy ID/source/interface, source/helper hashes, runtime build, ordered pair,
result, active claims and separate run/position hashes. Downloaded positions
(`wmt.entity-position/1`) also contain complete graph/schema inputs, the exact
helper source, runtime build record, WMT IR and engine state. Hashes identify
artifacts and observations; they are not signed attestations or correctness
proofs. The pre-existing build receipt authenticates no new entity theorem.

Up to 20 named positions persist under the new `wmt.entity-lab.v1` key with
envelope `wmt.entity-positions/1`. Restore loads the graph, schema and code,
re-executes with the current helper/runtime, and reapplies retracted claims.
Historical verdicts are never imported as current results. `wmt.kernel-lab.v1`
and workbench `wmt.tree.v2` data and formats are untouched; no migration needed.

This is a standalone graph/schema experiment connected to WMT's claim engine,
not a new graph database, RDF/OWL reasoner or full workbench graph editor.
Universal Weave, remote graph loading, ontology law proofs, field mappings and
automatic external proof-kernel adapters remain future work.

## Verification

```sh
node --test e2e/kernel-model.test.mjs e2e/entity-model.test.mjs
cd e2e && npm ci
BASE=http://localhost:8799/ PW_CHANNEL=chrome node entities.mjs
BASE=http://localhost:8799/ PW_CHANNEL=chrome node kernels.mjs
BASE=http://localhost:8799/ PW_CHANNEL=chrome node e2e.mjs
```

Use `PW_CHANNEL=chromium` with Playwright's current Chromium installed. CI runs
all three browser suites. Entity tests execute real OCaml/Wasm and OCaml/JS,
inheritance/overrides, explicit interfaces, exact/cosine matching, nontransitivity,
space metadata, zero/invalid vectors, extreme magnitudes, graph-aware policies,
UTF-8 escaping, conditional solver conflicts and retractions, error/timeout/stale
handling, and saved-position replay. Unit checks cover schema/graph validation,
full snapshot hashes and the IR guard. Existing artifact checks verify that the
mass export and both runtime files still match their original build record.
