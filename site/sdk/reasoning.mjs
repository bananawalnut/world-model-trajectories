import {closed,requireThat,clone,digest,canonical} from './hash.mjs';
import {validateIR,LOGIC_PROFILE} from './ir.mjs';
export const DEFEASIBLE_POLICY='wmt.strict-specificity-greedy/1';
export function collectiveConflicts(groups) {
  return {format:'wmt.collective-conflicts/1',groups:clone(groups),
    collectiveAttacks:groups.flatMap(group=>group.map(to=>({from:group.filter(id=>id!==to),to}))),
    boundary:'Each group is jointly inconsistent and inclusion-minimal. Its pairs need not conflict. Collective attacks retain the entire remaining group; this is not a binary Dung framework.'};
}
export async function defaultSpecificity(ir,defaults,background,ctx) {
  const rules=new Map(),eligibility=[];
      const occupied=new Set();
      const visit=node=>{if(Array.isArray(node))node.forEach(visit);else if(node && typeof node==='object'){if(typeof node.name==='string')occupied.add(node.name);Object.values(node).forEach(visit);}};
      visit(ir);let prefix='wmt_specificity_';while([...occupied].some(n=>n.startsWith(prefix)))prefix+='x_';
      for(const id of defaults) {
        const c=ir.claims.find(c=>c.id===id);let f=c.formula,vars=[];
        while(f.op==='forall'){vars.push(...f.vars);f=f.body;}
        // Alpha-normalize free occurrences of these outer binders only.
        const names=new Map(vars.map((v,i)=>[v.name,prefix+i]));
        const rename=(node,bound=new Set())=>{
          if(Array.isArray(node))return node.map(x=>rename(x,bound));
          if(!node || typeof node!=='object')return node;
          if(node.t==='var')return {...node,name:bound.has(node.name)?node.name:names.get(node.name)??node.name};
          if(node.op==='forall'||node.op==='exists'){const nested=new Set([...bound,...node.vars.map(v=>v.name)]);return {...node,body:rename(node.body,nested)};}
          return Object.fromEntries(Object.entries(node).map(([k,v])=>[k,rename(v,bound)]));
        };
        const canonicalVars=vars.map((v,i)=>({name:prefix+i,sort:v.sort}));
        if(f.op!=='imp'){eligibility.push({claimId:id,status:'priority_only',reason:'Not an outer universal implication or ground implication.'});continue;}
        const antecedent=rename(f.a),exists=vars.length?{op:'exists',vars:canonicalVars,body:antecedent}:antecedent;
        // Entailment of not-exists means the antecedent cannot occur. Avoid
        // treating that vacuous inclusion as stronger applicability.
        if(await ctx.run(background,{op:'not',x:exists})==='unsat'){eligibility.push({claimId:id,status:'impossible_antecedent',reason:'Strict assumptions exclude this antecedent; no specificity edges are inferred.'});continue;}
        rules.set(id,{vars:canonicalVars,antecedent});eligibility.push({claimId:id,status:'logical_antecedent'});
      }
      const specificity=[];
      for(let i=0;i<defaults.length;i++)for(let j=i+1;j<defaults.length;j++) {
        const a=rules.get(defaults[i]),b=rules.get(defaults[j]);if(!a||!b||canonical(a.vars)!==canonical(b.vars))continue;
        const implication=(left,right)=>{const body={op:'imp',a:left.antecedent,b:right.antecedent};return left.vars.length?{op:'forall',vars:left.vars,body}:body;};
        const ab=await ctx.run(background,implication(a,b)),ba=await ctx.run(background,implication(b,a));
        if(ab==='unsat' && ba==='sat')specificity.push([defaults[i],defaults[j]]);
        if(ba==='unsat' && ab==='sat')specificity.push([defaults[j],defaults[i]]);
      }
  return {specificity,eligibility};
}
// Internal runner shared by the browser and Node worker. The unchanged Rust
// compiler and witness driver generate SMT; every query goes through the host's
// checked Z3 boundary. Defaults deliberately have their own versioned policy.
export function createReasoningRunner({engineFor,evalScript,limitsFor,runtime}) {
  function context(budgets) {
    const limits=limitsFor(budgets),start=Date.now();let steps=0;
    async function query(script) {
      requireThat(++steps<=limits.maxSteps,'Reasoning exceeded the step budget.','step_budget');
      requireThat(Date.now()-start<limits.wallTimeMs,'Reasoning exceeded the wall-clock budget.','timeout');
      const reply=await evalScript(script,limits);
      requireThat(Date.now()-start<limits.wallTimeMs,'Reasoning exceeded the wall-clock budget.','timeout');
      return reply;
    }
    async function run(ir,formula) {
      const engine=engineFor(ir);
      try {return (await query(formula?engine.smt_entails_json(JSON.stringify(formula)):engine.smt_check())).split('\n')[0];}
      finally {engine.free?.();}
    }
    return {limits,query,run,get steps(){return steps;}};
  }
  const stopped=(format,error)=>({format,status:'unsupported',complete:false,stopReason:error.reason??error.code??'error',reason:String(error.message??error)});
  async function witness(ir,evidence,budgets={}) {
    const ctx=context(budgets);let engine;
    try {
      validateIR(ir);closed(evidence,['targetClaimId','candidatePremiseIds'],'witness evidence');
      const target=ir.claims.find(c=>c.id===evidence.targetClaimId);requireThat(target,'Witness target must exist.');
      const ids=evidence.candidatePremiseIds??ir.claims.filter(c=>c.id!==target.id).map(c=>c.id);
      requireThat(Array.isArray(ids) && new Set(ids).size===ids.length && ids.every(id=>id!==target.id && ir.claims.some(c=>c.id===id)),'Witness candidates must be unique, present and exclude the conclusion.');
      const subset=keep=>({...clone(ir),claims:ir.claims.filter(c=>keep.includes(c.id)).map(clone)}),premises=subset(ids);
      const binding={inputDigest:await digest('ir',ir),targetDigest:await digest('formula',target.formula),targetClaimId:target.id,candidatePremiseIds:clone(ids),requestDigest:await digest('witness-request',{ir,evidence:{targetClaimId:target.id,candidatePremiseIds:ids}})};
      const finish=result=>({format:'wmt.explanation-witness/1',complete:true,stopReason:'completed',profile:LOGIC_PROFILE,limits:ctx.limits,steps:ctx.steps,runtime:clone(runtime),...binding,...result});
      if(await ctx.run(premises)!=='sat')return finish({status:'failed',reason:'Candidate premises are inconsistent; choose a coherent position or a smaller premise pool. Vacuous entailment is refused.',premiseClaimIds:[]});
      engine=engineFor(premises);engine.witness_begin(JSON.stringify(target.formula));
      for(let script=engine.witness_next();script;script=engine.witness_next())engine.witness_feed(await ctx.query(script));
      const result=JSON.parse(engine.witness_result());
      requireThat(['entailed','not_entailed'].includes(result.status),'Witness driver did not finish.','solver_unknown');
      if(result.status==='not_entailed')return finish({status:'failed',reason:'The target is not entailed by the candidate premises.',premiseClaimIds:[]});
      requireThat(Array.isArray(result.witness) && new Set(result.witness).size===result.witness.length && result.witness.every(id=>ids.includes(id)),'Invalid witness returned by the kernel.','binding_mismatch');
      let keep=clone(result.witness);
      requireThat(await ctx.run(subset(keep))==='sat' && await ctx.run(subset(keep),target.formula)==='unsat','Kernel witness failed independent consistency/entailment checks.','binding_mismatch');
      // Also handle the legacy driver's singleton early exit: a tautology has
      // an empty witness. A final deletion pass independently checks minimality.
      const necessity=[];
      for(const id of [...keep]) {
        const without=keep.filter(x=>x!==id);
        if(await ctx.run(subset(without),target.formula)==='unsat')keep=without;
        else necessity.push({removedClaimId:id,without:'not_entailed'});
      }
      return finish({status:'checked',reason:'A consistent, inclusion-minimal premise set entails the exact target. This is one witness, not all explanations or a minimum-cardinality explanation.',premiseClaimIds:keep,minimality:'inclusion',necessity});
    } catch(error){return stopped('wmt.explanation-witness/1',error);}
    finally {engine?.free?.();}
  }
  async function defeasible(ir,request,budgets={}) {
    const ctx=context(budgets);
    try {
      validateIR(ir);closed(request,['defaultClaimIds','targetClaimId','policy'],'defaults request');
      requireThat(request.policy===undefined || request.policy===DEFEASIBLE_POLICY,'Unknown defaults policy.');
      const defaults=request.defaultClaimIds,target=request.targetClaimId?ir.claims.find(c=>c.id===request.targetClaimId):null;
      requireThat(request.targetClaimId===undefined || target,'Conclusion must exist.');
      requireThat(Array.isArray(defaults) && new Set(defaults).size===defaults.length && defaults.every(id=>ir.claims.some(c=>c.id===id) && id!==target?.id),'Defaults must be unique, present and exclude the conclusion.');
      const strict=ir.claims.filter(c=>!defaults.includes(c.id) && c.id!==target?.id).map(c=>c.id),subset=ids=>({...clone(ir),claims:ir.claims.filter(c=>ids.includes(c.id)).map(clone)}),background=subset(strict);
      const binding={inputDigest:await digest('ir',ir),requestDigest:await digest('defeasible-request',{ir,defaultClaimIds:defaults,targetClaimId:target?.id??null,policy:DEFEASIBLE_POLICY}),policy:DEFEASIBLE_POLICY,defaultClaimIds:clone(defaults),strictClaimIds:strict,targetClaimId:target?.id??null};
      const finish=result=>({format:'wmt.defeasible-analysis/1',complete:true,stopReason:'completed',limits:ctx.limits,steps:ctx.steps,runtime:clone(runtime),...binding,...result,
        boundary:'One deterministic preferred consistent subtheory of whole formulas. Specificity uses strict-background logical inclusion of compatible rule antecedents; then weight and claim ID break ties. This does not enumerate all default extensions, implement arbitrary Reiter defaults, or prove a conclusion without its selected assumptions. Strict bucket admission still uses the full strict IR.'});
      if(await ctx.run(background)!=='sat')return finish({status:'strict_inconsistent',reason:'Strict assumptions conflict; defaults cannot repair them.',acceptedClaimIds:[],overridden:[],specificity:[],order:[],trace:[]});
      const {specificity,eligibility}=await defaultSpecificity(ir,defaults,background,ctx);
      const pending=new Set(defaults),order=[],byId=new Map(ir.claims.map(c=>[c.id,c]));
      while(pending.size) {
        const ready=[...pending].filter(id=>!specificity.some(([a,b])=>b===id && pending.has(a)));
        requireThat(ready.length,'Specificity cycle; no preferred order was selected.','invalid_specificity');
        ready.sort((a,b)=>(byId.get(b).weight??1)-(byId.get(a).weight??1)||(a<b?-1:a>b?1:0));
        order.push(ready[0]);pending.delete(ready[0]);
      }
      const accepted=[...strict],overridden=[],trace=[];
      for(const id of order) {
        if(await ctx.run(subset([...accepted,id]))==='sat'){accepted.push(id);trace.push({claimId:id,decision:'retained'});continue;}
        let group=[...accepted,id];
        for(const other of accepted) {const rest=group.filter(x=>x!==other);if(await ctx.run(subset(rest))==='unsat')group=rest;}
        overridden.push({claimId:id,conflict:group});trace.push({claimId:id,decision:'overridden',conflict:group});
      }
      let conclusion=null;
      if(target) {
        const positive=await ctx.run(subset(accepted),target.formula),negative=await ctx.run(subset(accepted),{op:'not',x:target.formula});
        conclusion={claimId:target.id,targetDigest:await digest('formula',target.formula),status:positive==='unsat'?'supported_in_selected_subtheory':negative==='unsat'?'refuted_in_selected_subtheory':'undetermined'};
      }
      return finish({status:'selected',reason:'Selected one consistent subtheory under the recorded priority policy.',acceptedClaimIds:accepted,overridden,specificity,specificityEligibility:eligibility,order,trace,conclusion});
    }catch(error){return stopped('wmt.defeasible-analysis/1',error);}
  }
  return {witness,defeasible};
}
