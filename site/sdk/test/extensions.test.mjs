import test from 'node:test';import assert from 'node:assert/strict';
import {client} from './helpers.mjs';import {clone,BucketRepository,createAnalysisRunner} from '../index.mjs';
import {readFile} from 'node:fs/promises';
const atom=(name,arg)=>({op:'pred',name,args:arg?[arg]:[]}),not=x=>({op:'not',x}),imp=(a,b)=>({op:'imp',a,b}),variable={t:'var',name:'x'},term=name=>({t:'app',name,args:[]});
const all=body=>({op:'forall',vars:[{name:'x',sort:'Entity'}],body});
export function entitiesExample(){return {sorts:['Entity'],preds:['Bird','Penguin','Fly','Quaker','Republican','Peace'].map(name=>({name,args:['Entity']})),funcs:['tweety','robin','nixon'].map(name=>({name,args:[],ret:'Entity'})),claims:[
 {id:'taxonomy',source:'Penguins are birds',formula:all(imp(atom('Penguin',variable),atom('Bird',variable)))},
 {id:'tweety_fact',source:'Tweety is a penguin',formula:atom('Penguin',term('tweety'))},
 {id:'robin_fact',source:'Robin is a bird',formula:atom('Bird',term('robin'))},
 {id:'quaker_fact',source:'Nixon is a Quaker',formula:atom('Quaker',term('nixon'))},
 {id:'republican_fact',source:'Nixon is a Republican',formula:atom('Republican',term('nixon'))},
 {id:'birds',source:'Birds normally fly',formula:all(imp(atom('Bird',variable),atom('Fly',variable)))},
 {id:'penguins',source:'Penguins normally do not fly',formula:all(imp(atom('Penguin',variable),not(atom('Fly',variable))))},
 {id:'quakers',source:'Quakers normally favour peace',formula:all(imp(atom('Quaker',variable),atom('Peace',variable)))},
 {id:'republicans',source:'Republicans normally oppose peace',formula:all(imp(atom('Republican',variable),not(atom('Peace',variable))))},
 {id:'target',source:'Nixon favours peace',formula:atom('Peace',term('nixon'))}
]};}
const request={defaultClaimIds:['birds','penguins','quakers','republicans'],targetClaimId:'target'};
const props=claims=>({sorts:[],preds:['P','Q','R'].map(name=>({name,args:[]})),funcs:[],claims:Object.entries(claims).map(([id,formula])=>({id,source:id,formula}))});
test('enumerates all normal extensions and per-entity exceptions; specificity preserves Robin and leaves genuine ties',async()=>{
 const input=entitiesExample(),r=await client.extensions(input,request);assert.equal(r.status,'enumerated',JSON.stringify(r));assert.equal(r.extensions.length,4);assert.equal(r.preferredExtensionIds.length,2);assert.equal(r.conclusion.preferred.skepticallySupported,false);assert.equal(r.conclusion.preferred.credulouslySupported,true);assert.equal(r.conclusion.preferred.refutedIn.length,1);
 assert(r.grounding.instances.every(g=>typeof g.renderedConclusion==='string'));
 const g=r.grounding.instances,robin=g.find(g=>g.sourceClaimId==='birds'&&g.bindings[0].entity==='robin').id,tweety=g.find(g=>g.sourceClaimId==='birds'&&g.bindings[0].entity==='tweety').id,penguin=g.find(g=>g.sourceClaimId==='penguins'&&g.bindings[0].entity==='tweety').id;
 for(const e of r.extensions.filter(e=>e.preferred)){assert(e.appliedInstanceIds.includes(robin));assert(e.appliedInstanceIds.includes(penguin));assert(e.blockedInstanceIds.includes(tweety));assert(e.blockingConflicts.some(c=>c.instanceId===tweety));assert.equal((await client.consistency(e.inputIR)).status,'consistent');}
 assert.equal(input.claims[5].defeasible,undefined);
});
test('normal defaults do not contrapose or self-support and allow support chains and unknown prerequisites',async()=>{
 let input=props({rule:imp(atom('P'),atom('Q'))}),r=await client.extensions(input,{defaultClaimIds:['rule'],entities:[]});assert.equal(r.status,'enumerated');assert.equal(r.extensions.length,1);assert.equal(r.extensions[0].inputIR.claims.length,0);assert.equal(r.extensions[0].notTriggeredInstanceIds.length,1);
 input=props({self:imp(atom('P'),atom('P')),pq:imp(atom('P'),atom('Q')),qp:imp(atom('Q'),atom('P'))});r=await client.extensions(input,{defaultClaimIds:['self','pq','qp'],entities:[]});assert.equal(r.extensions.length,1);assert.equal(r.extensions[0].appliedInstanceIds.length,0);
 input=props({start:atom('P'),rule:imp(atom('P'),atom('Q')),query:atom('Q')});r=await client.extensions(input,{defaultClaimIds:['start','rule'],targetClaimId:'query',entities:[]});assert.equal(r.extensions.length,1);assert.equal(r.extensions[0].conclusion.status,'supported');assert.equal(r.extensions[0].appliedInstanceIds.length,2);
 // Applying all initially compatible defaults would incorrectly miss Q & ¬P.
 input=props({p:atom('P'),q:atom('Q'),qp:imp(atom('Q'),not(atom('P')))});r=await client.extensions(input,{defaultClaimIds:['p','q','qp'],entities:[]});assert.equal(r.extensions.length,2,JSON.stringify(r));
});
test('strict inconsistency, incomplete grounding, unknown, cancellation and budgets never authorize extensions',async()=>{
 let r=await client.extensions(props({p:atom('P'),np:not(atom('P')),d:atom('Q')}),{defaultClaimIds:['d'],entities:[]});assert.equal(r.status,'strict_inconsistent');assert.deepEqual(r.extensions,[]);
 r=await client.extensions(entitiesExample(),{...request,entities:[]});assert.equal(r.stopReason,'missing_ground_domain');
 r=await client.extensions(entitiesExample(),request,{limits:{maxSteps:1}});assert.equal(r.complete,false);assert.deepEqual(r.extensions,[]);
 const controller=new AbortController();controller.abort();assert.equal((await client.extensions(entitiesExample(),request,{signal:controller.signal})).stopReason,'cancelled');
 const {default:init,WmtEngine}=await import('../runtime/wmt_core.js');await init({module_or_path:await readFile(new URL('../runtime/wmt_core_bg.wasm',import.meta.url))});const runner=createAnalysisRunner({createEngine:()=>new WmtEngine(),evaluate:async()=> 'unknown',runtime:{}});r=await runner.extensions(props({d:atom('P')}),{defaultClaimIds:['d'],entities:[]});assert.equal(r.complete,false);assert.deepEqual(r.extensions,[]);
});
test('extension receipts become separately checked immutable bucket forks; parent strict content and historical authority are preserved',async()=>{
 const repo=new BucketRepository(client),input=entitiesExample(),baseline=await repo.create({id:'base',name:'Strict baseline',owner:'me'}),opts={expectedVersion:1,expectedDigest:baseline.digest,actorId:'me',candidateIR:input,request};
 const receipt=await repo.enumerateDefaults('base',opts);assert.equal(receipt.result.status,'enumerated');const e=receipt.result.extensions.find(e=>e.preferred);
 const fork=await repo.forkExtension('base',{receiptId:receipt.id,extensionId:e.id,newId:'ext',name:'One selected position',actorId:'me',expectedVersion:1,expectedDigest:baseline.digest});assert.equal(fork.parent.digest,baseline.digest);assert.equal(fork.provenance.creationEvidence.status,'consistent');assert.equal(repo.get('base').version,1);assert.equal(fork.ir.claims.some(c=>c.id==='birds'),false);
 await assert.rejects(()=>repo.forkExtension('base',{receiptId:receipt.id,extensionId:'forged',newId:'bad',name:'Bad',actorId:'me',expectedVersion:1,expectedDigest:baseline.digest}),/enumerated extension/);
 const restored=new BucketRepository(client);await restored.restore(repo.export());await assert.rejects(()=>restored.forkExtension('base',{receiptId:receipt.id,extensionId:e.id,newId:'historical',name:'Historical',actorId:'me',expectedVersion:1,expectedDigest:baseline.digest}),/fresh extension receipt/);
 const strict=await repo.create({id:'strict',name:'Fixed assumptions',owner:'me',ir:{...input,claims:[input.claims[5]]}});await assert.rejects(()=>repo.enumerateDefaults('strict',{...opts,expectedDigest:strict.digest}),/Existing bucket assumptions remain strict/);
});
test('exhaustive subset/fixed-point oracle agrees with the search, including a three-way default conflict',async()=>{
 const {default:init,WmtEngine}=await import('../runtime/wmt_core.js'),{init:initZ3}=await import('z3-solver'),{lowLevelEvaluator,prepareGroundDefaults}=await import('../index.mjs');await init({module_or_path:await readFile(new URL('../runtime/wmt_core_bg.wasm',import.meta.url))});const z=await initZ3(),evaluate=lowLevelEvaluator(z.Z3);
 async function query(ir,formula){const e=new WmtEngine(),empty=!ir.claims.length;const value=empty?{...clone(ir),claims:[{id:'temp',source:'Temporary initializer',formula:{op:'eq',a:{t:'int',v:0},b:{t:'int',v:0}}}]}:ir;try{assert(JSON.parse(e.ingest(JSON.stringify(value))).ok);if(empty)e.remove('temp');return (await evaluate(formula?e.smt_entails_json(JSON.stringify(formula)):e.smt_check())).split('\n')[0];}finally{e.free();}}
 const theories=[
  {ir:props({p:atom('P'),q:atom('Q'),r:atom('R'),constraint:not({op:'and',xs:[atom('P'),atom('Q'),atom('R')]})}),ids:['p','q','r']},
  {ir:props({p:atom('P'),q:atom('Q'),qp:imp(atom('Q'),not(atom('P')))}),ids:['p','q','qp']},
  {ir:props({self:imp(atom('P'),atom('P')),pq:imp(atom('P'),atom('Q')),qp:imp(atom('Q'),atom('P'))}),ids:['self','pq','qp']},
  {ir:props({p:atom('P'),pq:imp(atom('P'),atom('Q')),qr:imp(atom('Q'),atom('R'))}),ids:['p','pq','qr']}
 ];
 for(const t of theories){const req={defaultClaimIds:t.ids,entities:[]},g=prepareGroundDefaults(t.ir,req),expected=new Set();
  for(let mask=0;mask<2**g.instances.length;mask++){const ids=g.instances.filter((_,i)=>mask&(1<<i)).map(g=>g.id),candidate=g.materialize(ids);if(await query(candidate)!=='sat')continue;
   let generated=[];for(;;){const additions=[];for(const rule of g.instances){if(generated.includes(rule.id))continue;if(await query({...clone(candidate),claims:[...candidate.claims,{id:'extra',source:'Oracle justification',formula:rule.conclusion}]})!=='sat')continue;if(await query(g.materialize(generated),rule.prerequisite)==='unsat')additions.push(rule.id);}if(!additions.length)break;generated.push(...additions);}
   const gamma=g.materialize(generated),left=[],right=[];for(const rule of g.instances){left.push(await query(candidate,rule.conclusion)==='unsat');right.push(await query(gamma,rule.conclusion)==='unsat');}if(JSON.stringify(left)===JSON.stringify(right))expected.add(g.instances.filter((_,i)=>left[i]).map(g=>g.id).join(','));
  }
  const actual=await client.extensions(t.ir,req);assert.equal(actual.status,'enumerated',JSON.stringify(actual));assert.deepEqual(new Set(actual.extensions.map(e=>e.consequentClaimIds.join(','))),expected);if(t.ids.includes('constraint'))assert.equal(actual.extensions.length,3);
 }
});
test('bucket admission uses its whole conjunction independently of repair enumeration',async()=>{
 const {demoPaper}=await import('./helpers.mjs');const paper=await demoPaper(),repo=new BucketRepository(client),b=await repo.create({id:'admission',name:'Full conjunction',owner:'me'});
 const first=await repo.submit(b.id,{submission:paper,actorId:'me',expectedVersion:1,expectedDigest:b.digest,idempotencyKey:'one',limits:{maxSteps:1}});assert.equal(first.receipt.outcome,'inserted');assert.equal(first.receipt.consistency.status,'consistent');
 const {controlledParser}=await import('../index.mjs');const strict=await repo.create({id:'conflict',name:'General bird rule',owner:'me',ir:await controlledParser()({id:'c_background',statement:'All birds are fliers.'})});
 for(const enumeratePositions of [false,true]){const r=await repo.submit(strict.id,{submission:paper,actorId:'me',expectedVersion:1,expectedDigest:strict.digest,idempotencyKey:String(enumeratePositions),enumeratePositions,limits:{maxSteps:1}});assert.equal(r.receipt.outcome,'conflict');assert.equal(r.receipt.consistency.status,'inconsistent');assert.equal(r.receipt.analysis.complete,false);assert.equal(repo.get(strict.id).version,1);const {toCastaliaAnalysis}=await import('../index.mjs');assert.equal(toCastaliaAnalysis(r.receipt,{id:'PAS-0001',targetId:'FMT-0001',snapshotId:'PMS-BOUNDED'}).status,'counterexample_found');const {coherenceModel}=await import('../../papers/coherence-view.mjs');const view=coherenceModel(r.receipt);assert.equal(view.verdict,'inconsistent');assert.equal(view.complete,false);assert.deepEqual(view.positions,[]);}
});
