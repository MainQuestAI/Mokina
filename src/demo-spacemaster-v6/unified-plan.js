/* One project-bound delivery plan; execution snapshots never follow navigation. */
const UNIFIED_PLAN={showModal,handle,makeState,renderBatchPanel,ensureExperience};
let planProjectPicking=false;
function planProjectContext(p){
  const snapshot=window.V62Inputs?.projectSnapshot(p.id);
  return {product:p.productName||p.model,model:p.model||'',category:p.category||'',market:p.market,language:p.language,channels:clone(p.channels||[]),inputSnapshotId:snapshot?.id||null,contextRevision:window.V62Inputs?.inputReadiness(p.id)?.contextRevision||0};
}
function projectPlanRules(pid){
  const p=project(pid);if(!p)return [];
  const rows=demoProject(p)?demoRules():DEMO_PREVIOUS.rulesFor(p.channels||[],p.tier);
  return rows.map(r=>({...r,name:r.kind==='mh'?'Message House':r.name,reason:r.kind==='mh'?`${p.market||'待明确市场'} · ${p.language||'待明确语言'}`:r.reason,requirement:String(r.requirement||'交付要求待补充，开始前请核对。').replace(/演示审核/g,'审核').replace(/集中确认草稿/g,'集中采用版本')}));
}
planKinds=p=>projectPlanRules(p.id).filter(r=>r.category!=='推荐').map(r=>r.kind);
ensurePlanProject=()=>project(S.projectId)||null;
function migrateUnifiedPlans(state){
  state.plans??=[];
  for(const p of state.projects){
    const plans=state.plans.filter(x=>x.projectId===p.id);
    for(const plan of plans){plan.kinds??=[];plan.notes??=[];plan.revision??=1;plan.mode??='collaborate';plan.context??=planProjectContext(p);}
    if(p.scopeConfirmed&&!plans.length){const historical=p.scope?.length?p.scope:state.tasks.filter(t=>t.projectId===p.id);const rules=demoProject(p)?demoRules():DEMO_PREVIOUS.rulesFor(p.channels||[],p.tier);state.plans.push({id:'legacy-plan-'+p.id,projectId:p.id,threadId:p.threadId,owner:p.owner,revision:1,status:'draft',mode:'collaborate',goal:p.goal||p.name,kinds:[...new Set((historical.length?historical:rules.filter(r=>r.category!=='推荐')).map(r=>r.kind))],notes:[],scopeAccepted:true,legacy:true,context:{product:p.productName||p.model,market:p.market,language:p.language,channels:clone(p.channels||[])},created:p.created||now()});}
  }
  state.unifiedPlanMigration=1;return state;
}
makeState=()=>migrateUnifiedPlans(UNIFIED_PLAN.makeState());migrateUnifiedPlans(S);
ensureExperience=function(state,...args){return migrateUnifiedPlans(UNIFIED_PLAN.ensureExperience(state,...args));};
function ensureUnifiedPlan(pid,mode){
  const p=project(pid);if(!p)return null;
  let plan=S.plans.findLast(x=>x.projectId===pid&&x.status==='draft');
  if(!plan){const prev=S.plans.findLast(x=>x.projectId===pid);plan={id:uid('plan'),projectId:pid,threadId:p.threadId||S.threadId,owner:p.owner||S.actor,revision:(prev?.revision||0)+1,status:'draft',mode:mode||'collaborate',goal:prev?.goal||p.goal||p.name,kinds:clone(prev?.kinds||planKinds(p)),notes:[],created:now(),context:planProjectContext(p)};S.plans.push(plan);}
  if(mode)plan.mode=mode;return plan;
}
function openUnifiedPlan(pid=S.projectId){const plan=ensureUnifiedPlan(pid);if(!plan)return toast('请先在输入框选择项目，再制定交付计划。',true);return UNIFIED_PLAN.showModal('plan',plan.id);}
showModal=function(kind,arg=''){return kind==='scope'?openUnifiedPlan(arg||S.projectId):UNIFIED_PLAN.showModal(kind,arg);};
discussPlan=function(text,mode='collaborate'){
  const p=ensurePlanProject();if(!p)return toast('请先选择项目。不会自动关联其他项目。',true);
  if(p.owner!==S.actor)return toast('请由项目负责人制定交付计划。',true);
  text=String(text||'').trim();if(!text)return;
  const plan=ensureUnifiedPlan(p.id,mode);plan.threadId=S.threadId;if(!plan.notes.length)plan.goal=text;plan.notes.push(text);
  clearComposer();closeModal();S.workModes[S.threadId]=mode;addMsg('user',text);
  addMsg('assistant',`交付计划已保存到「${p.name}」。保存不会开始制作；你可以只开始当前工作，或按计划连续制作。`,{planId:plan.id});
  delete S.panelDrafts['plan|'+plan.id];showModal('plan',plan.id);render(true);persist();return plan;
};
function validateUnifiedPlan(plan,execution='all'){
  const p=project(plan?.projectId),errors=[];if(!p)return ['请明确计划所属项目。'];
  if(!String(plan.goal||'').trim())errors.push('请填写本次目标。');
  if(!plan.kinds?.length)errors.push('请至少选择一项交付。');
  if(p.inputsReady===false)errors.push('请先补齐并核对项目产品资料。');
  if(!p.market||!p.language)errors.push('请在项目资料中明确市场与语言。');
  const rules=projectPlanRules(p.id),supported=rules.map(r=>r.kind);
  for(const rule of rules.filter(r=>r.category==='必需'))if(!plan.kinds?.includes(rule.kind))errors.push(`组织要求包含：${rule.name}。`);
  for(const k of plan.kinds||[])if(!supported.includes(k))errors.push(`${KIND[k]?.name||k}：暂不支持，需调整。`);
  const current=planProjectContext(p),ctx=plan.context||{};
  if(ctx.market!==p.market||ctx.language!==p.language||JSON.stringify(ctx.channels||[])!==JSON.stringify(p.channels||[])||['product','model','category','inputSnapshotId','contextRevision'].some(key=>key in ctx&&ctx[key]!==current[key]))errors.push('项目资料、产品、市场、语言或渠道已变化，请同步计划上下文。');
  const chosen=execution==='current'?[plan.currentKind||plan.kinds?.[0]]:plan.kinds||[];
  if(execution==='current'&&!plan.kinds?.includes(chosen[0]))errors.push('当前工作不在本次交付范围，请重新选择。');
  for(const k of chosen){for(const dep of BATCH_DEPS[k]||[])if(!byKind(dep,p.id)&&!(execution==='all'&&chosen.includes(dep)))errors.push(`${KIND[k]?.name||k} 缺少输入：${KIND[dep]?.name||dep}。`);}
  return [...new Set(errors)];
}
collectPlanEdits=function(plan){
  if(!plan||plan.status!=='draft')return !!plan;
  const goal=document.querySelector('#plan-goal'),nodes=[...document.querySelectorAll('[data-plan-kind]')],mode=document.querySelector('#plan-mode'),current=document.querySelector('#plan-current-kind');
  const before=JSON.stringify([plan.goal,plan.kinds,plan.mode,plan.currentKind]);
  if(goal)plan.goal=goal.value.trim();if(nodes.length)plan.kinds=nodes.filter(n=>n.checked).map(n=>n.dataset.planKind);if(mode)plan.mode=mode.value;if(current)plan.currentKind=current.value;
  if(before!==JSON.stringify([plan.goal,plan.kinds,plan.mode,plan.currentKind]))plan.revision++;
  persist();return true;
};
planPanelHTML=function(plan){
  const p=project(plan.projectId);if(!p)return '<div class="notice warn">原项目不可用，请恢复项目资料。</div>';
  const locked=plan.status!=='draft',rules=projectPlanRules(p.id),rows=[...rules.filter(r=>plan.kinds.includes(r.kind)),...plan.kinds.filter(k=>!rules.some(r=>r.kind===k)).map(k=>({kind:k,name:KIND[k]?.name||k,requirement:'暂不支持，需调整',maturity:'draft'}))];
  const row=r=>`<label class="plan-item"><input type="checkbox" data-plan-kind="${E(r.kind)}" ${plan.kinds.includes(r.kind)?'checked':''} ${locked?'disabled':''}><span>${icon(KIND[r.kind]?.icon||'file')}<strong>${E(r.name)}</strong><small>${E(r.requirement)}</small><small>${r.maturity==='approved'?'需指定审核人批准':'采用后完成'}</small></span></label>`;
  const errors=validateUnifiedPlan(plan,plan.mode==='yolo'?'all':'current');
  return `<div class="plan-intro"><h3>${E(p.name)}</h3><p>${E(p.model||p.productName||'待补充产品')} · ${E(p.market||'待明确市场')} · ${E(p.language||'待明确语言')}</p>${tag(locked?'已开始':'交付计划','blue')}<span class="small muted">v${plan.revision}</span></div><div class="field"><label for="plan-goal">本次目标</label><textarea id="plan-goal" ${locked?'readonly':''}>${E(plan.goal)}</textarea></div><section class="plan-deliverables"><h3>本次交付</h3>${rows.map(row).join('')}<details><summary>添加交付</summary>${rules.filter(r=>!plan.kinds.includes(r.kind)).map(row).join('')}</details></section><div class="field"><label for="plan-mode">执行方式</label><select id="plan-mode" ${locked?'disabled':''}><option value="collaborate" ${plan.mode!=='yolo'?'selected':''}>协作 · 只执行当前工作</option><option value="yolo" ${plan.mode==='yolo'?'selected':''}>自主完成 · 连续制作全部交付</option></select></div><div class="field"><label for="plan-current-kind">当前工作</label><select id="plan-current-kind" ${locked?'disabled':''}>${rows.map(r=>`<option value="${r.kind}" ${r.kind===(plan.currentKind||plan.kinds[0])?'selected':''}>${E(r.name)}</option>`).join('')}</select></div>${errors.length?`<div class="notice warn" role="status">${errors.map(E).join('<br>')}</div>`:''}<p class="small muted">保存不执行；开始后按固定计划制作。采用与正式批准由相应负责人处理。</p>`;
};
function acceptUnifiedScope(plan){
  const p=project(plan.projectId),rules=projectPlanRules(p.id);p.scopeConfirmed=true;p.scope=clone(rules.filter(r=>plan.kinds.includes(r.kind)));plan.scopeAccepted=true;
  for(const r of p.scope)if(!S.tasks.some(t=>t.projectId===p.id&&t.kind===r.kind)){S.tasks.push({id:uid('task'),projectId:p.id,kind:r.kind,domain:r.domain,name:r.name,maturity:r.maturity,requirement:r.requirement,reason:r.reason,ruleVersion:p.ruleVersion,assignee:p.owner,reviewer:'reviewer',status:'todo',revision:1,artifactId:null});}
}
confirmScope=function(pid,selectedKinds){const plan=ensureUnifiedPlan(pid);if(!plan)return;if(selectedKinds)plan.kinds=[...new Set(selectedKinds)];const errors=validateUnifiedPlan(plan,'all');if(errors.length)return toast(errors.join(' '),true);acceptUnifiedScope(plan);closeModal();persist();render();return plan;};
confirmPlan=function(id,execution){
  const plan=planById(id);if(!plan||plan.owner!==S.actor)return toast('仅计划负责人可以开始本次工作。',true);
  if(plan.batchId)return showModal('batch',plan.batchId),batchById(plan.batchId);
  if(batchPromise||S.runId)return toast('请等待当前工作结束。',true);
  collectPlanEdits(plan);execution=execution||(plan.mode==='yolo'?'all':'current');
  const errors=validateUnifiedPlan(plan,execution);if(errors.length){toast(errors.join(' '),true);return showModal('plan',id);}
  const p=project(plan.projectId),kinds=execution==='current'?[plan.currentKind||plan.kinds[0]]:BATCH_ORDER.filter(k=>plan.kinds.includes(k));
  acceptUnifiedScope(plan);
  const b={id:uid('batch'),projectId:p.id,threadId:plan.threadId,owner:plan.owner,reviewer:'reviewer',plan:clone(plan),inputSnapshot:window.V62Inputs?.projectSnapshot(p.id)||null,projectSnapshot:clone(p),items:[],status:'running',created:now(),events:[],execution,externalRefs:[]};
  for(const dep of new Set(kinds.flatMap(k=>BATCH_DEPS[k]||[]).filter(k=>!kinds.includes(k)))){const a=byKind(dep,p.id);if(a)b.externalRefs.push({id:a.id,kind:dep,revision:a.accepted||a.active,title:a.title});}
  for(const kind of kinds){const t=S.tasks.find(t=>t.projectId===p.id&&t.kind===kind),a=t?.artifactId&&artifact(t.artifactId),num=a?.pending||a?.active||null,submission=a&&S.submissions.findLast(s=>s.artifactId===a.id&&s.revision===num&&['pending','approved'].includes(s.status));b.items.push({kind,taskId:t.id,status:a?(a.checks?.[num]?.passed?'ready':'checking'):'pending',decision:submission?(submission.status==='approved'?'approved':'submitted'):a?.accepted===num?'accepted':'pending',selected:true,artifactId:a?.id||null,revision:num,checks:[]});}
  plan.status='confirmed';plan.batchId=b.id;plan.confirmedAt=now();S.batches.push(b);S.workModes[b.threadId]=execution==='all'?'yolo':'collaborate';
  addMsg('assistant',`已开始${execution==='all'?'全部制作':'当前工作'}：${b.items.length} 项。完成后进入待处理，由你采用。`,{batchId:b.id},b.threadId);
  showModal('batch',b.id);persist();launchBatch(b);return b;
};
renderBatchPanel=function(){
  if(MODAL?.kind!=='plan')return UNIFIED_PLAN.renderBatchPanel();
  const plan=planById(MODAL.arg);if(!plan)return;
  const contextChanged=validateUnifiedPlan(plan).some(e=>e.includes('变化'));
  const foot=plan.status==='draft'?(contextChanged?button('同步项目上下文','plan-sync-context',plan.id):'')+button('保存计划','plan-save',plan.id)+button(plan.mode==='yolo'?'开始全部制作':'开始当前工作',plan.mode==='yolo'?'plan-start-all':'plan-start-current',plan.id,'primary','play'):button('调整下一版计划','plan-next',plan.id)+button('查看本次制作','batch-open',plan.batchId,'primary');
  dockRoot().innerHTML=modalFrame('交付计划',planPanelHTML(plan),foot);mountDock();restorePanelValues();updatePlanStartState();scheduleText();
};
function updatePlanStartState(){
  if(MODAL?.kind!=='plan')return;
  const plan=planById(MODAL.arg);if(!plan||plan.status!=='draft')return;
  const input=document.querySelector('#plan-goal'),check={...plan,goal:input?input.value:plan.goal};
  const errors=validateUnifiedPlan(check,plan.mode==='yolo'?'all':'current');
  const start=dockRoot().querySelector('[data-action="plan-start-current"],[data-action="plan-start-all"]');
  if(start){start.disabled=errors.length>0||plan.owner!==S.actor;start.title=errors.join(' ')||(plan.owner!==S.actor?'仅计划负责人可以开始':'');}
  const foot=dockRoot().querySelector('.modal-foot');
  if(errors.some(e=>e.includes('产品资料'))&&!foot?.querySelector('[data-action="product-intake"]'))foot?.insertAdjacentHTML('afterbegin',button('补充与核对资料','product-intake',plan.projectId,'sm','file'));
}
handle=async function(action,arg=''){
  if(action==='choose-project'&&planProjectPicking&&MODAL?.kind==='project-picker'){planProjectPicking=false;await UNIFIED_PLAN.handle(action,arg);if(arg==='none')return;const plan=ensureUnifiedPlan(arg,'yolo');return showModal('plan',plan.id);}
  if(action==='plan-next'){const plan=planById(arg);if(plan)return openUnifiedPlan(plan.projectId);return;}
  if(action==='plan-sync-context'){const plan=planById(arg),p=project(plan?.projectId);if(!plan||!p||plan.status!=='draft'||plan.owner!==S.actor)return;collectPlanEdits(plan);plan.context=planProjectContext(p);plan.revision++;persist();return showModal('plan',arg);}
  if(action==='start-yolo'){const p=project(arg)||project(S.projectId);if(!p){planProjectPicking=true;return showModal('project-picker');}const plan=ensureUnifiedPlan(p.id,'yolo');return showModal('plan',plan.id);}
  if(action==='plan-start-current'||action==='plan-start-all')return confirmPlan(arg,action==='plan-start-all'?'all':'current');
  if(action==='plan-save'){const plan=planById(arg);if(!plan||plan.status!=='draft'||plan.owner!==S.actor)return toast('只有计划负责人可以保存草稿。',true);collectPlanEdits(plan);closeModal();toast('计划已保存，尚未开始制作。');return;}
  return UNIFIED_PLAN.handle(action,arg);
};
document.addEventListener('change',event=>{if(MODAL?.kind!=='plan'||!event.target.matches('#plan-mode,#plan-current-kind,[data-plan-kind]'))return;const plan=planById(MODAL.arg);if(!plan)return;collectPlanEdits(plan);delete S.panelDrafts['plan|'+plan.id];renderBatchPanel();});
document.addEventListener('input',event=>{if(event.target.id==='plan-goal')updatePlanStartState();});
