// The kernel-to-claim adapter. Executed comparisons are ground observations,
// guarded by their input values; they are not universal equality axioms.
export const MATERIALS = [
  { name: 'water', density: ['1000', '1'] },
  { name: 'steel', density: ['7850', '1'] },
  { name: 'petrol', density: ['745', '1'] },
];
const gcd = (a,b) => b ? gcd(b, a % b) : a;
export function fraction(value) {
  const s = String(value).trim();
  if (s.length > 40 || !/^-?\d+(?:\.\d+)?$/.test(s))
    throw new Error('Use a decimal number, with at most 40 characters.');
  const [whole, tail = ''] = s.split('.');
  const d = 10n ** BigInt(tail.length);
  const n = BigInt(whole + tail);
  const g = gcd(n < 0n ? -n : n, d);
  return [(n/g).toString(), (d/g).toString()];
}
export function displayFraction([n,d]) {
  const divisor=gcd(BigInt(n)<0n?-BigInt(n):BigInt(n),BigInt(d));
  n=(BigInt(n)/divisor).toString();d=(BigInt(d)/divisor).toString();
  if(BigInt(d)===1n)return BigInt(n).toLocaleString('en');
  const number = Number(n) / Number(d);
  const pretty = Number.isFinite(number) ? number.toLocaleString('en', {maximumSignificantDigits: 12}) : `${n}/${d}`;
  return `${pretty} (${n}/${d})`;
}
export function equalFractions([a,b],[c,d]) { return BigInt(a)*BigInt(d) === BigInt(c)*BigInt(b); }
const term = name => ({ t: 'app', name, args: [] });
const real = ([n,d]) => ({ t: 'real', v: BigInt(d) === 1n ? n : `(/ ${n} ${d})` });
const eq = (name, value) => ({ op: 'eq', a: term(name), b: real(value) });
const match = { op: 'pred', name: 'sample_matches_model', args: [] };
export function claimsFor(input, result, selected) {
  if (result.status !== 'answered') throw new Error('Unsupported computation cannot produce a model consequence.');
  const material = MATERIALS[input.material];
  if (!material) throw new Error('Unknown material.');
  const volume = eq('sample_volume_l', input.volume);
  const density = eq('sample_density_kg_m3', material.density);
  const mass = eq('sample_mass_kg', input.claimed);
  return {
    sorts: [],
    funcs: ['sample_volume_l','sample_density_kg_m3','sample_mass_kg'].map(name => ({name,args:[],ret:'Real'})),
    preds: [{name:'sample_matches_model',args:[]}],
    claims: [
      {id:'c_volume', source:`The sample volume is ${displayFraction(input.volume)} litres.`, weight:5, formula:volume},
      {id:'c_density', source:`The sample uses the reference density for ${material.name}: ${material.density[0]} kg/m³.`, weight:5, formula:density},
      {id:'c_mass', source:`The sample mass is ${displayFraction(input.claimed)} kg and matches the selected model.`, weight:2, formula:{op:'and',xs:[mass,match]}},
      {id:'c_kernel', source:`On these inputs, ${selected === 'reference' ? 'veri7vn' : 'my OCaml kernel'} computes ${displayFraction(result.value)} kg; its comparison ${result.matches ? 'accepts' : 'rejects'} the claimed mass.`, weight:10,
        formula:{op:'imp',a:{op:'and',xs:[volume,density,mass]},b:{op:'iff',a:match,b:{op:'eq',a:{t:'int',v:0},b:{t:'int',v:result.matches?0:1}}}}},
    ],
  };
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
}
