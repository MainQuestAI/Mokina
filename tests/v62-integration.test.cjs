/* Domain integration only: no browser, DOM engine, HTTP, image decode, or model.
 * All build modules are loaded in their actual order. Rendering, animation waits,
 * typing presentation and image decoding are stubbed; business functions and the
 * 21-step story (including autoRequest message writes) execute without replacement.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'src/demo-spacemaster-v6');
const productCopy=vm.runInNewContext(fs.readFileSync(path.join(dir,'product-copy.mjs'),'utf8').replace('export function productCopy','function productCopy')+'\nproductCopy;');

function harness() {
  const build=fs.readFileSync(path.join(dir,'build.mjs'),'utf8');
  const base=JSON.parse(build.match(/const parts=(\[[^\n]+\]);/)[1].replaceAll("'",'"')).map(x=>'base/'+x+'.js');
  const additions=JSON.parse(build.match(/\['merged\.js'[^\n]+?'release-policy\.js'\]/)[0].replaceAll("'",'"'));
  const modules=[...base,...additions],toasts=[];
  const dock={innerHTML:'',hidden:false,className:'',querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},setAttribute(){}};
  const document={addEventListener(){},removeEventListener(){},querySelector:selector=>selector==='#modal-root'?dock:null,querySelectorAll:()=>[],getElementById:()=>null,body:{appendChild(){}},documentElement:{dataset:{}},fonts:{ready:Promise.resolve()},activeElement:null};
  const assets={images:{},logo:'',actionIcons:{},scenarios:{},demoImages:JSON.parse(fs.readFileSync(path.join(root,'public/demo-spacemaster-v6/manifest.json'),'utf8'))};
  const context={document,window:{addEventListener(){}},MERGED_ASSETS:assets,localStorage:{getItem:()=>null,setItem(){}},console,setTimeout,clearTimeout,URL,FormData,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s).toString('base64'),Uint8Array,TextEncoder,TextDecoder,requestAnimationFrame:cb=>cb(),innerWidth:1200,HTMLElement:class{},ResizeObserver:class{observe(){}disconnect(){}},MutationObserver:class{observe(){}disconnect(){}},Pretext:{},toasts};
  vm.createContext(context);
  for(const name of modules)vm.runInContext(productCopy(fs.readFileSync(path.join(dir,name),'utf8')),context,{filename:name});
  const run=code=>vm.runInContext(code,context);
  run(`
    render=()=>{};renderModal=()=>{};renderBatchPanel=()=>{};scheduleText=()=>{};mountDock=()=>{};
    toast=(message,error)=>toasts.push({message,error});
    wait=async()=>{};autoWait=async()=>{};autoTypeInput=async()=>{};
    typeText=async(obj,key,text)=>{obj[key]=text};prepareImageStep=async()=>{};
    openCanvas=(id,num)=>{const a=artifact(id);S.canvas={id,num:num||a.pending||a.active,tab:'content'};};
  `);
  return {context,run,state:run('S'),modules,toasts};
}

test('full build chain initializes V6 schema and keeps migrations idempotent',()=>{
  const h=harness();assert.deepEqual(h.modules.slice(-4),['project-input.js','decision-refinement.js','workflow-branches.js','release-policy.js']);
  assert.equal(h.run('RELEASE_VERSION'),'6.2.0');assert.equal(h.run('APP_VERSION'),'6.0.0-spacemaster-demo');assert.equal(h.state.schema,'6.0.0-spacemaster-demo');
  const initial=JSON.stringify(h.state.inputSnapshots),projects=h.state.projects.length;
  h.run('ensureExperience(S);window.V62Inputs.ensure(S);window.V62Workflows.ensure(S);');
  assert.equal(h.state.projects.length,projects);assert.equal(JSON.stringify(h.state.inputSnapshots),initial);assert.equal(h.run('window.V62Inputs.inputReadiness("spacemaster-de").ready'),true);
});

test('21 story steps preserve fixed German internal reviews without duplicate messages or fake receipts',async()=>{
  const h=harness();h.run('S.auto={active:true,index:0};');assert.equal(h.run('AUTO_STEPS.length'),21);
  const traces=[];
  for(let index=0;index<21;index++){
    const name=h.run(`AUTO_STEPS[${index}].name`);
    await assert.doesNotReject(()=>h.run(`AUTO_STEPS[${index}].do()`),name);
    traces.push({step:index+1,name,projectId:h.state.projectId,threadId:h.state.threadId});
    assert.equal(h.state.threadId,'spacemaster-de-chat',name+' changed the active conversation');
    if(index<19)assert.equal(h.state.projectId,'spacemaster-de',name+' changed project context');
  }
  assert.equal(h.state.batches.length,7);assert.ok(h.state.batches.every(b=>b.status==='reviewed'));
  assert.equal(h.state.artifacts.length,8);assert.equal(h.state.submissions.length,2);
  const [returned,approved]=h.state.submissions;
  assert.equal(returned.status,'returned');assert.equal(approved.status,'approved');assert.ok(approved.revision>returned.revision);
  for(const s of h.state.submissions){assert.equal(s.approvalScope,'internal-review');assert.deepEqual([...s.deliveryScope.members],['K09']);assert.equal(s.deliveryScope.country,'DE');assert.equal(s.deliveryScope.language,'de-DE');assert.equal(s.snapshot.num,s.revision);}
  assert.equal(h.state.deliveries.length,0);assert.equal(h.state.libraryPushes.length,0);
  const messages=h.state.threads.find(t=>t.id==='spacemaster-de-chat').messages.filter(m=>m.role==='user');
  assert.equal(messages.length,13);assert.equal(new Set(messages.map(m=>m.text)).size,messages.length);
  assert.ok(h.state.threads.filter(t=>t.id!=='spacemaster-de-chat').every(t=>!t.messages.some(m=>m.role==='user')));
  assert.equal(h.state.projects.find(p=>p.id==='spacemaster-de').threadId,'spacemaster-de-chat');
  assert.equal(h.state.threadId,'spacemaster-de-chat');
  assert.equal(h.state.projectId,'spacemaster-de');
  assert.equal(h.state.view,'tasks');
  assert.ok(h.state.workflowBranches.jobs.every(j=>!j.externalVerified));
  assert.equal(h.toasts.filter(x=>x.error).length,0,JSON.stringify(h.toasts));
});

test('new product input and decision wrappers produce an editable internal draft with fixed evidence',async()=>{
  const h=harness();h.run(`
    const custom={id:'custom-product',threadId:'custom-chat',name:'清泉法国官网项目',productName:'清泉',category:'洗碗机',model:'DW-42',market:'FR',language:'fr-FR',channels:['web'],goal:'准备本产品官网资料',tier:'Hero',owner:'lin',inputsReady:false,scopeConfirmed:false};
    S.projects.push(custom);S.threads.push({id:'custom-chat',projectId:custom.id,messages:[]});S.projectId=custom.id;S.threadId=custom.threadId;
    window.V62Inputs.ensure(S);
    const evidence=window.V62Inputs.verifyEvidence(custom.id,{sourceType:'manual',sourceName:'产品手册',excerpt:'DW-42 洗碗机配有可调整的上层篮架，按餐具高度配置。',locator:'第3页',model:'DW-42',market:'FR',category:'product',confirmed:true});
    window.V62Inputs.saveSnapshot(custom.id,[evidence.id]);
    const plan=ensureUnifiedPlan(custom.id,'collaborate');plan.currentKind='strategy';
    confirmPlan(plan.id,'current');
  `);await h.run('batchPromise');
  const a=h.state.artifacts.find(a=>a.projectId==='custom-product');assert.ok(a);assert.equal(a.versions[0].data.projectInputDraft,true);assert.doesNotMatch(JSON.stringify(a.versions[0].data),/570 L|SpaceMaster|MDRS761|es-MX/);
  const check=h.run(`inspectContent(artifact('${a.id}'),revision(artifact('${a.id}'),1))`);assert.equal(check.passed,true);assert.equal(check.formalReady,false);
  assert.match(h.run(`v62ScopeReason(artifact('${a.id}'),revision(artifact('${a.id}'),1),'formal-use')`),/结构化草稿|正式/);
  h.run(`adopt('${a.id}',1);S.canvas={id:'${a.id}',num:1};S.contextSelection={artifactId:'${a.id}',revision:1,section:'goal'};`);
  await h.run(`sendPrompt('请把这段改为：先验证首次购买者的使用需求。')`);
  const snapshot=JSON.stringify(a.versions[0].data.inputSnapshot);const v=h.run(`window.V62Inputs.saveDraftEdit('${a.id}',1,S.v62DraftEditor)`);
  assert.equal(v.num,2);assert.equal(a.accepted,1);assert.equal(a.pending,2);assert.equal(JSON.stringify(v.data.inputSnapshot),snapshot);assert.match(v.data.sections.find(s=>s.id==='goal').body,/首次购买者/);assert.equal(h.state.plans.length,1);
});
