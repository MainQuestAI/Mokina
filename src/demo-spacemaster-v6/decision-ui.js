/* Personal decisions are separate from project work and immutable approvals. */
const DECISION_UI={handle,render,renderModal,showModal,headerHTML,sidebarHTML,tasksHTML,chatHTML,conversationStart,submitArtifact,batchPanelHTML,renderBatchPanel,versionLabel};
let decisionSubmission=null;
const decisionPreviousBatchLabel=batchLabel,decisionPreviousTaskRow=taskRow,decisionPreviousStatus=workStatusHTML;
batchLabel=b=>decisionPreviousBatchLabel(b).replace('草稿待审核','草稿待采用').replace('草稿已确认','草稿已采用');
taskRow=t=>decisionPreviousTaskRow(t).replaceAll('草稿待确认','草稿待采用').replaceAll('待审核','待审批').replaceAll('审核成果','审批成果');
workStatusHTML=()=>decisionPreviousStatus().replaceAll('待我审核','待处理').replaceAll('待审核内容','待处理内容').replaceAll('草稿或正式提交等待你查看','草稿等待采用，或固定提交等待审批');
function pendingAdoptions(){
  const seen=new Set(),rows=[];
  for(const a of S.artifacts){
    const num=a.pending||(!a.accepted?a.active:null),v=num&&revision(a,num),key=a.id+'|'+num;
    if(!v||a.accepted===num||!canWrite(a,false)||seen.has(key))continue;
    seen.add(key);rows.push({a,num,v});
  }
  return rows;
}
function pendingApprovals(){return S.submissions.filter(s=>s.status==='pending'&&s.reviewer===S.actor);}
actionableReviews=()=>pendingAdoptions().length+pendingApprovals().length;
function decisionCompletion(t){return t?.maturity==='approved'?`完成条件：由 ${PEOPLE[t.reviewer]?.name||'指定审核人'} 批准固定版本`:'完成条件：采用完整草稿后完成';}
function decisionGroupsHTML(items,tab){
  const groups=new Map();
  for(const row of items){const a=tab==='adopt'?row.a:artifact(row.artifactId),pid=a?.projectId||row.projectId||'independent',num=tab==='adopt'?row.num:row.revision,b=tab==='adopt'?S.batches.findLast(b=>b.items.some(i=>i.artifactId===a.id&&i.revision===num)):null;
    if(!groups.has(pid))groups.set(pid,new Map());const batches=groups.get(pid),key=b?.id||'single';if(!batches.has(key))batches.set(key,{b,rows:[]});batches.get(key).rows.push({row,a,num});
  }
  return [...groups].map(([pid,batches])=>`<section class="decision-project-group" data-decision-project="${E(pid)}"><h2>${E(project(pid)?.name||'独立工作')}</h2>${[...batches.values()].map(({b,rows})=>`<section class="decision-batch-group">${b?`<div class="decision-group-head"><h3>草稿批次 · 计划 v${b.plan?.revision||1}</h3>${button('查看批次','batch-open',b.id,'ghost sm')}</div>`:'<h3 class="decision-group-label">单份成果</h3>'}${rows.map(({row,a,num})=>{const t=S.tasks.find(t=>t.id===a?.taskId);return `<article class="decision-row"><div><h3>${E(a?.title||row.title)} <span>v${num}</span></h3><p>${E(decisionCompletion(t))}</p><p class="small muted">${tab==='adopt'?'采用后用于后续工作，不代表正式批准':'审批对象已固定，后续草稿不会改变此提交'}</p></div>${button(tab==='adopt'?'查看并采用':'审批固定版本',tab==='adopt'?'open-artifact':'review',tab==='adopt'?a.id+'|'+num:row.id,'sm',tab==='adopt'?'file':'shield')}</article>`}).join('')}</section>`).join('')}</section>`).join('');
}
function decisionPageHTML(){
  const adoptRows=pendingAdoptions(),approvalRows=pendingApprovals(),tab=S.decisionTab==='approve'?'approve':'adopt';
  const items=tab==='adopt'?adoptRows:approvalRows;
  return `<div class="view-inner decision-page"><div class="page-head"><div><h1>待处理</h1><p>采用可继续使用的草稿，或审批提交给你的固定版本。</p></div></div><div class="decision-tabs" role="tablist" aria-label="待处理类型">${[['adopt','待我采用',adoptRows.length],['approve','待我审批',approvalRows.length]].map(([id,label,n])=>`<button type="button" role="tab" id="decision-tab-${id}" aria-controls="decision-list" aria-selected="${tab===id}" tabindex="${tab===id?0:-1}" data-action="decision-tab" data-arg="${id}">${label}<span>${n}</span></button>`).join('')}</div><section id="decision-list" role="tabpanel" aria-labelledby="decision-tab-${tab}">${items.length?decisionGroupsHTML(items,tab):`<div class="decision-empty"><h2>当前没有${tab==='adopt'?'待采用草稿':'待审批提交'}</h2><p>${tab==='adopt'?'你有编辑权限的新草稿会出现在这里。':'只有指定给当前角色的正式提交会出现在这里。'}</p></div>`}</section></div>`;
}
tasksHTML=function(){return S.view==='review'?decisionPageHTML():DECISION_UI.tasksHTML();};
conversationStart=function(){return DECISION_UI.conversationStart()&&(!S.projectId||S.decisionLauncherThread===S.threadId);};
chatHTML=function(){const p=project();if(p&&!thread()?.messages.length&&!S.canvas&&!conversationStart())return `<section class="chat-column"><div class="chat-scroll"><div class="conversation decision-project-empty"><h1>${E(p.name)}</h1><p>${E(p.goal||'在这个项目中开始讨论，资料和成果会保留在这里。')}</p>${button('制定工作计划','decision-project-plan',p.id,'primary','tasks')}</div></div>${composerHTML()}</section>`;return DECISION_UI.chatHTML();};
headerHTML=function(){
  let html=DECISION_UI.headerHTML();
  if(!S.projectId&&['tasks','library','review'].includes(navigationView())){
    const name={tasks:'我的任务',library:'工作成果',review:'待处理'}[navigationView()];
    const t=document.createElement('template');t.innerHTML=html;
    const strong=t.content.querySelector('.crumb strong');if(strong)strong.textContent=name;
    const bar=t.content.querySelector('.work-context-bar');if(bar){bar.setAttribute('aria-label',name);bar.querySelector('.personal-work-label')?.remove();bar.classList.add('decision-global-bar');}
    html=t.innerHTML;
  }
  return html;
};
sidebarHTML=function(){const t=document.createElement('template');t.innerHTML=DECISION_UI.sidebarHTML();const entry=t.content.querySelector('[data-action="review-inbox"]');if(entry){entry.innerHTML=icon('shield')+'待处理'+(actionableReviews()?`<span class="count">${actionableReviews()}</span>`:'');entry.classList.toggle('active',S.view==='review');entry.setAttribute('aria-current',S.view==='review'?'page':'false');}const library=t.content.querySelector('.primary-nav [data-action="nav"][data-arg="library"]');if(library)library.dataset.action='decision-library';return t.innerHTML;};
versionLabel=function(a,num){const result=DECISION_UI.versionLabel(a,num);return [result[0].replace('已确认草稿','已采用').replace('待采用建议','待采用').replace('草稿待确认','待采用').replace('待审核','待审批'),result[1]];};
function decisionSubmissionReason(a,num){
  if(!a||!revision(a,num))return '成果版本不存在';
  if(!canWrite(a,false))return '当前角色无权提交这份成果';
  if(a.pending)return '存在未采用候选，请先采用或处理候选版本';
  if(a.active!==num||a.accepted!==num)return '请先采用这个完整版本';
  const t=S.tasks.find(t=>t.id===a.taskId);
  if(!t||t.maturity!=='approved')return '这项成果不要求正式审批';
  if(S.submissions.some(s=>s.artifactId===a.id&&s.status==='pending'))return '已有待审批提交';
  if(S.submissions.some(s=>s.artifactId===a.id&&s.revision===num&&s.status==='approved'))return '这个版本已经批准';
  return '';
}
function batchDecisionCounts(b){
  if(['running','paused'].includes(b.status))return {selected:0,adopt:[],submit:[]};
  const items=b.items.filter(i=>i.selected!==false),available=[...new Map(items.filter(i=>{const a=artifact(i.artifactId);return a&&revision(a,i.revision)&&canWrite(a,false);}).map(i=>[i.artifactId+'|'+i.revision,i])).values()];
  const adopt=available.filter(i=>i.status==='ready'&&!['changes_requested','submitted','approved'].includes(i.decision)&&artifact(i.artifactId).accepted!==i.revision&&(!artifact(i.artifactId).pending||artifact(i.artifactId).pending===i.revision));
  const submit=available.filter(i=>!decisionSubmissionReason(artifact(i.artifactId),i.revision));
  return {selected:items.length,adopt,submit};
}
batchPanelHTML=function(b){const t=document.createElement('template');t.innerHTML=DECISION_UI.batchPanelHTML(b).replaceAll('草稿待审核','草稿待采用').replaceAll('已确认草稿','已采用').replaceAll('确认草稿用于后续工作','采用草稿用于后续工作').replaceAll('审核意见（退回时必填）','修改意见（退回时必填）');t.content.querySelectorAll('.batch-item').forEach((el,index)=>{const task=S.tasks.find(t=>t.id===b.items[index]?.taskId);el.querySelector('.batch-item-meta')?.insertAdjacentHTML('afterend',`<p class="batch-item-completion">${E(decisionCompletion(task))}</p>`);});return t.innerHTML;};
function decorateBatchDecisions(){
  if(MODAL?.kind!=='batch')return;const b=batchById(MODAL.arg);if(!b)return;
  const c=batchDecisionCounts(b),root=dockRoot();
  if(['running','paused'].includes(b.status))return;
  const canHandle=b.items.some(i=>artifact(i.artifactId)&&canWrite(artifact(i.artifactId),false));
  for(const [action,label,n,reason] of [['batch-accept','采用所选',c.adopt.length,'所选项没有可采用的完整草稿；请等待自检完成或先处理新版。'],['batch-submit','提交审批',c.submit.length,'所选项没有可提交的成果；请先采用需正式审批的版本，并处理所有新候选。']]){
    if(canHandle&&!root.querySelector(`[data-action="${action}"]`))root.querySelector('.modal-foot')?.insertAdjacentHTML('beforeend',button(label,action,b.id,'sm'));
    const el=root.querySelector(`[data-action="${action}"]`);if(!el)continue;
    el.innerHTML=label+`（${n}）`;el.disabled=n===0;el.setAttribute('aria-describedby',action+'-reason');
    root.querySelector('#'+action+'-reason')?.remove();
    el.parentElement.insertAdjacentHTML('beforebegin',`<p class="decision-action-reason" id="${action}-reason">${n?`已选择 ${c.selected} 项，其中 ${n} 项可${action==='batch-accept'?'采用':'提交审批'}。`:reason}</p>`);
  }
}
renderBatchPanel=function(){DECISION_UI.renderBatchPanel();decorateBatchDecisions();};
function openDecisionSubmission(targets,batchId=null){
  decisionSubmission={batchId,targets:targets.map(({id,num})=>({id,num,snapshot:JSON.stringify(revision(artifact(id),num)),check:null})),checking:false,error:''};
  return showModal('decision-submit');
}
function decisionSubmitHTML(){
  const ctx=decisionSubmission;if(!ctx)return '';
  return `<p>只提交以下固定成果版本及其来源。提交前完成一次内容检查；审批由指定审核人决定。</p><div class="decision-submit-list">${ctx.targets.map(x=>{const a=artifact(x.id),t=S.tasks.find(t=>t.id===a?.taskId),reason=decisionSubmissionReason(a,x.num);return `<article><h3>${E(a?.title||'成果不存在')} · v${x.num}</h3><p>${E(project(a?.projectId)?.name||'独立工作')} · 审核人：${E(PEOPLE[t?.reviewer]?.name||'未指定')}</p><p>${E(t?.requirement||'')}</p>${reason?`<p class="notice warn">${E(reason)}</p>`:''}${x.check?`<p class="decision-check-result ${x.check.passed?'passed':'failed'}">${x.check.passed?'提交前检查通过':'提交前检查未通过，请修改后重新检查'}</p><details><summary>检查明细</summary><pre>${E(JSON.stringify(x.check,null,2))}</pre></details>`:'<p class="small muted">待提交前检查</p>'}</article>`}).join('')}</div>${ctx.error?`<p role="alert" class="notice warn">${E(ctx.error)}</p>`:''}`;
}
function renderDecisionSubmission(){
  const ctx=decisionSubmission;if(!ctx)return;const blocked=ctx.targets.some(x=>decisionSubmissionReason(artifact(x.id),x.num)),checked=ctx.targets.length&&ctx.targets.every(x=>x.check?.passed);
  let action=button(ctx.checking?'正在检查…':checked?`提交 ${ctx.targets.length} 项固定版本`:'检查并准备提交',checked?'decision-submit-final':'decision-submit-check','','primary','shield');
  if(blocked||ctx.checking||!ctx.targets.length)action=action.replace('<button ','<button disabled ');
  dockRoot().innerHTML=modalFrame('提交审批前检查',decisionSubmitHTML(),button('返回修改','panel-close')+action);mountDock();
}
showModal=function(kind,arg=''){
  if(kind==='submit'){const [id,raw]=String(arg).split('|'),a=artifact(id);return openDecisionSubmission([{id,num:Number(raw)||a?.active}]);}
  if(kind==='review-inbox')return openDecisionPage();
  return DECISION_UI.showModal(kind,arg);
};
renderModal=function(){if(MODAL?.kind==='decision-submit')return renderDecisionSubmission();DECISION_UI.renderModal();decorateBatchDecisions();};
function openDecisionPage(){closeModal();S.projectId=null;S.canvas=null;S.artifactWorkspace=null;S.inspectorOpen=false;S.view='review';S.decisionTab=pendingAdoptions().length?'adopt':pendingApprovals().length?'approve':'adopt';render();persist();}
submitArtifact=function(id,num){const a=artifact(id);return openDecisionSubmission([{id,num:num||a?.active}]);};
function submissionTargetsStillValid(ctx){return ctx.targets.every(x=>!decisionSubmissionReason(artifact(x.id),x.num)&&JSON.stringify(revision(artifact(x.id),x.num))===x.snapshot);}
handle=async function(action,arg=''){
  if(action==='review-inbox')return openDecisionPage();
  if(action==='decision-project-plan')return openUnifiedPlan(arg);
  if(action==='set-role'){const result=await DECISION_UI.handle(action,arg);if(S.view==='review'){S.decisionTab=pendingAdoptions().length?'adopt':pendingApprovals().length?'approve':'adopt';render();persist();}return result;}
  if(action==='decision-tab'){S.decisionTab=arg;render();persist();document.querySelector('#decision-tab-'+arg)?.focus();return;}
  if(action==='decision-library'){closeModal();S.projectId=null;return DECISION_UI.handle('nav','library');}
  if(action==='project'){closeModal();S.decisionLauncherThread=null;S.canvas=null;S.artifactWorkspace=null;S.inspectorOpen=false;S.projectCollapsed[arg]=false;return goProject(arg);}
  if(action==='new-project-thread'){closeModal();newChat(arg);S.decisionLauncherThread=S.threadId;render();persist();return;}
  if(action==='choose-project'){const r=await DECISION_UI.handle(action,arg);S.decisionLauncherThread=S.threadId;render();persist();return r;}
  if(action==='thread')S.decisionLauncherThread=null;
  if(action==='batch-submit'){const b=batchById(arg);if(!b)return;selectedBatchItems(b);const c=batchDecisionCounts(b);if(!c.submit.length)return toast('没有可提交审批的已采用成果。',true);return openDecisionSubmission(c.submit.map(i=>({id:i.artifactId,num:i.revision})),b.id);}
  if(action==='batch-accept'){const b=batchById(arg);if(!b)return;selectedBatchItems(b);const rows=batchDecisionCounts(b).adopt;if(!rows.length)return toast('没有可采用的完整草稿。',true);for(const i of rows)adopt(i.artifactId,i.revision);recalcBatch(b);showModal('batch',b.id);persist();return;}
  if(action==='decision-submit-check'){
    const ctx=decisionSubmission;if(!ctx)return;if(!submissionTargetsStillValid(ctx)){ctx.error='成果版本或处理权限已改变，请返回成果重新选择。';return renderDecisionSubmission();}
    ctx.checking=true;renderDecisionSubmission();await new Promise(resolve=>requestAnimationFrame(resolve));
    try{for(const x of ctx.targets){const a=artifact(x.id);x.check=inspectContent(a,revision(a,x.num));}ctx.error='';}catch(e){ctx.error='检查未完成：'+e.message;}finally{ctx.checking=false;}
    if(decisionSubmission===ctx&&MODAL?.kind==='decision-submit')renderDecisionSubmission();return;
  }
  if(action==='decision-submit-final'||action==='submit-confirm'){
    const ctx=decisionSubmission;if(!ctx||!ctx.targets.every(x=>x.check?.passed))return toast('请先完成提交前检查。',true);
    if(!submissionTargetsStillValid(ctx)){ctx.error='存在新候选、版本变化或重复提交，请返回成果重新选择。';return renderDecisionSubmission();}
    for(const x of ctx.targets){const a=artifact(x.id);a.checks??={};a.checks[x.num]=clone(x.check);DECISION_UI.submitArtifact(x.id,x.num);}
    const batch=ctx.batchId&&batchById(ctx.batchId);decisionSubmission=null;if(batch)showModal('batch',batch.id);return;
  }
  return DECISION_UI.handle(action,arg);
};
render=function(bottom=false){DECISION_UI.render(bottom);decorateBatchDecisions();for(const el of document.querySelectorAll('[data-action="adopt"]')){const arg=el.dataset.arg||'',num=arg.split('|')[1];el.innerHTML=icon('check')+(num?'采用 v'+num:'采用此版本');}for(const el of document.querySelectorAll('[data-action="submit"]'))el.innerHTML=icon('shield')+'提交审批';for(const el of document.querySelectorAll('#version-select option'))el.textContent=el.textContent.replace('已确认','已采用');};
document.addEventListener('change',e=>{if(e.target.matches('[data-batch-select]'))decorateBatchDecisions();});
document.addEventListener('keydown',e=>{if(!e.target.matches('[data-action="decision-tab"]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();handle('decision-tab',e.key==='Home'?'adopt':e.key==='End'?'approve':S.decisionTab==='adopt'?'approve':'adopt');});
