import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const out='/Users/dingcheng/Coding-Project/02-key-project/Lilith-原型/output/demo-spacemaster-v6';
const setup=`(()=>{
  S=makeState();MODAL=null;globalReturn=null;S.inspectorOpen=false;Object.keys(DRAFTS).forEach(k=>delete DRAFTS[k]);
  const p=S.projects[0];goProject(p.id);addMsg('user','准备当前产品的上市内容。');
  for(let i=0;i<24;i++){const a=newArtifact('strategy',makeContent('strategy'),p.id,[]);a.title='上市策略 '+(i+1);addMsg('assistant','已保存策略成果。',{artifactIds:[a.id]});}
  const a=S.artifacts[8];addRevision(a,clone(revision(a,1).data),'另一候选版本',[]);a.accepted=1;
  window.artifactTestId=a.id;window.artifactTestThread=S.threadId;window.artifactTestSnapshot=JSON.stringify(revision(a,1));
  DRAFTS[S.threadId]='保留原对话草稿';const input=document.querySelector('#composer');input.value=DRAFTS[S.threadId];
  handle('nav','library');handle('filter','strategy');
  return true;
})()`;
const tests=`(async()=>{
  const checks=[];const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name)};
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const a=artifact(window.artifactTestId),tid=window.artifactTestThread;
  const card=[...document.querySelectorAll('.result-card')].find(el=>el.dataset.arg.startsWith(a.id+'|'));
  card.focus({preventScroll:true});document.querySelector('.view-content').scrollTop=640;const scroll=document.querySelector('.view-content').scrollTop;check('fixture scrolls the filtered library',scroll>0);
  await handle('open-artifact',a.id+'|1');
  check('library opens independent artifact view',S.view==='artifact'&&navigationView()==='library');
  check('conversation is initially absent',!document.querySelector('.chat-column')&&!document.querySelector('#composer'));
  check('artifact occupies the whole work area',Math.abs(document.querySelector('.canvas').getBoundingClientRect().width-document.querySelector('.main').getBoundingClientRect().width)<2);
  check('library navigation remains selected',!!document.querySelector('.primary-nav [data-arg="library"].active')&&!!document.querySelector('.work-view-tabs [data-arg="library"].active'));
  check('back and expand controls are local to the artifact',!!document.querySelector('.canvas .artifact-layout-bar [data-action="artifact-back"]')&&document.querySelector('[data-action="artifact-chat-toggle"]').getAttribute('aria-expanded')==='false');
  check('viewing alone does not change draft or version',DRAFTS[tid]==='保留原对话草稿'&&JSON.stringify(revision(a,1))===window.artifactTestSnapshot);
  await handle('artifact-chat-toggle');
  check('discussion expands without navigating away',S.view==='artifact'&&!!document.querySelector('.chat-column')&&!!document.querySelector('.canvas'));
  check('discussion targets current artifact and version',S.contextSelection.artifactId===a.id&&S.contextSelection.revision===1&&S.threadId===tid);
  window.__LILITH_QA_TIME_SCALE=80;const versionCount=a.versions.length;await sendPrompt('为什么选择这一产品定位？先不要修改');
  check('sending a discussion stays in artifact view without revising content',S.view==='artifact'&&S.canvas.id===a.id&&a.versions.length===versionCount&&thread().messages.some(m=>m.role==='user'&&m.text==='为什么选择这一产品定位？先不要修改'));
  document.querySelector('#composer').value='折叠后继续编辑这段意见';
  const body=document.querySelector('.canvas-body');body.scrollTop=180;const bodyScroll=body.scrollTop;
  await handle('artifact-chat-toggle');await handle('artifact-chat-toggle');
  check('folding preserves unsent discussion',document.querySelector('#composer').value==='折叠后继续编辑这段意见');
  check('folding preserves artifact reading position',Math.abs(document.querySelector('.canvas-body').scrollTop-bodyScroll)<2);
  document.querySelector('#version-select').value='2';document.querySelector('#version-select').dispatchEvent(new Event('change',{bubbles:true}));
  check('changing viewed version updates discussion reference',S.contextSelection.revision===2&&S.canvas.num===2);
  await handle('artifact-chat-toggle');showModal('edit-document',a.id+'|2');
  check('editor inherits full work area and return route',S.view==='artifact'&&!!document.querySelector('.dock-host .artifact-layout-bar')&&Math.abs(document.querySelector('.dock-host').getBoundingClientRect().width-document.querySelector('.main').getBoundingClientRect().width)<2);
  document.querySelector('#doc-field-0').value='保留尚未提交的正文修改';showModal('source','P01');await handle('panel-back');
  check('nested sources return to editor with draft',MODAL.kind==='edit-document'&&document.querySelector('#doc-field-0').value==='保留尚未提交的正文修改');
  closeModal();check('closing editor returns to focused artifact',S.view==='artifact'&&!MODAL&&!!document.querySelector('.canvas')&&!document.querySelector('.chat-column'));
  await handle('canvas-switch',S.artifacts[9].id+'|1');
  check('switching after a discussion does not reopen a deliberately folded pane',!S.artifactWorkspace.chatVisible&&!document.querySelector('.chat-column'));
  openCanvas(a.id,2);
  await handle('artifact-back');await frame();
  check('back restores original list scope and filter',S.view==='library'&&S.projectId===a.projectId&&S.filters.domain==='strategy'&&!S.canvas);
  check('back restores scroll and keyboard focus',Math.abs(document.querySelector('.view-content').scrollTop-scroll)<2&&document.activeElement.dataset.arg===card.dataset.arg);
  check('return preserves discussion draft and fixed version',DRAFTS[tid]==='折叠后继续编辑这段意见'&&JSON.stringify(revision(a,1))===window.artifactTestSnapshot);
  await handle('thread',tid);await handle('open-artifact',a.id+'|1');
  check('chat entry defaults to paired layout',S.view==='chat'&&S.artifactWorkspace.chatVisible&&!!document.querySelector('.chat-column'));
  await handle('artifact-chat-toggle');check('chat entry also supports full-width reading',!document.querySelector('.chat-column')&&S.view==='chat');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await frame();
  check('Escape returns to originating conversation',S.view==='chat'&&S.threadId===tid&&!S.canvas&&!S.artifactWorkspace);
  await handle('nav','library');await handle('open-artifact',a.id+'|1');
  await handle('canvas-switch',S.artifacts[9].id+'|1');
  check('switching artifacts preserves independent workspace and origin',S.view==='artifact'&&!S.artifactWorkspace.chatVisible&&S.artifactWorkspace.origin.view==='library');
  await handle('new-chat');check('global new chat leaves artifact workspace',conversationStart()&&!S.projectId&&!S.artifactWorkspace&&!document.querySelector('.artifact-layout-bar'));
  await handle('nav','library');await handle('open-artifact',a.id+'|1');S.openCanvases=[{id:a.id,num:1}];await handle('canvas-tab-close',a.id+'|1');await frame();
  check('closing the last artifact restores its list instead of a blank screen',S.view==='library'&&!S.canvas&&!S.artifactWorkspace&&!!document.querySelector('.library-grid'));
  return checks;
})()`;
const focused=`(async()=>{await handle('project',S.projects[0].id);await handle('nav','library');await handle('open-artifact',window.artifactTestId+'|1');return true})()`;
const args=['run','/Users/dingcheng/.gstack/repos/gstack/bin/gstack-render.ts',out+'/finalized.html','--timeout','90000','--eval',setup,'--eval',tests,'--out',out+'/artifact-workspace-checks.json',
  '--eval',focused,'--screenshot',out+'/artifact-focused.jpg','--width','1531','--height','1324','--jpeg',
  '--eval',`(async()=>{await handle('artifact-chat-toggle');return true})()`,'--screenshot',out+'/artifact-discussion.jpg','--width','1531','--height','1324','--jpeg',
  '--eval',`(async()=>{await handle('artifact-chat-toggle');showModal('edit-document',window.artifactTestId+'|2');return true})()`,'--screenshot',out+'/artifact-editor-focused.jpg','--width','1531','--height','1324','--jpeg',
  '--eval',`(()=>{closeModal();S.settings.theme='dark';render();return true})()`,'--screenshot',out+'/artifact-focused-dark.jpg','--width','1888','--height','1324','--jpeg'];
const result=spawnSync('bun',args,{encoding:'utf8',timeout:110000});
fs.writeFileSync(out+'/artifact-workspace-verification.log',(result.stdout||'')+(result.stderr||''));console.log(result.stdout);console.error(result.stderr);
if(result.status!==0||/PAGE_ERRORS=\[(?!\])/.test(result.stdout))process.exit(1);
console.log(JSON.stringify({passed:true,checks:JSON.parse(fs.readFileSync(out+'/artifact-workspace-checks.json')).length}));
