const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname,'../src/demo-spacemaster-v6/project-input.js'),'utf8');
const product = (id='p1',overrides={}) => ({id,threadId:id+'-chat',name:'清泉洗碗机法国上市',productName:'清泉',category:'洗碗机',model:'DW-42',market:'FR',language:'fr-FR',channels:['web'],goal:'准备官网介绍',tier:'Hero',owner:'lin',inputsReady:false,scopeConfirmed:true,...overrides});
function setup(projects=[product(),product('p2',{name:'另一产品',model:'AC-2',category:'空调'})]) {
  const state={projects,actor:'lin',projectId:projects[0]?.id||null,threadId:projects[0]?.threadId||'personal',threads:[...projects.map(p=>({id:p.threadId,projectId:p.id,messages:[]})),{id:'personal',projectId:null,messages:[]}],uploads:[],tasks:[],artifacts:[],submissions:[],plans:[],batches:[],settings:{}};
  const calls=[],listeners={};let sequence=0;
  const document={addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn),querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null};
  const context={S:state,document,window:{},URL,FormData,console,Set,JSON,Date,String,Error,PRODUCT:{model:'MDRS761MYM45A'},SOURCES:[{id:'P01',name:'墨西哥产品样例',text:'SpaceMaster MDRS761MYM45A 产品资料'},{id:'P02',name:'附件',text:'570 L / Counter Depth'}],deSources:[['DE01','德国示例','SpaceMaster 德国输入说明']],PEOPLE:{lin:{name:'李林'},ana:{name:'Ana'}},CHANNEL:{web:'品牌官网',retail:'线下门店',ecom:'电商'},KIND:Object.fromEntries(['strategy','fabe','mh','assets','web','pop','ecom','notes','research','productImages','scene','featureImages','websitePoster'].map(k=>[k,{name:k,domain:'strategy'}])),BATCH_DEPS:{strategy:[],assets:[],fabe:['strategy'],mh:['fabe'],web:['mh','assets'],pop:['mh','assets']},MODAL:null,executingBatch:null,attachedIds:[],storageWarning:false,now:()=> '2026-09-12T10:00:00.000Z',uid:p=>p+'-'+(++sequence),E:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),icon:()=>'<svg></svg>',button:(label,action,arg)=>`<button data-action="${action}" data-arg="${arg}">${label}</button>`,tag:label=>`<span>${label}</span>`,render:()=>{},persist:()=>{},clearComposer:()=>{},requestAnimationFrame:fn=>fn(),closeModal:()=>{context.MODAL=null},toast:(message,error)=>calls.push({type:'toast',message,error}),openProjectCreation:()=>calls.push({type:'create-form'}),openUnifiedPlan:pid=>calls.push({type:'plan',pid}),makeState:()=>state,ensureExperience:s=>s,handle:(...args)=>calls.push({type:'old-handle',args}),showModal:(...args)=>calls.push({type:'old-modal',args}),filesHTML:()=>'<p>旧资料</p>',projectInfoHTML:()=>'<p>旧背景</p>',sendPrompt:text=>{calls.push({type:'old-prompt',text});state.projectId='spacemaster-de';},makeContent:kind=>({title:'fixture',kind,summary:'570 L 冰箱'}),runSpec:kind=>({name:kind,sources:[],steps:[]}),contentHTML:()=>'<p>旧正文</p>',refsHTML:()=>'<p>旧来源</p>',generate:kind=>calls.push({type:'old-generate',kind}),projectPlanRules:()=>[{kind:'strategy',requirement:'草稿'},{kind:'web',requirement:'官网'},{kind:'pop',requirement:'线下'},{kind:'ecom',requirement:'电商'}],inspectContent:()=>({passed:true,findings:[]}),checkBatchDraft:()=>({passed:true,findings:[]}),artifactEvidenceCount:()=>0};
  context.project=(pid=state.projectId)=>state.projects.find(p=>p.id===pid);
  context.taskFor=(kind,pid)=>state.tasks.find(t=>t.kind===kind&&t.projectId===pid);
  context.byKind=(kind,pid=state.projectId)=>state.artifacts.filter(a=>a.kind===kind&&a.projectId===pid).at(-1);
  context.addMsg=(role,text,extra={})=>{state.threads.find(t=>t.id===state.threadId).messages.push({role,text,...extra});};
  context.sourceRefs=()=>[];
  context.versionFiles=()=>({'fixture.txt':'570 L 冰箱'});
  context.documentText=(a,v)=>JSON.stringify(v.data);
  context.modifySelected=()=>calls.push({type:'old-modify',text:'Espacio para tu día a día.'});
  context.artifact=id=>state.artifacts.find(a=>a.id===id);
  context.revision=(a,num)=>a?.versions.find(v=>v.num===Number(num));
  context.canWrite=a=>state.actor!=='reviewer'&&(state.tasks.find(t=>t.id===a.taskId)?.assignee||state.projects.find(p=>p.id===a.projectId)?.owner)===state.actor;
  context.openCanvas=(id,num)=>{state.canvas={id,num,tab:'content'};};
  context.newArtifact=(kind,data,pid,refs,tid)=>{const a={id:'artifact-'+(++sequence),kind,projectId:pid,threadId:tid,title:data.title,versions:[{num:1,data,refs}],active:1};state.artifacts.push(a);return a;};
  context.addRevision=(a,data,note,refs)=>{const v={num:a.versions.length+1,data,note,refs};a.versions.push(v);a.pending=v.num;return v;};
  context.runWork=(kind,done)=>{calls.push({type:'run',kind});return done();};
  vm.createContext(context);vm.runInContext(source,context);
  return {context,state,calls,api:context.window.V62Inputs,listeners};
}
const evidenceInput=(overrides={})=>({sourceType:'manual',sourceName:'DW-42 产品手册',excerpt:'DW-42 洗碗机配有可调节上层篮架，说明书规定可按餐具高度调整。',locator:'第 3 页，篮架说明',model:'DW-42',market:'FR',category:'product',confirmed:true,...overrides});
function confirm(h,pid='p1',overrides={}) {const e=h.api.verifyEvidence(pid,evidenceInput(overrides));return {e,snapshot:h.api.saveSnapshot(pid,[e.id])};}

test('上传文本在本项目显示，上传本身不产生就绪或事实确认',async()=>{
  const h=setup();await h.context.handleFiles([{name:'DW-42.txt',size:100,type:'text/plain',text:async()=>evidenceInput().excerpt}]);
  assert.equal(h.state.uploads.length,1);assert.equal(h.state.uploads[0].projectId,'p1');assert.equal(h.api.inputReadiness('p1').ready,false);assert.equal(h.state.inputEvidence.length,0);
  const html=h.context.filesHTML();assert.match(html,/DW-42.txt/);assert.match(html,/本地正文已读取/);assert.doesNotMatch(html,/AC-2.*已读取/);
});
test('已读取文本只能核对正文中的摘录，拒绝不存在的事实或另一个项目的文件',()=>{
  const h=setup();h.state.uploads.push({id:'u1',projectId:'p1',name:'产品说明.txt',text:evidenceInput().excerpt});
  assert.throws(()=>h.api.verifyEvidence('p1',evidenceInput({sourceType:'upload',sourceId:'u1',excerpt:'这段没有出现在原始资料正文，不能核对成产品事实。'})),/与已读取正文不一致/);
  assert.throws(()=>h.api.verifyEvidence('p2',evidenceInput({sourceType:'upload',sourceId:'u1',model:'AC-2'})),/当前项目/);
  const e=h.api.verifyEvidence('p1',evidenceInput({sourceType:'upload',sourceId:'u1'}));assert.equal(e.captureMethod,'local-text-excerpt');
});
test('新项目必须有具体产品证据，市场和竞品摘录不能单独放行',()=>{
  const h=setup();assert.throws(()=>h.api.saveSnapshot('p1',[]),/产品事实证据/);
  assert.throws(()=>h.api.verifyEvidence('p1',evidenceInput({confirmed:false})),/勾选核对声明/);
  const e=h.api.verifyEvidence('p1',evidenceInput({category:'competitor'}));assert.throws(()=>h.api.saveSnapshot('p1',[e.id]),/竞品或市场材料/);
  assert.throws(()=>h.api.verifyEvidence('p1',evidenceInput({model:'DW-43'})),/具体产品型号/);
});
test('保存快照后就绪，重复保存同一组不重复版本；返回值不能改内部快照',()=>{
  const h=setup(),{e,snapshot}=confirm(h);assert.equal(h.api.inputReadiness('p1').ready,true);assert.equal(h.state.projects[0].inputsReady,true);
  assert.equal(h.api.saveSnapshot('p1',[e.id]).id,snapshot.id);assert.equal(h.state.inputSnapshots.length,1);
  snapshot.evidence[0].excerpt='被外部调用者改掉';assert.notEqual(h.api.projectSnapshot('p1').evidence[0].excerpt,snapshot.evidence[0].excerpt);
});
test('字段修改列影响并使新输入待核对，旧批次与快照内容不改变',()=>{
  const h=setup(),{snapshot}=confirm(h);h.state.batches.push({id:'b1',projectId:'p1',status:'running',inputSnapshot:snapshot});h.state.artifacts.push({id:'a1',projectId:'p1',title:'已有策略'});
  const frozen=JSON.stringify(h.state.batches[0]),old=JSON.stringify(h.state.inputSnapshots[0]);
  const data={...h.state.projects[0],market:'BE',language:'nl-BE',channels:['retail']};const impact=h.api.saveContext('p1',data);
  assert.equal(impact.batches.length,1);assert.equal(impact.artifacts.length,1);assert.equal(h.api.inputReadiness('p1').ready,false);
  assert.equal(JSON.stringify(h.state.batches[0]),frozen);assert.equal(JSON.stringify(h.state.inputSnapshots[0]),old);assert.equal(h.api.executionIssues(h.state.batches[0]).length,0);
  const next=confirm(h,'p1',{market:'BE'}).snapshot;assert.equal(next.version,2);assert.equal(h.api.inputReadiness('p1').ready,true);
});
test('仅项目负责人可以修订字段、核对来源、保存或撤销证据资格',()=>{
  const h=setup(),{e}=confirm(h);h.state.actor='ana';
  for(const fn of [()=>h.api.saveContext('p1',h.state.projects[0]),()=>h.api.verifyEvidence('p1',evidenceInput()),()=>h.api.saveSnapshot('p1',[e.id]),()=>h.api.invalidateEvidence('p1',e.id,'型号不适用'),()=>h.api.registerExternal('p1',{title:'资料',url:'https://example.com'})])assert.throws(fn,/仅项目负责人/);
});
test('外部来源登记与核对分开，引用快照含手工摘录和来源网址',()=>{
  const h=setup(),s=h.api.registerExternal('p1',{title:'产品网页',url:'https://example.com/dw42'});assert.equal(s.status,'待核验');assert.equal(h.api.inputReadiness('p1').ready,false);
  const e=h.api.verifyEvidence('p1',evidenceInput({sourceType:'external',sourceId:s.id,locator:'技术规格章节'}));const snap=h.api.saveSnapshot('p1',[e.id]);
  assert.equal(snap.evidence[0].url,s.url);assert.equal(snap.evidence[0].captureMethod,'manual-excerpt');assert.throws(()=>h.api.registerExternal('p1',{title:'注入',url:'javascript:alert(1)'}),/http 或 https/);
});
test('资料失效动态阻止旧批次使用，普通新版本不冒充撤权',()=>{
  const h=setup(),{e,snapshot}=confirm(h),batch={projectId:'p1',inputSnapshot:snapshot};assert.equal(h.api.executionIssues(batch).length,0);
  h.api.invalidateEvidence('p1',e.id,'供应商确认该功能属于旧型号');assert.equal(h.api.inputReadiness('p1').ready,false);assert.equal(h.api.executionIssues(batch).length,1);assert.equal(snapshot.evidence[0].status,'verified');
  assert.match(h.api.executionIssues(batch)[0],/现已失效或需复核/);
});
test('个人输入不再静默关联德国，文字创建与按钮共享创建表单',async()=>{
  const h=setup();h.state.projectId=null;h.state.threadId='personal';
  for(const text of ['SpaceMaster 墨西哥上市','德国竞品研究','六视角怎么准备']){await h.context.sendPrompt(text);assert.equal(h.state.projectId,null);assert.equal(h.state.threads.at(-1).projectId,null);}
  assert.equal(h.calls.filter(c=>c.type==='old-prompt').length,0);
  await h.context.sendPrompt('帮我创建清泉洗碗机法国上市项目');assert.equal(h.calls.at(-1).type,'create-form');assert.equal(h.state.projects.length,2);assert.equal(h.api.creationIntent('不用创建项目，先研究'),false);
});
test('新产品全部交付只能使用本项目快照，不借用冰箱参数或图像',()=>{
  const h=setup(),{snapshot}=confirm(h);
  for(const kind of ['strategy','fabe','mh','assets','web','pop','ecom','productImages']){const d=h.context.makeContent(kind);assert.equal(d.projectInputDraft,true);assert.equal(d.inputSnapshot.id,snapshot.id);assert.equal(d.imageGenerated,false);assert.doesNotMatch(JSON.stringify(d),/570 L|SpaceMaster|MDRS761|es-MX|冰箱/);assert.match(JSON.stringify(d),/DW-42/);assert.equal(h.context.inspectContent({kind,id:'a'}, {num:1,data:d}).passed,true);}
});
test('生成期间继续读启动快照，项目新版本和其他项目导航不改变旧正文',()=>{
  const h=setup(),{snapshot}=confirm(h);h.context.executingBatch={projectId:'p1',inputSnapshot:snapshot};
  h.api.saveContext('p1',{...h.state.projects[0],model:'DW-43'});confirm(h,'p1',{model:'DW-43',excerpt:'DW-43 洗碗机配有独立下层篮架，新型号事实记录。'});
  const d=h.context.makeContent('strategy');assert.equal(d.inputSnapshot.context.model,'DW-42');assert.doesNotMatch(JSON.stringify(d),/DW-43/);
  h.context.executingBatch=null;assert.equal(h.context.makeContent('strategy').inputSnapshot.context.model,'DW-43');
});
test('德国与历史墨西哥 fixture 迁移幂等，保留旧成果和提交记录',()=>{
  const de=product('spacemaster-de',{demoScenario:'spacemaster-de',productName:'SpaceMaster',category:'冰箱',model:'MDRS761MYM45A',market:'DE',language:'de-DE',inputsReady:true});
  const mx=product('old-mx',{productName:undefined,category:'冰箱',model:'MDRS761MYM45A',market:'MX',language:'es-MX',inputsReady:undefined});
  const h=setup([de,mx]);h.state.submissions.push({id:'s1',status:'approved'});const ids=h.state.inputSnapshots.map(x=>x.id);h.api.ensure(h.state);h.api.ensure(h.state);
  assert.deepEqual(h.state.inputSnapshots.map(x=>x.id),ids);assert.equal(h.api.inputReadiness(de.id).ready,true);assert.equal(h.api.inputReadiness(mx.id).ready,true);assert.equal(h.state.submissions[0].status,'approved');
});
test('单渠道项目不出现其他渠道交付，也不能直接调用其他渠道制作',()=>{
  const h=setup();confirm(h);const kinds=h.context.projectPlanRules('p1').map(r=>r.kind);assert.deepEqual([...kinds],['strategy','web']);h.context.generate('pop');assert.match(h.calls.at(-1).message,/未选择该渠道/);
});
test('上传部分失败逐项保留原因，异步读取始终登记到开始选择的项目',async()=>{
  const h=setup();let resolveText;const textPromise=new Promise(resolve=>resolveText=resolve);const pending=h.context.handleFiles([{name:'过大.pdf',size:4*1024*1024,type:'application/pdf'},{name:'DW-42.txt',size:100,type:'text/plain',text:()=>textPromise},{name:'坏文件.txt',size:100,type:'text/plain',text:async()=>{throw Error('文件被移除')}}]);
  h.state.projectId='p2';resolveText(evidenceInput().excerpt);const result=await pending;
  assert.equal(result.added,1);assert.equal(result.failed,2);assert.equal(h.state.uploads[0].projectId,'p1');assert.equal(h.state.inputUploadAttempts.filter(x=>x.status==='failed').length,2);assert.equal(h.state.projects[0].inputsReady,false);
});
test('个人查看其他项目背景仍走辅助面板，只有编辑进入资料工作区',async()=>{
  const h=setup();await h.context.handle('context','p2');assert.equal(h.calls.at(-1).type,'old-handle');assert.equal(h.state.projectId,'p1');h.context.showModal('context','p1');assert.equal(h.calls.at(-1).type,'old-modal');
});
test('安全工作稿导出包含事实快照，不进入旧产品图与海报导出',()=>{
  const h=setup();confirm(h);for(const kind of ['assets','pop','web']){const data=h.context.makeContent(kind),files=h.context.versionFiles({id:'a',kind,title:data.title},{num:1,data},'工作草稿');assert.ok(files['input-snapshot.json']);assert.equal(Object.keys(files).some(x=>/\.(svg|png|jpg)$/.test(x)),false);assert.doesNotMatch(JSON.stringify(files),/570 L|SpaceMaster|MDRS761/);}
});
test('预置来源可以标记失效并立即阻止运行中的固定快照',()=>{
  const h=setup([product('spacemaster-de',{demoScenario:'spacemaster-de',productName:'SpaceMaster',category:'冰箱',model:'MDRS761MYM45A',market:'DE',language:'de-DE',inputsReady:true})]);const snap=h.api.projectSnapshot('spacemaster-de');h.api.invalidateEvidence('spacemaster-de',snap.evidence[0].id,'客户要求重新核对适用型号');assert.equal(h.api.executionIssues({inputSnapshot:snap}).length,1);assert.equal(h.api.inputReadiness('spacemaster-de').ready,false);
});
test('选区修改打开本地正文编辑器，不创建计划或调用旧墨西哥改稿',async()=>{
  const h=setup();confirm(h);const data=h.context.makeContent('strategy'),a=h.context.newArtifact('strategy',data,'p1',[],'p1-chat');h.state.canvas={id:a.id,num:1};h.state.contextSelection={artifactId:a.id,revision:1,section:'goal'};
  await h.context.sendPrompt('把这段改为：面向首次装修家庭，先整理需要验证的购买顾虑。');
  assert.equal(h.state.plans.length,0);assert.equal(h.state.v62DraftEditor.artifactId,a.id);assert.match(h.state.v62DraftEditor.sections.goal,/首次装修/);assert.equal(h.calls.some(x=>x.type==='old-modify'),false);assert.equal(a.versions.length,1);
  const v=h.api.saveDraftEdit(a.id,1,h.state.v62DraftEditor);assert.equal(v.num,2);assert.equal(a.pending,2);assert.match(v.data.sections.find(s=>s.id==='goal').body,/首次装修/);assert.equal(v.data.manualEdit.modelCalled,false);assert.doesNotMatch(JSON.stringify(v.data),/Espacio|570 L|MDRS761/);assert.deepEqual(v.data.inputSnapshot,data.inputSnapshot);
});
test('改稿不能覆盖事实摘录；已有新候选和非负责人不能保存旧底稿',()=>{
  const h=setup();confirm(h);const a=h.context.newArtifact('strategy',h.context.makeContent('strategy'),'p1',[],'p1-chat'),edit=h.api.openDraftEditor(a.id,1);
  assert.throws(()=>h.api.saveDraftEdit(a.id,1,{...edit,sections:{...edit.sections,identity:'另一个型号'}}),/事实摘录不可/);
  const next=h.api.saveDraftEdit(a.id,1,{...edit,summary:'本轮只补充工作目标，待人工核对。'});assert.equal(next.num,2);
  assert.throws(()=>h.api.saveDraftEdit(a.id,1,{...edit,summary:'再次改变'}),/较新的候选/);
  h.state.actor='ana';assert.throws(()=>h.api.saveDraftEdit(a.id,2,{...edit,summary:'无权修改'}),/负责人/);
});
