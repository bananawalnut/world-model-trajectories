import type {KernelExecutor} from './kernels.mjs';
export function createBrowserOCamlExecutor(options:{runtimeBaseURL:string|URL;buildReceipt:{runtimeFilesSha256:Record<string,string>};runtime?:'wasm'|'js';libraries?:{id:string;source:string;sha256:string}[]}):Promise<KernelExecutor>;
