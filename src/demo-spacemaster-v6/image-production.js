/* Image process presentation uses supplied files, not a live generation service.
   Motion contract: queued -> processing -> decoded result, one member at a time.
   Existing run pause/cancel and immutable artifact snapshots remain authoritative. */
const IMAGE_PIPELINES={
  productImages:{name:'生成产品六视角',steps:[['K01','读取白底正视图'],['K02','生成左 45° 视角'],['K03','生成右 45° 视角'],['K04','生成左侧视角'],['K05','生成右侧视角'],['K06','生成背面视角']]},
  scene:{name:'生成厨房基础场景',steps:[['K07','生成木色厨房与自然光场景']]},
  featureImages:{name:'生成卖点图',steps:[['FT01','生成空间容量卖点图'],['FT02','生成温度检测卖点图'],['FT03','生成保鲜情境卖点图'],['FT04','生成分区温控卖点图']]},
  websitePoster:{name:'生成官网海报与语言版本',steps:[['K08','组合官网横幅母版'],['K09','生成德语官网海报'],['K10','生成法语版本'],['K11','生成阿拉伯语版本']]},
  modelComposite:{name:'将模特融入生活场景',steps:[['PM00','生成带成人与儿童的生活场景']]},
  modelReplace:{name:'生成模特替换方案',steps:[['PM01','生成模特方案 1'],['PM02','生成模特方案 2'],['PM03','生成模特方案 3'],['PM04','生成模特方案 4']]}
};
const imagePreviousSpec=runSpec;
runSpec=function(kind){
  const p=IMAGE_PIPELINES[kind];if(!p||!demoProject(project()))return imagePreviousSpec(kind);
  const steps=kind==='scene'&&executingBatch?[...p.steps,...IMAGE_PIPELINES.modelComposite.steps,...IMAGE_PIPELINES.modelReplace.steps]:p.steps;
  return {name:p.name,module:'production',sources:['DE01','DE02','DE03'],thought:'先读取当前产品与画面要求，再逐张完成画面处理和检查。等待中的图片保留位置，完成后可以查看、比较和选择；原采用版本保持不变。',steps:steps.map(([member,label])=>['image.prepare',label,'图像制作',{member,product:PRODUCT.model,scope:'当前项目固定输入'},{member,origin:'supplied',executionMode:'local-presentation',modelExecuted:false}])};
};
async function prepareImageStep(event,run,token){
  const id=event.plannedOutput?.member;if(!IMAGE_PIPELINES[run.kind]||!id)return;
  // Result appears only after a real archived preview can be decoded.
  await wait(1000,token);
  if(window.__IMAGE_FAIL_ONCE===id){delete window.__IMAGE_FAIL_ONCE;throw Error('无法读取 '+demoImage(id).name+'，请重试。');}
  const img=new Image();img.src=demoImage(id).previewURL;await img.decode();
  if(token!==CANCEL_TOKEN)throw Error('CANCELLED');
  event.plannedOutput.previewDecoded=true;event.plannedOutput.fileSha256=demoImage(id).sha256;
}
function imageProductionHTML(r){
  const active=r.events.find(e=>e.status==='running'),complete=r.events.filter(e=>e.status==='done').length;
  return `<section class="canvas production-workspace" aria-label="图片制作过程" aria-busy="${r.status==='running'}"><header class="production-head"><div><h2>${E(r.name)}</h2><p role="status">${r.status==='failed'?'本次制作未完成':S.paused?'已暂停':active?E(active.label):'正在准备画面'} · ${complete} / ${r.events.length}</p></div><div class="row">${r.status==='running'?button(S.paused?'继续':'暂停','pause','','sm',S.paused?'play':'pause')+button('取消制作','cancel-run','','sm','close'):button('重试制作','image-retry',r.id,'primary sm','refresh')+button('返回成果','image-dismiss',r.id,'sm')}</div></header><div class="production-body">${r.status==='failed'?`<p class="notice warn">${E(r.error)} 已保存的成果和成功画面保持不变。</p>`:''}<div class="production-grid ${r.events.length===1?'single':''}">${r.events.map(e=>{const id=e.plannedOutput.member,f=demoImage(id),done=e.status==='done',working=e.status==='running';return `<article class="production-tile" data-image-step="${id}" data-status="${e.status}"><div class="production-image">${done?`<img src="${f.previewURL}" alt="${E(f.name)}">`:`<div class="production-placeholder">${icon(working&&!S.paused?'refresh':working?'pause':e.status==='failed'?'warning':'image',working&&!S.paused?'spin':'')}<span>${working?(S.paused?'已暂停':'正在生成…'):e.status==='failed'?'未完成':'等待处理'}</span></div>`}</div><h3>${E(e.label)}</h3><p>${done?'图片已就绪':working?'完成后将在这里显示':e.status==='failed'?'可重新尝试':'按顺序继续'}</p></article>`;}).join('')}</div><details class="production-provenance"><summary>查看处理来源</summary><p>本地流程使用已归档的 Canva / 用户图片呈现各制作阶段，并校验图片可读取。尚未连接实时图像生成服务；不会将本次等待记录为新的模型调用或像素改版。</p></details></div></section>`;
}
const imagePreviousRunCard=runCard;
runCard=function(r){
  const html=imagePreviousRunCard(r);if(!S.paused||r?.id!==S.runId||r.status!=='running')return html;
  const template=document.createElement('template');template.innerHTML=html;
  const status=template.content.querySelector('.run-head>.tiny');if(status)status.textContent='已暂停';
  for(const line of template.content.querySelectorAll('.run-line.active')){line.querySelector('.tiny')?.replaceChildren(document.createTextNode('已暂停'));const svg=line.querySelector('svg');if(svg)svg.outerHTML=icon('pause');}
  template.content.querySelector('.thought')?.classList.remove('stream');
  return template.innerHTML;
};
const imagePreviousRender=render;
render=function(bottom=false){
  imagePreviousRender(bottom);
  const r=S.runs.find(r=>r.id===S.runId)||S.runs.findLast(r=>IMAGE_PIPELINES[r.kind]&&r.status==='failed'&&!r.imageDismissed);
  if(!r||!IMAGE_PIPELINES[r.kind]||!['running','failed'].includes(r.status)||r.projectId!==S.projectId||r.threadId!==S.threadId||!['chat','artifact'].includes(S.view))return;
  const main=document.querySelector('.main');if(!main)return;
  main.classList.add('image-producing');main.querySelector('.canvas')?.remove();main.querySelector('.dock-host')?.setAttribute('hidden','');main.querySelector('.work-inspector')?.setAttribute('hidden','');
  main.insertAdjacentHTML('beforeend',imageProductionHTML(r));
  if(window.__LILITH_QA_TIME_SCALE){const trace=window.__IMAGE_PROCESS_TRACE??=[];for(const e of r.events){const key=r.id+'|'+e.id+'|'+e.status;if(!trace.some(x=>x.key===key))trace.push({key,runId:r.id,kind:r.kind,member:e.plannedOutput.member,status:e.status,paused:S.paused,visible:!!main.querySelector('[data-image-step="'+e.plannedOutput.member+'"]'),at:performance.now()});}}
};
function imageSequenceRecord(a,n){S.imageSequences??={};return S.imageSequences[a.id+'|'+n]??={};}
async function produceModelSequence(a,n,replace=false){
  if(!a||!canWrite(a)||S.runId)return;
  const pid=a.projectId,tid=S.threadId,record=imageSequenceRecord(a,n);
  async function stage(kind,key){const r=await runWork(kind,()=>{record[key]=true;record[key+'Run']=S.runId;persist();return {text:kind==='modelComposite'?'带人物的生活场景已就绪。接下来可以生成模特替换方案。':'四个模特方案已就绪，可以逐个比较人物、产品、背景和文字变化。'};});return r?.status==='done';}
  if((!replace||!record.composite)&&!await stage('modelComposite','composite'))return;
  if(replace&&!await stage('modelReplace','replaced'))return;
  if(S.projectId===pid&&S.threadId===tid){openCanvas(a.id,n);S.imageViews[a.id+'|'+n]={person:true,member:replace?'PM01':'PM00',compare:replace};render();persist();}
}
const imagePreviousHandle=handle;
handle=async function(action,arg=''){
  if(action==='image-dismiss'){const r=S.runs.find(r=>r.id===arg);if(r)r.imageDismissed=true;render();return;}
  if(action==='image-retry'){const r=S.runs.find(r=>r.id===arg);if(!r||S.runId)return;r.imageDismissed=true;if(['modelComposite','modelReplace'].includes(r.kind)){const a=byKind('scene',r.projectId);return produceModelSequence(a,a.pending||a.active,r.kind==='modelReplace');}return generate(r.kind);}
  if(action==='demo-integrate-model'||action==='demo-person-mode'){
    const a=artifact(S.canvas?.id),n=S.canvas?.num;if(a?.kind!=='scene')return;
    return produceModelSequence(a,n,action==='demo-person-mode');
  }
  if(action==='demo-view-models'){
    const a=artifact(S.canvas?.id),n=S.canvas?.num;if(!a)return;const record=imageSequenceRecord(a,n);
    S.imageViews[a.id+'|'+n]={person:true,member:record.replaced?'PM01':'PM00',compare:!!record.replaced};render();return;
  }
  return imagePreviousHandle(action,arg);
};
// Ordinary viewing does not replay production. Existing scene files remain immutable.
const imagePreviousContent=contentHTML;
contentHTML=function(a,v){let html=imagePreviousContent(a,v);if(a.kind==='scene'&&v.data.imageCollection){const template=document.createElement('template');template.innerHTML=html;const row=template.content.querySelector('.demo-image-work>.demo-image-actions');if(row)row.innerHTML=button('基础场景','demo-scene-mode','','sm')+button('融入模特','demo-integrate-model','','sm','person')+button('生成模特替换方案','demo-person-mode','','sm','refresh')+button('查看人物素材','demo-view-models','','sm','image');html=template.innerHTML;}return html;};
