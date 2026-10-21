# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

### Added

- A knowledge-graph entity experiment with typed, inherited schemas, runnable OCaml equals overrides, graph-aware policies and exact/cosine embedding comparisons. Ground Z3 claims and saved alternatives retain distinct entity IDs and snapshot provenance; unknown comparisons assert no match consequence.
- Entity contract tests and real-browser coverage for policy inheritance, nontransitive similarity, incompatible spaces, graph relationships, errors, re-execution and both OCaml backends.
- A browser kernel experiment using Isabelle-exported veri7vn OCaml, editable replacement kernels and comparisons, conditional Z3 consequences, and saved alternatives — to test executable domain models without coupling claim reasoning to one implementation.
- Reproducible proof/export builds, runtime source notices, and exact-number/browser checks — to make the experiment's behavior and proof boundaries reviewable.

### Changed

- Updated the Playwright test runner and pinned its dependency lock — the previous browser download hosts no longer resolve, and the kernel experiment needs current Wasm-GC browser coverage.
