import {closed,requireThat,clone,digest,canonical} from './hash.mjs';
import {validateIR,mergeIR} from './ir.mjs';
import {defaultSpecificity} from './reasoning.mjs';
export const EXTENSIONS_POLICY='wmt.named-normal-extensions/1';
const truth={op:'eq',a:{t:'int',v:0},b:{t:'int',v:0}};
const compare=(a,b)=>a<b?-1:a>b?1:0;
export function normalizeExtensionsRequest(ir,request) {
  validateIR(ir);closed(request,['defaultClaimIds','targetClaimId','entities','policy'],'extension request');
  requireThat(request.policy===undefined || request.policy===EXTENSIONS_POLICY,'Unknown extension policy.');
  const defaults=request.defaultClaimIds,target=request.targetClaimId??null;
  requireThat(target===null || ir.claims.some(c=>c.id===target),'Conclusion must exist.');
  requireThat(Array.isArray(defaults) && new Set(defaults).size===defaults.length && defaults.every(id=>id!==target && ir.claims.some(c=>c.id===id)),'Default IDs must be unique, present and exclude the query.');
  const entities=request.entities??ir.funcs.filter(f=>f.args.length===0).map(f=>({name:f.name,sort:f.ret}));
  requireThat(Array.isArray(entities) && entities.length<=64,'Choose at most 64 declared entity constants.','resource_limit');
  const seen=new Set();for(const e of entities){closed(e,['name','sort'],'ground entity');requireThat(!seen.has(e.name) && ir.funcs.some(f=>f.name===e.name && f.ret===e.sort && f.args.length===0),'Entities must be unique declared zero-argument constants with matching sorts.');seen.add(e.name);}
  return {policy:EXTENSIONS_POLICY,defaultClaimIds:[...defaults].sort(compare),targetClaimId:target,entities:clone(entities).sort((a,b)=>compare(a.name,b.name))};
}
export function prepareGroundDefaults(ir,request) {
  const normalized=normalizeExtensionsRequest(ir,request),strict=ir.claims.filter(c=>!normalized.defaultClaimIds.includes(c.id) && c.id!==normalized.targetClaimId).map(clone),instances=[];
  const occupied=new Set(ir.claims.map(c=>c.id));let prefix='c_ground_';while([...occupied].some(id=>id.startsWith(prefix)))prefix+='x_';
  for(const id of normalized.defaultClaimIds) {
    const source=ir.claims.find(c=>c.id===id);let body=source.formula,vars=[];
    while(body.op==='forall'){vars.push(...body.vars);body=body.body;}
    const domains=vars.map(v=>normalized.entities.filter(e=>e.sort===v.sort));
    requireThat(domains.every(d=>d.length),'Every outer universal variable needs an explicit nonempty named domain of its sort.','missing_ground_domain');
    const instantiate=(node,map,bound=new Set())=>{
      if(Array.isArray(node))return node.map(n=>instantiate(n,map,bound));if(!node || typeof node!=='object')return node;
      if(node.t==='var' && map.has(node.name) && !bound.has(node.name))return {t:'app',name:map.get(node.name),args:[]};
      if(node.op==='forall'||node.op==='exists')return {...node,body:instantiate(node.body,map,new Set([...bound,...node.vars.map(v=>v.name)]))};
      return Object.fromEntries(Object.entries(node).map(([k,v])=>[k,instantiate(v,map,bound)]));
    };
    function ground(i,bindings) {
      if(i<vars.length){for(const e of domains[i])ground(i+1,[...bindings,{variable:vars[i].name,sort:vars[i].sort,entity:e.name}]);return;}
      requireThat(strict.length+instances.length<64,'Grounded defaults plus strict claims exceed this SDK profile’s 64-formula limit; narrow the named domain.','resource_limit');
      const f=instantiate(body,new Map(bindings.map(b=>[b.variable,b.entity]))),instanceId=prefix+instances.length;
      instances.push({id:instanceId,sourceClaimId:id,bindings,weight:source.weight??1,
        prerequisite:f.op==='imp'?f.a:clone(truth),conclusion:f.op==='imp'?f.b:f,
        source:source.source+(bindings.length?' ['+bindings.map(b=>b.variable+'='+b.entity).join(', ')+']':'')});
    }
    ground(0,[]);
  }
  const background={...clone(ir),claims:strict};
  const instanceClaim=g=>({id:g.id,source:g.source,weight:g.weight,formula:clone(g.conclusion)});
  const materialize=ids=>({...clone(background),claims:[...strict.map(clone),...instances.filter(g=>ids.includes(g.id)).map(instanceClaim)]});
  validateIR(materialize(instances.map(g=>g.id)));
  return {normalized,background,instances,materialize};
}
export function createExtensionsRunner({engineFor,evalScript,limitsFor,runtime}) {
  async function extensions(ir,request,budgets={}) {
    const limits=limitsFor(budgets),started=Date.now();let steps=0,states=0;
    const tick=()=>{requireThat(++states<=limits.maxSteps,'Extension search exceeded its state budget.','step_budget');requireThat(Date.now()-started<limits.wallTimeMs,'Extension search exceeded its wall budget.','timeout');};
    const query=async script=>{requireThat(++steps<=limits.maxSteps,'Extension search exceeded its solver-call budget.','step_budget');requireThat(Date.now()-started<limits.wallTimeMs,'Extension search exceeded its wall budget.','timeout');const r=await evalScript(script,limits);requireThat(Date.now()-started<limits.wallTimeMs,'Extension search exceeded its wall budget.','timeout');return r;};
    const cache=new Map();
    async function run(input,formula){const key=canonical({claims:input.claims.map(c=>[c.id,c.formula]),formula:formula??null});if(cache.has(key))return cache.get(key);const e=engineFor(input);try{const out=(await query(formula?e.smt_entails_json(JSON.stringify(formula)):e.smt_check())).split('\n')[0];cache.set(key,out);return out;}finally{e.free?.();}}
    try {
      const {normalized,background,instances,materialize}=prepareGroundDefaults(ir,request),byId=new Map(instances.map(g=>[g.id,g])),target=ir.claims.find(c=>c.id===normalized.targetClaimId);
      const renderer=engineFor(materialize(instances.map(g=>g.id)));
      try{const reads=new Map(JSON.parse(renderer.meta()).claims.map(c=>[c.id,c.render]));for(const g of instances)g.renderedConclusion=reads.get(g.id)??null;}finally{renderer.free?.();}
      const binding={inputDigest:await digest('ir',ir),requestDigest:await digest('extension-request',{ir,request:normalized}),policy:EXTENSIONS_POLICY,request:normalized};
      const finish=value=>({format:'wmt.default-extensions/1',complete:true,stopReason:'completed',...binding,limits,steps,states,runtime:clone(runtime),grounding:{scope:'named_entities_only',entities:normalized.entities,strictClaimIds:background.claims.map(c=>c.id),instances},...value,
        boundary:'All grounded normal-default extensions for this named domain, not all unnamed first-order individuals. Each uses prerequisite : conclusion / conclusion. Preferred positions use explicit specificity strata and weight strata with set-inclusion preference, preserving ties. Bucket admission checks the full materialized conjunction independently.'});
      if(await run(background)!=='sat')return finish({status:'strict_inconsistent',extensions:[],preferredExtensionIds:[],specificity:[],priorityStrata:[],conclusion:null,reason:'Strict assumptions are inconsistent; no coherent extension is accepted.'});
      const {specificity,eligibility}=await defaultSpecificity(ir,normalized.defaultClaimIds,background,{run});
      // Ranked source priorities: specificity layers, then descending weight.
      // Equal priority is a true tie; lexical IDs only stabilize display order.
      const remaining=new Set(normalized.defaultClaimIds),strata=[];
      while(remaining.size){const ready=[...remaining].filter(id=>!specificity.some(([a,b])=>b===id && remaining.has(a)));requireThat(ready.length,'Specificity contains a cycle.','invalid_specificity');
        const weights=[...new Set(ready.map(id=>ir.claims.find(c=>c.id===id).weight??1))].sort((a,b)=>b-a);
        for(const weight of weights){const sources=ready.filter(id=>(ir.claims.find(c=>c.id===id).weight??1)===weight).sort(compare);strata.push(instances.filter(g=>sources.includes(g.sourceClaimId)).map(g=>g.id));}
        ready.forEach(id=>remaining.delete(id));}
      const allIds=instances.map(g=>g.id),globallyCompatible=await run(materialize(allIds))==='sat',visited=new Set(),found=new Map();
      const strictPrerequisites=new Set(),strictConsequents=new Set();
      for(const g of instances){if(await run(background,g.prerequisite)==='unsat')strictPrerequisites.add(g.id);if(await run(background,g.conclusion)==='unsat')strictConsequents.add(g.id);}
      async function search(selected,derivation) {
        tick();const theory=materialize(selected);
        // Closure over the finite consequent basis is a canonical theory key:
        // all candidates share W and are generated by those consequents.
        const entailed=[];for(const g of instances)if(selected.includes(g.id) || strictConsequents.has(g.id) || await run(theory,g.conclusion)==='unsat')entailed.push(g.id);
        const key=canonical(entailed);if(visited.has(key))return;visited.add(key);
        const applicable=[];
        for(const g of instances){if(entailed.includes(g.id))continue;if(!strictPrerequisites.has(g.id) && await run(theory,g.prerequisite)!=='unsat')continue;if(await run(materialize([...selected,g.id]))==='sat')applicable.push(g.id);}
        if(applicable.length){
          // If even all possible consequents are jointly SAT, no future rule
          // can defeat a currently triggered default: batch this unique closure.
          if(globallyCompatible){await search([...new Set([...selected,...applicable])],[...derivation,...applicable.map(id=>({instanceId:id,prerequisiteFrom:[...selected]}))]);}
          else for(const id of applicable)await search([...selected,id],[...derivation,{instanceId:id,prerequisiteFrom:[...selected]}]);
          return;
        }
        const applied=[],blocked=[],notTriggered=[];
        for(const g of instances){if(!strictPrerequisites.has(g.id) && await run(theory,g.prerequisite)!=='unsat'){notTriggered.push(g.id);continue;}if(entailed.includes(g.id))applied.push(g.id);else{requireThat(await run(theory,{op:'not',x:g.conclusion})==='unsat','An extension has an unresolved applicable default.','invalid_extension');blocked.push(g.id);}}
        // Independently reconstruct Gamma(E) from W with final justification
        // checks fixed to E. Reject self-supporting or unfinished candidates.
        let gamma=[];for(;;){const additions=[];const stage=materialize(gamma);for(const g of instances)if(applied.includes(g.id) && !gamma.includes(g.id) && (strictPrerequisites.has(g.id) || await run(stage,g.prerequisite)==='unsat'))additions.push(g.id);if(!additions.length)break;gamma=[...new Set([...gamma,...additions])];tick();}
        const gammaTheory=materialize(gamma);requireThat(await run(gammaTheory)==='sat','Reconstructed extension is inconsistent.','invalid_extension');
        for(const g of instances)requireThat((await run(gammaTheory,g.conclusion)==='unsat')===entailed.includes(g.id),'Candidate is not a normal-default fixed point.','invalid_extension');
        const inputIR=materialize(entailed),irDigest=await digest('ir',inputIR),extensionId='extension_'+await digest('normal-extension',{requestDigest:binding.requestDigest,irDigest});
        const blockers=[];for(const id of blocked){let group=[...inputIR.claims.map(c=>c.id),id].filter((v,i,a)=>a.indexOf(v)===i);
          const withRejected={...clone(inputIR),claims:[...inputIR.claims,{id,source:byId.get(id).source,formula:clone(byId.get(id).conclusion)}]};
          for(const other of group.filter(x=>x!==id)){const rest=group.filter(x=>x!==other);if(await run({...withRejected,claims:withRejected.claims.filter(c=>rest.includes(c.id))})==='unsat')group=rest;}
          blockers.push({instanceId:id,conflict:group});}
        let conclusion=null;if(target){const positive=await run(inputIR,target.formula),negative=await run(inputIR,{op:'not',x:target.formula});conclusion={claimId:target.id,targetDigest:await digest('formula',target.formula),status:positive==='unsat'?'supported':negative==='unsat'?'refuted':'undetermined'};}
        found.set(key,{id:extensionId,appliedInstanceIds:applied,blockedInstanceIds:blocked,notTriggeredInstanceIds:notTriggered,consequentClaimIds:entailed,derivation,blockingConflicts:blockers,conclusion,inputIR,irDigest,preferred:false});
      }
      await search([],[]);
      const results=[...found.values()].sort((a,b)=>compare(a.id,b.id));
      requireThat(results.length>0,'Normal-default search produced no verified coherent extension.','invalid_extension');
      function dominates(a,b){for(const rank of strata){const aa=a.appliedInstanceIds.filter(id=>rank.includes(id)),bb=b.appliedInstanceIds.filter(id=>rank.includes(id));if(canonical(aa)===canonical(bb))continue;return bb.every(id=>aa.includes(id)) && aa.length>bb.length;}return false;}
      for(const a of results)a.preferred=!results.some(b=>b!==a && dominates(b,a));
      const preferred=results.filter(a=>a.preferred);
      const acceptance=ids=>({inEvery:allIds.filter(id=>ids.every(e=>e.consequentClaimIds.includes(id))),inSome:allIds.filter(id=>ids.some(e=>e.consequentClaimIds.includes(id))),inNone:allIds.filter(id=>ids.every(e=>!e.consequentClaimIds.includes(id)))});
      const summarize=items=>target?{supportedIn:items.filter(e=>e.conclusion.status==='supported').map(e=>e.id),refutedIn:items.filter(e=>e.conclusion.status==='refuted').map(e=>e.id),undeterminedIn:items.filter(e=>e.conclusion.status==='undetermined').map(e=>e.id),skepticallySupported:items.length>0 && items.every(e=>e.conclusion.status==='supported'),credulouslySupported:items.some(e=>e.conclusion.status==='supported')}:null;
      return finish({status:'enumerated',reason:'Exhausted the grounded normal-default extension search and verified every fixed point.',extensions:results,preferredExtensionIds:preferred.map(e=>e.id),specificity,specificityEligibility:eligibility,priorityStrata:strata,acceptance:{all:acceptance(results),preferred:acceptance(preferred)},conclusion:{all:summarize(results),preferred:summarize(preferred)}});
    }catch(error){return {format:'wmt.default-extensions/1',status:'unsupported',complete:false,stopReason:error.reason??error.code??'error',reason:String(error.message??error),extensions:[],preferredExtensionIds:[]};}
  }
  return {extensions};
}
