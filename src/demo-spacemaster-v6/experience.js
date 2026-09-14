/* Existing workspace extension: customer language, useful navigation, Plan and YOLO. */
const EXPERIENCE={homeHTML,sidebarHTML,composerHTML,headerHTML,footerHTML,tasksHTML,taskRow,libraryHTML,messageHTML,renderModal,handle,sendPrompt,makeState,versionLabel,canvasHTML,currentSource,taskFor};
const MODE_NAMES={collaborate:'协作',plan:'Plan · 先定计划',yolo:'YOLO · 自主完成'};
function ensureExperience(state,seed=true){
  state.schema=APP_VERSION;
  state.plans??=[];state.batches??=[];state.workModes??={};state.taskFilter??='mine';
  if(seed&&!window.MARKETING_DESKTOP&&!state.examplesAdded){
    for(const [suffix,name,channels,goal] of [
      ['launch','SpaceMaster 墨西哥上市',['web','retail'],'完成墨西哥上市策略与官网、门店物料。'],
      ['website','SpaceMaster 官网焕新',['web'],'以厨房升级场景完善官网产品页表达。'],
      ['retail','SpaceMaster 门店推广',['retail'],'准备墨西哥线下门店的产品素材与 POP。']]){
      if(state.projects.some(p=>p.name===name||(suffix==='launch'&&p.model===PRODUCT.model&&p.channels.includes('web')&&p.channels.includes('retail'))))continue;
      const id='sample-'+suffix,tid='sample-chat-'+suffix;
      state.projects.push({id,name,model:PRODUCT.model,category:'冰箱',tier:'Hero',market:'MX',markets:['MX'],channels,language:'es-MX',goal,owner:'lin',scopeConfirmed:false,ruleVersion:2,threadId:tid,created:now(),contextArtifacts:[],sample:true});
      state.threads.push({id:tid,title:name,projectId:id,messages:[],created:now()});
    }
    state.examplesAdded=true;
  }
  return state;
}
makeState=()=>ensureExperience(EXPERIENCE.makeState());
ensureExperience(S);
for(const batch of S.batches)if(['running','paused'].includes(batch.status)){batch.status='interrupted';batch.items.filter(i=>['making','checking'].includes(i.status)).forEach(i=>i.status=i.artifactId?'checking':'pending');}
function workMode(){return S.workModes[S.threadId]||'collaborate'}
function pendingBatches(){return S.batches.filter(b=>['ready','needs_review','changes_requested'].includes(b.status)&&b.items.some(i=>i.decision==='pending'||i.decision==='changes_requested'))}
function projectThreads(){return S.threads.filter(t=>t.projectId===S.projectId&&(t.messages.length||t.id===S.threadId)).slice(-8).reverse()}
sidebarHTML=function(){
  const mine=S.tasks.filter(t=>t.assignee===S.actor&&!['done','cancelled'].includes(t.status)).length;
  const reviews=pendingBatches().filter(b=>b.owner===S.actor||b.reviewer===S.actor).length+S.submissions.filter(s=>s.reviewer===S.actor&&s.status==='pending').length;
  return `<aside class="sidebar ${S.mobileNav?'open':''}"><div class="brand-lockup"><div class="wordmark">Lilith</div><span class="line"></span><img src="${MERGED_ASSETS.logo}" alt="Midea"></div>${button('新的对话','new-chat','','new-btn','compose')}<div class="sidebar-scroll"><div class="primary-nav">${button('我的任务'+(mine?`<span class="count">${mine}</span>`:''),'my-tasks','','nav-item '+(navigationView()==='tasks'&&S.taskFilter==='mine'?'active':''),'tasks')}${button('待我审核'+(reviews?`<span class="count">${reviews}</span>`:''),'review-inbox','','nav-item','shield')}${button('工作成果','nav','library','nav-item '+(navigationView()==='library'?'active':''),'layers')}${button('能力与连接','capabilities','','nav-item','plug')}</div><div class="nav-label">项目 ${ibutton('选择或创建项目','project-picker','','folder')}</div>${projectTreeHTML()}</div><div class="sidebar-bottom">${button('工作偏好','settings','','nav-item','settings')}${button('帮助与说明','about','','nav-item','info')}<div class="workspace-badge">美的 · Marketing Workspace</div></div></aside>`;
};
composerHTML=function(home=false){
  let html=EXPERIENCE.composerHTML(home);
  html=html.replace(/<span class="scope-label">[\s\S]*?<\/span>/,modeControlHTML());
  html=html.replace('<div class="composer-frame">',composerProjectHTML()+'<div class="composer-frame">');
  html=html.replace(/<p class="input-note">[\s\S]*?<\/p>/,'');
  return html;
};
homeHTML=function(){return `<div class="home-content"><h1>你好，${E(PEOPLE[S.actor].name)}。<br>今天，我们一起做什么？</h1><p class="home-desc">研究市场，打磨产品卖点，准备下一次上市。<br>你可以先问一个问题，也可以把整个项目交给 Lilith。</p>${composerHTML(true)}<div class="quick-grid">${[['research','search','了解目标市场','分析场景与机会'],['create','compass','筹备新品上市','从产品策略到渠道物料'],['assets','image','查找产品素材','找到适合当前用途的图片'],['content-check','shield','检查营销内容','核对产品声明与品牌表达']].map(([key,ic,title,sub])=>`<button class="quick-card" data-action="${key==='content-check'?key:'prompt'}" data-arg="${key}">${icon(ic)}<strong>${title}</strong><small>${sub}</small></button>`).join('')}</div><section class="yolo-home"><div><h2>先定计划，把整套工作交给 Lilith。</h2><p>开启 YOLO，确认交付范围。Lilith 连续完成制作与自检，你回来后集中审核。</p></div>${button('试试 YOLO','start-yolo','','primary','play')}</section><section class="sample-space"><div class="space-preview"><div class="product-tile">${fridge()}</div><div><h3>SpaceMaster 墨西哥上市</h3><p class="small muted">产品策略、价值主张、官网内容与门店 POP</p></div><span class="spacer"></span>${button('进入项目','project',S.projects.find(p=>p.id==='sample-launch')?.id||S.projects[0]?.id,'sm','arrow')}</div></section></div>`};
headerHTML=function(){let html=EXPERIENCE.headerHTML();return html.replace('项目上下文','项目资料').replace('>交付</','>任务</')};
footerHTML=function(){return ''};
tasksHTML=function(){
  const p=project(),all=S.tasks.filter(t=>(!p||t.projectId===p.id)&&(S.taskFilter==='all'||t.assignee===S.actor||t.reviewer===S.actor&&t.status==='review'));
  return `<div class="view-inner"><div class="page-head"><div><h1>${p?'项目任务':'我的任务'}</h1><p>查看你负责的工作、当前进度和需要审核的成果。</p></div>${p?button('制定工作计划','start-yolo','','primary','tasks'):button('选择项目','project-picker','','primary','folder')}</div><div class="filter-tabs">${button('由我负责','task-filter','mine',S.taskFilter==='mine'?'primary sm':'sm')}${button('全部任务','task-filter','all',S.taskFilter==='all'?'primary sm':'sm')}</div>${S.batches.filter(b=>!p||b.projectId===p.id).map(batchSummaryHTML).join('')}${all.length?`<div class="task-cards">${all.map(taskRow).join('')}</div>`:emptyHTML('还没有待办任务','选择一个项目，和 Lilith 确认这次要完成的工作。','选择项目','project-picker')}</div>`;
};
taskRow=function(t){
  const a=artifact(t.artifactId),states={todo:['待开始',''],working:['进行中','blue'],draft_ready:['草稿待确认','amber'],changes_requested:['待修改','amber'],review:['待审核','amber'],done:['已完成','green'],cancelled:['已取消','']};
  const [label,color]=states[t.status]||['待处理',''];
  const review=t.status==='review'&&S.actor===t.reviewer;
  const action=a?button(review?'审核成果':t.status==='draft_ready'?'查看草稿':'查看详情',review?'review-task':'open-artifact',review?t.id:a.id,'sm'):t.batchId?button('查看进度','batch-open',t.batchId,'sm'):S.actor===t.assignee?button('开始任务','task-start',t.id,'sm','play'):'';
  return `<article class="task-row task-card" data-task-id="${E(t.id)}"><div class="task-card-title">${icon(t.status==='done'?'check':KIND[t.kind].icon)}<h3>${E(t.name)}</h3></div><p>${E(project(t.projectId)?.name||'')} · ${E(PEOPLE[t.assignee]?.name||'待分配')}</p><div class="task-card-actions">${tag(label,color)}<span class="spacer"></span>${action}${ibutton('任务要求与协作','task-detail',t.id,'info')}</div></article>`;
};
libraryHTML=function(){const html=EXPERIENCE.libraryHTML();return html.replace('每一步，都留下可以继续的成果。','工作成果').replace('研究、草稿、素材与正式物料，使用同一套查看、引用和版本机制。','按项目查找研究、策略、素材和渠道内容。').replace('<div class="filter-tabs">',S.batches.filter(b=>!S.projectId||b.projectId===S.projectId).map(batchSummaryHTML).join('')+'<div class="filter-tabs">')};
renderModal=function(){
  if(MODAL?.kind==='project-picker'){dockRoot().innerHTML=modalFrame('选择项目',`<p class="muted small">把这次工作放进项目，方便后续查找资料和成果。</p><div class="project-options">${S.projects.map(p=>button(E(p.name),'choose-project',p.id,'project-option','folder')).join('')}${button('暂不选择，直接提问','choose-project','none','project-option','message')}</div>`,button('筹备新的上市项目','prompt','create','sm','plus'));mountDock();return}
  if(MODAL?.kind==='content-check'){dockRoot().innerHTML=modalFrame('检查营销内容',`<p>粘贴需要检查的文案，Lilith 会核对产品声明和品牌表达。</p><div class="field"><label for="check-copy">待检查文案</label><textarea id="check-copy" placeholder="例如：SpaceMaster，570 L 大容量，让厨房更有条理。"></textarea></div><p class="small muted">核对产品：SpaceMaster · MDRS761MYM45A · 墨西哥</p><div id="copy-check-result" aria-live="polite"></div>`,button('开始检查','check-copy','','primary','shield'));mountDock();restorePanelValues();return}
  if(['plan','batch','review-inbox'].includes(MODAL?.kind))return renderBatchPanel();
  EXPERIENCE.renderModal();
  if(MODAL?.kind==='about')dockRoot().innerHTML=modalFrame('帮助与说明',`<section class="section"><h3>三种协作方式</h3><p>协作：边讨论边完成工作。Plan：先确认目标和交付清单。YOLO：确认计划后连续制作、自检，最后集中审核草稿。</p></section><section class="section"><h3>当前原型的能力范围</h3><p>本页是交互原型，使用预置业务情境。项目、编辑、版本、草稿审核和导出在当前浏览器内保存；模型、MCP 与外部内容库尚未接入。</p><p>YOLO 执行时可切换项目和对话，但浏览器页面需要保持打开。关闭或刷新后，已保存的草稿仍在，未完成的工作需点击继续。</p><p>预置项目用于体验，产品图片沿用官网归档。商业授权和印前条件需另行确认。</p></section>`,button('播放完整故事','auto-start','','sm','play')+button('重置体验数据','reset','','sm'));
};
handle=async function(action,arg=''){
  if(action==='my-tasks'){S.projectId=null;S.taskFilter='mine';return EXPERIENCE.handle('nav','tasks')}
  if(action==='task-filter'){S.taskFilter=arg;render();persist();return}
  if(action==='choose-project'){const draft=document.querySelector('#composer')?.value||'',mode=workMode();closeModal();if(arg==='none')newChat();else goProject(arg);DRAFTS[S.threadId]=draft;S.workModes[S.threadId]=mode;const comp=document.querySelector('#composer');if(comp)comp.value=draft;render();persist();return}
  if(['project-picker','content-check','review-inbox'].includes(action))return showModal(action,arg);
  if(action==='check-copy'){
    const text=document.querySelector('#check-copy')?.value.trim();if(!text)return toast('请先填写需要检查的文案。',true);
    const result=inspectContent({kind:'notes',id:'copy-check'},{num:1,data:{text}});
    document.querySelector('#copy-check-result').innerHTML=`<div class="notice ${result.passed?'':'warn'}">${result.passed?'未发现规则覆盖范围内的问题。':'发现需要修改的声明。'}</div>${result.findings.map(f=>`<section class="section"><h3>${f.ok?'通过':'待修改'} · ${E(f.title)}</h3><p>${E(f.detail)}</p></section>`).join('')}`;return;
  }
  if(action.startsWith('batch-')||action.startsWith('plan-')||action==='start-yolo')return handleBatchAction(action,arg);
  const activeBatch=S.batches.find(b=>['running','paused'].includes(b.status));
  if(activeBatch&&action==='pause')return handleBatchAction('batch-pause',activeBatch.id);
  if(activeBatch&&action==='cancel-run')return handleBatchAction('batch-cancel',activeBatch.id);
  if(action==='retry-run'){const r=S.runs.find(r=>r.id===arg);if(r?.batchId)return handleBatchAction('batch-resume',r.batchId)}
  if(action==='restore-confirm'&&window.pendingBackup){ensureExperience(window.pendingBackup);for(const b of window.pendingBackup.batches)if(['running','paused'].includes(b.status))b.status='interrupted';}
  return EXPERIENCE.handle(action,arg);
};
sendPrompt=async function(text){
  if(['plan','yolo'].includes(workMode())&&!S.contextSelection)return discussPlan(text,workMode());
  return EXPERIENCE.sendPrompt(text);
};
