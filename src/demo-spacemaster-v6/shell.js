/* v5.2: projects own conversations; transient mode dialog; compact right inspector. */
const SHELL={render,renderModal,showModal,closeModal,handle,headerHTML,makeState,ensureExperience,filesHTML,generate,confirmPlan,scopeCard};
ICONS.plug='M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v4';
ICONS.settings='M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0';
for(const kind of ['work-mode','role','about'])BLOCKING.add(kind);
function diversifyProjects(state){
  if(window.MARKETING_DESKTOP)return;
  if(state.productExamplesUpdated)return;
  for(const [oldId,newId,oldName,name,productName,category,channels,goal] of [
    ['sample-website','sample-dishwasher','SpaceMaster 官网焕新','嵌入式洗碗机 · 新品上市','嵌入式洗碗机','洗碗机',['web'],'准备洗碗机新品的价值主张与官网内容。'],
    ['sample-retail','sample-rice-cooker','SpaceMaster 门店推广','智能电饭煲 · 市场推广','智能电饭煲','电饭煲',['retail'],'准备电饭煲的使用场景、卖点与门店物料。']]){
    const old=state.projects.find(p=>p.id===oldId),hasWork=old&&(state.artifacts.some(a=>a.projectId===oldId)||state.tasks.some(t=>t.projectId===oldId)||state.threads.some(t=>t.projectId===oldId&&t.messages.length));
    const data={name,productName,category,channels,model:'待补充',inputsReady:false,goal};
    if(old&&old.sample&&!hasWork&&old.name===oldName){Object.assign(old,data);const t=state.threads.find(t=>t.id===old.threadId);if(t)t.title='产品资料与上市计划';}
    else if(!state.projects.some(p=>p.id===newId||p.productName===productName)){const tid=newId+'-chat';state.projects.push({id:newId,...data,tier:'Hero',market:'MX',markets:['MX'],language:'es-MX',owner:'lin',scopeConfirmed:false,ruleVersion:2,threadId:tid,created:now(),contextArtifacts:[],sample:true});state.threads.push({id:tid,title:'产品资料与上市计划',projectId:newId,messages:[],created:now()});}
  }
  state.productExamplesUpdated=true;
}
function ensureShell(state){state.projectCollapsed??={};state.expandedSellingPoints??={};state.inspectorOpen??=state.batches?.some(b=>['running','paused','ready','needs_review'].includes(b.status))||false;state.inspectorTab??='status';state.libraryPushes??=[];state.externalSources??=[];diversifyProjects(state);return state;}
ensureExperience=function(state,seed=true){return ensureShell(SHELL.ensureExperience(state,seed))};
makeState=()=>ensureShell(SHELL.makeState());
ensureShell(S);
if(MODAL?.kind==='context'){S.inspectorOpen=true;S.inspectorTab='project';S.inspectorProjectId=MODAL.arg||S.projectId;MODAL=null;S.panelStack=[];}
let modeDialog=null;
let globalReturn=null;
let projectMenuId=null;
ICONS.compose='M13 5H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7M16 3l5 5M10 14l-1 4 4-1L22 8l-4-4-8 10Z';
ACTION_ICON_MAP.more='more';
function conversationStart(){return S.view==='chat'&&!S.canvas&&!thread()?.messages.length;}
function initializeConversationEntry(){
  // Opening the app starts at the personal launcher, without removing saved work.
  const t=S.threads.findLast(t=>!t.projectId&&!t.messages.length)||{id:uid('chat'),title:'新的工作',projectId:null,messages:[],created:now()};
  if(!S.threads.includes(t))S.threads.push(t);
  S.threadId=t.id;S.projectId=null;S.view='chat';S.canvas=null;S.contextSelection=null;
  MODAL=null;globalReturn=null;projectMenuId=null;S.panelStack=[];S.dockState=null;S.inspectorOpen=false;S.mobileNav=false;S.artifactWorkspace=null;
}
const messageBeforeLogo=messageHTML;
messageHTML=function(m){
  const mark=MERGED_ASSETS.lilithMark.replace(/<svg[^>]*>/,'<svg class="lilith-symbol" viewBox="0 0 256 256" fill="none" aria-hidden="true">').replaceAll('softGlow','lilith-glow-'+String(m.id).replace(/[^a-zA-Z0-9_-]/g,''));
  return messageBeforeLogo(m).replace('<span class="lilith-mark">l</span>','<span class="lilith-mark" aria-hidden="true">'+mark+'</span>');
};
function projectRowMenuHTML(p){return projectMenuId===p.id?`<div class="project-row-menu" role="menu" aria-label="${E(p.name)}的操作">${[['发起对话','new-project-thread','compose'],['项目背景','context','info'],['项目资料','project-files','file']].map(([label,action,ic])=>button(label,action,p.id,'ghost sm',ic).replace('<button ','<button role="menuitem" ')).join('')}</div>`:'';}
function conversationLabel(t,p){if(p&&t.title===p.name)return t.messages.find(m=>m.role==='user')?.text.slice(0,18)||'上市工作计划';return t.title==='新的工作'?'新的对话':t.title;}
function projectTreeHTML(){
  const tree=S.projects.map(p=>{
    const expanded=!S.projectCollapsed[p.id],ts=S.threads.filter(t=>t.projectId===p.id),listId='threads-'+p.id;
    return `<section class="project-group" data-project-id="${E(p.id)}"><div class="project-tree-row ${p.id===S.projectId?'current-project':''} ${projectMenuId===p.id?'menu-open':''}"><button class="tree-disclosure icon-btn" aria-expanded="${expanded}" aria-controls="${E(listId)}" aria-label="${expanded?'收起':'展开'} ${E(p.name)}的会话" data-action="project-toggle" data-arg="${E(p.id)}">${icon(expanded?'down':'chevron')}</button><button class="tree-project" data-action="project" data-arg="${E(p.id)}" title="${E(p.name)}">${icon('folder')}<span>${E(p.name)}</span></button><div class="project-row-actions"><button class="icon-btn" data-action="project-menu" data-arg="${E(p.id)}" aria-label="${E(p.name)}，更多操作" aria-haspopup="menu" aria-expanded="${projectMenuId===p.id}" title="更多操作">${icon('more')}</button>${ibutton('在 '+p.name+' 中发起对话','new-project-thread',p.id,'compose')}</div>${projectRowMenuHTML(p)}</div><div id="${E(listId)}" class="project-conversations" role="group" aria-label="${E(p.name)}的会话" ${expanded?'':'hidden'}>${ts.map(t=>`<button class="tree-conversation ${S.threadId===t.id&&S.view==='chat'?'active':''}" data-action="thread" data-arg="${E(t.id)}" title="${E(t.title)}">${icon('message')}<span>${E(conversationLabel(t,p))}</span>${S.batches.some(b=>b.threadId===t.id&&b.status==='running')?'<span class="status-dot" aria-label="正在执行"></span>':''}</button>`).join('')}</div></section>`;
  }).join('');
  const other=S.threads.filter(t=>!t.projectId&&(t.messages.length||t.id===S.threadId)).slice(-6).reverse();
  return tree+(other.length?`<div class="nav-label">对话</div>${other.map(t=>`<button class="tree-conversation unassigned ${S.threadId===t.id&&S.view==='chat'?'active':''}" data-action="thread" data-arg="${E(t.id)}">${icon('message')}<span>${E(conversationLabel(t))}</span></button>`).join('')}`:'');
}
function modeControlHTML(){return `<button id="work-mode" class="btn mode-control mode-${workMode()}" data-action="mode-open" aria-haspopup="dialog" aria-label="工作模式：${E(MODE_NAMES[workMode()])}">${workMode()==='yolo'?icon('spark'):''}${E(MODE_NAMES[workMode()])}${icon('down')}</button>`;}
function composerProjectHTML(){const p=project();return `<div class="composer-project-context">${p?`<button class="btn ghost sm" data-action="${conversationStart()?'project-picker':'context'}" data-arg="${E(p.id)}" aria-label="${conversationStart()?'更换项目':'查看项目背景'}：${E(p.name)}">${icon('folder')}<span>${E(p.name)}</span>${icon(conversationStart()?'down':'info')}</button>${conversationStart()?ibutton('移除项目上下文','choose-project','none','close'):''}`:button('选择项目','project-picker','','ghost sm','folder')}</div>`;}
function actionableReviews(){return pendingBatches().filter(b=>b.owner===S.actor||b.reviewer===S.actor).length+S.submissions.filter(s=>s.reviewer===S.actor&&s.status==='pending').length;}
function inCurrentWork(item){return S.projectId?item.projectId===S.projectId:item.threadId===S.threadId;}
function currentWorkSummary(){
  const batches=S.batches.filter(inCurrentWork),runs=S.runs.filter(inCurrentWork);
  if(S.auto?.active)return {label:S.paused?'演示已暂停':'演示中',active:!S.paused};
  if(batches.some(b=>b.status==='running')||runs.some(r=>r.status==='running'))return {label:S.paused?'已暂停':'进行中',active:!S.paused};
  if(batches.some(b=>['paused','interrupted'].includes(b.status)))return {label:'待继续'};
  if(batches.some(b=>['ready','needs_review','changes_requested'].includes(b.status)))return {label:'待确认'};
  if(S.submissions.some(s=>inCurrentWork(s)&&s.status==='pending'))return {label:'待审核'};
  return {label:''};
}
headerHTML=function(){
  const p=conversationStart()?null:project(),summary=currentWorkSummary(),page=UTILITY_PAGES.has(MODAL?.kind),expanded=S.inspectorOpen;
  const status=`<button class="btn work-status-entry ${expanded&&S.inspectorTab==='status'?'active':''}" data-action="inspector-toggle" aria-controls="work-inspector" aria-expanded="${expanded&&S.inspectorTab==='status'}" aria-label="${expanded&&S.inspectorTab==='status'?'收起':'展开'}工作状态">${icon('clock')}<span>工作状态</span>${summary.label?`<small class="${summary.active?'is-running':''}">${summary.label}</small>`:''}</button>`;
  const background=p?`<button class="btn project-background-entry ${expanded&&S.inspectorTab==='project'?'active':''}" data-action="context" data-arg="${E(p.id)}" aria-controls="work-inspector" aria-expanded="${expanded&&S.inspectorTab==='project'}">${icon('info')}项目背景</button>`:'';
  return `<header class="topbar">${ibutton('打开导航','mobile-nav','','menu')}<div class="crumb">${icon(p?'folder':'message')}<span>${p?'项目空间':'个人工作'}</span>${p?icon('chevron'):''}<strong>${p?E(p.name):'与 Lilith 协作'}</strong></div><div class="top-actions">${S.auto?.active?button(S.paused?'继续演示':'暂停演示','pause','','sm',S.paused?'play':'pause')+ibutton('结束演示','auto-stop','','stop'):button('播放完整故事','auto-start','','','play')}</div></header>${page?'':`<nav class="projectbar work-context-bar" aria-label="${p?'项目工作区':'当前对话'}">${p?`<div class="work-view-tabs">${[['chat','对话'],['tasks','任务'],['library','成果'],['files','资料'],['activity','动态']].map(([v,l])=>`<button class="tab ${navigationView()===v?'active':''}" data-action="nav" data-arg="${v}">${l}</button>`).join('')}</div>`:'<span class="personal-work-label">当前对话</span>'}<div class="work-context-actions">${background}${status}</div></nav>`}`;
};
function accountEntryHTML(){const p=PEOPLE[S.actor];return `<button class="role-btn account-entry" data-action="role" aria-haspopup="dialog" aria-label="${E(p.name)}，切换角色"><span class="avatar">${E(p.initial)}</span><span class="account-copy"><strong>${E(p.name)}</strong><small>${E(p.role)}</small></span>${icon('down')}</button>`;}
function projectInfoHTML(){
  const p=project(S.inspectorProjectId)||project();
  if(!p)return '<div class="inspector-empty"><h3>尚未选择项目</h3><p>从左侧选择项目，查看它的目标和基础信息。</p></div>';
  const draft=S.projectInfoDraft?.projectId===p.id?S.projectInfoDraft:{projectId:p.id,name:p.name,goal:p.goal};
  if(S.inspectorEditing)return `<div class="inspector-form"><div class="field"><label for="project-info-name">项目名称</label><input id="project-info-name" value="${E(draft.name)}"></div><div class="field"><label for="project-info-goal">项目目标</label><textarea id="project-info-goal">${E(draft.goal)}</textarea></div><div class="row wrap">${button('保存基本信息','project-info-save',p.id,'primary sm')}${button('取消','project-info-cancel','','sm')}</div></div>`;
  return `<section class="project-facts"><h3>${E(p.name)}</h3><dl><div><dt>产品</dt><dd>${E(p.productName||'SpaceMaster')}<br><span>${E(p.model)}</span></dd></div><div><dt>目标市场</dt><dd>${p.market==='MX'?'墨西哥':E(p.market)}</dd></div><div><dt>内容语言</dt><dd>${p.language==='es-MX'?'西班牙语（墨西哥）':E(p.language)}</dd></div><div><dt>渠道</dt><dd>${p.channels.map(c=>CHANNEL[c]).join('、')}</dd></div><div><dt>负责人</dt><dd>${E(PEOPLE[p.owner]?.name||'未指定')}</dd></div></dl><h4>项目目标</h4><p>${E(p.goal||'尚未填写项目目标。')}</p>${button('编辑基本信息','project-info-edit',p.id,'sm','edit')}${p.inputsReady===false?button('补充产品资料','product-intake',p.id,'sm','upload'):''}</section>`;
}
const basicProjectInfoHTML=projectInfoHTML;
projectInfoHTML=function(){const p=project(S.inspectorProjectId)||project();return basicProjectInfoHTML()+(p?.officialSource?`<section class="official-project-source"><h3>产品官网资料</h3><p>${E(p.officialSource.facts)}</p><a href="${E(p.officialSource.url)}" target="_blank" rel="noopener noreferrer">查看美的官网产品页 ${icon('arrow')}</a></section>`:'');};
function workStatusHTML(){
  const bs=S.batches.filter(inCurrentWork),running=bs.find(b=>['running','paused','interrupted'].includes(b.status)),reviews=pendingBatches().filter(b=>inCurrentWork(b)&&(b.owner===S.actor||b.reviewer===S.actor)).length+S.submissions.filter(s=>inCurrentWork(s)&&s.reviewer===S.actor&&s.status==='pending').length;
  const r=S.runs.find(r=>r.id===S.runId&&inCurrentWork(r));
  let html='';
  if(S.auto?.active)html+=`<section class="inspector-section"><h3>演示进度</h3><p>${S.auto.index+1} / ${AUTO_STEPS.length} · ${E(AUTO_STEPS[S.auto.index]?.name||'')}</p><div class="row">${button(S.paused?'继续':'暂停','pause','','sm')}${button('结束演示','auto-stop','','sm')}</div></section>`;
  if(running)html+=`<section class="inspector-section"><h3>${E(batchName(running))}</h3><p>${E(batchLabel(running))}</p><strong class="inspector-progress">${running.items.filter(i=>i.status==='ready').length} / ${running.items.length}<small>项草稿完成自检</small></strong>${button('查看任务进度','batch-open',running.id,'sm','clock')}</section>`;
  else if(r)html+=`<section class="inspector-section"><h3>${E(r.name)}</h3><p>${r.events.filter(e=>e.status==='done').length} / ${r.events.length} 项操作完成</p>${button('查看执行详情','run-detail',r.id,'sm')}</section>`;
  else html+='<section class="inspector-section"><h3>当前没有运行中的任务</h3><p>新的工作进度会显示在这里。</p></section>';
  html+=`<section class="inspector-section"><h3>待我审核${reviews?' · '+reviews:''}</h3><p>${reviews?'有草稿或正式提交等待你查看。':'当前没有待处理的审核。'}</p>${reviews?button('查看待审核内容','review-inbox','','sm','shield'):''}</section>`;
  const recent=bs.filter(b=>!['running','paused','interrupted'].includes(b.status)).slice(-3).reverse();
  if(recent.length)html+=`<section class="inspector-section"><h3>最近的草稿集合</h3>${recent.map(b=>button(E(batchName(b))+'<small>'+E(batchLabel(b))+'</small>','batch-open',b.id,'inspector-link')).join('')}</section>`;
  html+=`<div class="inspector-save">${storageWarning?'保存空间不足，请导出备份。':'修改已保存'}${storageWarning?button('导出备份','export-backup','','sm'):''}</div>`;
  return html;
}
function mountInspector(){
  const main=document.querySelector('.main');if(!main)return;
  main.querySelector('.work-inspector')?.remove();
  const visible=S.inspectorOpen&&!isBlockingModal(MODAL?.kind)&&!UTILITY_PAGES.has(MODAL?.kind);
  main.classList.toggle('inspector-open',visible);
  if(!visible)return;
  main.insertAdjacentHTML('beforeend',`<aside id="work-inspector" class="work-inspector" aria-label="${S.inspectorTab==='project'?'项目背景':'工作状态'}"><header><div><h2>${S.inspectorTab==='project'?'项目背景':'工作状态'}</h2><p>${E(project()?.name||'当前对话')}</p></div>${button('收起','inspector-close','','ghost sm','down')}</header><div class="inspector-body">${S.inspectorTab==='project'?projectInfoHTML():workStatusHTML()}</div></aside>`);
}
render=function(bottom=false){ensureShell(S);SHELL.render(bottom);document.querySelector('.sidebar-bottom')?.insertAdjacentHTML('beforeend',accountEntryHTML());mountInspector();};
function openInspector(tab='status',pid=S.projectId){S.inspectorOpen=true;S.inspectorTab=tab;S.inspectorProjectId=pid;render();persist();}
showModal=function(kind,arg=''){
  if(kind==='context')return openInspector('project',arg||S.projectId);
  if(globalReturn?.state!==S)globalReturn=null;
  if((UTILITY_PAGES.has(kind)||['about','role'].includes(kind))&&kind!==MODAL?.kind)globalReturn={kind,state:S,previous:globalReturn,modal:MODAL?clone(MODAL):null,stack:clone(S.panelStack),inspector:S.inspectorOpen,focusAction:document.activeElement?.dataset.action};
  S.inspectorOpen=false;
  return SHELL.showModal(kind,arg);
};
const shellOpenCanvas=openCanvas;
openCanvas=function(...args){S.inspectorOpen=false;return shellOpenCanvas(...args)};
function openModeDialog(selected=workMode(),startAfter=false){
  modeDialog={threadId:S.threadId,selected,startAfter,prior:MODAL?clone(MODAL):null,stack:clone(S.panelStack),inspector:S.inspectorOpen};
  showModal('work-mode');
}
closeModal=function(){
  if(MODAL?.kind!=='work-mode'){
    const restore=globalReturn?.kind===MODAL?.kind&&globalReturn?.state===S?globalReturn:null;
    if(restore)globalReturn=restore.previous;
    else if(globalReturn?.state!==S)globalReturn=null;
    SHELL.closeModal();
    if(restore){MODAL=restore.modal;S.panelStack=restore.stack;S.inspectorOpen=restore.inspector;render();persist();requestAnimationFrame(()=>{if(restore.focusAction)document.querySelector(`[data-action="${restore.focusAction}"]`)?.focus({preventScroll:true})});}
    return;
  }
  const prior=modeDialog;modeDialog=null;SHELL.closeModal();
  if(prior?.prior){MODAL=prior.prior;S.panelStack=prior.stack;render();renderModal()}else if(prior?.inspector){S.inspectorOpen=true;render()}
  requestAnimationFrame(()=>document.querySelector('#work-mode')?.focus({preventScroll:true}));persist();
};
function modeDialogHTML(){
  const copy={collaborate:'边讨论边完成单项工作，随时调整方向。',plan:'先沟通目标和交付清单。保存计划不会开始制作，确认后再执行。',yolo:'确认计划后，Lilith 连续完成制作与自检，保存一组草稿，等你集中审核。不会替你正式批准或发布。'};
  return `<p class="mode-dialog-intro">选择接下来与 Lilith 协作的方式。</p><div class="mode-options" role="radiogroup" aria-label="选择工作模式">${Object.entries(MODE_NAMES).map(([id,label])=>`<label class="mode-option mode-${id}"><input type="radio" name="next-work-mode" value="${id}" ${modeDialog?.selected===id?'checked':''}><span><strong>${E(label)}</strong><small>${copy[id]}</small></span></label>`).join('')}</div>${S.runId?'<p class="small muted">切换仅影响之后发起的工作，不改变正在执行的任务。</p>':''}`;
}
function pushRevision(a){const approved=S.submissions.findLast(s=>s.artifactId===a.id&&s.status==='approved');return approved?.revision||a.accepted||null;}
function alreadyPushed(id,num){return S.libraryPushes.some(p=>p.artifactId===id&&p.revision===num&&['sending','received'].includes(p.status))||S.deliveries.some(d=>d.artifactId===id&&d.revision===num&&d.status==='received');}
function contentLibraryHTML(){
  const list=visibleArtifacts();
  return `<p class="push-intro">选择要推送的成果，保留它的内容、版本和来源。</p><div class="push-list">${list.map(a=>{const num=pushRevision(a),sent=num&&alreadyPushed(a.id,num),allowed=num&&!sent&&canWrite(a,false);return `<label class="push-row"><input type="checkbox" data-push-id="${E(a.id)}" data-push-revision="${num||''}" ${allowed?'':'disabled'}><span><strong>${E(a.title)}</strong><small>${num?'v'+num+' · '+(approvalFor(a,num)?'已批准':'已确认草稿'):'请先确认草稿'}${sent?' · 已推送':''}</small></span></label>`}).join('')||'<p class="muted">当前没有成果。先完成并确认一份草稿，再推送到 Content Library。</p>'}</div><section class="push-history"><h3>推送记录</h3>${S.libraryPushes.filter(p=>!S.projectId||p.projectId===S.projectId).map(p=>`<div><strong>${E(p.title)} · v${p.revision}</strong><span>${p.status==='received'?'已推送':'推送中'}</span></div>`).join('')||'<p class="small muted">尚无手动推送记录。</p>'}${button('查看已有入库记录','deliveries','','ghost sm')}</section><p class="push-boundary">当前使用演示连接，不会写入真实 Content Library。</p>`;
}
renderModal=function(){
  if(MODAL?.kind==='work-mode'){dockRoot().innerHTML=modalFrame('切换工作模式',modeDialogHTML(),button('取消','modal-close')+button(modeDialog?.startAfter?'使用此模式并制定计划':'应用模式','mode-apply','','primary'));mountDock();return}
  if(MODAL?.kind==='content-library'){dockRoot().innerHTML=modalFrame('推送到 Content Library',contentLibraryHTML(),button('推送所选成果','content-library-push','','primary','upload'));mountDock();return}
  if(MODAL?.kind==='external-sources'){dockRoot().innerHTML=modalFrame('外部搜索信源',externalSourcesHTML(),button('保存信源','external-source-save','','primary','link'));mountDock();restorePanelValues();return}
  if(MODAL?.kind==='product-intake'){const p=project(MODAL.arg)||project();dockRoot().innerHTML=modalFrame('补充产品资料',`<h3>${E(p.name)}</h3><p class="small muted">请提供 ${E(p.productName)} 的型号、功能与适用市场资料。当前没有这些产品事实，不会沿用冰箱的参数生成内容。</p><div class="section"><h3>需要补充</h3><ul><li>产品型号与功能说明</li><li>目标市场及使用场景</li><li>可使用的图片和声明依据</li></ul></div>`,button('添加产品资料','attach','','primary','upload')+button('查看项目背景','context',p.id,'sm'));mountDock();return}
  SHELL.renderModal();
  if(MODAL?.kind==='review'){const s=S.submissions.find(s=>s.id===MODAL.arg)||S.submissions.findLast(s=>s.status==='pending'),a=s&&artifact(s.artifactId);if(s&&a){const details=dockRoot().querySelector('details');if(details)details.outerHTML=reviewMaterialCopy(a,s.snapshot);}}
};
handle=async function(action,arg=''){
  if(action==='project-menu'){projectMenuId=projectMenuId===arg?null:arg;render();if(projectMenuId)requestAnimationFrame(()=>document.querySelector('.project-row-menu [role="menuitem"]')?.focus());return;}
  projectMenuId=null;
  if(['project','thread','new-project-thread','new-chat','nav','my-tasks','scenario-open'].includes(action)&&UTILITY_PAGES.has(MODAL?.kind)){globalReturn=null;SHELL.closeModal();}
  if(action==='scenario-open')return enterHomeScenario(arg);
  if(action==='utility-close'){do{closeModal()}while(UTILITY_PAGES.has(MODAL?.kind));return;}
  if(['project','thread','new-project-thread','new-chat','nav','my-tasks'].includes(action))S.inspectorOpen=false;
  if(action==='project-toggle'){S.projectCollapsed[arg]=!S.projectCollapsed[arg];render();persist();return}
  if(action==='new-chat'){closeModal();newChat();return;}
  if(action==='project-files'){closeModal();goProject(arg);S.view='files';render();persist();return;}
  if(action==='choose-project'){
    const draft=document.querySelector('#composer')?.value||DRAFTS[S.threadId]||'',mode=workMode(),pid=arg==='none'?null:arg;
    if(pid&&!project(pid))return;
    closeModal();
    const t=thread();
    if(t&&!t.messages.length&&!S.projects.some(p=>p.threadId===t.id)){t.projectId=pid;S.projectId=pid;S.canvas=null;S.contextSelection=null;}
    else newChat(pid);
    S.view='chat';DRAFTS[S.threadId]=draft;S.workModes[S.threadId]=mode;
    if(pid)S.projectCollapsed[pid]=false;
    const input=document.querySelector('#composer');if(input)input.value=draft;
    render();persist();return;
  }
  if(action==='new-project-thread'||action==='project')S.projectCollapsed[arg]=false;
  if(action==='thread'){const t=S.threads.find(t=>t.id===arg);if(t?.projectId)S.projectCollapsed[t.projectId]=false;}
  if(action==='task-start'){const t=S.tasks.find(t=>t.id===arg);if(t){goProject(t.projectId);return generate(t.kind)}return}
  if(action==='mode-open')return openModeDialog();
  if(action==='start-yolo')return openModeDialog('yolo',true);
  if(action==='mode-apply'){
    const ctx=modeDialog,value=document.querySelector('[name="next-work-mode"]:checked')?.value;
    if(!ctx||!MODE_NAMES[value]||!S.threads.some(t=>t.id===ctx.threadId))return;
    S.workModes[ctx.threadId]=value;closeModal();render();persist();
    if(ctx.startAfter&&value!=='collaborate')return discussPlan(project()?.goal||'完成 SpaceMaster 墨西哥上市策略、素材、官网内容和门店 POP。',value);
    return;
  }
  if(action==='inspector-toggle'){if(S.inspectorOpen&&S.inspectorTab==='status')return handle('inspector-close');return openInspector('status');}
  if(action==='inspector-close'){const action=S.inspectorTab==='project'?'context':'inspector-toggle';S.inspectorOpen=false;render();persist();requestAnimationFrame(()=>document.querySelector(`.work-context-actions [data-action="${action}"]`)?.focus({preventScroll:true}));return}
  if(action==='inspector-tab'){S.inspectorTab=arg;S.inspectorProjectId=S.projectId;render();persist();return}
  if(action==='context'){if(S.inspectorOpen&&S.inspectorTab==='project'&&S.inspectorProjectId===(arg||S.projectId))return handle('inspector-close');return openInspector('project',arg||S.projectId);}
  if(action==='project-info-edit'){const p=project(arg);S.projectInfoDraft={projectId:arg,name:p.name,goal:p.goal};S.inspectorEditing=true;render();return}
  if(action==='project-info-cancel'){S.inspectorEditing=false;S.projectInfoDraft=null;render();persist();return}
  if(action==='project-info-save'){
    const p=project(arg),name=document.querySelector('#project-info-name')?.value.trim(),goal=document.querySelector('#project-info-goal')?.value.trim();
    if(!name)return toast('请填写项目名称。',true);p.name=name;p.goal=goal;S.inspectorEditing=false;S.projectInfoDraft=null;log('更新项目基本信息',name,p.id);render();persist();return;
  }
  if(action==='content-library')return showModal('content-library');
  if(action==='external-sources'||action==='product-intake')return showModal(action,arg);
  if(action==='external-source-save'){
    const title=document.querySelector('#external-title')?.value.trim(),raw=document.querySelector('#external-url')?.value.trim(),category=document.querySelector('#external-category')?.value;
    if(!title||!raw)return toast('请填写信源名称和网址。',true);
    let url;try{url=new URL(raw);if(!['https:','http:'].includes(url.protocol))throw Error()}catch{return toast('请输入有效的 http 或 https 网页链接。',true)}
    S.externalSources.push({id:uid('external'),projectId:S.projectId,title,url:url.href,category,addedAt:now(),status:'待核验'});document.querySelector('#external-title').value='';document.querySelector('#external-url').value='';delete S.panelDrafts[panelKey()];persist();renderModal();return;
  }
  if(action==='content-library-push'){
    const picked=[...document.querySelectorAll('[data-push-id]:checked')].map(n=>({a:artifact(n.dataset.pushId),num:+n.dataset.pushRevision})).filter(({a,num})=>a&&canWrite(a,false)&&revision(a,num)&&(a.accepted===num||approvalFor(a,num))&&!alreadyPushed(a.id,num));
    if(!picked.length)return toast('请选择已确认且尚未推送的成果。',true);
    const added=picked.map(({a,num})=>({id:uid('push'),projectId:a.projectId,artifactId:a.id,revision:num,title:a.title,snapshot:clone(revision(a,num)),status:'sending',at:now(),simulation:true}));S.libraryPushes.push(...added);persist();renderModal();
    await new Promise(resolve=>setTimeout(resolve,window.__LILITH_QA_TIME_SCALE?1:650));
    for(const p of added)if(S.libraryPushes.includes(p)){p.status='received';p.receipt='DEMO-CL-'+p.id;}
    persist();if(MODAL?.kind==='content-library')renderModal();return;
  }
  if(['panel-close','modal-close'].includes(action)&&MODAL?.kind==='batch'){const result=await SHELL.handle(action,arg);openInspector('status');return result}
  if(['project','thread','new-project-thread','choose-project'].includes(action)){S.inspectorProjectId=null;S.inspectorEditing=false;}
  return SHELL.handle(action,arg);
};
document.addEventListener('change',e=>{if(e.target.name==='next-work-mode'&&modeDialog)modeDialog.selected=e.target.value;});
document.addEventListener('click',e=>{if(projectMenuId&&!e.target.closest('.project-tree-row')){projectMenuId=null;render();}});
document.addEventListener('keydown',e=>{
  if(!projectMenuId)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const id=projectMenuId;projectMenuId=null;render();document.querySelector(`[data-action="project-menu"][data-arg="${id}"]`)?.focus();return;}
  if(!e.target.closest('.project-row-menu')||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();const items=[...document.querySelectorAll('.project-row-menu [role="menuitem"]')],current=items.indexOf(document.activeElement);
  const next=e.key==='Home'?0:e.key==='End'?items.length-1:(current+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();
},true);
document.addEventListener('input',e=>{if(['project-info-name','project-info-goal'].includes(e.target.id)&&S.projectInfoDraft){S.projectInfoDraft.name=document.querySelector('#project-info-name').value;S.projectInfoDraft.goal=document.querySelector('#project-info-goal').value;persist();}});
function externalSourcesHTML(){const list=S.externalSources.filter(x=>!S.projectId||x.projectId===S.projectId);return `<p>保存竞品官网、渠道信息和行业报告，供后续研究与内容核对使用。</p><div class="external-source-list">${list.map(x=>`<article><h3>${E(x.title)}</h3><p>${E(x.category)} · ${E(x.status)} · ${new Date(x.addedAt).toLocaleDateString('zh-CN')}</p><a href="${E(x.url)}" target="_blank" rel="noopener noreferrer">${E(new URL(x.url).hostname)} ${icon('arrow')}</a></article>`).join('')||'<div class="notice">尚未添加外部信源。可以先加入竞品产品页，再补充核验信息。</div>'}</div><div class="field"><label for="external-category">信源类型</label><select id="external-category"><option>竞品信息</option><option>渠道信息</option><option>行业报告</option><option>市场动态</option></select></div><div class="field"><label for="external-title">信源名称</label><input id="external-title" placeholder="例如：某品牌墨西哥产品页"></div><div class="field"><label for="external-url">来源网址</label><input id="external-url" type="url" placeholder="https://"></div><p class="small muted">保存链接不会自动验证网页内容；正式引用前仍需核对型号、市场与时间。</p>`;}
function externalSourceCard(){const n=S.externalSources.filter(s=>!S.projectId||s.projectId===S.projectId).length;return `<article class="file-card external-source-card"><div class="row between">${icon('globe')}${tag(n+' 项信源')}</div><h3>外部搜索信源</h3><p>竞品信息、渠道信息与行业报告</p><p>保留网址、添加时间和核验状态</p>${button('查看信源','external-sources','','sm')}</article>`;}
filesHTML=function(){
  if(project()?.inputsReady===false){const p=project();return `<div class="view-inner"><div class="page-head"><div><h1>项目资料</h1><p>${E(p.productName)} 的产品资料与参考信源。</p></div>${button('添加产品资料','attach','','primary','upload')}</div><div class="files-grid"><article class="file-card"><h3>产品基础资料</h3><p>${p.officialSource?E(p.model)+' · 美的墨西哥官网':'型号、功能说明和产品图片待补充。'}</p>${p.officialSource?`<p>${E(p.officialSource.facts)}</p><p>还需补充目标人群、渠道要求与声明依据。</p><a class="btn sm" href="${E(p.officialSource.url)}" target="_blank" rel="noopener noreferrer">查看官网资料 ${icon('arrow')}</a>`:''}${button('补充资料','product-intake',S.projectId,'sm')}</article>${externalSourceCard()}</div></div>`;}
  const html=SHELL.filesHTML(),index=html.lastIndexOf('</div></div>');return html.slice(0,index)+externalSourceCard()+html.slice(index);
};
scopeCard=function(pid){const p=project(pid);if(p?.inputsReady===false)return `<div class="scope-card"><h3>${E(p.name)}</h3><p class="small muted">${E(p.category)} · ${p.channels.map(c=>CHANNEL[c]).join('、')}</p><p>先补充产品型号、功能与使用场景，再确认这次的内容计划。</p>${button('补充产品资料','product-intake',p.id,'sm','upload')}</div>`;return SHELL.scopeCard(pid)};
generate=function(kind){if(project()?.inputsReady===false)return showModal('product-intake',S.projectId);return SHELL.generate(kind)};
confirmPlan=function(id){const plan=planById(id);if(project(plan?.projectId)?.inputsReady===false)return showModal('product-intake',plan.projectId);return SHELL.confirmPlan(id)};
function reviewMaterialCopy(a,v){
  const d=v.data,fields=a.kind==='pop'?[['主标题',d.headline],['副标题',d.subtitle],['核心支撑',d.summary],['型号与落款',d.footer]]:[['标题',d.headline||d.claim||a.title],['简介',d.body||d.summary],['适用说明',d.footer||d.disclaimer]];
  return `<section class="review-material-copy"><h3>本次物料文案</h3><dl>${fields.filter(([,x])=>x).map(([label,text])=>`<div><dt>${label}</dt><dd>${E(text)}</dd></div>`).join('')}</dl>${d.points?.length?`<details><summary>${a.kind==='pop'?'参考卖点（不属于本次 POP 排版）':'页面卖点文案'}</summary>${d.points.filter(p=>p.selected!==false).map(p=>`<section><h4>${E(p.claim||p.title)}</h4><p>${E(a.kind==='pop'?p.short:p.long)}</p></section>`).join('')}</details>`:''}</section>`;
}
const shellMhHTML=mhHTML;
mhHTML=function(a,v){let html=shellMhHTML(a,v);for(const p of v.data.points.filter(p=>p.selected)){const key=a.id+'|'+v.num+'|'+p.id;const old=button('展开完整卖点','point-detail',key,'ghost sm','expand');const details=`<details class="point-inline" data-point-key="${E(key)}" ${S.expandedSellingPoints[key]?'open':''}><summary><span class="point-expand-label">展开卖点</span><span class="point-collapse-label">收起卖点</span>${icon('down')}</summary><div class="point-inline-body">${[['消费者利益',p.benefit],['完整表达',p.long],['功能支撑',p.feature],['适用说明',p.disclaimer]].map(([label,value])=>`<div><h4>${label}</h4><p>${E(value)}</p></div>`).join('')}${sources(p.evidence)}</div></details>`;html=html.replace(old,details)}return html;};
refsHTML=function(a,v){
  const stale=isStale(v),sourceIds=runSpec(a.kind).sources||[],docs=SOURCES.filter(s=>sourceIds.includes(s.id)&&s.id!=='X01');
  return `<div class="reference-sections"><p class="small muted">${stale.length?'参考成果有新版本；当前内容仍保留原来的引用。':'查看这份成果所引用的版本与参考资料。'}</p>${v.refs.length?`<section><h3>参考成果</h3><div class="reference-grid">${v.refs.map(r=>`<button class="reference-card" data-action="open-artifact" data-arg="${E(r.id)}|${r.revision}">${icon(KIND[r.kind]?.icon||'file')}<strong>${E(r.title)}</strong><small>引用版本 v${r.revision}${stale.some(s=>s.id===r.id)?' · 有更新':''}</small><span>查看详情 ${icon('arrow')}</span></button>`).join('')}</div></section>`:''}<section><h3>知识与资料</h3><div class="reference-grid">${docs.map(s=>`<button class="reference-card" data-action="source" data-arg="${s.id}">${icon('book')}<strong>${E(s.name)}</strong><small>${E(s.version)}</small>${tag(s.status,s.status.includes('假设')?'amber':'')}<span>查看资料 ${icon('arrow')}</span></button>`).join('')||'<p class="small muted">本次没有引用内置知识资料。</p>'}</div></section><section><h3>外部搜索信源</h3><div class="reference-grid"><button class="reference-card" data-action="external-sources">${icon('globe')}<strong>竞品与市场参考</strong><small>${S.externalSources.filter(s=>s.projectId===a.projectId).length} 项项目外部信源 · 单独核验</small><span>查看信源 ${icon('arrow')}</span></button></div></section>${stale.length?button('使用更新资料生成新建议','refresh-sources',a.id,'primary'):''}</div>`;
};
document.addEventListener('toggle',e=>{if(e.target.matches?.('.point-inline')&&e.target.isConnected){S.expandedSellingPoints[e.target.dataset.pointKey]=e.target.open;persist();}},true);
