const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'../src/demo-spacemaster-v6',name),'utf8');

test('an unconfirmed enterprise contract cannot be converted into formal approval by a local clean check',()=>{
  const c=vm.createContext({});
  vm.runInContext(`window=globalThis;RELEASE_VERSION='6.2.0';renderModal=()=>{};handle=()=>{};planPanelHTML=()=>'';v62ScopeReason=()=>'';taskRow=()=>'<span>进行中</span>';decisionCompletion=()=>'';`,c);
  vm.runInContext(source('release-policy.js'),c);
  assert.equal(vm.runInContext(`V62Policy.scopeReason({}, {}, 'internal-review')`,c),'');
  assert.match(vm.runInContext(`V62Policy.scopeReason({}, {}, 'formal-use')`,c),/合同尚待确认/);
  assert.match(vm.runInContext(`taskRow({status:'working',internalReview:{status:'approved'}})`,c),/待正式使用确认/);
});

test('the story finishing its chapters does not claim business tasks or delivery have completed',async()=>{
  const c=vm.createContext({console,setTimeout});
  vm.runInContext(`window=globalThis;S={runId:null,settings:{},tasks:[]};clone=x=>JSON.parse(JSON.stringify(x));now=()=>new Date().toISOString();render=()=>{};persist=()=>{};closeModal=()=>{};toast=t=>globalThis.lastToast=t;resetState=()=>{S={settings:{},tasks:[{status:'working'}]}};`,c);
  vm.runInContext(source('base/auto.js'),c);
  vm.runInContext(`AUTO_STEPS.splice(0,AUTO_STEPS.length,{do:async()=>{}},{do:async()=>{}});autoWait=async()=>{};`,c);
  await vm.runInContext('startAuto()',c);
  assert.equal(vm.runInContext('S.auto.completed',c),true);
  assert.equal(vm.runInContext('S.auto.businessComplete',c),false);
  assert.match(vm.runInContext('lastToast',c),/分别查看/);
});

test('a failed chapter stays incomplete and retains the actionable error',async()=>{
  const c=vm.createContext({console:{error:()=>{}},setTimeout});
  vm.runInContext(`window=globalThis;S={runId:null,settings:{},tasks:[]};clone=x=>JSON.parse(JSON.stringify(x));now=()=>new Date().toISOString();render=()=>{};persist=()=>{};closeModal=()=>{};toast=t=>globalThis.lastToast=t;resetState=()=>{S={settings:{},tasks:[]}};`,c);
  vm.runInContext(source('base/auto.js'),c);
  vm.runInContext(`AUTO_STEPS.splice(0,AUTO_STEPS.length,{do:async()=>{throw Error('来源已失效')}});autoWait=async()=>{};`,c);
  await vm.runInContext('startAuto()',c);
  assert.notEqual(vm.runInContext('S.auto.completed',c),true);
  assert.match(vm.runInContext('lastToast',c),/来源已失效/);
});
