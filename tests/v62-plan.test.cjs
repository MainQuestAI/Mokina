const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Domain execution only: no browser, URL navigation, network, images or localStorage files.
function runtime() {
  const context = vm.createContext({console, setTimeout, clearTimeout, structuredClone});
  const run = code => vm.runInContext(code, context);
  const load = file => run(fs.readFileSync(path.join(__dirname, '../src/demo-spacemaster-v6', file), 'utf8'));
  run(`window=globalThis;localStorage={getItem:()=>null,setItem:()=>{}};
    document={querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}};
    MERGED_ASSETS={actionIcons:{}};`);
  load('base/data.js'); load('base/core.js'); load('base/engine.js');
  run(`MODAL=null;DRAFTS={};
    render=()=>{};toast=(message)=>{globalThis.lastToast=message};
    function showModal(kind,arg){MODAL={kind,arg}} function closeModal(){MODAL=null}
    function handle(){} function renderBatchPanel(){} function messageHTML(){return ''}
    function canvasHTML(){return ''} function clearComposer(){}
    function ensureExperience(s){s.plans??=[];s.batches??=[];s.workModes??={};s.panelDrafts??={};return s}
    ensureExperience(S);EXPERIENCE={currentSource,taskFor};
    function demoProject(){return false} function demoRules(){return []}
    DEMO_PREVIOUS={rulesFor};
    function seed(id,channels=['web']){const p={id,name:id,productName:'Product '+id,model:id+'-model',category:'冰箱',market:id==='de'?'DE':'MX',language:id==='de'?'de-DE':'es-MX',channels,owner:'lin',tier:'Hero',threadId:id+'-chat',inputsReady:true,contextArtifacts:[]};S.projects.push(p);S.threads.push({id:p.threadId,projectId:id,messages:[],title:id});S.projectId=id;S.threadId=p.threadId;return p}
    seed('de');seed('mx',['retail']);S.projectId='de';S.threadId='de-chat';
    window.V62Inputs={projectSnapshot:id=>({id:id+'-facts-v1',product:{model:id+'-model'},facts:[{value:'known'}]}),inputReadiness:()=>({ready:true,contextRevision:1})};`);
  load('yolo.js'); load('unified-plan.js');
  run(`renderBatchPanel=()=>{};runWork=async(kind,done)=>{const result=await done();return {status:'done',...result}};`);
  return {run, context};
}

test('saving a plan creates no tasks or execution; channels determine the actual deliverables', () => {
  const {run} = runtime();
  const result = JSON.parse(run(`JSON.stringify((()=>{const a=ensureUnifiedPlan('de'),b=ensureUnifiedPlan('mx');return {de:a.kinds,mx:b.kinds,tasks:S.tasks.length,batches:S.batches.length,context:a.context}})())`));
  assert(result.de.includes('web')); assert(!result.de.includes('pop'));
  assert(result.mx.includes('pop')); assert(!result.mx.includes('web'));
  assert.equal(result.tasks, 0); assert.equal(result.batches, 0);
  assert.equal(result.context.inputSnapshotId, 'de-facts-v1');
});

test('current work is explicit and a repeated start reuses the same immutable batch', async () => {
  const {run} = runtime();
  await run(`const plan=ensureUnifiedPlan('de');plan.currentKind='strategy';
    const b1=confirmPlan(plan.id,'current');const b2=confirmPlan(plan.id,'current');
    globalThis.sameBatch=b1.id===b2.id;awaitPromise=batchPromise;`);
  await run('awaitPromise');
  assert.equal(run('sameBatch'), true);
  assert.equal(run('S.batches.length'), 1);
  assert.equal(run('S.batches[0].items.length'), 1);
  assert.equal(run('S.artifacts.length'), 1);
  run(`plan.goal='a later edit';project('de').name='later title';`);
  assert.notEqual(run('S.batches[0].plan.goal'), 'a later edit');
  assert.equal(run('S.batches[0].projectSnapshot.name'), 'de');
});

test('external dependency content and reference keep the same frozen version after navigation and adoption change', async () => {
  const {run} = runtime();
  run(`const original={id:'source',title:'FABE',kind:'fabe',projectId:'de',active:1,accepted:1,pending:null,versions:[{num:1,data:{points:[{id:'one',title:'original',selected:true}]},refs:[]},{num:2,data:{points:[{id:'two',title:'changed',selected:true}]},refs:[]}]};S.artifacts.push(original);
    const plan=ensureUnifiedPlan('de');plan.currentKind='mh';
    let release;let first=true;runWork=async(kind,done)=>{if(first){first=false;await new Promise(resolve=>release=resolve)}const value=await done();return {status:'done',...value}};
    const batch=confirmPlan(plan.id,'current');
    original.active=2;original.accepted=2;S.projectId='mx';S.threadId='mx-chat';release();`);
  await run('batchPromise');
  assert.equal(run(`byKind('mh','de').versions[0].data.points[0].title`), 'original');
  assert.equal(run(`byKind('mh','de').versions[0].refs[0].revision`), 1);
  assert.equal(run(`S.projectId`), 'mx');
  assert.equal(run(`byKind('mh','mx')`), undefined);
});

test('input and product changes require explicit synchronization, missing inputs never execute', () => {
  const {run} = runtime();
  run(`const plan=ensureUnifiedPlan('de');project('de').model='changed-model';`);
  assert(run(`validateUnifiedPlan(plan,'current').some(x=>x.includes('变化'))`));
  run(`plan.context=planProjectContext(project('de'));project('de').inputsReady=false;confirmPlan(plan.id,'current');`);
  assert.equal(run('S.batches.length'), 0);
  assert(run(`validateUnifiedPlan(plan,'current').some(x=>x.includes('产品资料'))`));
});

test('unknown historic deliverables stay visible and unsupported current work cannot start', () => {
  const {run} = runtime();
  run(`const plan=ensureUnifiedPlan('de');plan.kinds.push('retired-kind');plan.currentKind='unselected-kind';`);
  assert(run(`validateUnifiedPlan(plan,'current').some(x=>x.includes('暂不支持'))`));
  assert(run(`validateUnifiedPlan(plan,'current').some(x=>x.includes('不在本次交付范围'))`));
  assert(run(`plan.kinds.includes('retired-kind')`));
});

test('legacy migration is idempotent and never duplicates historical tasks or approvals', () => {
  const {run} = runtime();
  run(`project('de').scopeConfirmed=true;S.tasks.push({id:'old-task',projectId:'de',kind:'strategy'});S.submissions.push({id:'old-submission',status:'approved'});migrateUnifiedPlans(S);migrateUnifiedPlans(S);`);
  assert.equal(run(`S.plans.filter(p=>p.projectId==='de').length`), 1);
  assert.equal(run('S.tasks.length'), 1);
  assert.equal(run('S.submissions[0].status'), 'approved');
});

test('explicit source revocation during execution blocks result creation rather than trusting the frozen snapshot', async () => {
  const {run} = runtime();
  run(`let revoked=false;let release;
    V62Inputs.executionIssues=()=>revoked?['来源已失效，请补充有效依据。']:[];
    runWork=async(kind,done)=>{await new Promise(resolve=>release=resolve);return done()};
    const p=ensureUnifiedPlan('de');p.currentKind='strategy';const b=confirmPlan(p.id,'current');revoked=true;release();`);
  await run('batchPromise');
  assert.equal(run('S.artifacts.length'), 0);
  assert.equal(run('S.batches[0].items[0].status'), 'failed');
  assert.match(run('S.batches[0].items[0].error'), /失效/);
});
