# world-model-trajectories

A consistency loop for a set of natural-language claims, built for
[@bananawalnutz](https://twitter.com/bananawalnutz)'s question: *parse claims
into programmable logic so that adding a claim computes contradictions
against the user's axiom set and a selection must be made — goal is
consistency, not truth.*

It is a sibling of [stella / svenvs](https://github.com/emberian): same
honesty discipline, same design language, no overclaim.

## The one idea

**The tool does not parse natural language. You + your own LLM do, in the
open, by copy-paste — and that round-trip *is* the seam, surfaced on
purpose.**

1. You type natural-language claims.
2. The tool builds a prompt (carrying your current typed vocabulary so the
   LLM reuses your symbols instead of inventing synonyms) — you paste it
   into whatever LLM you like.
3. You paste back a **typed many-sorted first-order IR as JSON** — *not*
   SMT-LIB2. (Models are reliable at structured JSON and unreliable at
   solver s-expressions; this also kills the "solver syntax error" failure
   mode.) You never read logic syntax: each claim is shown as your sentence
   plus a deterministic **plain-English rendering** of what it became,
   which you confirm.
4. A trusted, test-pinned Rust compiler turns the IR into SMT-LIB2 (a
   private compile target, never shown) and a real solver — **Z3 4.16,
   wasm, entirely in the browser tab** — drives:
   - the **minimal conflict**: the smallest set of claims that cannot all
     hold (assumption-core + deletion-shrink to a true MUS);
   - the **optimal repair**: the minimum-entrenchment-weight set of claims
     to give up, computed exactly over the conflict (you set the weights;
     the suggestion is yours to take or override — AGM selection);
   - **forced consequences**: atoms entailed by the whole set though no
     single claim asserts them.
5. Same claim id = revision (replace), not append. That is the trajectory.

The logic is real SMT — `Bool / Int / Real / = /` uninterpreted functions
/ quantifiers — not toy propositional. `x > 5` and `x < 3`, or quantified
`∀x. Penguin(x) ⇒ ¬Flies(x)` against `∀x. Bird(x) ⇒ Flies(x)`, are
detected contradictions a propositional engine could not see.

## Why this shape (the honest part)

General NL→logic *without manual intervention* is not reliable and this
tool does not pretend to do it. The faithfulness of the formalization is a
**seam**, and the only honest move is to make it cheap and visible rather
than hidden:

1. **NL → IR faithfulness** is the human+LLM step; you confirm the
   plain-English render, never logic syntax. The tool guarantees
   consistency *of the formalization*, never that it captures your
   sentence. That stays yours.
2. **Z3 may answer `unknown`** on hard quantified fragments. It is reported
   as `unknown` — never silently treated as consistent.
3. **Registry discipline** (reuse a symbol, don't mint a synonym — the
   single most common way contradiction-detection silently breaks) is
   enforced by Z3's own type-checker: a bad symbol surfaces as Z3's
   verbatim error, not a guess.

Goal: **consistency, not truth.** The tool never claims your claims are
correct — only whether they can all hold at once (the smallest, and the
only fully-mechanizable, part of the problem) and what they jointly force.

This is, deliberately, a *truth-maintenance system + AGM belief revision*
(Doyle/de&nbsp;Kleer/Alchourrón–Gärdenfors–Makinson; minimal-unsat-core =
Reiter's conflict sets). None of that is novel; the contribution is the
honest UX of the seam.

## Architecture

- `crate/` — `wmt-core`, a Rust crate compiled to wasm. It owns the typed
  IR, the **IR↔SMT-LIB2 compiler**, the **IR→English renderer**, the typed
  vocabulary, the claim trajectory, AGM selection/weights, the LLM prompt,
  and the analysis step-driver. **It does not solve.**
- The solver is **Z3** (vendored `z3-solver` wasm in `site/vendor/z3/`).
- `site/` — a static page (no server, no API keys, no build step to run
  it). The Rust→wasm core in `site/pkg/`; open `site/index.html` via any
  static host.

## What is verified, and how (no overclaim)

- The engine's correctness is tested **end-to-end against the native `z3`
  binary**: `cd crate && cargo test`. Eight tests: IR→SMT compiles & runs;
  the English render contains no solver syntax; a **quantified** penguin
  contradiction; the analysis driver yields the exact minimal conflict
  **and** the min-entrenchment optimal repair; a consistent set; a
  **beyond-propositional** arithmetic conflict; a forced-consequence
  entailment; same-id revision. (MaxSMT was tried and *rejected* — it
  hangs on quantifiers; the shipped design is assumption-core +
  Rust-side exact repair, which composes with quantifiers. That finding
  is in the commit history, not hidden.)
- **Enumeration is the MARCO algorithm** (Liffiton–Previti–Malik–
  Marques-Silva): a SAT *map* over selector bits, grow SAT seeds to an
  MSS / shrink UNSAT seeds to an MUS, block, repeat. It enumerates every
  minimal conflict and maximal coherent position **with no claim-count
  cap** (the old 10-claim subset-search cap is gone); an honest budget
  stops pathological cases and is reported as "real but not exhaustive",
  never silently truncated. Symbols a claim *uses* but doesn't *declare*
  are auto-declared (elicited IR often omits them); a Z3 error or
  `unknown` is surfaced as **undecided**, never as a verdict.
- **27 tests now** (added since: ground-atom forced consequences; the
  full coherence-lattice — every minimal conflict, the maximal coherent
  positions, and the two-independent-conflicts Reiter duality; MARCO
  past the old cap, the MUS↔MCS duality cross-check, a worked non-toy
  knowledge base with three overlapping conflicts, autodeclare
  well-formedness, defeasible specificity, conflict-triage prompt;
  explanation witnesses are the *minimal* forcing chain and a
  not-entailed case; the back-translation field round-trips; a forked
  branch round-trips and analyses identically (`state_round_trips`);
  and the Dung argumentation reading — attack = co-membership in a
  minimal conflict, with skeptical/contested/defeated acceptance — on
  the single-conflict, two-conflict, and coherent cases).
- **The argumentation view is not a second solve.** Under attack =
  co-membership in an irreducible disagreement, a set is conflict-free
  iff consistent, so the preferred/stable extensions *are* the maximal
  coherent positions the lattice already enumerates; the attack graph
  and acceptance labels are a faithful reading of tested lattice data,
  and the page says so in-product.
- **The trajectory is a tree, not a line.** `Core` (de)serializes
  exactly; a branch is a snapshot, fork/switch/compare is real and
  persisted in-tab. The engine owns the round-trip (tested); the tree
  lives in the UI.
- The browser solver is the official `z3-solver` wasm; checked
  **byte-identical** to that binary on the same scripts.
- **The whole stack is now verified in a real headless browser**
  (`e2e/`, Playwright + Chromium; CI on every push): load the page →
  Z3 ready → seeded trajectory is coherent with the right forced
  consequence → add the contradiction → the SVG conflict structure,
  the maximal positions, the irreducible disagreements, the
  min-entrenchment repair, and the dialectical claim-colouring all
  render → adopting the repair restores coherence; zero console/page
  errors. This closed the standing residual — and on first run it
  **caught two latent bugs shipped since the first deploy** (the
  z3-solver ESM import shape, so the in-browser solver had never
  actually worked; and that z3's wasm is multi-threaded and needs
  COOP/COEP, fixed with a vendored `coi-serviceworker` shim that works
  on GitHub Pages). Both are in the commit history, not hidden — the
  reason real-browser verification is not optional.
- The e2e now also asserts the argumentation attack-graph + acceptance
  summary and a full fork → repair → side-by-side branch-compare, and
  it **again earned its keep**: it caught a save-the-instant-status-
  flipped race that snapshotted a stale branch summary. Local Chrome
  won the race; CI's slower Chromium failed correctly; fixed by
  capturing the summary synchronously. In the commit history, not
  hidden.
- **Conflict triage — real disagreement vs. mis-formalization**
  (abductive; "model proposes, solver disposes"). On a minimal
  conflict, your model judges whether the clash is intrinsic to the
  *sentences* or an artifact the *formalization* introduced, and may
  propose corrected IR. That proposal is **not trusted**: it is applied
  to a snapshot and re-checked with Z3 *under the same reasoning the app
  shows* (strict or defeasible); the "apply" button appears only if the
  solver confirms the conflict is actually gone. The triage prompt is
  built in the trusted Rust core and tested deterministically; the live
  LLM round-trip is the external seam (gated on an OpenRouter key, never
  shown without one — a tested invariant) and, like auto-formalize, is
  deliberately not claimed as CI-verified. Verified live by hand on
  `nvidia/nemotron-3-super-120b` against the deployed stack: both the
  "intrinsic → yours to resolve" and "formalization → Z3 re-checks"
  branches behave correctly and never silently trust the model.
- **Defeasible / prioritized reasoning** (Poole specificity + Brewka
  preferred subtheory). Mark a claim a *default*; a "contradiction"
  that is really a general rule with a more-specific exception (the
  penguin) is reframed as *a default overridden*, not an inconsistency.
  Specificity is **derived from the user's own strict claims**, not
  hand-ranked ("penguins are birds" is what makes "penguin" beat
  "bird"), every step Z3-checked; strict-only conflicts are *never*
  papered over (a tested invariant). 21 native tests now (+3:
  specificity-from-own-KB, no-rescue-of-strict-contradiction, flag
  default+round-trip). Surfaced in-product, with its scope (auto-
  specificity only for `∀x.(Pred(x) ⇒ …)`) stated honestly.
- The serialized-refresh fix that the defeasible e2e step forced also
  closed a real latent concurrency bug: a click during an in-flight
  Z3 analysis started a second wasm session and crashed it. Found by
  the real-browser e2e, in the commit history, not hidden.
- **Optional auto-formalize (OpenRouter, bring-your-own-key)** closes
  the no-manual-intervention gap: your model formalizes, the engine
  ingests, Z3 analyzes, in one click. It does *not* weaken the seam —
  the model still only proposes the typed IR, the engine still compiles
  & type-checks it, and you still confirm the English render. It is the
  one path where data leaves the tab (your sentences + vocabulary →
  OpenRouter, under your key, stored only in `localStorage`), stated
  in-product. The e2e asserts the control exists and that the key-less
  path is honest and makes **no** network call; the live LLM round-trip
  is the external seam and is deliberately *not* claimed as
  CI-verified — it depends on a third-party service and your key.

First load fetches ~34&nbsp;MB of Z3 wasm, then it is cached. Everything
runs locally in the tab; nothing is sent anywhere.

## Run it

```sh
cd crate && cargo test                 # prove the engine vs the z3 binary
wasm-pack build --release --target web --out-dir ../site/pkg   # rebuild wasm
cd ../site && python3 -m http.server   # then open http://localhost:8000
```

Or just open the deployed page and click **Load the penguin demo**.

## Replaceable kernel experiment

Open `site/kernel-lab.html` to compare an Isabelle-exported veri7vn mass
calculation with an editable OCaml kernel and comparison function. Both run in
the browser; Wasm-GC is the default and `?runtime=js` selects the JavaScript
backend. WMT and Z3 check claims conditional on the computed comparison.
The original workbench and its saved branches remain compatible.

See [the experiment](experiments/kernels/README.md) for examples, the kernel
contract, exact proof scope, build instructions and browser tests.

## License

MIT OR Apache-2.0 for this project's code. Bundled Z3 is © Microsoft,
MIT (`site/vendor/z3/Z3-LICENSE.txt`).
