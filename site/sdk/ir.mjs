import {closed,requireThat,canonical,clone} from './hash.mjs';
export const EMPTY_IR={sorts:[],preds:[],funcs:[],claims:[]};
export const LOGIC_PROFILE='wmt.strict-many-sorted-fol/1';
const builtin=['Bool','Int','Real'];
const reserved=new Set(['true','false','and','or','not','let','forall','exists','ite','assert','check_sat']);
function name(s) {requireThat(typeof s==='string' && /^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(s) && !reserved.has(s) && !s.startsWith('a_'),`Invalid or reserved logical name: ${s}.`);return s;}
export function validateIR(ir,{maxClaims=64}={}) {
  closed(ir,['sorts','preds','funcs','claims'],'IR');
  for(const k of ['sorts','preds','funcs','claims'])requireThat(Array.isArray(ir[k]),`IR.${k} must be an array.`);
  requireThat(ir.claims.length<=maxClaims && ir.sorts.length<=64 && ir.preds.length+ir.funcs.length<=256,'IR exceeds the SDK logic profile limits.','resource_limit');
  requireThat(canonical(ir).length<=500000,'IR exceeds the byte budget.','resource_limit');
  const sorts=new Set(builtin), signatures=new Map(), ids=new Set();let nodes=0;
  for(const sort of ir.sorts){name(sort);requireThat(!sorts.has(sort),`Duplicate or builtin sort ${sort}.`);sorts.add(sort);}
  for(const [kind,entries] of [['pred',ir.preds],['func',ir.funcs]])for(const sig of entries) {
    closed(sig,['name','args','ret','gloss'],'signature');name(sig.name);
    requireThat(!signatures.has(sig.name),`Duplicate signature ${sig.name}.`);
    requireThat(Array.isArray(sig.args) && sig.args.length<=16 && sig.args.every(s=>sorts.has(s)),`Invalid argument sorts for ${sig.name}.`);
    requireThat(sig.gloss===undefined || typeof sig.gloss==='string' && sig.gloss.length<=10000,'Signature gloss must be bounded text.');
    const ret=kind==='pred'?'Bool':sig.ret;
    requireThat(sorts.has(ret) && (kind!=='pred' || sig.ret===undefined || sig.ret==='Bool'),`Invalid return sort for ${sig.name}.`);
    signatures.set(sig.name,{...sig,kind,ret});
  }
  function budget(depth){requireThat(++nodes<=10000 && depth<=24,'Formula exceeds the depth/node budget.','resource_limit');}
  function term(t,env,depth) {
    budget(depth);requireThat(t && typeof t.t==='string','Missing typed term.');
    if(t.t==='var'){closed(t,['t','name'],'variable');requireThat(env.has(t.name),`Unbound variable ${t.name}.`);return env.get(t.name);}
    if(t.t==='int'){closed(t,['t','v'],'integer');requireThat(Number.isSafeInteger(t.v),'Int literals must be safe JSON integers; use an exact Real string for larger numerals.');return 'Int';}
    if(t.t==='real') {
      closed(t,['t','v'],'real');
      requireThat(typeof t.v==='string' && t.v.length<=160 && (/^-?\d+(?:\.\d+)?$/.test(t.v) || /^\(\/ -?\d+ [1-9]\d*\)$/.test(t.v)), 'Real literals must be exact decimal or (/ numerator positive-denominator) strings.');
      return 'Real';
    }
    if(t.t==='app') {
      closed(t,['t','name','args'],'application');const sig=signatures.get(t.name),args=t.args??[];
      requireThat(sig?.kind==='func' && Array.isArray(args) && args.length===sig.args.length,`Undeclared function or wrong arity: ${t.name}.`);
      args.forEach((arg,i)=>requireThat(term(arg,env,depth+1)===sig.args[i],`Wrong argument type for ${t.name}.`));return sig.ret;
    }
    if(t.t==='arith') {
      closed(t,['t','op','args'],'arithmetic');requireThat(['+','-','*'].includes(t.op) && Array.isArray(t.args) && t.args.length>=1 && t.args.length<=16,'Unsupported arithmetic.');
      const types=t.args.map(arg=>term(arg,env,depth+1));requireThat(['Int','Real'].includes(types[0]) && types.every(t=>t===types[0]),'Arithmetic sorts must match.');return types[0];
    }
    requireThat(false,`Unsupported term ${t.t}.`);
  }
  function formula(f,env=new Map(),depth=0) {
    budget(depth);requireThat(f && typeof f.op==='string','Missing formula.');
    if(f.op==='pred') {
      closed(f,['op','name','args'],'predicate');const sig=signatures.get(f.name),args=f.args??[];
      requireThat(sig?.kind==='pred' && Array.isArray(args) && args.length===sig.args.length,`Undeclared predicate or wrong arity: ${f.name}.`);
      args.forEach((arg,i)=>requireThat(term(arg,env,depth+1)===sig.args[i],`Wrong argument type for ${f.name}.`));return;
    }
    if(['eq','cmp'].includes(f.op)) {
      closed(f,f.op==='eq'?['op','a','b']:['op','rel','a','b'],'comparison');
      const a=term(f.a,env,depth+1),b=term(f.b,env,depth+1);requireThat(a===b,'Equality/comparison sorts must match.');
      if(f.op==='cmp')requireThat(['Int','Real'].includes(a) && ['<','<=','>','>='].includes(f.rel),'Unsupported ordered comparison.');return;
    }
    if(f.op==='not'){closed(f,['op','x'],'negation');formula(f.x,env,depth+1);return;}
    if(['and','or'].includes(f.op)) {
      closed(f,['op','xs'],'junction');requireThat(Array.isArray(f.xs) && f.xs.length<=64,'Invalid junction.');f.xs.forEach(x=>formula(x,env,depth+1));return;
    }
    if(['imp','iff'].includes(f.op)){closed(f,['op','a','b'],'binary formula');formula(f.a,env,depth+1);formula(f.b,env,depth+1);return;}
    if(['forall','exists'].includes(f.op)) {
      closed(f,['op','vars','body'],'quantifier');requireThat(Array.isArray(f.vars) && f.vars.length>0 && f.vars.length<=16,'Invalid quantified variables.');
      const scoped=new Map(env);
      for(const v of f.vars){closed(v,['name','sort'],'bound variable');name(v.name);requireThat(!scoped.has(v.name) && sorts.has(v.sort),'Duplicate bound variable or unknown sort.');scoped.set(v.name,v.sort);}
      formula(f.body,scoped,depth+1);return;
    }
    requireThat(false,`Unsupported formula ${f.op}.`);
  }
  for(const claim of ir.claims) {
    closed(claim,['id','source','gloss','back','formula','weight','active','defeasible'],'claim');name(claim.id);
    requireThat(!ids.has(claim.id),`Duplicate claim ID ${claim.id}.`);ids.add(claim.id);
    requireThat(typeof claim.source==='string' && claim.source.length<=10000,'Each claim needs bounded source text.');
    for(const key of ['gloss','back'])requireThat(claim[key]===undefined || typeof claim[key]==='string' && claim[key].length<=10000,`Claim ${key} must be bounded text.`);
    requireThat(claim.weight===undefined || (Number.isSafeInteger(claim.weight) && claim.weight>=1 && claim.weight<=1000000),'Invalid entrenchment weight.');
    requireThat(claim.active!==false && (claim.active===undefined || claim.active===true),'SDK submissions contain active claims only; use an explicit fork to retract.');
    requireThat(claim.defeasible===undefined || claim.defeasible===false,'This profile checks strict FOL; defeasible claims require a separate profile.');
    formula(claim.formula);
  }
  return ir;
}
export function mergeIR(left,right) {
  validateIR(left);validateIR(right);
  const out=clone(EMPTY_IR);out.sorts=[...new Set([...left.sorts,...right.sorts])];
  for(const key of ['preds','funcs','claims']) {
    const map=new Map();
    for(const item of [...left[key],...right[key]]) {
      const id=key==='claims'?item.id:item.name;
      const semantics=x=>key==='claims'?x:{name:x.name,args:x.args,ret:key==='preds'?'Bool':x.ret};
      requireThat(!map.has(id) || canonical(semantics(map.get(id)))===canonical(semantics(item)),`Conflicting ${key} revision ${id}; fork or use a new ID.`, 'revision_conflict');
      if(!map.has(id))map.set(id,item);
    }
    out[key]=[...map.values()].map(clone);
  }
  return validateIR(out);
}
