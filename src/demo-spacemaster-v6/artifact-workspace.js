/* Artifact navigation is independent of the optional conversation pane. */
const ARTIFACT_WORKSPACE={render,handle,openCanvas,canvasHTML,chatHTML,modalFrame};

function navigationView(){return S.view==='artifact'?(S.artifactWorkspace?.origin.view||'library'):S.view;}
function captureConversationDraft(){const input=document.querySelector('#composer');if(input)DRAFTS[input.dataset.threadId||S.threadId]=input.value;}
function workspaceOrigin(){
  return {view:S.view,projectId:S.projectId,threadId:S.threadId,filters:clone(S.filters),taskFilter:S.taskFilter,decisionTab:S.decisionTab,
    selection:clone(S.contextSelection),listScroll:document.querySelector('.view-content')?.scrollTop||0,
    chatScroll:document.querySelector('.chat-scroll')?.scrollTop||0,
    focusAction:document.activeElement?.dataset.action,focusArg:document.activeElement?.dataset.arg};
}
function createArtifactWorkspace(){
  const origin=workspaceOrigin(),independent=origin.view!=='chat';
  return {origin,independent,chatVisible:!independent,scrolls:{},chatScroll:origin.chatScroll,discussionBound:false};
}
openCanvas=function(id,num=null,tab='content'){
  const a=artifact(id);if(!a||!revision(a,num||a.pending||a.active))return;
  captureConversationDraft();capturePanel();
  if(!S.artifactWorkspace||!S.canvas||!['chat','artifact'].includes(S.view))S.artifactWorkspace=createArtifactWorkspace();
  const changed=S.canvas?.id!==id;
  ARTIFACT_WORKSPACE.openCanvas(id,num,tab);
  if(changed&&S.artifactWorkspace?.discussionBound&&S.artifactWorkspace.chatVisible)bindArtifactDiscussion('',false);
};
function artifactBackLabel(){const view=S.artifactWorkspace?.origin.view;return ({library:'返回成果列表',tasks:'返回任务列表',review:'返回待处理',files:'返回资料列表',activity:'返回动态'})[view]||'返回对话';}
function artifactToolbarHTML(){
  const visible=S.artifactWorkspace?.chatVisible!==false;
  return `<div class="artifact-layout-bar" aria-label="成果工作区布局">${button(artifactBackLabel(),'artifact-back','','ghost sm','chevron')}<span class="spacer"></span><button class="btn sm" data-action="artifact-chat-toggle" aria-expanded="${visible}" aria-controls="artifact-conversation">${icon(visible?'layout':'message')}${visible?'收起对话':'讨论这份成果'}</button></div>`;
}
modalFrame=function(...args){const html=ARTIFACT_WORKSPACE.modalFrame(...args);return S.canvas&&S.artifactWorkspace&&!isBlockingModal(MODAL?.kind)&&!UTILITY_PAGES.has(MODAL?.kind)?artifactToolbarHTML()+html:html;};
canvasHTML=function(){
  let html=ARTIFACT_WORKSPACE.canvasHTML();
  if(!S.artifactWorkspace)return html;
  html=html.replace('<aside class="canvas" aria-label="成果工作面">','<section class="canvas" aria-label="成果详情">'+artifactToolbarHTML()).replace(/<\/aside>$/,'</section>');
  return html.replace(ibutton('关闭成果工作面','close-canvas'),'');
};
chatHTML=function(){
  let html=ARTIFACT_WORKSPACE.chatHTML();
  if(!S.canvas||!S.artifactWorkspace)return html;
  return html.replace('<section class="chat-column">','<section id="artifact-conversation" class="chat-column" aria-label="成果讨论"><div class="artifact-chat-heading">'+icon('message')+'<span>与 Lilith 讨论</span></div>');
};
function discussionThread(a){
  const ws=S.artifactWorkspace;
  const compatible=t=>t&&t.projectId===(a.projectId||null);
  const current=thread();
  if(!ws.independent&&compatible(current))return current;
  const remembered=S.threads.find(t=>t.id===ws.discussionThreadId);
  if(compatible(remembered))return remembered;
  const source=S.threads.findLast(t=>compatible(t)&&t.messages.some(m=>m.artifactIds?.includes(a.id)||m.artifactRefs?.some(r=>r.id===a.id)));
  if(source)return source;
  const projectThread=S.threads.find(t=>t.id===project(a.projectId)?.threadId);
  if(compatible(projectThread))return projectThread;
  const t={id:uid('chat'),title:a.title+' · 讨论',projectId:a.projectId||null,messages:[],created:now()};S.threads.push(t);return t;
}
function bindArtifactDiscussion(section='',focus=true){
  const a=artifact(S.canvas?.id),v=selectedRevision(),ws=S.artifactWorkspace;if(!a||!v||!ws)return;
  captureConversationDraft();const t=discussionThread(a);S.threadId=t.id;S.projectId=a.projectId||null;ws.discussionThreadId=t.id;
  const part=v.data.sections?.find(x=>x.id===section)||v.data.points?.find(x=>x.id===section);
  S.contextSelection={artifactId:a.id,revision:v.num,section,title:part?.title||a.title};
  ws.discussionBound=true;ws.boundTarget=a.id+'|'+v.num;ws.chatVisible=true;
  S.view=ws.independent?'artifact':'chat';render();persist();if(focus)document.querySelector('#composer')?.focus({preventScroll:true});
}
function returnFromArtifact(){
  const ws=S.artifactWorkspace;if(!ws)return;
  captureConversationDraft();capturePanel();const origin=ws.origin;
  MODAL=null;S.panelStack=[];S.dockState=null;S.inspectorOpen=false;S.canvas=null;S.artifactWorkspace=null;
  S.view=origin.view;S.projectId=origin.projectId;S.threadId=origin.threadId;S.filters=clone(origin.filters);S.taskFilter=origin.taskFilter;S.decisionTab=origin.decisionTab;S.contextSelection=clone(origin.selection);
  const root=dockRoot();root.innerHTML='';root.className='';document.body.appendChild(root);
  render();persist();
  requestAnimationFrame(()=>{
    const list=document.querySelector('.view-content'),chat=document.querySelector('.chat-scroll');if(list)list.scrollTop=origin.listScroll;if(chat)chat.scrollTop=origin.chatScroll;
    const target=[...document.querySelectorAll('[data-action]')].find(e=>e.dataset.action===origin.focusAction&&e.dataset.arg===origin.focusArg);target?.focus({preventScroll:true});
  });
}
render=function(bottom=false){
  if(S.canvas&&['chat','artifact'].includes(S.view)&&!S.artifactWorkspace)S.artifactWorkspace=createArtifactWorkspace();
  const ws=S.artifactWorkspace;
  if(ws&&S.canvas&&['chat','artifact'].includes(S.view)){
    if(ws.independent)S.view='artifact';
    const old=document.querySelector('.canvas-body');if(old?.dataset.artifactScrollKey)ws.scrolls[old.dataset.artifactScrollKey]=old.scrollTop;
    const chat=document.querySelector('.chat-scroll');if(chat)ws.chatScroll=chat.scrollTop;
    if(ws.discussionBound&&ws.chatVisible&&ws.boundTarget!==S.canvas.id+'|'+S.canvas.num){
      const a=artifact(S.canvas.id);S.contextSelection={artifactId:a.id,revision:S.canvas.num,section:'',title:a.title};ws.boundTarget=a.id+'|'+S.canvas.num;
    }
  }
  ARTIFACT_WORKSPACE.render(bottom);
  const main=document.querySelector('.main');
  const active=!!(ws&&S.canvas&&['chat','artifact'].includes(S.view));
  main?.classList.toggle('artifact-focused',active&&!ws.chatVisible);main?.classList.toggle('artifact-workspace',active);
  if(active){
    const dock=main.querySelector('.dock-host');if(dock&&!dock.querySelector('.artifact-layout-bar'))dock.insertAdjacentHTML('afterbegin',artifactToolbarHTML());
    const body=main.querySelector('.canvas-body'),key=S.canvas.id+'|'+S.canvas.num+'|'+S.canvas.tab;
    if(body){body.dataset.artifactScrollKey=key;body.scrollTop=ws.scrolls[key]||0;}
    const chat=main.querySelector('.chat-scroll');if(chat&&!bottom)chat.scrollTop=ws.chatScroll||0;
  }
};
handle=async function(action,arg=''){
  if(action==='artifact-back'||action==='close-canvas'&&S.artifactWorkspace){returnFromArtifact();return;}
  if(action==='artifact-chat-toggle'){
    const ws=S.artifactWorkspace;if(!ws||!S.canvas)return;
    if(ws.chatVisible){captureConversationDraft();ws.chatVisible=false;render();persist();document.querySelector('[data-action="artifact-chat-toggle"]')?.focus({preventScroll:true});}
    else bindArtifactDiscussion();
    return;
  }
  if(action==='open-artifact'){const[id,n]=String(arg).split('|');openCanvas(id,Number(n)||null);return;}
  if(action==='select-section'&&S.canvas&&S.artifactWorkspace){
    const[id,n,section='']=String(arg).split('|');
    if(S.canvas.id!==id||S.canvas.num!==Number(n))openCanvas(id,Number(n));
    // Keep the pre-existing single-pane small-screen behavior; desktop gets folding.
    if(innerWidth<851){S.artifactWorkspace=null;return ARTIFACT_WORKSPACE.handle(action,arg);}
    if(MODAL)closeModal();bindArtifactDiscussion(section);return;
  }
  if(action==='clear-selection'&&S.artifactWorkspace)S.artifactWorkspace.discussionBound=false;
  if(action==='canvas-tab-close'&&S.artifactWorkspace){
    const[id,n]=String(arg).split('|');S.openCanvases=S.openCanvases.filter(c=>!(c.id===id&&c.num===Number(n)));
    if(S.canvas?.id===id&&S.canvas.num===Number(n)){const next=S.openCanvases.at(-1);if(next)openCanvas(next.id,next.num);else returnFromArtifact();}
    else{render();persist();}return;
  }
  if(S.artifactWorkspace&&['nav','project','thread','new-chat','new-project-thread','scenario-open','my-tasks','project-files','choose-project','restore-confirm','auto-start'].includes(action)){
    if(action==='nav'&&arg===S.artifactWorkspace.origin.view){returnFromArtifact();return;}
    captureConversationDraft();S.artifactWorkspace=null;S.canvas=null;if(S.view==='artifact')S.view='chat';
  }
  return ARTIFACT_WORKSPACE.handle(action,arg);
};
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!S.artifactWorkspace||!S.canvas||MODAL||S.inspectorOpen||projectMenuId)return;
  event.preventDefault();event.stopImmediatePropagation();returnFromArtifact();
},true);
