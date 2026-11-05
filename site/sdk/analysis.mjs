import {createExtensionsRunner} from './default-extensions.mjs';
import {createReasoningRunner,collectiveConflicts} from './reasoning.mjs';
import {requireThat,digest,clone} from './hash.mjs';
import {validateIR,LOGIC_PROFILE} from './ir.mjs';
export const DEFAULT_LIMITS={maxSteps:3000,solverTimeoutMs:1500,wallTimeMs:30000};
export function limitsFor(input={}) {
  const limits={...DEFAULT_LIMITS,...input};
  for(const [key,max] of Object.entries({maxSteps:5000,solverTimeoutMs:5000,wallTimeMs:60000}))
    requireThat(Number.isSafeInteger(limits[key]) && limits[key]>=1 && limits[key]<=max,`Invalid ${key}; maximum ${max}.`);
  requireThat(Object.keys(limits).every(k=>k in DEFAULT_LIMITS),'Unknown analysis budget.');return limits;
}
export const stopped=(stopReason,message='Operation stopped without a complete result.')=>({format:'wmt.analysis/1',status:'unknown',complete:false,stopReason,message,positions:[],conflicts:[],repair:null});
class Stop extends Error {constructor(reason,message){super(message);this.reason=reason;}}
// The original core requests a core/model after check-sat even when unavailable.
// Only those expected diagnostic lines are tolerated, after a valid status.
export function checkedSolverReply(value) {
  const output=String(value).trim(),head=output.split('\n')[0].trim();
  if(head==='unknown')throw new Stop('solver_unknown','Z3 returned unknown.');
  if(!['sat','unsat'].includes(head))throw new Stop('solver_error','Z3 did not return a valid status: '+output.slice(0,1200));
  for(const line of output.split('\n').slice(1))
    if(line.includes('(error') && !/unsat core is not available|model is not available/.test(line))
      throw new Stop('solver_error',line);
  return output;
}
function initializeEngine(createEngine,ir) {
  validateIR(ir);const engine=createEngine(),empty=ir.claims.length===0;
  // The workbench's ingest UI rejects declaration-only input. Retain its
  // unchanged core: initialize declarations with a tautology, then REMOVE it
  // before any solver query. Empty buckets and zero-premise proofs remain real.
  const input=empty?{...ir,claims:[{id:'c_sdk_empty_initializer',source:'SDK declaration initialization',formula:{op:'eq',a:{t:'int',v:0},b:{t:'int',v:0}}}]}:ir;
  const result=JSON.parse(engine.ingest(JSON.stringify(input)));
  if(!result.ok){engine.free?.();throw new Stop('invalid_input',result.errors.join('\n'));}
  if(empty){const removed=JSON.parse(engine.remove('c_sdk_empty_initializer'));if(!Array.isArray(removed.claims) || removed.claims.length!==0){engine.free?.();throw new Stop('error','Could not initialize the empty bucket.');}}
  return engine;
}
export function createAnalysisRunner({createEngine,evaluate,runtime}) {
  async function evalScript(script,limits) {return checkedSolverReply(await evaluate(`(set-option :timeout ${limits.solverTimeoutMs})\n`+script));}
  function engineFor(ir) {
    return initializeEngine(createEngine,ir);
  }
  async function analyze(ir,budgets={}) {
    const limits=limitsFor(budgets);let engine,steps=0;
    try {
      engine=engineFor(ir);engine.lattice_begin();
      for(let script=engine.lattice_next();script;script=engine.lattice_next()) {
        if(++steps>limits.maxSteps)throw new Stop('step_budget','Enumeration exceeded the step budget.');
        engine.lattice_feed(await evalScript(script,limits));
      }
      const lattice=JSON.parse(engine.lattice_result());
      if(!lattice.done || lattice.unknown)throw new Stop('solver_unknown','No complete lattice result.');
      if(lattice.capped)throw new Stop('enumeration_cap','WMT reached its enumeration cap; no append is permitted.');
      const active=ir.claims.map(c=>c.id),weights=new Map(ir.claims.map(c=>[c.id,c.weight??1]));
      const positions=lattice.mss.map(keep=>({keep,drop:active.filter(id=>!keep.includes(id))}));
      const repairs=positions.map(p=>({drop:p.drop,weight:p.drop.reduce((n,id)=>n+weights.get(id),0)}));
      repairs.sort((a,b)=>a.weight-b.weight || a.drop.length-b.drop.length || a.drop.join(',').localeCompare(b.drop.join(',')));
      return {format:'wmt.analysis/1',status:lattice.consistent?'consistent':'inconsistent',complete:true,stopReason:'completed',
        profile:LOGIC_PROFILE,limits,steps,runtime:clone(runtime),inputDigest:await digest('ir',ir),
        positions,conflicts:lattice.mus,repair:repairs[0]??null,acceptance:{...lattice.af,attackSemantics:'legacy-co-membership-only'},conflictSemantics:collectiveConflicts(lattice.mus),
        renderedClaims:JSON.parse(engine.meta()).claims,engineState:engine.export_state()};
    } catch(error) {if(error.name==='ContractError')return stopped(error.code,error.message);return stopped(error.reason??'error',String(error.message??error));}
    finally {engine?.free?.();}
  }
  async function consistency(ir,budgets={}) {
    const limits=limitsFor(budgets);let engine;
    try{engine=engineFor(ir);const answer=await evalScript(engine.smt_check(),limits);
      return {format:'wmt.consistency/1',status:answer.split('\n')[0]==='sat'?'consistent':'inconsistent',complete:true,stopReason:'completed',profile:LOGIC_PROFILE,limits,steps:1,runtime:clone(runtime),inputDigest:await digest('ir',ir),renderedClaims:JSON.parse(engine.meta()).claims,engineState:engine.export_state()};
    }catch(error){return {...stopped(error.reason??error.code??'error',String(error.message??error)),format:'wmt.consistency/1'};}
    finally{engine?.free?.();}
  }
  async function entailment(ir,{targetClaimId,premiseClaimIds},budgets={}) {
    const limits=limitsFor(budgets);let engine;
    try {
      validateIR(ir);const target=ir.claims.find(c=>c.id===targetClaimId);
      requireThat(target && Array.isArray(premiseClaimIds) && new Set(premiseClaimIds).size===premiseClaimIds.length,'Invalid proof target/premises.');
      requireThat(!premiseClaimIds.includes(targetClaimId) && premiseClaimIds.every(id=>ir.claims.some(c=>c.id===id)),'Proof premises must exist and exclude the conclusion.');
      const premises={...clone(ir),claims:ir.claims.filter(c=>premiseClaimIds.includes(c.id)).map(clone)};
      engine=engineFor(premises);
      const base=await evalScript(engine.smt_check(),limits);
      if(base.split('\n')[0]!=='sat')return {status:'failed',reason:'Premises are inconsistent; vacuous entailment is not accepted.'};
      const answer=await evalScript(engine.smt_entails_json(JSON.stringify(target.formula)),limits);
      return {status:answer.split('\n')[0]==='unsat'?'checked':'failed',reason:answer.split('\n')[0]==='unsat'?'Declared premises entail the exact target formula.':'The target is not entailed by these premises.',
        runtime:clone(runtime),profile:LOGIC_PROFILE,limits,inputDigest:await digest('ir',ir),targetDigest:await digest('formula',target.formula),targetClaimId,premiseClaimIds};
    } catch(error) {return {status:'unsupported',stopReason:error.reason??error.code??'error',reason:String(error.message??error)};}
    finally {engine?.free?.();}
  }
  return {analyze,entailment,consistency,...createReasoningRunner({engineFor,evalScript,limitsFor,runtime}),...createExtensionsRunner({engineFor,evalScript,limitsFor,runtime})};
}
export function renderIR(createEngine,ir) {
  const engine=initializeEngine(createEngine,ir);
  try {
    return JSON.parse(engine.meta());
  } finally {engine.free?.();}
}

export function lowLevelEvaluator(Z3) {
  return async script=>{
    const config=Z3.mk_config(),context=Z3.mk_context(config);
    try{return await Z3.eval_smtlib2_string(context,script);}
    finally{Z3.del_context(context);Z3.del_config(config);}
  };
}
