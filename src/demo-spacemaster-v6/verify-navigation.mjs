import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const out='/Users/dingcheng/Coding-Project/02-key-project/Lilith-原型/output/demo-spacemaster-v6';
const test=`(async()=>{
  const result=[];const check=(name,ok)=>{result.push({name,ok:!!ok});if(!ok)throw Error(name)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  S=makeState();MODAL=null;globalReturn=null;S.inspectorOpen=false;Object.keys(DRAFTS).forEach(k=>delete DRAFTS[k]);newChat();render();
  check('three independent vertical scenarios',document.querySelectorAll('.scenario-grid>.space-preview').length===3);
  check('official product images are embedded for offline use',Object.values(MERGED_ASSETS.scenarios).length===2&&Object.values(MERGED_ASSETS.scenarios).every(v=>v.startsWith('data:image/webp;base64,')));
  await Promise.all(Object.values(MERGED_ASSETS.scenarios).map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth===3000?resolve():reject(Error('image dimension'));img.onerror=reject;img.src=src})));
  check('both downloaded official images decode',true);
  addMsg('user','讨论上市安排');
  const priorProjects=JSON.stringify(S.projects),n=S.projects.length;
  await handle('scenario-open','dishwasher');const dishwasher=S.projectId;await handle('scenario-open','dishwasher');
  check('scenario entry reopens one dedicated project without duplicates',S.projects.length===n+1&&S.projectId===dishwasher&&project().model==='MDWPS1401KSS');
  await handle('nav','files');check('new project shows its official product facts and source',document.querySelector('.view-content').innerText.includes('14 套')&&document.querySelector('.view-content a').href.includes('mdwps1401kss'));
  await handle('scenario-open','air-fryer');check('air fryer owns separate product facts',project().model==='MAF7DSTBSKV'&&project().officialSource.facts.includes('7 L'));
  check('existing projects are not renamed or overwritten',JSON.stringify(S.projects.slice(0,n))===priorProjects);
  const before=S.artifacts.length;await generate('strategy');check('new scenarios cannot generate fridge facts',MODAL?.kind==='product-intake'&&S.artifacts.length===before);closeModal();
  const p=S.projects[0];goProject(p.id);const a=newArtifact('strategy',makeContent('strategy'),p.id,[]);openCanvas(a.id,1);
  DRAFTS[S.threadId]='保留这一段尚未发送的意见';document.querySelector('#composer').value=DRAFTS[S.threadId];
  const tabs=JSON.stringify(S.openCanvases),canvas=JSON.stringify(S.canvas),width=document.querySelector('.canvas').getBoundingClientRect().width;
  check('account has one entry at bottom left',document.querySelectorAll('.role-btn').length===1&&!!document.querySelector('.sidebar-bottom .role-btn')&&!document.querySelector('.topbar .role-btn'));
  check('standalone conversations use plain label',document.querySelector('.sidebar-scroll').innerText.includes('对话')&&!document.querySelector('.sidebar-scroll').innerText.includes('未归入项目'));
  check('work status is local and labelled, not a global topbar icon',!!document.querySelector('.work-context-bar .work-status-entry')&&!document.querySelector('.topbar .inspector-toggle'));
  await handle('inspector-toggle');check('status overlays without hiding or resizing artifact',!!document.querySelector('.work-inspector')&&getComputedStyle(document.querySelector('.canvas')).display!=='none'&&document.querySelector('.canvas').getBoundingClientRect().width===width);
  await handle('context',p.id);check('background uses same single inspector',document.querySelectorAll('.work-inspector').length===1&&!!document.querySelector('.project-facts')&&document.querySelector('[data-action="context"]').getAttribute('aria-expanded')==='true');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  check('Escape folds information only, keeping artifact and draft',!S.inspectorOpen&&JSON.stringify(S.canvas)===canvas&&document.querySelector('#composer').value==='保留这一段尚未发送的意见');
  await handle('inspector-toggle');await handle('inspector-toggle');check('status entry toggles predictably',!document.querySelector('.work-inspector'));
  const other=S.projects[1];S.batches.push({id:'other-batch',projectId:other.id,threadId:other.threadId,status:'running',items:[]});render();
  check('another project does not appear in current status',!currentWorkSummary().active);S.batches=[];
  await handle('about');check('help opens as modal without adding a work tab',!!document.querySelector('.modal-overlay')&&!document.querySelector('.dock-host')&&JSON.stringify(S.openCanvases)===tabs);closeModal();
  await handle('settings');check('settings opens as independent page',!!document.querySelector('.utility-host .utility-page')&&!document.querySelector('.utility-host .work-tabs')&&!document.querySelector('.modal-overlay'));
  showModal('about');closeModal();check('help from settings returns to settings',MODAL?.kind==='settings'&&!!document.querySelector('#pref-theme'));
  const noDensity=!document.querySelector('#pref-density');document.querySelector('#pref-speed').value='2';await handle('save-settings');check('save settings without density switch preserves artifact and draft',noDensity&&S.settings.density==='comfortable'&&S.settings.speed===2&&JSON.stringify(S.canvas)===canvas&&document.querySelector('#composer').value==='保留这一段尚未发送的意见');
  await handle('capabilities');check('capabilities is a page rather than a dock',!!document.querySelector('.utility-page')&&!document.querySelector('.dock-host'));await handle('utility-close');
  showModal('settings');await handle('project',p.id);check('project navigation leaves global settings',!MODAL&&S.projectId===p.id&&!document.querySelector('.utility-host'));openCanvas(a.id,1);
  showModal('edit-document',a.id+'|1');document.querySelector('#doc-field-0').value='保留未提交的编辑';showModal('about');closeModal();
  check('closing help restores previous editor and its draft',MODAL?.kind==='edit-document'&&document.querySelector('#doc-field-0').value==='保留未提交的编辑');closeModal();
  const events=runSpec('strategy').steps;check('capability labels do not repeat simulation wording',events.every(e=>!e[2].includes('模拟')));
  S.settings.density='comfortable';S.auto={active:true,index:0};window.__LILITH_QA_TIME_SCALE=80;S.contextSelection={artifactId:a.id,revision:1,title:'旧选中内容'};
  await sendPrompt('为什么优先选择厨房升级人群？');
  check('demo types full request in real composer before sending',window.__DEMO_INPUT_TRACE.at(-1).composer==='为什么优先选择厨房升级人群？'&&!window.__DEMO_INPUT_TRACE.at(-1).hasSelection);
  check('typed request becomes exactly one user message',thread().messages.filter(m=>m.role==='user'&&m.text==='为什么优先选择厨房升级人群？').length===1);
  S.auto={active:true,index:0};window.__LILITH_QA_TIME_SCALE=1;const count=thread().messages.length;const typing=autoTypeInput('暂停后不要再输入，也不要发送这段文字').catch(e=>e.message);
  let deadline=Date.now()+3000;while((document.querySelector('#composer')?.value.length||0)<2&&Date.now()<deadline)await wait(20);
  S.paused=true;await wait(70);const frozen=document.querySelector('#composer').value;await wait(120);check('pause freezes human input animation',frozen.length>=2&&document.querySelector('#composer').value===frozen);
  S.auto.active=false;S.paused=false;check('stop cancels unsent input without creating a user message',await typing==='AUTO_STOPPED'&&thread().messages.length===count&&!demoInput);
  S.auto=null;S.canvas=null;S.projectId=null;newChat();S.inspectorOpen=false;render();document.querySelector('#toast').hidden=true;
  return result;
})()`;
const layout=`(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,containers:[...document.querySelectorAll('.work-context-bar,.scenario-grid,.space-preview,.utility-page,.work-inspector')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+3).map(e=>e.className),cards:[...document.querySelectorAll('.scenario-grid>.space-preview')].map(e=>({x:Math.round(e.getBoundingClientRect().x),y:Math.round(e.getBoundingClientRect().y),footer:Math.round(e.querySelector('.btn').getBoundingClientRect().y)}))}))()`;
const args=['run','/Users/dingcheng/.gstack/repos/gstack/bin/gstack-render.ts',out+'/finalized.html','--timeout','90000','--eval',test,'--out',out+'/v53-navigation-result.json','--screenshot',out+'/v53-home-desktop.jpg','--width','1888','--height','1324','--jpeg','--eval',layout,'--out',out+'/v53-home-desktop-layout.json','--screenshot',out+'/v53-home-mobile.jpg','--width','390','--height','844','--jpeg','--eval',layout,'--out',out+'/v53-home-mobile-layout.json',
  '--eval',`(async()=>{S.auto={active:true,index:0};window.__LILITH_QA_TIME_SCALE=5;window.mobileInput=autoTypeInput('先帮我研究墨西哥的厨房场景，再讨论 SpaceMaster 的上市策略。').catch(e=>e.message);while((document.querySelector('#composer')?.value.length||0)<12)await new Promise(r=>setTimeout(r,20));S.paused=true;render();await new Promise(r=>setTimeout(r,70));const c=document.querySelector('#composer'),r=c.getBoundingClientRect(),view=document.querySelector('.chat-scroll').getBoundingClientRect();return {visible:r.top>=view.top&&r.bottom<=innerHeight,label:!!document.querySelector('.home-input .demo-input-label'),sendDisabled:document.querySelector('.send-btn').disabled,text:c.value};})()`,'--out',out+'/v53-input-visibility.json','--screenshot',out+'/v53-input-mobile.jpg','--width','390','--height','844','--jpeg','--screenshot',out+'/v53-input-desktop.jpg','--width','1440','--height','1000','--jpeg','--eval',`(async()=>{S.auto.active=false;S.paused=false;await window.mobileInput;S.auto=null;render();return true})()`,
  '--eval',`(()=>{goProject(S.projects[0].id);openCanvas(S.artifacts[0].id,1);openInspector('status');return true})()`,'--screenshot',out+'/v53-status-desktop.jpg','--width','1440','--height','960','--jpeg','--eval',layout,'--out',out+'/v53-status-layout.json',
  '--eval',`(()=>{S.inspectorOpen=false;showModal('settings');return true})()`,'--screenshot',out+'/v53-settings-desktop.jpg','--width','1440','--height','960','--jpeg',
  '--eval',`(()=>{closeModal();showModal('about');return true})()`,'--screenshot',out+'/v53-help-mobile.jpg','--width','390','--height','844','--jpeg','--eval',layout,'--out',out+'/v53-help-layout.json'];
const r=spawnSync('bun',args,{encoding:'utf8',timeout:110000});fs.writeFileSync(out+'/v53-navigation.log',(r.stdout||'')+(r.stderr||''));console.log(r.stdout);console.error(r.stderr);if(r.status!==0||/PAGE_ERRORS=\[(?!\])/.test(r.stdout))process.exit(1);
const results=JSON.parse(fs.readFileSync(out+'/v53-navigation-result.json','utf8'));if(results.some(c=>!c.ok))throw Error('Navigation assertions failed');
const input=JSON.parse(fs.readFileSync(out+'/v53-input-visibility.json','utf8'));if(!input.visible||!input.label||!input.sendDisabled)throw Error('Mobile demo input is obscured or can be sent twice');
for(const key of ['home-desktop','home-mobile','status','help']){const l=JSON.parse(fs.readFileSync(out+'/v53-'+key+'-layout.json','utf8'));if(l.overflow||l.containers.length)throw Error('Layout failure: '+JSON.stringify(l))}
console.log(JSON.stringify({passed:true,checks:results.length}));
