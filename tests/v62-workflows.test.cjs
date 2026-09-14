const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/demo-spacemaster-v6/workflow-branches.js'),'utf8');

function harness() {
  let serial=0;
  const S={actor:'lin',view:'chat',projectId:null,threadId:'personal',canvas:null,projects:[],uploads:[],artifacts:[],submissions:[],tasks:[],transfers:[],runs:[],batches:[],deliveries:[],libraryPushes:[]};
  const ctx={S,window:{},console,URL,JSON,Date,Set,Map,PEOPLE:{lin:{name:'李林'},ana:{name:'Ana'},reviewer:{name:'陈蕾'}},ASSET_FIXTURES:[{id:'sample',name:'演示厨房',desc:'样本图片',eligible:true,license:'仅示例'}],MODAL:null,
    E:value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),clone:x=>JSON.parse(JSON.stringify(x)),uid:prefix=>prefix+'-'+(++serial),now:()=>new Date().toISOString(),
    persist(){},render(){},closeModal(){ctx.MODAL=null;},toast(){},download:(name,data)=>{ctx.downloaded={name,data};},
    document:{addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}},
    handle:async(action)=>{ctx.lastAction=action;},homeHTML:()=>'<div><button data-action="prompt" data-arg="assets">查找产品素材</button><button data-action="content-check" data-arg="content-check">检查营销内容</button></div>',filesHTML:()=>'<div>原资料</div>',libraryHTML:()=>'<div>原成果</div>',tasksHTML:()=>'<div role="tablist"><button role="tab">采用</button><button role="tab">审批</button></div>',contentHTML:()=>'<div>原成果正文</div>',showModal(){},renderModal(){},actionableReviews:()=>2,ingest:async()=>{},
    headerHTML:()=>'<header><div class="crumb"><strong>与 Lilith 协作</strong></div></header><nav class="projectbar work-context-bar" aria-label="当前对话"><span>当前对话</span><button>工作状态：待继续</button></nav>',sidebarHTML:()=>'<nav class="primary-nav"><button data-action="capabilities">能力与连接</button></nav>',navigationView:()=>S.view==='artifact'?S.artifactWorkspace?.origin.view:S.view,
    handleFiles:async files=>{for(const f of files)S.uploads.push({id:'upload-'+(++serial),name:f.name,type:'text',text:await f.text(),projectId:S.projectId});return {added:files.length,failed:0};},
    button:(label,action,arg='',style='',icon='')=>`<button class="${style}" data-action="${action}" data-arg="${arg}">${label}</button>`,
    artifact:id=>S.artifacts.find(x=>x.id===id),revision:(a,num)=>a?.versions.find(x=>x.num===Number(num)),approvalFor:(a,num)=>S.submissions.find(x=>x.artifactId===a.id&&x.revision===num&&x.status==='approved'),
    newArtifact:(kind,data,pid,refs)=>{const a={id:'a-'+(++serial),kind,title:data.title,projectId:pid,active:1,pending:1,accepted:0,versions:[{num:1,data:JSON.parse(JSON.stringify(data)),refs:JSON.parse(JSON.stringify(refs))}]};S.artifacts.push(a);return a;},
    addRevision:(a,data,note,refs)=>{const v={num:a.versions.length+1,data:JSON.parse(JSON.stringify(data)),refs:JSON.parse(JSON.stringify(refs)),note};a.versions.push(v);a.pending=v.num;return v;}
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  const api=ctx.window.V62Workflows;
  function upload(data={}) {const u={id:'upload-'+(++serial),name:'厨房说明.txt',type:'text',text:'使用空间说明',created:'2026-09-12',...data};S.uploads.push(u);return u;}
  function artifact(data={}) {const a={id:'source-'+(++serial),title:'原 Message House',kind:'mh',projectId:'existing-project',accepted:1,active:1,pending:null,versions:[{num:1,data:{title:'原 Message House',claim:'原版主张',summary:'原始摘要'},refs:[]}],...data};S.artifacts.push(a);return a;}
  return {ctx,S,api,upload,artifact};
}

test('independent search uses local input and never creates a project or silently includes fixtures',()=>{
  const {S,api,upload}=harness();const u=upload();const job=api.runSearch({query:'厨房'});
  assert.equal(job.results.length,1);assert.equal(job.results[0].id,u.id);assert.equal(S.projects.length,0);assert.equal(S.tasks.length,0);assert.equal(job.projectId,null);assert.equal(job.externalStatus,'not_connected');
  assert.equal(api.runSearch({query:'演示厨房'}).results.length,0);
  assert.equal(api.runSearch({query:'演示厨房',source:'demo'}).results.length,1);
});
test('empty, inaccessible, missing and revoked search results retain distinct next actions',()=>{
  const {api,upload}=harness();assert.throws(()=>api.runSearch({query:'  '}),/请填写/);
  const missing=api.runSearch({query:'背面照片'});assert.equal(missing.status,'waiting_input');
  const request=api.createInputTask(missing.id,'production');assert.equal(request.status,'waiting_input');assert.equal(request.requestKind,'production');assert.equal(api.createInputTask(missing.id,'production').id,request.id);
  const denied=upload({name:'限制图片.png',type:'image',permission:'denied'});const blocked=api.runSearch({query:'限制图片'});assert.equal(blocked.status,'waiting_permission');assert.throws(()=>api.selectResult(blocked.id,denied.id),/无权使用/);
  const u=upload({name:'可用文字'}),j=api.runSearch({query:'可用文字'});api.selectResult(j.id,u.id);assert.equal(j.selected.length,1);api.selectResult(j.id,u.id);assert.equal(j.selected.length,0);u.revoked=true;assert.throws(()=>api.selectResult(j.id,u.id),/无权使用/);
});
test('governance retains editable descriptions and explicit decisions without altering source records',()=>{
  const {api,upload}=harness();const u=upload(),before=JSON.stringify(u);const j=api.runGovernance({ids:[u.id]});
  assert.equal(j.status,'waiting_input');assert.match(j.suggestions[0].basis,/未执行图像识别/);api.decideDescription(j.id,u.id,'accepted','厨房安装资料，待产品负责人核对');
  assert.equal(j.status,'ready');assert.equal(j.suggestions[0].value,'厨房安装资料，待产品负责人核对');assert.equal(JSON.stringify(u),before);
  assert.throws(()=>api.createHandoff('description',{fields:[{field:'tags',value:'formal'}]}),/description/);
  const h=api.createHandoff('description',{fields:[{field:'description',value:j.suggestions[0].value}],refs:j.refs});assert.equal(h.status,'awaiting_handoff');assert.equal(h.externalStatus,'not_connected');
});
test('content check reports local findings and preserves original text through repair and recheck',()=>{
  const {api,upload}=harness();const u=upload({text:'产品介绍\n省电30%\n其他说明'});const j=api.runCheck({sourceId:u.id});const issue=j.findings[0];
  assert.equal(j.check.authenticity,'未核验');assert.equal(j.check.publishEligibility,'未确认');assert.match(issue.locator,/第 2 行/);assert.equal(j.status,'waiting_repair');
  assert.throws(()=>api.closeFinding(j.id,issue.id),/复检/);api.repairFinding(j.id,issue.id,{correction:'省电30%',evidence:'首次修改'});api.recheckFinding(j.id,issue.id);assert.equal(issue.status,'reopened');
  api.repairFinding(j.id,issue.id,{correction:'支持多种储物安排。',evidence:'删除未经核验的量化声明'});api.recheckFinding(j.id,issue.id);api.closeFinding(j.id,issue.id);
  assert.equal(j.status,'closed');assert.match(u.text,/省电30%/);assert.match(issue.recheck.scope,/源文件或线上页面未改变/);
});
test('opaque file and site inspections do not simulate parsing or web access',()=>{
  const {api,upload}=harness();const u=upload({name:'原文件.pdf',type:'file',text:null});const j=api.runCheck({sourceId:u.id});assert.equal(j.check.readable,false);assert.match(j.findings[0].evidence,/未进行 PDF/);
  const web=api.runCheck({location:'https://example.com/product'});assert.equal(web.type,'handoff');assert.equal(web.kind,'inspection');assert.equal(web.status,'awaiting_handoff');assert.equal(web.externalStatus,'not_connected');
  assert.throws(()=>api.runCheck({location:'javascript:alert(1)'}),/http/);
});
test('direct continuation fixes the original version and saves an actual editable candidate',()=>{
  const {S,api,artifact}=harness();const a=artifact(),before=JSON.stringify(a);const j=api.continueFrom({sourceId:a.id,revision:1,mode:'direct',market:'法国',language:'fr-FR',channel:'官网',change:'新市场表达，需核对声明'});
  assert.equal(j.draftText,'原版主张');assert.equal(S.tasks.length,0);assert.equal(S.projects.length,0);assert.equal(j.refs[0].revision,1);
  a.versions.push({num:2,data:{claim:'后来采用的新主张'}});a.active=2;a.accepted=2;
  const output=api.saveContinuation(j.id,{body:'Un espace adapté à votre quotidien.'});assert.equal(output.versions[0].data.sections[0].body,'Un espace adapté à votre quotidien.');assert.equal(output.versions[0].refs[0].revision,1);assert.equal(output.accepted,0);assert.equal(S.submissions.length,0);assert.equal(j.refs[0].snapshot.data.claim,'原版主张');
  api.saveContinuation(j.id,{body:'Un espace adapté à votre quotidien.'});assert.equal(output.versions.length,1);
  api.saveContinuation(j.id,{body:'Une nouvelle proposition locale.'});assert.equal(output.versions.length,2);assert.equal(a.versions[0].data.claim,JSON.parse(before).versions[0].data.claim);
});
test('pure extension requires explicit escalation for fact changes and cannot inherit approvals',()=>{
  const {S,api,artifact}=harness();const a=artifact({kind:'pop'});S.submissions.push({artifactId:a.id,revision:1,status:'approved'});
  const input={sourceId:a.id,mode:'extension',market:'德国',language:'de-DE',channel:'门店 A4',change:'只改尺寸'};
  assert.throws(()=>api.continueFrom({...input,factChanged:true}),/二次企划/);
  const j=api.continueFrom(input);const out=api.saveContinuation(j.id,{body:'新尺寸正文'});assert.equal(out.accepted,0);assert.equal(S.submissions.length,1);
  const replan=api.continueFrom({...input,mode:'replan',factChanged:true,change:'功能配置变化'});assert.match(replan.steps.join(' '),/受影响策略/);assert.equal(S.tasks.length,0);
});
test('revoked source and ownership changes block continued writes',()=>{
  const {S,api,artifact}=harness();const a=artifact();const j=api.continueFrom({sourceId:a.id,mode:'direct',market:'德国',language:'de-DE',channel:'官网',change:'表达修订'});
  a.revoked=true;assert.throws(()=>api.saveContinuation(j.id,{body:'新版'}),/无权使用/);assert.equal(S.artifacts.length,1);a.revoked=false;S.actor='ana';assert.throws(()=>api.saveContinuation(j.id,{body:'新版'}),/指定负责人/);
});
test('human handoff receipts remain unverified and duplicates do not create repeated records',()=>{
  const {api}=harness();const j=api.createHandoff('publish',{location:'https://example.com/page'});const input={result:'reported_complete',location:'CMS-PUB-001',evidence:'渠道负责人提供发布截图编号 001'};
  api.recordHandoff(j.id,input);api.recordHandoff(j.id,input);assert.equal(j.receipts.length,1);assert.equal(j.receipts[0].verifiedByConnector,false);assert.equal(j.externalStatus,'unverified');assert.equal(j.status,'handoff_recorded');
  api.closeJob(j.id,'人工材料已齐，完成本地交接记录。');assert.equal(j.status,'closed');assert.equal(j.externalStatus,'unverified');
});
test('failed publishing closes only after evidence, repair, recheck and a completion receipt',()=>{
  const {api}=harness();const j=api.createHandoff('publish',{location:'https://example.com/page'});api.recordHandoff(j.id,{result:'failed',location:'CMS-FAIL-1',evidence:'渠道返回缺少声明'});assert.equal(j.status,'external_failed');
  api.addFeedback(j.id,{title:'发布材料声明缺失',location:'页面 / 资产 v1',evidence:'CMS 提示：缺少声明'});const issue=j.findings[0];
  assert.throws(()=>api.closeJob(j.id,'想关闭'),/未复检/);api.repairFinding(j.id,issue.id,{correction:'补充来源与适用范围说明。',evidence:'责任人校对后的文件说明'});api.recheckFinding(j.id,issue.id);api.closeFinding(j.id,issue.id);
  assert.notEqual(j.status,'closed');assert.throws(()=>api.closeJob(j.id,'处理完成'),/人工完成回执/);api.recordHandoff(j.id,{result:'reported_complete',location:'CMS-PUB-2',evidence:'责任人提供重新发布的人工回执'});api.closeJob(j.id,'所有本地事项与证据已登记');assert.equal(j.externalStatus,'unverified');
});
test('knowledge handoff requires source evidence and retained knowledge body',()=>{
  const {api}=harness();assert.throws(()=>api.createHandoff('knowledge',{body:'未证实结论'}),/核验来源/);const j=api.createHandoff('knowledge',{body:'本次适用范围内的已核验记录。',evidence:'审核记录 K-001；适用于本型号与当前市场'});assert.equal(j.status,'awaiting_handoff');assert.equal(j.kind,'knowledge');assert.equal(j.externalStatus,'not_connected');
});
test('manual inbox keeps two primary decision tabs and exposes inputs, transfer and failures',()=>{
  const {S,ctx,api}=harness();S.view='review';S.projects.push({id:'p',name:'项目 A',owner:'lin',inputsReady:false});S.tasks.push({id:'t',name:'渠道材料',assignee:'ana'});S.transfers.push({id:'tr',taskId:'t',from:'ana',to:'lin',status:'pending'});S.runs.push({id:'run',kind:'check',status:'failed',actor:'lin'});api.createHandoff('upload');
  const items=api.manualItems();assert.ok(items.some(x=>x.type==='补输入'));assert.ok(items.some(x=>x.action==='accept-transfer'));assert.ok(items.some(x=>x.type==='执行异常'));assert.ok(items.some(x=>x.type==='交接/反馈'));
  const html=ctx.tasksHTML();assert.equal((html.match(/role="tab"/g)||[]).length,2);assert.match(html,/其他事项/);
});
test('transfer cancellation preserves the original assignee',()=>{
  const {S,api}=harness();S.tasks.push({id:'task',assignee:'lin'});S.transfers.push({id:'tr',taskId:'task',from:'lin',to:'ana',status:'pending'});api.cancelTransfer('tr');assert.equal(S.tasks[0].assignee,'lin');assert.equal(S.transfers[0].status,'cancelled');assert.equal(api.manualItems().length,0);
});
test('approval delivery becomes a native-upload handoff without fake external receipts',async()=>{
  const {S,ctx,artifact}=harness();const a=artifact();S.submissions.push({id:'s',artifactId:a.id,revision:1,status:'approved',submitter:'lin'});const delivery={id:'d',submissionId:'s',artifactId:a.id,revision:1,status:'pending',items:[{name:'文件',status:'pending'}]};S.deliveries.push(delivery);
  await ctx.ingest('d');assert.equal(delivery.status,'awaiting_handoff');assert.equal(delivery.items[0].status,'awaiting_handoff');assert.equal(delivery.externalVerified,false);assert.ok(delivery.handoffId);await ctx.ingest('d');assert.equal(S.workflowBranches.jobs.length,1);assert.equal(S.submissions[0].status,'approved');
});
test('workflow rendering escapes hostile user text and retains reversible return context',()=>{
  const {S,ctx,api}=harness();S.projectId='p-existing';S.view='files';api.open('search');api.runSearch({query:'<img src=x onerror=alert(1)>'});const html=api.pageHTML();assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);ctx.handle('wf-back');assert.equal(S.projectId,'p-existing');assert.equal(S.view,'files');
});
test('denied source text is not searched or copied into result snapshots',()=>{
  const {api,upload}=harness();upload({name:'限制文件',permission:'denied',text:'不应通过检索公开的私密内容'});assert.equal(api.runSearch({query:'私密内容'}).results.length,0);const j=api.runSearch({query:'限制文件'});assert.equal(j.results[0].snapshot.redacted,true);assert.doesNotMatch(JSON.stringify(j),/私密内容/);
});
test('assigned feedback remains actionable after reloading state and only its owner repairs it',()=>{
  const {S,api}=harness();const j=api.createHandoff('inspection',{location:'page:1'});api.addFeedback(j.id,{title:'声明待调整',location:'page:1 / asset v1',evidence:'人工截图标记',owner:'ana'});const issue=j.findings[0];assert.throws(()=>api.repairFinding(j.id,issue.id,{correction:'修复',evidence:'证据'}),/问题负责人/);
  S.workflowBranches=JSON.parse(JSON.stringify(S.workflowBranches));S.actor='ana';assert.ok(api.manualItems().some(x=>x.type==='反馈修复'));
  api.repairFinding(j.id,issue.id,{correction:'已删去无依据声明',evidence:'修订稿 V2'});api.recheckFinding(j.id,issue.id);api.closeFinding(j.id,issue.id);assert.equal(S.workflowBranches.jobs[0].findings[0].status,'closed');assert.notEqual(S.workflowBranches.jobs[0].status,'closed');
});
test('expired transfer cannot change ownership when accepted',async()=>{
  const {S,api,ctx}=harness();S.tasks.push({id:'task',assignee:'ana'});S.transfers.push({id:'tr',taskId:'task',from:'ana',to:'lin',status:'pending',expiresAt:'2020-01-01T00:00:00Z'});await ctx.handle('accept-transfer','tr');assert.equal(S.transfers[0].status,'expired');assert.equal(S.tasks[0].assignee,'ana');assert.equal(api.manualItems().length,0);
});
test('legacy successful receipt and item history survive native-upload handoff preparation',async()=>{
  const {S,ctx,api,artifact}=harness();const a=artifact();const d={id:'old',artifactId:a.id,revision:1,status:'received',items:[{name:'旧文件',status:'received',receipt:'DEMO-CL-OLD'}]};S.deliveries.push(d);await ctx.ingest('old');assert.equal(d.status,'received');assert.equal(d.items[0].receipt,'DEMO-CL-OLD');assert.equal(d.externalVerified,false);api.open('handoff');assert.match(api.pageHTML(),/既有交付与模拟接收记录/);assert.match(api.pageHTML(),/不证明真实 CL 接收/);
});
test('the original homepage asset and check shortcuts enter the independent workflows',async()=>{
  const {S,ctx,api}=harness();assert.match(ctx.homeHTML(),/data-action="wf-open" data-arg="search"/);assert.match(ctx.homeHTML(),/data-action="wf-open" data-arg="check"/);
  await ctx.handle('prompt','assets');assert.equal(S.view,'workflow');assert.equal(api.ensure().mode,'search');await ctx.handle('content-check');assert.equal(api.ensure().mode,'check');assert.equal(S.projects.length,0);assert.equal(S.artifacts.length,0);
});
test('empty work and missing-input tasks can upload in place and resume the original search',async()=>{
  const {S,ctx,api}=harness();api.open('governance');api.modeDraft().description='尚未保存的描述建议';assert.match(api.pageHTML(),/data-action="wf-attach"/);await ctx.handle('wf-attach');assert.equal(ctx.lastAction,'attach');
  await ctx.handleFiles([{name:'安装说明.txt',text:async()=> '厨房安装说明'}]);assert.equal(S.view,'workflow');assert.equal(api.modeDraft().description,'尚未保存的描述建议');assert.equal(api.modeDraft().sourceId,S.uploads[0].id);assert.equal(S.uploads[0].projectId,null);
  const search=api.runSearch({query:'背面说明'}),task=api.createInputTask(search.id,'missing');api.showJob(task.id);assert.match(api.pageHTML(),/data-action="wf-attach"/);await ctx.handle('wf-attach',task.id);await ctx.handleFiles([{name:'背面说明.txt',text:async()=> '真实背面图拍摄要求，等待产品负责人拍摄'}]);assert.equal(task.uploadedIds.length,1);await ctx.handle('wf-rerun-search',search.id);assert.equal(api.ensure().jobs[0].results.length,1);assert.equal(api.ensure().jobs[0].results[0].title,'背面说明.txt');
});
test('mode drafts and job drafts survive normal navigation and local-state restoration',()=>{
  const {S,api,artifact}=harness();api.open('search');api.modeDraft().query='尚未发送的检索需求';api.open('check');api.modeDraft().text='尚未检查的原文';api.open('search');assert.equal(api.modeDraft().query,'尚未发送的检索需求');
  const a=artifact(),j=api.continueFrom({sourceId:a.id,mode:'direct',market:'法国',language:'fr-FR',channel:'官网',change:'局部修订'});api.showJob(j.id);api.jobDraft(j.id).editBody='尚未保存的完整新正文';const other=api.runCheck({text:'正常文字'});api.showJob(other.id);api.jobDraft(other.id).resolution='另一项工作的说明';S.view='library';S.workflowBranches=JSON.parse(JSON.stringify(S.workflowBranches));api.showJob(j.id);
  assert.equal(api.jobDraft(j.id).editBody,'尚未保存的完整新正文');assert.equal(api.jobDraft(other.id).resolution,'另一项工作的说明');assert.match(api.pageHTML(),/尚未保存的完整新正文/);api.open('check');assert.equal(api.modeDraft().text,'尚未检查的原文');
});
test('independent navigation identifies its location and omits the originating conversation status',()=>{
  const {S,ctx,api}=harness();S.projectId='origin';S.threadId='origin-chat';api.open('search');const header=ctx.headerHTML();assert.match(header,/<strong>独立工作<\/strong>/);assert.match(header,/aria-label="独立工作区"/);assert.doesNotMatch(header,/当前对话|待继续/);const sidebar=ctx.sidebarHTML();assert.equal((sidebar.match(/>独立工作<\/button>/g)||[]).length,1);assert.match(sidebar,/aria-current="page"/);assert.match(sidebar,/class="nav-item active"/);
});
test('returning to a job restores the captured workflow scroll and field selection',()=>{
  const {ctx,api}=harness();const list={scrollTop:320};let focus=0,range=null;const field={dataset:{wfField:'query'},selectionStart:2,selectionEnd:5,focus(){focus++;},setSelectionRange(a,b){range=[a,b];}};ctx.document.querySelector=selector=>selector==='.view-content'?list:null;ctx.document.querySelectorAll=()=>[field];ctx.document.activeElement=field;
  api.open('search');api.open('check');list.scrollTop=0;api.open('search');assert.equal(list.scrollTop,320);assert.ok(focus>0);assert.deepEqual(range,[2,5]);
});
test('internally reviewed work remains in the manual inbox for its formal-use owner',()=>{
  const {S,api,artifact}=harness();const a=artifact();S.tasks.push({id:'needs-formal',name:'官网内容',artifactId:a.id,assignee:'lin',status:'working',internalReview:{status:'approved',revision:1}});const row=api.manualItems().find(x=>x.type==='正式使用确认');assert.ok(row);assert.equal(row.action,'open-artifact');assert.equal(row.arg,a.id+'|1');S.actor='ana';assert.equal(api.manualItems().filter(x=>x.type==='正式使用确认').length,0);
});
