#!/usr/bin/env python3
"""Rebuild the experiment from pinned Isabelle sources and an OCaml toolchain.

No formula is transcribed into another implementation. Isabelle exports the
existing quantity kernel; both browser runtimes load that exact OCaml source.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PIN = '093b59af26ff1aecaada0f5e7bda998fb2f8b6d1'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args, cwd=ROOT, env=None):
    subprocess.run([str(a) for a in args], cwd=cwd, env=env, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--veri7vn', type=Path, required=True)
    parser.add_argument('--isabelle', type=Path, required=True)
    parser.add_argument('--ocaml-prefix', type=Path, required=True,
                        help='OCaml/opam switch prefix; bin must contain ocamlfind and both browser compilers')
    parser.add_argument('--binaryen-bin', type=Path, help='directory containing wasm-opt and wasm-merge')
    args = parser.parse_args()
    upstream = args.veri7vn.resolve()
    isabelle = args.isabelle.resolve()
    prefix = args.ocaml_prefix.resolve()
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=upstream, text=True).strip()
    if commit != PIN:
        raise SystemExit(f'Expected veri7vn {PIN}; found {commit}. Update the pin deliberately.')
    source_paths = ['src/extract/quantity/Quantity.thy', 'src/extract/quantity/Quantity_Export.thy',
                    'src/extract/quantity/base/Quantity_Base.thy', 'src/extract/commons/Commons_Num.thy']
    for name in source_paths:
        checked_in = subprocess.check_output(['git', 'show', f'{PIN}:{name}'], cwd=upstream)
        if (upstream / name).read_bytes() != checked_in:
            raise SystemExit(f'Upstream source has local changes: {name}')
    export = upstream / 'src/extract/wmt_browser'
    export.mkdir(parents=True, exist_ok=True)
    for name in ['ROOT', 'Wmt_Browser_Quantity.thy']:
        shutil.copyfile(ROOT / 'experiments/kernels/isabelle' / name, export / name)
    roots = ['src/extract/wmt_browser', 'src/extract/quantity', 'src/extract/commons']
    command = ['python3', 'tools/dev/check-native', '--isabelle', isabelle,
               '--session', 'Wmt_Browser_Quantity', '--expect', 'WMT_BROWSER_QUANTITY PASS oracles=0',
               '--timeout', '1800']
    for directory in roots:
        command += ['--session-root', directory]
    run(command, cwd=upstream)
    candidates = []
    for path in (upstream / 'var/native-scaffold/sessions').glob('*/receipt.json'):
        receipt = json.loads(path.read_text())
        if receipt.get('session') == 'Wmt_Browser_Quantity':
            candidates.append((path.stat().st_mtime, receipt))
    receipt = max(candidates, key=lambda item: item[0])[1]
    if receipt['status'] != 'passed':
        raise SystemExit('Fresh Isabelle build did not pass')
    env = os.environ.copy()
    env['USER_HOME'] = str(upstream / 'var/native-scaffold/user-state')
    destination = upstream / 'var/wmt-browser-export'
    command = [isabelle, 'export']
    for directory in roots:
        command += ['-d', directory]
    command += ['-O', destination, '-x', '*:code/*', 'Wmt_Browser_Quantity']
    run(command, cwd=upstream, env=env)
    generated = destination / 'Wmt_Browser_Quantity.Wmt_Browser_Quantity/code/wmt_quantity.ocaml'
    site = ROOT / 'site/kernels'
    shutil.copyfile(generated, site / 'quantity.ml')
    scratch = ROOT / '.kernel-build'
    scratch.mkdir(exist_ok=True)
    shutil.copyfile(ROOT / 'experiments/kernels/ocaml/browser.ml', scratch / 'browser.ml')
    env = os.environ.copy()
    bins = [str(prefix / 'bin')]
    if args.binaryen_bin:
        bins.append(str(args.binaryen_bin.resolve()))
    env['PATH'] = os.pathsep.join([*bins, env.get('PATH', '')])
    env['CAML_LD_LIBRARY_PATH'] = os.pathsep.join(str(p) for p in [
        prefix / 'lib/stublibs', prefix / 'lib/ocaml/stublibs', prefix / 'lib/ocaml'])
    common = 'js_of_ocaml-toplevel.common,compiler-libs.toplevel,js_of_ocaml-ppx,zarith'
    vendor = ROOT / 'experiments/kernels/vendor/zarith-stubs'
    # Keep generated arithmetic-warning diagnostics inside the evaluator;
    # never substitute dummy implementations for missing numeric primitives.
    for runtime in ['js', 'wasm']:
        package = ('js_of_ocaml-toplevel,' if runtime == 'js' else 'wasm_of_ocaml-compiler.dynlink,') + common
        bytecode = scratch / f'browser-{runtime}.byte'
        run(['ocamlfind', 'ocamlc', '-g', '-linkall', '-package', package, '-linkpkg',
             scratch / 'browser.ml', '-o', bytecode], env=env)
        compiler = 'js_of_ocaml' if runtime == 'js' else 'wasm_of_ocaml'
        output = site / ('ocaml-runtime.js' if runtime == 'js' else 'ocaml-wasm.js')
        command = [compiler, '--effects=cps', '--toplevel', '--disable', 'genprim', vendor / 'runtime.js']
        if runtime == 'wasm':
            command.append(vendor / 'runtime.wat')
        command += [bytecode, '-o', output]
        run(command, env=env)
    shutil.copyfile(ROOT / 'experiments/kernels/ocaml/user-kernel.ml', site / 'user-kernel.ml')
    runtime_files = [site / 'ocaml-runtime.js', site / 'ocaml-wasm.js',
                     *(site / 'ocaml-wasm.assets').glob('*.wasm')]
    build = {
        'format': 'wmt.kernel-build/1',
        'upstream': 'https://github.com/emberian/veri7vn', 'upstreamCommit': PIN,
        'isabelleVersion': 'Isabelle2026-RC1', 'session': 'Wmt_Browser_Quantity',
        'proofBuildStatus': receipt['status'], 'proofAttemptId': receipt['attempt_id'],
        'proofMarker': 'WMT_BROWSER_QUANTITY PASS oracles=0',
        'upstreamSourceSha256': {name: sha(upstream / name) for name in source_paths},
        'generatedSourceSha256': sha(site / 'quantity.ml'),
        'exportTheorySha256': sha(ROOT / 'experiments/kernels/isabelle/Wmt_Browser_Quantity.thy'),
        'runtime': 'OCaml 5.3.0 / js_of_ocaml + wasm_of_ocaml 6.4.1',
        'defaultRuntime': 'Wasm-GC',
        'runtimeFilesSha256': {str(p.relative_to(site)): sha(p) for p in runtime_files},
        'numericRuntime': {'repository': 'https://github.com/janestreet/zarith_stubs_js',
                           'commit': 'c8e2e3eb062eee373625f9aecca88168103e4e93'},
        'guarantee': 'Upstream mass_from_volume and kernel_exact_sound dependencies checked for oracles. The OCaml/JSON adapter and browser toolchains are tested, not proved. No specialist-panel admission claimed.',
        'theoremStatement': 'kernel (MassOf m (Some V) u) = Exact k y ==> k = K_mass AND dim_of (snd V) = D_volume AND dim_of u = D_mass AND y * scale u = density m * siq V',
    }
    (site / 'build-receipt.json').write_text(json.dumps(build, indent=2) + '\n')
    print('Built both browser runtimes from the checked OCaml export.')


if __name__ == '__main__':
    main()
