import {Worker} from 'node:worker_threads';
import {createWorkerClient} from './client.mjs';
export * from './index.mjs';
export function createNodeClient() {
  return createWorkerClient(()=>new Worker(new URL('./node-worker.mjs',import.meta.url),{type:'module',execArgv:[]}));
}
