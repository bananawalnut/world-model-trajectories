# Browser runtime sources and notices

The generated browser runtime combines these projects. It is not covered solely
by WMT's MIT/Apache-2.0 license.

| Component | Version/source | License |
|---|---|---|
| veri7vn quantity and numeric theories | emberian/veri7vn `093b59af26ff1aecaada0f5e7bda998fb2f8b6d1` | CC0 |
| Isabelle library code emitted by code generation | Isabelle2026-RC1 | BSD-style; see `site/kernels/licenses/Isabelle-COPYRIGHT` |
| OCaml standard library and compiler-libs | OCaml 5.3.0, https://github.com/ocaml/ocaml | LGPL-2.1 with linking exception and component notices |
| js_of_ocaml / wasm_of_ocaml / toplevel | 6.4.1, https://github.com/ocsigen/js_of_ocaml | LGPL-2.1 with linking exception |
| Zarith | 1.14, https://github.com/ocaml/Zarith | GNU Library GPL v2 with linking exception |
| Zarith JS/Wasm primitives | janestreet/zarith_stubs_js `c8e2e3eb062eee373625f9aecca88168103e4e93` | MIT; source and license in `vendor/zarith-stubs` |

License texts are included under `site/kernels/licenses/`. The generated OCaml
module is distributed as source in `site/kernels/quantity.ml`; the adapter and
rebuild instructions are in this directory and `tools/build-kernel-lab.py`.
The build record pins source and runtime hashes. Z3 and WMT retain their existing
notices in the main repository.
