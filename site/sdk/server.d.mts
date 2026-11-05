import type {Server} from 'node:http';
import type {WorkerClient,BucketRepository,Verifier,Formalizer,ClaimExtractor} from './index.mjs';
export function createSidecarServer(options?:{client?:WorkerClient;repository?:BucketRepository;verifiers?:Map<string,Verifier>;formalizers?:Map<string,Formalizer>;claimExtractor?:ClaimExtractor;maxBodyBytes?:number;maxConcurrent?:number}):{server:Server;repository:BucketRepository;close():Promise<void>};
