/* V6 workspace composition and one owner for transient-layer keyboard behavior. */
const WORKSPACE_REFINEMENT={contentHTML,renderModal,handle,render,showModal,closeModal,mountDock,libraryHTML};
mountDock=function(){dockRoot().hidden=false;return WORKSPACE_REFINEMENT.mountDock();};
libraryHTML=function(){const template=document.createElement('template');template.innerHTML=WORKSPACE_REFINEMENT.libraryHTML();template.content.querySelectorAll('.batch-summary').forEach(node=>node.remove());return template.innerHTML;};

function artifactEvidenceCount(a,v){
  const ids=new Set();
  const walk=(value,key='')=>{if(Array.isArray(value)){if(['sources','evidence'].includes(key))value.forEach(id=>{if(typeof id==='string'&&SOURCES.some(s=>s.id===id))ids.add(id)});value.forEach(x=>walk(x));}else if(value&&typeof value==='object')Object.entries(value).forEach(([k,x])=>walk(x,k));};
  walk(v.data);return ids.size;
}
contentHTML=function(a,v){
  const template=document.createElement('template');template.innerHTML=WORKSPACE_REFINEMENT.contentHTML(a,v);
  for(const doc of template.content.querySelectorAll('.document')){
    doc.querySelector(':scope>.eyebrow')?.remove();doc.querySelector(':scope>h2')?.remove();
  }
  template.content.querySelector('[data-action="demo-member-adopt"]')?.replaceChildren(document.createTextNode('选用图片'));
  for(const node of template.content.querySelectorAll('.demo-image-thumbs button')){
    const id=node.dataset.arg,selected=v.data.memberStates?.[id]?.selected||v.data.memberStates?.[id]?.adopted;
    if(selected&&!node.textContent.includes('已选用')){for(const label of node.querySelectorAll('span'))if(label.textContent==='已采用')label.remove();const label=document.createElement('span');label.textContent='已选用';node.append(label);}
  }
  // The fixed-version submission action lives in one footer, not two competing bars.
  template.content.querySelectorAll('[data-action="submit"]').forEach(node=>node.remove());
  return template.innerHTML;
};
canvasHTML=function(){
  const a=artifact(S.canvas?.id),v=selectedRevision();if(!a||!v)return'';
  const t=S.tasks.find(t=>t.id===a.taskId),[label,color]=versionLabel(a,v.num),approved=approvalFor(a,v.num),pending=hasPendingSubmission(a),write=canWrite(a,false);
  const versions=[...a.versions].reverse().map(x=>`<option value="${x.num}" ${x.num===v.num?'selected':''}>v${x.num}${x.num===a.accepted?' · 已采用':''}</option>`).join('');
  const header=`<header class="artifact-context-bar"><button class="btn ghost sm artifact-return" data-action="artifact-back">${icon('chevron')}<span>${artifactBackLabel()}</span></button><div class="artifact-identity"><h2>${E(a.title)}</h2><div class="artifact-context-meta">${tag(label,color)}<span>${v.refs.length} 项引用成果 · ${artifactEvidenceCount(a,v)} 项资料来源</span></div></div><select class="version-select" id="version-select" aria-label="选择成果版本">${versions}</select><button class="btn sm" data-action="artifact-chat-toggle" aria-expanded="${S.artifactWorkspace?.chatVisible!==false}" aria-controls="artifact-conversation">${icon('message')}${S.artifactWorkspace?.chatVisible!==false?'收起对话':'讨论这份成果'}</button>${ibutton('下载当前版本','export-one',a.id+'|'+v.num,'download')}</header>`;
  let action='';
  if(write&&!approved&&!pending){
    if(a.accepted!==v.num)action=button('采用此版本','adopt',a.id+'|'+v.num,'primary sm','check');
    else if(t?.maturity==='approved')action=button('提交审核','submit',a.id+'|'+v.num,'primary sm','lock');
  }
  const detail=approved?'已批准 · 固定版本保持不变':pending?'已提交 · 等待指定审核人处理':t?.maturity==='approved'?'需 '+(PEOPLE[t.reviewer]?.name||'指定审核人')+' 批准':a.accepted===v.num?'已采用 · 草稿交付完成':'采用后完成草稿交付';
  return `<section class="canvas refined-canvas" aria-label="成果详情">${S.openCanvases.length>1?workTabs():''}${header}<nav class="canvas-tabs" aria-label="成果视图">${[['content','内容'],['sources','来源'],['versions','版本']].map(([key,name])=>`<button class="tab ${S.canvas.tab===key?'active':''}" data-action="canvas-tab" data-arg="${key}" aria-current="${S.canvas.tab===key?'page':'false'}">${name}</button>`).join('')}</nav><div class="canvas-body">${S.canvas.tab==='sources'?refsHTML(a,v):S.canvas.tab==='versions'?versionsHTML(a):contentHTML(a,v)}</div><footer class="canvas-footer"><span class="small muted">${E(detail)}</span><span class="spacer"></span>${a.versions.length>1?button('比较版本','compare',a.id+'|'+v.num,'ghost sm','layers'):''}${approved?button('查看接收结果','deliveries','','sm','check'):''}${action}</footer></section>`;
};

function updatePushAction(){
  if(MODAL?.kind!=='content-library')return;
  const root=dockRoot(),available=[...root.querySelectorAll('[data-push-id]:not(:disabled)')],picked=available.filter(n=>n.checked);
  const foot=root.querySelector('.modal-foot');if(!foot)return;
  foot.innerHTML=available.length?`<span class="small muted" role="status">${picked.length?'保留所选版本与来源':'请选择已采用且尚未推送的成果'}</span><button class="btn primary" data-action="content-library-push" ${picked.length?'':'disabled'}>${icon('upload')}推送 ${picked.length} 项成果</button>`:`<span class="small muted">${visibleArtifacts().length?'当前成果尚不可推送，请先采用或查看接收记录。':'当前没有成果可推送。'}</span>${button('去准备成果','prepare-results','','primary','arrow')}`;
}
function decoratePlanValidity(){
  if(MODAL?.kind!=='plan')return;
  const input=document.querySelector('#plan-goal');if(!input)return;
  const invalid=!input.value.trim();input.setAttribute('aria-invalid',String(invalid));
  document.querySelector('#plan-goal-error')?.remove();
  if(invalid){input.setAttribute('aria-describedby','plan-goal-error');input.insertAdjacentHTML('afterend','<p id="plan-goal-error" class="field-error" role="alert">请填写本次目标。可以保存草稿，补齐后再开始制作。</p>');}
  else input.removeAttribute('aria-describedby');
}
renderModal=function(){dockRoot().hidden=false;WORKSPACE_REFINEMENT.renderModal();updatePushAction();decoratePlanValidity();syncOverlayLayers();};
handle=async function(action,arg=''){
  if(action==='prepare-results'){closeModal();S.canvas=null;S.artifactWorkspace=null;S.view='chat';render();document.querySelector('#composer')?.focus();return;}
  if(['panel-close','modal-close'].includes(action)&&MODAL?.kind==='batch'){closeModal();return;}
  return WORKSPACE_REFINEMENT.handle(action,arg);
};
document.addEventListener('change',e=>{if(e.target.matches('[data-push-id]'))updatePushAction();});

const overlayReturns=[];let inertNodes=new Map(),activeModalNode=null;
function restoreOverlayFocus(node){
  const target=node?.isConnected&&!node.closest('[inert]')?node:document.querySelector('.artifact-context-bar button,.work-context-actions button,#composer,.new-btn');
  target?.focus({preventScroll:true});
}
function overlayStack(){
  const stack=[];
  if(S.artifactWorkspace&&S.canvas)stack.push({kind:'artifact',close:()=>returnFromArtifact()});
  if(MODAL&&!isBlockingModal(MODAL.kind)&&!UTILITY_PAGES.has(MODAL.kind))stack.push({kind:'panel',node:dockRoot(),close:()=>closeModal()});
  if(S.inspectorOpen)stack.push({kind:'inspector',node:document.querySelector('.work-inspector'),close:()=>handle('inspector-close')});
  if(projectMenuId)stack.push({kind:'menu',node:document.querySelector('.project-row-menu'),close:()=>{const id=projectMenuId;projectMenuId=null;render();document.querySelector(`[data-action="project-menu"][data-arg="${id}"]`)?.focus()}});
  const dialog=document.querySelector('.modal-overlay [role="dialog"]');
  if(dialog)stack.push({kind:'dialog',node:dialog,modal:true,close:()=>closeModal()});
  const image=document.querySelector('.demo-image-dialog');
  if(image)stack.push({kind:'image',node:image,modal:true,close:()=>image.querySelector('[data-image-close]')?.click()});
  return stack;
}
function syncOverlayLayers(){
  const top=overlayStack().at(-1),modal=top?.modal?top.node:null;
  if(modal===activeModalNode)return;
  for(const [el,prior] of inertNodes)el.inert=prior;
  inertNodes=new Map();activeModalNode=modal;
  if(modal){let child=modal;while(child.parentElement&&child.parentElement!==document.documentElement){for(const sibling of child.parentElement.children){if(sibling!==child&&sibling instanceof HTMLElement&&!['SCRIPT','STYLE','LINK'].includes(sibling.tagName)){inertNodes.set(sibling,sibling.inert);sibling.inert=true;}}child=child.parentElement;}}
}
showModal=function(kind,arg=''){
  const before=MODAL?{...MODAL}:null,trigger=document.activeElement;
  const result=WORKSPACE_REFINEMENT.showModal(kind,arg);
  if(MODAL&&(!before||before.kind!==MODAL.kind||before.arg!==MODAL.arg))overlayReturns.push({key:panelKey(),trigger});
  syncOverlayLayers();return result;
};
closeModal=function(){
  const key=panelKey(),record=overlayReturns.findLast(x=>x.key===key);
  const result=WORKSPACE_REFINEMENT.closeModal();
  if(record)overlayReturns.splice(overlayReturns.indexOf(record),1);
  syncOverlayLayers();requestAnimationFrame(()=>restoreOverlayFocus(record?.trigger));return result;
};
render=function(bottom=false){WORKSPACE_REFINEMENT.render(bottom);syncOverlayLayers();};
// Window capture runs before all legacy document handlers; only this layer owns Escape.
window.addEventListener('keydown',event=>{
  const top=overlayStack().at(-1);
  if(event.key==='Escape'&&top){event.preventDefault();event.stopImmediatePropagation();top.close();syncOverlayLayers();return;}
  if(event.key==='Tab'&&top?.modal){
    const nodes=[...top.node.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]')].filter(n=>n.getClientRects().length&&!n.closest('[inert]'));
    const first=nodes[0],last=nodes.at(-1),current=document.activeElement;
    if(!top.node.contains(current)||event.shiftKey&&current===first||!event.shiftKey&&current===last){event.preventDefault();(event.shiftKey?last:first)?.focus();}
    event.stopImmediatePropagation();
  }
},true);
window.V6Overlays={stack:overlayStack,sync:syncOverlayLayers,restore:restoreOverlayFocus};
// Project creation is a separate, explicit action; never send a fixture prompt.
BLOCKING.add('create-project');
const projectCreationPrevious={handle,renderModal};
const projectFields=[['name','项目名称','例如：洗碗机德国上市'],['productName','产品名称','例如：嵌入式洗碗机'],['model','产品型号（选填）','可在资料中补充'],['category','产品品类','例如：洗碗机'],['market','目标市场','例如：德国'],['language','内容语言','例如：德语']];
function openProjectCreation(){showModal('create-project');}
renderModal=function(){
  if(MODAL?.kind!=='create-project')return projectCreationPrevious.renderModal();
  const draft=S.projectCreationDraft||{};
  dockRoot().innerHTML=modalFrame('创建上市项目',`<p class="muted">先填写项目基础信息，之后再补充资料、制定交付计划。创建不会开始制作。</p><form id="project-create-form"><div class="project-create-fields">${projectFields.map(([id,label,placeholder])=>`<div class="field"><label for="project-create-${id}">${label}${id==='model'?'':' *'}</label><input id="project-create-${id}" name="${id}" value="${E(draft[id]||'')}" placeholder="${placeholder}" maxlength="120" ${id==='model'?'':'required'}></div>`).join('')}</div><fieldset class="project-create-channels"><legend>交付渠道 *（可多选）</legend>${[['web','品牌官网'],['retail','线下门店'],['ecom','电商']].map(([id,label])=>`<label><input type="checkbox" name="channels" value="${id}" ${(draft.channels||[]).includes(id)?'checked':''}>${label}</label>`).join('')}</fieldset><div class="field"><label for="project-create-goal">项目目标（选填）</label><textarea id="project-create-goal" name="goal" maxlength="1000" placeholder="希望这次上市工作达成什么？">${E(draft.goal||'')}</textarea></div><p id="project-create-error" class="project-create-error" role="alert"></p></form>`,button('取消','modal-close')+button('创建项目','project-create-save','','primary','folder'),true);
  mountDock();
};
function readProjectCreation(){const form=document.querySelector('#project-create-form');if(!form)return null;const data=new FormData(form);return {...Object.fromEntries([...data].filter(([key])=>key!=='channels').map(([k,v])=>[k,String(v).trim()])),channels:data.getAll('channels')};}
document.addEventListener('input',e=>{if(e.target.closest('#project-create-form')){S.projectCreationDraft=readProjectCreation();persist();}});
document.addEventListener('submit',e=>{if(e.target.id==='project-create-form'){e.preventDefault();handle('project-create-save');}});
handle=function(action,arg,...rest){
  if(action==='project-create'||(action==='prompt'&&arg==='create'))return openProjectCreation();
  if(action!=='project-create-save')return projectCreationPrevious.handle(action,arg,...rest);
  const form=document.querySelector('#project-create-form'),data=readProjectCreation();if(!form||!data)return;
  const missing=projectFields.find(([id])=>id!=='model'&&!data[id]);
  if(missing||!data.channels.length){document.querySelector('#project-create-error').textContent=missing?'请填写'+missing[1]+'。':'请至少选择一个交付渠道。';const el=missing?form.elements[missing[0]]:form.querySelector('[name="channels"]');el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby','project-create-error');el.focus();return;}
  const id=uid('project'),tid=uid('chat');
  const p={...data,id,threadId:tid,owner:S.actor,tier:'Hero',markets:[data.market],scopeConfirmed:false,ruleVersion:2,created:now(),contextArtifacts:[],inputsReady:false};
  S.projects.push(p);S.threads.push({id:tid,title:'新的工作',projectId:id,messages:[],created:now()});
  delete S.projectCreationDraft;closeModal();S.artifactWorkspace=null;S.contextSelection=null;S.inspectorOpen=false;S.projectCollapsed[id]=false;goProject(id);
  toast('项目已创建。请先补充产品资料，再制定交付计划。');persist();
};
