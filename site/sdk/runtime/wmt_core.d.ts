/* tslint:disable */
/* eslint-disable */

export class WmtEngine {
    free(): void;
    [Symbol.dispose](): void;
    analyze_begin(): void;
    analyze_feed(z3_out: string): void;
    analyze_next(): string;
    analyze_result(): string;
    belief_elicitation_prompt(domain: string, n: number): string;
    defeasible_begin(): void;
    defeasible_feed(z3_out: string): void;
    defeasible_next(): string;
    defeasible_result(): string;
    export_state(): string;
    import_state(json: string): string;
    ingest(json: string): string;
    lattice_begin(): void;
    lattice_feed(z3_out: string): void;
    lattice_next(): string;
    lattice_result(): string;
    meta(): string;
    constructor();
    prompt(nl: string): string;
    reactivate(id: string): string;
    remove(id: string): string;
    /**
     * Start from nothing — loading a demo should give you that demo, not
     * append it to whatever was there.
     */
    reset(): string;
    retract(id: string): string;
    seed_demo(): string;
    seed_scenario(): string;
    set_defeasible(id: string, d: boolean): string;
    set_weight(id: string, w: bigint): string;
    smt_check(): string;
    smt_core(): string;
    smt_entails_json(formula_json: string): string;
    triage_prompt_json(ids_json: string): string;
    witness_begin(formula_json: string): void;
    witness_feed(z3_out: string): void;
    witness_next(): string;
    witness_result(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wmtengine_free: (a: number, b: number) => void;
    readonly wmtengine_analyze_begin: (a: number) => void;
    readonly wmtengine_analyze_feed: (a: number, b: number, c: number) => void;
    readonly wmtengine_analyze_next: (a: number) => [number, number];
    readonly wmtengine_analyze_result: (a: number) => [number, number];
    readonly wmtengine_belief_elicitation_prompt: (a: number, b: number, c: number, d: number) => [number, number];
    readonly wmtengine_defeasible_begin: (a: number) => void;
    readonly wmtengine_defeasible_feed: (a: number, b: number, c: number) => void;
    readonly wmtengine_defeasible_next: (a: number) => [number, number];
    readonly wmtengine_defeasible_result: (a: number) => [number, number];
    readonly wmtengine_export_state: (a: number) => [number, number];
    readonly wmtengine_import_state: (a: number, b: number, c: number) => [number, number];
    readonly wmtengine_ingest: (a: number, b: number, c: number) => [number, number];
    readonly wmtengine_lattice_begin: (a: number) => void;
    readonly wmtengine_lattice_feed: (a: number, b: number, c: number) => void;
    readonly wmtengine_lattice_next: (a: number) => [number, number];
    readonly wmtengine_lattice_result: (a: number) => [number, number];
    readonly wmtengine_meta: (a: number) => [number, number];
    readonly wmtengine_new: () => number;
    readonly wmtengine_prompt: (a: number, b: number, c: number) => [number, number];
    readonly wmtengine_reactivate: (a: number, b: number, c: number) => [number, number];
    readonly wmtengine_remove: (a: number, b: number, c: number) => [number, number];
    readonly wmtengine_reset: (a: number) => [number, number];
    readonly wmtengine_retract: (a: number, b: number, c: number) => [number, number];
    readonly wmtengine_seed_demo: (a: number) => [number, number];
    readonly wmtengine_seed_scenario: (a: number) => [number, number];
    readonly wmtengine_set_defeasible: (a: number, b: number, c: number, d: number) => [number, number];
    readonly wmtengine_set_weight: (a: number, b: number, c: number, d: bigint) => [number, number];
    readonly wmtengine_smt_check: (a: number) => [number, number];
    readonly wmtengine_smt_core: (a: number) => [number, number];
    readonly wmtengine_smt_entails_json: (a: number, b: number, c: number) => [number, number];
    readonly wmtengine_triage_prompt_json: (a: number, b: number, c: number) => [number, number];
    readonly wmtengine_witness_begin: (a: number, b: number, c: number) => void;
    readonly wmtengine_witness_feed: (a: number, b: number, c: number) => void;
    readonly wmtengine_witness_next: (a: number) => [number, number];
    readonly wmtengine_witness_result: (a: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
