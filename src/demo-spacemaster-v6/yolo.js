/* Plan confirmation -> autonomous draft production -> human batch review.
   Self-check never writes approval records or publishes content. */
const BATCH_DEPS={strategy:[],research:[],fabe:['strategy'],mh:['fabe'],assets:[],web:['mh','assets'],pop:['mh','assets'],ecom:['mh','assets']};
const BATCH_ORDER=['research','strategy','fabe','mh','assets','web','pop','ecom'];
let batchPromise=null,executingBatch=null;
const batchById=id=>S.batches.find(b=>b.id===id);
const planById=id=>S.plans.find(p=>p.id===id);
const batchName=b=>project(b.projectId)?.name||'项目';
function inBatchContext(batch,fn){
  const saved={projectId:S.projectId,threadId:S.threadId,actor:S.actor,batch:executingBatch};
  S.projectId=batch.projectId;S.threadId=batch.threadId;S.actor=batch.owner;executingBatch=batch;
  try{return fn()}finally{S.projectId=saved.projectId;S.threadId=saved.threadId;S.actor=saved.actor;executingBatch=saved.batch;}
}
currentSource=function(a){
  const item=executingBatch?.items.find(i=>i.artifactId===a?.id);
  if(item)return revision(a,item.revision);
  const fixed=executingBatch?.externalRefs?.find(r=>r.id===a?.id||r.kind===a?.kind);
  return fixed?revision(artifact(fixed.id),fixed.revision):EXPERIENCE.currentSource(a);
};
taskFor=function(kind,pid=S.projectId){const item=executingBatch?.projectId===pid?executingBatch.items.find(i=>i.kind===kind):null;return item?S.tasks.find(t=>t.id===item.taskId):EXPERIENCE.taskFor(kind,pid)};
function planKinds(p){return projectPlanRules(p.id).filter(r=>r.category!=='推荐').map(r=>r.kind)}
function applyPlanWords(plan,text){
  if(/(不做|不要|暂不|不需要).{0,5}官网/.test(text))plan.kinds=plan.kinds.filter(k=>k!=='web');
  if(/(不做|不要|暂不|不需要).{0,5}(门店|POP)/i.test(text))plan.kinds=plan.kinds.filter(k=>k!=='pop');
  if(/(加入|加上|增加|需要).{0,5}电商/.test(text)&&!plan.kinds.includes('ecom'))plan.kinds.push('ecom');
  if(/只做.{0,6}(门店|POP)/i.test(text))plan.kinds=plan.kinds.filter(k=>!['web','ecom'].includes(k));
  if(/只做.{0,6}官网/.test(text))plan.kinds=plan.kinds.filter(k=>!['pop','ecom'].includes(k));
  plan.kinds=BATCH_ORDER.filter(k=>plan.kinds.includes(k));
}
function ensurePlanProject(){
  if(project())return project();
  const p=S.projects.find(p=>p.id==='sample-launch')||S.projects[0];
  if(p)goProject(p.id,false);return p;
}
function discussPlan(text,mode='yolo'){
  text=String(text||'').trim();if(!text)return;
  if(S.actor==='reviewer')return toast('请切换到项目负责人后制定执行计划。',true);
  const p=ensurePlanProject();if(!p)return toast('请先选择项目。',true);
  if(p.owner!==S.actor)return toast('请由项目负责人确认本次工作范围。',true);
  clearComposer();closeModal();S.workModes[S.threadId]=mode;addMsg('user',text);
  let plan=S.plans.findLast(x=>x.threadId===S.threadId&&x.status==='draft');
  if(!plan){plan={id:uid('plan'),projectId:p.id,threadId:S.threadId,owner:S.actor,revision:1,status:'draft',mode,goal:text,kinds:planKinds(p),notes:[],created:now()};S.plans.push(plan)}
  else{plan.revision++;plan.notes.push(text);plan.mode=mode;}
  applyPlanWords(plan,text);
  delete S.panelDrafts['plan|'+plan.id];
  addMsg('assistant',`我已整理本次计划：${plan.kinds.length} 项交付，保存到「${p.name}」。请确认目标和清单；开始后我会连续制作、自检，完成时请你集中审核。`,{planId:plan.id});
  S.view='chat';showModal('plan',plan.id);render(true);persist();return plan;
}
function planPanelHTML(plan){
  const p=project(plan.projectId),locked=plan.status!=='draft';
  const kinds=BATCH_ORDER.filter(k=>k!=='research'||plan.kinds.includes(k));
  return `<div class="plan-intro"><h3>${E(p.name)}</h3><p>${E(p.model)} · 墨西哥 · 西班牙语</p>${tag(locked?'计划已确认':'等待你确认','blue')}<span class="small muted">计划 v${plan.revision}</span></div><div class="field"><label for="plan-goal">这次要达成什么</label><textarea id="plan-goal" ${locked?'readonly':''}>${E(plan.goal)}</textarea></div><section class="plan-deliverables"><h3>交付清单</h3>${kinds.map(k=>`<label class="plan-item"><input type="checkbox" data-plan-kind="${k}" ${plan.kinds.includes(k)?'checked':''} ${locked?'disabled':''}><span>${icon(KIND[k].icon)}<strong>${E(KIND[k].name)}</strong><small>${({strategy:'定位、使用场景与核心价值',fabe:'功能、优势、利益与依据',mh:'主张与完整卖点表达',assets:'产品图片与使用范围',web:'官网产品页文案',pop:'门店 POP 文案与预览',ecom:'商品标题与详情文案',research:'市场观察与待验证问题'})[k]}</small></span><span class="tag">Draft</span></label>`).join('')}</section><section class="plan-execution"><h3>确认后，Lilith 会这样完成</h3><ol><li>按依赖顺序制作策略、卖点、素材和渠道内容。</li><li>逐项自检产品事实、内容完整性和来源；发现可修正的问题先返修。</li><li>将全部草稿组成一套成果，保存到项目，通知你集中审核。</li></ol><p>不会自动发布、替你批准或覆盖已批准版本。需要你补充的资料会单独列出。</p></section><div class="plan-feedback"><label for="plan-feedback">还有什么需要调整？</label><div class="row"><input id="plan-feedback" placeholder="例如：先不做官网，增加电商内容" ${locked?'disabled':''}>${button('调整计划','plan-feedback',plan.id,'sm')}</div></div>`;
}
function collectPlanEdits(plan){
  if(plan.status!=='draft')return true;
  const goal=document.querySelector('#plan-goal')?.value.trim()||plan.goal;
  const nodes=[...document.querySelectorAll('[data-plan-kind]')];
  const kinds=nodes.length?nodes.filter(n=>n.checked).map(n=>n.dataset.planKind):plan.kinds;
  if(!goal||!kinds.length){toast('请填写目标，并至少选择一项交付。',true);return false}
  const missing=[...new Set(kinds.flatMap(k=>BATCH_DEPS[k]||[]).filter(k=>!kinds.includes(k)))];
  if(missing.length){toast('请同时选择依赖的成果：'+missing.map(k=>KIND[k].name).join('、'),true);return false}
  if(plan.goal!==goal||JSON.stringify(plan.kinds)!==JSON.stringify(kinds)){plan.revision++;plan.goal=goal;plan.kinds=kinds;}
  persist();return true;
}
function batchLabel(b){return ({running:'正在自主制作',paused:'已暂停',interrupted:'待继续',ready:'草稿待审核',needs_review:'有内容需要处理',changes_requested:'待返修',reviewed:'草稿已确认',cancelled:'已停止',failed:'执行未完成'})[b.status]||b.status}
function batchSummaryHTML(b){
  const ready=b.items.filter(i=>i.status==='ready').length;
  return `<button class="batch-summary" data-action="batch-open" data-arg="${b.id}"><span class="batch-icon">${icon(b.status==='running'?'refresh':'layers',b.status==='running'?'spin':'')}</span><span><strong>${E(batchName(b))} · 草稿集合</strong><small>${ready}/${b.items.length} 项已完成自检 · ${E(batchLabel(b))}</small></span><span class="spacer"></span>${icon('chevron')}</button>`;
}
const experienceMessage=messageHTML;
messageHTML=function(m){let html=experienceMessage(m);if(m.planId){const plan=planById(m.planId);if(plan)html+=`<div class="conversation-action">${button(`查看计划 v${plan.revision}`,'plan-open',plan.id,'sm','tasks')}</div>`}if(m.batchId){const b=batchById(m.batchId);if(b)html+=batchSummaryHTML(b)}return html;};
const experienceCanvas=canvasHTML;
canvasHTML=function(){const b=S.batches.findLast(b=>b.items.some(i=>i.artifactId===S.canvas?.id));let html=experienceCanvas();if(b)html=html.replace('<div class="canvas-head">',`<div class="batch-return">${button('返回草稿集合','batch-open',b.id,'ghost sm','arrow')}</div><div class="canvas-head">`);return html;};
function batchPanelHTML(b){
  const active=['running','paused'].includes(b.status),ready=b.items.filter(i=>i.status==='ready').length;
  return `<div class="batch-heading"><h3>${E(batchName(b))}</h3><p>${E(b.plan.goal)}</p><div class="row wrap">${tag('YOLO','blue')}${tag(batchLabel(b),active?'blue':'amber')}<span class="small muted">${ready}/${b.items.length} 项自检完成 · 计划 v${b.plan.revision}</span></div></div><div class="batch-progress" role="progressbar" aria-label="草稿完成进度" aria-valuenow="${ready}" aria-valuemin="0" aria-valuemax="${b.items.length}"><span style="width:${100*ready/b.items.length}%"></span></div>${active?`<div class="batch-running-note">${icon('clock')}<span>你可以先处理其他工作。草稿会保留在此项目，完成后出现在“待我审核”。</span></div>`:''}${b.status==='interrupted'?'<div class="notice warn">已恢复之前的成果。点击继续，从未完成的部分接着制作。</div>':''}<div class="batch-list">${b.items.map((i,index)=>{const a=artifact(i.artifactId),v=a&&revision(a,i.revision),status=({pending:'待开始',making:'制作中',checking:'自检中',ready:'自检通过',needs_input:'需补充资料',failed:'未完成',changes_requested:'待修改'})[i.status]||i.status;return `<div class="batch-item"><label class="batch-item-select"><input type="checkbox" data-batch-select="${index}" ${i.selected!==false?'checked':''} ${active||!v?'disabled':''}><span>${icon(KIND[i.kind].icon)}</span><strong>${E(KIND[i.kind].name)}</strong></label><div class="batch-item-meta">${tag(status,i.status==='ready'?'green':i.status==='failed'?'red':'')}${v?tag('Draft · v'+v.num):''}${i.decision&&i.decision!=='pending'?tag(({accepted:'已确认草稿',changes_requested:'已退回',submitted:'正式审核中',approved:'已批准'})[i.decision]||i.decision):''}</div>${i.error?`<p class="batch-issue">${E(i.error)}</p>`:''}${i.feedback?`<p class="batch-feedback">修改意见：${E(i.feedback)}</p>`:''}${v?`<div class="row wrap">${button('查看草稿','open-artifact',a.id+'|'+v.num,'sm')}${button('自检明细','check-detail',a.id+'|'+v.num,'ghost sm')}${a.pending&&a.pending!==i.revision&&i.decision!=='approved'?button('纳入新版并自检','batch-refresh',b.id+'|'+index,'ghost sm'):''}</div>`:''}</div>`}).join('')}</div>${!active?`<div class="field"><label for="batch-feedback">审核意见（退回时必填）</label><textarea id="batch-feedback" placeholder="指出要调整的内容。例如：POP 标题改为：Espacio para tu día a día."></textarea></div><p class="small muted">确认草稿用于后续工作；需要正式批准的物料仍按审核流程处理。</p>`:''}`;
}
function renderBatchPanel(){
  const {kind,arg}=MODAL;let title,body,foot;
  if(kind==='plan'){
    const p=planById(arg);if(!p)return;title='确认工作计划';body=planPanelHTML(p);foot=p.status==='draft'?button('保存计划，稍后开始','plan-save',p.id)+button('确认计划并开启 YOLO','plan-start',p.id,'primary','play'):button('查看草稿集合','batch-open',p.batchId,'primary');
  }else if(kind==='review-inbox'){
    title='待我审核';const bs=pendingBatches().filter(b=>b.owner===S.actor||b.reviewer===S.actor),subs=S.submissions.filter(s=>s.reviewer===S.actor&&s.status==='pending');
    body=`<p class="muted small">集中查看 Lilith 完成的草稿，以及等待你决定的正式提交。</p>${bs.map(batchSummaryHTML).join('')}${subs.map(s=>`<div class="review-inbox-row"><strong>${E(s.title)} · v${s.revision}</strong>${button('审核固定版本','review',s.id,'sm')}</div>`).join('')}${!bs.length&&!subs.length?'<div class="empty"><h3>当前没有待审核内容</h3><p>Lilith 完成一组草稿后，会在这里通知你。</p></div>':''}`;foot=button('返回工作','panel-close');
  }else{
    const b=batchById(arg);if(!b)return;title='草稿集合与进度';body=batchPanelHTML(b);const can=b.owner===S.actor;
    if(b.status==='running'||b.status==='paused')foot=button(b.status==='paused'?'继续执行':'暂停','batch-pause',b.id)+button('停止制作','batch-cancel',b.id)+button('先去做其他工作','panel-close','','primary');
    else foot=(['interrupted','failed','cancelled','needs_review','changes_requested'].includes(b.status)&&can?button(b.status==='changes_requested'?'按意见返修':'继续未完成项','batch-resume',b.id,'sm','play'):'')+button('下载草稿集合','batch-export',b.id,'sm','download')+(can?button('退回所选','batch-return',b.id,'sm')+button('确认所选草稿','batch-accept',b.id,'primary sm','check')+button('提交需审批成果','batch-submit',b.id,'sm'):'' );
  }
  dockRoot().innerHTML=modalFrame(title,body,foot);mountDock();restorePanelValues();scheduleText();
}
function confirmPlan(id){
  const plan=planById(id);if(!plan||plan.owner!==S.actor)return toast('仅计划负责人可以开始本次工作。',true);
  if(plan.status==='confirmed'){showModal('batch',plan.batchId);return batchById(plan.batchId)}
  if(batchPromise||S.runId)return toast('请等待当前制作完成，或先停止当前工作。',true);
  if(!collectPlanEdits(plan))return;
  const p=project(plan.projectId),b={id:uid('batch'),projectId:p.id,threadId:plan.threadId,owner:S.actor,reviewer:'reviewer',plan:clone(plan),items:[],status:'running',created:now(),events:[]};
  for(const kind of BATCH_ORDER.filter(k=>plan.kinds.includes(k))){
    const rule=projectPlanRules(p.id).find(r=>r.kind===kind);
    const t={id:uid('task'),projectId:p.id,kind,domain:KIND[kind].domain,name:rule.name,maturity:rule.maturity,requirement:rule.requirement,reason:'已确认的 YOLO 计划',ruleVersion:p.ruleVersion,assignee:S.actor,reviewer:b.reviewer,status:'todo',revision:1,artifactId:null,batchId:b.id};
    S.tasks.push(t);b.items.push({kind,taskId:t.id,status:'pending',decision:'pending',selected:true,artifactId:null,revision:null,checks:[]});
  }
  plan.status='confirmed';plan.batchId=b.id;plan.confirmedAt=now();p.scopeConfirmed=true;S.batches.push(b);
  S.workModes[b.threadId]='yolo';
  addMsg('assistant',`计划已确认。我将完成 ${b.items.length} 项草稿并逐项自检。你可以先处理其他工作，完成后再集中审核。`,{batchId:b.id},b.threadId);
  showModal('batch',b.id);persist();launchBatch(b);return b;
}
function updateBatchView(b){persist();render();if(MODAL?.kind==='batch'&&MODAL.arg===b.id)renderBatchPanel();}
function runBatchStage(b,kind,done){
  const requireAvailable=()=>{const issues=window.V62Inputs?.executionIssues?.(b)||[];if(issues.length)throw Error(issues.join(' '));};
  requireAvailable();
  const promise=inBatchContext(b,()=>runWork(kind,async()=>{requireAvailable();return inBatchContext(b,done)}));
  const r=S.runs.find(r=>r.id===S.runId);if(r)r.batchId=b.id;return promise;
}
function batchRefs(b,kind){return (BATCH_DEPS[kind]||[]).map(k=>{const fixed=b.externalRefs?.find(r=>r.kind===k);if(fixed)return clone(fixed);const item=b.items.find(i=>i.kind===k),a=item?artifact(item.artifactId):byKind(k,b.projectId);return a?{id:a.id,kind:k,revision:item?.revision||a.accepted||a.active,title:a.title}:null}).filter(Boolean)}
function batchData(b,item){
  let data=makeContent(item.kind);
  const direct=item.feedback?.match(/(?:改为|改成|替换为)[：:\s]*([\s\S]+)/)?.[1]?.trim();
  if(direct){if(['pop','web','ecom'].includes(item.kind))data.headline=direct;else if(item.kind==='mh')data.claim=direct;else if(data.sections)data.sections[0].body=direct;else if(data.points)data.points[0].benefit=direct;}
  return data;
}
function checkBatchDraft(a,v){
  const d=v.data,checkVersion={...v,data:{...d}};delete checkVersion.data.exclusions;
  const result=inspectContent(a,checkVersion);
  const complete=a.kind==='assets'?(d.items?.length>=2):['pop','web','ecom'].includes(a.kind)?!!d.headline:!!(d.sections?.length||d.points?.length);
  result.findings.push({title:'交付内容完整性',ok:complete,detail:complete?'本项要求的内容已齐备。':'内容不足，请补充后再次检查。'});result.passed&&=complete;return result;
}
function repairDraftData(data){
  const rewrite=x=>typeof x==='string'?x.replace(/省电\s*30%|30%\s*(energy|ahorro)/gi,'能耗表现以适用产品资料为准').replace(/保鲜\s*7\s*天|7\s*días/gi,'保鲜表现以适用产品资料为准').replace(/销量第一/g,''):Array.isArray(x)?x.map(rewrite):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,rewrite(v)])):x;
  return rewrite(data);
}
async function runBatch(b){
  b.status='running';updateBatchView(b);
  for(const item of b.items){
    if(!S.batches.includes(b)||b.status==='cancelled')break;
    while(b.status==='paused')await new Promise(resolve=>setTimeout(resolve,100));
    if(b.status==='cancelled')break;
    if(item.status==='ready'&&item.decision!=='changes_requested')continue;
    const unavailable=(BATCH_DEPS[item.kind]||[]).filter(k=>{const dependency=b.items.find(i=>i.kind===k);return dependency?(!dependency.artifactId||dependency.status!=='ready'):!byKind(k,b.projectId)});
    if(unavailable.length){item.status='needs_input';item.error='依赖的成果尚未就绪，请先处理前序项目。';continue}
    try{
      if(!item.artifactId||item.decision==='changes_requested'){
        item.status='making';updateBatchView(b);
        const r=await runBatchStage(b,item.kind,()=>{
          const data=batchData(b,item),refs=batchRefs(b,item.kind);let a=artifact(item.artifactId),v;
          if(a){v=addRevision(a,data,'按集中审核意见返修',refs)}else{a=newArtifact(item.kind,data,b.projectId,refs,b.threadId);v=revision(a,1);}
          item.artifactId=a.id;item.revision=v.num;item.decision='pending';item.error=null;
          return {text:KIND[item.kind].name+'草稿已保存，接下来进行自检。'};
        });
        if(!r)throw Error('制作未完成，可继续重试。');
      }
      if(b.status==='cancelled')break;
      item.status='checking';updateBatchView(b);
      const checked=await runBatchStage(b,'check',()=>{
        const a=artifact(item.artifactId);let v=revision(a,item.revision),result=checkBatchDraft(a,v);item.checks.push(clone(result));
        if(!result.passed){const repaired=repairDraftData(v.data);if(JSON.stringify(repaired)!==JSON.stringify(v.data)){v=addRevision(a,repaired,'自检返修：移除没有依据的声明',v.refs);item.revision=v.num;result=checkBatchDraft(a,v);item.checks.push(clone(result));}}
        a.checks??={};a.checks[v.num]=result;item.status=result.passed?'ready':'needs_input';item.error=result.passed?null:result.findings.filter(f=>!f.ok).map(f=>f.detail).join(' ');
        const t=S.tasks.find(t=>t.id===item.taskId);t.status='draft_ready';t.artifactId=a.id;
        return {text:result.passed?KIND[item.kind].name+'已完成自检，等待你集中审核。':KIND[item.kind].name+'草稿已保存，有问题需要你处理。'};
      });
      if(!checked)throw Error('自检未完成，可继续重试。');
    }catch(error){if(b.status==='cancelled')break;item.status='failed';item.error=error.message;}
    updateBatchView(b);
  }
  if(!S.batches.includes(b))return;
  if(b.status!=='cancelled'){
    b.status=b.items.every(i=>i.status==='ready')?'ready':'needs_review';b.completedAt=now();
    addMsg('assistant',b.status==='ready'?`${b.items.length} 项草稿已完成制作与自检，已保存到「${batchName(b)}」。请集中查看，确认要采用的内容。`:'已保存本次完成的草稿；需要补充或重试的项目已单独标出。',{batchId:b.id},b.threadId);
  }
  updateBatchView(b);
}
function launchBatch(b){
  if(batchPromise)return batchPromise;
  S.paused=false;
  batchPromise=runBatch(b).catch(e=>{b.status='failed';b.error=e.message;updateBatchView(b)}).finally(()=>batchPromise=null);
  return batchPromise;
}
function selectedBatchItems(b){const nodes=[...document.querySelectorAll('[data-batch-select]')];if(nodes.length)nodes.forEach(n=>b.items[+n.dataset.batchSelect].selected=n.checked);return b.items.filter(i=>i.selected!==false&&i.artifactId)}
function recalcBatch(b){b.status=b.items.some(i=>i.decision==='changes_requested')?'changes_requested':b.items.every(i=>['accepted','submitted','approved'].includes(i.decision))?'reviewed':b.items.every(i=>i.status==='ready')?'ready':'needs_review';}
const singleArtifactAdopt=adopt;
adopt=function(id,num){
  const a=artifact(id);num=num||a?.pending||a?.active;
  const linked=S.batches.flatMap(b=>b.items.filter(i=>i.artifactId===id&&i.revision===num).map(i=>({b,i})));
  if(linked.some(({i})=>i.status!=='ready'))return toast('这份草稿还有自检或返修问题，请先处理后再确认。',true);
  singleArtifactAdopt(id,num);
  if(a?.accepted===num&&canWrite(a,false))for(const {b,i} of linked){if(!['submitted','approved'].includes(i.decision)){i.decision='accepted';i.reviewedBy=S.actor;i.reviewedAt=now();recalcBatch(b)}}
  render();persist();
};
const singleArtifactSubmit=submitArtifact;
submitArtifact=function(id,num){
  const a=artifact(id);num=num||a?.active;singleArtifactSubmit(id,num);
  if(S.submissions.some(s=>s.artifactId===id&&s.revision===num&&s.status==='pending'))for(const b of S.batches){const i=b.items.find(i=>i.artifactId===id&&i.revision===num);if(i){i.decision='submitted';recalcBatch(b)}}
  persist();
};
function exportDraftBatch(b){
  const files={'README.txt':'项目草稿集合。自检不等于人工批准，未经正式审核不得视为发布版本。\n'};
  for(const i of b.items){const a=artifact(i.artifactId),v=a&&revision(a,i.revision);if(!v)continue;for(const [name,data] of Object.entries(versionFiles(a,v,'DRAFT')))files[i.kind+'/'+name]=data;}
  files['manifest.json']=JSON.stringify({type:'draft-collection',project:batchName(b),plan:b.plan,items:b.items.map(i=>({kind:i.kind,artifactId:i.artifactId,revision:i.revision,selfCheck:i.status,decision:i.decision})),simulation:true},null,2);
  download('Lilith_草稿集合.zip',zipStore(files),'application/zip');
}
async function handleBatchAction(action,arg){
  const [id,index]=arg.split('|'),b=batchById(id),plan=planById(id);
  if(action==='start-yolo'){S.workModes[S.threadId]='yolo';return discussPlan(project()?.goal||'完成 SpaceMaster 墨西哥上市策略、素材、官网内容和门店 POP。','yolo')}
  if(action==='plan-open')return showModal('plan',id);
  if(action==='plan-feedback'){const text=document.querySelector('#plan-feedback')?.value.trim();if(!text)return toast('请告诉我需要调整什么。',true);if(!collectPlanEdits(plan))return;clearComposer();return discussPlan(text,plan.mode)}
  if(action==='plan-save'){if(collectPlanEdits(plan)){closeModal();toast('计划已保存，尚未开始制作。')}return}
  if(action==='plan-start')return confirmPlan(id);
  if(action==='batch-open')return showModal('batch',id);
  if(!b)return;
  if(['batch-export'].includes(action))return exportDraftBatch(b);
  if(b.owner!==S.actor)return toast('请由本次工作负责人处理这些草稿。',true);
  if(action==='batch-pause'){b.status=b.status==='paused'?'running':'paused';S.paused=b.status==='paused';updateBatchView(b);return}
  if(action==='batch-cancel'){b.status='cancelled';CANCEL_TOKEN++;S.paused=false;updateBatchView(b);return}
  if(action==='batch-resume'){if(batchPromise||S.runId)return toast('正在结束上一项操作，请稍后再继续。');return launchBatch(b)}
  if(['running','paused'].includes(b.status))return toast('请等待制作完成后再审核。');
  if(action==='batch-refresh'){
    const item=b.items[+index],a=artifact(item?.artifactId);if(!a?.pending||item.decision==='approved')return;
    item.revision=a.pending;item.decision='pending';item.status='checking';b.status='needs_review';return launchBatch(b);
  }
  const items=selectedBatchItems(b);if(!items.length)return toast('请先选择要处理的草稿。',true);
  if(action==='batch-accept'){
    if(items.some(i=>i.status!=='ready'||i.decision==='changes_requested'))return toast('所选草稿还有待处理问题，请先返修或补充资料。',true);
    for(const i of items){if(['submitted','approved'].includes(i.decision))continue;adopt(i.artifactId,i.revision);i.decision='accepted';i.reviewedBy=S.actor;i.reviewedAt=now();}
  }
  if(action==='batch-return'){
    const feedback=document.querySelector('#batch-feedback')?.value.trim();if(!feedback)return toast('请填写具体修改意见。',true);
    if(items.some(i=>['submitted','approved'].includes(i.decision)))return toast('已提交的固定版本请在正式审核中处理。',true);
    for(const i of items){i.decision='changes_requested';i.status='changes_requested';i.feedback=feedback;S.tasks.find(t=>t.id===i.taskId).status='changes_requested';}
  }
  if(action==='batch-submit'){
    const formal=items.filter(i=>S.tasks.find(t=>t.id===i.taskId).maturity==='approved'&&i.decision==='accepted');
    if(!formal.length)return toast('先确认需要正式审核的草稿，再提交审核。',true);
    for(const i of formal){inBatchContext(b,()=>submitArtifact(i.artifactId,i.revision));if(S.submissions.some(s=>s.artifactId===i.artifactId&&s.revision===i.revision&&s.status==='pending'))i.decision='submitted';}
  }
  recalcBatch(b);showModal('batch',b.id);persist();
}
const batchReviewDecision=reviewDecision;
reviewDecision=function(id,decision,comment){
  const s=S.submissions.find(s=>s.id===id),before=s?.status;batchReviewDecision(id,decision,comment);
  if(before==='pending'&&s?.status===decision)for(const b of S.batches){const i=b.items.find(i=>i.artifactId===s.artifactId&&i.revision===s.revision);if(i){i.decision=decision==='approved'?'approved':'changes_requested';if(decision==='returned'){i.feedback=comment;i.status='changes_requested'}recalcBatch(b);persist();}}
};
document.addEventListener('change',e=>{if(e.target.dataset.batchSelect!==undefined&&MODAL?.kind==='batch'){const b=batchById(MODAL.arg);b.items[+e.target.dataset.batchSelect].selected=e.target.checked;persist()}});
window.LilithYolo={get batches(){return S.batches},get plans(){return S.plans},get active(){return batchPromise},discussPlan,confirmPlan,launchBatch};
