# SDK runtime source notices

- `runtime/wmt_core.js`, `.wasm` and `.d.ts` are the unchanged generated browser
  core from this world-model-trajectories fork, originally by Emberian. The
  project's declared license is MIT OR Apache-2.0. Source and rebuild instructions
  remain in the repository's `crate/` and README. `runtime/manifest.json` records
  exact artifact hashes; copying them does not add a formal proof or signature.
- `z3-solver` 4.16.0 is a pinned npm dependency, copyright Microsoft contributors,
  MIT. The browser consumer reuses `site/vendor/z3/`, including `Z3-LICENSE.txt`.
  The Node and browser wasm binaries are checked to be byte-identical.
- `pdfjs-dist` 5.6.205 is a pinned npm dependency from Mozilla's PDF.js project,
  Apache-2.0. Its legacy browser module, parser worker, standard fonts and notices
  are copied under `site/vendor/pdfjs/` by `tools/sync-paper-sdk.mjs`. That directory
  retains the original `LICENSE`, `LICENSE_FOXIT`, and `LICENSE_LIBERATION` files.
- The two Castalia publication schemas and generated TypeScript files under
  `test/castalia/` are compatibility-test snapshots from the user's Castalia Web
  repository. They are not part of the published package file set. Exact source
  revision/paths and checksums are captured in `source.json`; no Castalia runtime,
  authority, UI, credentials or accepted artifacts are imported.

The SDK package contains no OCaml or Isabelle executable. The existing separate
kernel experiment retains its own upstream/runtime source notices. Author
proof assets are submission data; their source and licensing remain with their
authors, and attaching them does not run a checker.
