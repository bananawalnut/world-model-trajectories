export class ContractError extends Error {
  constructor(message, code='invalid_input') { super(message); this.name='ContractError'; this.code=code; }
}
export function requireThat(ok,message,code) {if(!ok)throw new ContractError(message,code);}
export const isObject=x=>x!==null && typeof x==='object' && [Object.prototype,null].includes(Object.getPrototypeOf(x));
export function closed(value,keys,where) {
  requireThat(isObject(value),`${where} must be an object.`);
  for(const key of Object.keys(value))requireThat(keys.includes(key),`${where}: unsupported field ${key}.`);
}
export function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(isObject(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  requireThat(value===null || ['string','boolean'].includes(typeof value) || (typeof value==='number' && Number.isFinite(value)), 'Only finite JSON values can be hashed.');
  return JSON.stringify(value);
}
export async function sha256(bytes) {
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export const digest=(domain,value)=>sha256(new TextEncoder().encode(`wmt.${domain}.v1\0`+canonical(value)));
export const clone=value=>structuredClone(value);
export function text(value,label,max=1000) {requireThat(typeof value==='string' && value.length>0 && value.length<=max,`${label} must be a nonempty string of at most ${max} characters.`);return value;}
export const isoNow=()=>new Date().toISOString();
