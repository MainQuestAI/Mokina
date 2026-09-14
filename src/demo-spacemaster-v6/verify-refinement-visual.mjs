import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from '/Users/dingcheng/.gstack/repos/gstack/node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=root+'output/demo-spacemaster-v6/qa-refinement-visual';
fs.mkdirSync(out,{recursive:true});
const setup=`(async()=>{
  S=makeState();MODAL=null;globalReturn=null;S.inspectorOpen=false;S.actor='lin';S.settings.theme='light';S.settings.density='comfortable';S.openCanvases=[];S.artifactWorkspace=null;
  S.tasks=[];S.artifacts=[];S.submissions=[];S.batches=[];Object.keys(DRAFTS).forEach(k=>delete DRAFTS[k]);
  const p=S.projects.find(p=>p.id==='sample-launch')||S.projects[0];goProject(p.id);p.scopeConfirmed=true;
  window.visualFixture={pid:p.id,ids:{}};
  for(const kind of ['strategy','pop']){const t={id:'visual-'+kind,projectId:p.id,kind,domain:KIND[kind].domain,name:KIND[kind].name,maturity:kind==='pop'?'approved':'draft',requirement:'确认产品型号、使用场景、目标市场和资料来源。',assignee:'lin',reviewer:'reviewer',status:'draft_ready',revision:1};S.tasks.push(t);const a=newArtifact(kind,makeContent(kind),p.id,[]);a.taskId=t.id;t.artifactId=a.id;window.visualFixture.ids[kind]=a.id;}
  newChat();render();await document.fonts.ready;return {version:APP_VERSION,devicePixelRatio,fixtureOnly:true};
})()`;
const scenes={
  home:`closeModal();S.actor='lin';S.canvas=null;S.artifactWorkspace=null;newChat();`,
  plan:`closeModal();S.actor='lin';S.canvas=null;S.artifactWorkspace=null;goProject(visualFixture.pid);openUnifiedPlan(visualFixture.pid);`,
  decisions:`closeModal();S.actor='lin';S.canvas=null;S.artifactWorkspace=null;await handle('review-inbox');`,
  artifact:`closeModal();S.actor='lin';S.canvas=null;S.artifactWorkspace=null;S.projectId=null;S.view='library';render();await handle('open-artifact',visualFixture.ids.strategy+'|1');`,
  review:`closeModal();S.actor='reviewer';S.canvas=null;S.artifactWorkspace=null;const a=artifact(visualFixture.ids.pop);S.submissions=[{id:'visual-review',artifactId:a.id,taskId:a.taskId,projectId:a.projectId,title:a.title,revision:1,snapshot:clone(revision(a,1)),requirement:{text:'确认型号、市场、内容与来源。',maturity:'approved'},submitter:'lin',reviewer:'reviewer',status:'pending'}];await handle('review-inbox');showModal('review','visual-review');`,
  formReadonly:`closeModal();S.actor='lin';goProject(visualFixture.pid);const p=ensureUnifiedPlan(visualFixture.pid);p.status='confirmed';showModal('plan',p.id);`,
  formError:`closeModal();S.actor='lin';const a=artifact(visualFixture.ids.pop);a.accepted=1;a.active=1;S.submissions=[];if(!a.pending)addRevision(a,clone(revision(a,1).data),'待采用候选');showModal('submit',a.id+'|1');`
};
const metrics=`(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&!e.closest('[hidden]')};
  const toolbar=document.querySelector('.artifact-context-bar');
  const children=toolbar?[...toolbar.children].filter(visible):[],rows=[...new Set(children.map(e=>Math.round(e.getBoundingClientRect().top/4)*4))];
  const body=document.querySelector('.canvas-body'),first=body?.querySelector('.section>p'),bodyRect=body&&rect(body),firstRect=first&&rect(first);
  const controls=[...document.querySelectorAll('button,input,select,textarea,[role=tab]')].filter(visible);
  const outside=controls.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5||e.scrollWidth>e.clientWidth+3&&!e.matches('select,textarea,input')}).map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||'').slice(0,65),...rect(e),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
  const computed=controls.map(e=>{const s=getComputedStyle(e);return {text:(e.innerText||e.getAttribute('aria-label')||e.id||'').slice(0,70),tag:e.tagName,disabled:e.disabled||false,readonly:e.readOnly||false,selected:e.getAttribute('aria-selected'),invalid:e.getAttribute('aria-invalid'),font:s.font,height:s.height,radius:s.borderRadius,color:s.color,background:s.backgroundColor,border:s.border,gap:s.gap,...rect(e)}});
  return {viewport:[innerWidth,innerHeight],devicePixelRatio,documentOverflow:document.documentElement.scrollWidth>innerWidth,toolbar:toolbar?{rect:rect(toolbar),alignedTopRows:rows.length,rows,approxRows:Math.ceil(toolbar.getBoundingClientRect().height/44)}:null,firstSection:firstRect?{rect:firstRect,body:bodyRect,visiblePixels:Math.max(0,Math.min(firstRect.bottom,bodyRect.bottom,innerHeight)-Math.max(firstRect.y,bodyRect.y))}:null,outside,computed,tags:[...document.querySelectorAll('.tag')].filter(visible).map(e=>({text:e.innerText,...rect(e)})),modal:MODAL?.kind||null,overlayStack:V6Overlays.stack().map(x=>x.kind)};
})()`;
const browser=await chromium.launch({headless:true});
try{for(const [width,height] of [[1280,720],[1440,1000],[1531,1324]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(root+'output/demo-spacemaster-v6/finalized.html').href);await page.evaluate(setup);
  for(const name of ['home','plan','decisions','artifact','review',...(width===1440?['formReadonly','formError']:[])]){
    await page.evaluate(`(async()=>{${scenes[name]}render();if(MODAL)renderModal();document.querySelector('#toast').hidden=true;await document.fonts.ready;return true})()`);
    await page.screenshot({path:`${out}/${name}-${width}.png`});fs.writeFileSync(`${out}/${name}-${width}.json`,JSON.stringify(await page.evaluate(metrics),null,2));
  }
  fs.writeFileSync(out+'/capture-'+width+'.log',JSON.stringify({driver:'playwright',viewport:{width,height},errors},null,2));await context.close();if(errors.length)throw Error(errors.join('\n'));
}
  const sourceContext=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1}),source=await sourceContext.newPage();
  await source.goto(pathToFileURL('/Users/dingcheng/.gstack/projects/AgenticDAM/designs/midea-design-system-20260908/preview.html').href);
  await source.getByRole('tab',{name:'03 组件与状态'}).click();await source.evaluate(()=>document.fonts.ready);
  await source.getByText('操作与反馈',{exact:true}).evaluate(el=>el.scrollIntoView({block:'center'}));await source.screenshot({path:out+'/midea-components-1440.png'});
  await source.getByText('系统标识（禁用）',{exact:true}).evaluate(el=>el.scrollIntoView({block:'center'}));await source.screenshot({path:out+'/midea-input-states-1440.png'});
  fs.writeFileSync(out+'/midea-computed.json',JSON.stringify(await source.evaluate(()=>({viewport:[innerWidth,innerHeight],devicePixelRatio,controls:[...document.querySelectorAll('button,input,textarea,select,[role=tab]')].filter(e=>e.getBoundingClientRect().width).map(e=>{const s=getComputedStyle(e);return {tag:e.tagName,id:e.id,text:e.innerText||e.getAttribute('aria-label')||'',readonly:!!e.readOnly,disabled:!!e.disabled,selected:e.getAttribute('aria-selected'),invalid:e.getAttribute('aria-invalid'),font:s.font,height:s.height,radius:s.borderRadius,color:s.color,background:s.backgroundColor,border:s.border}})})),null,2));await sourceContext.close();
}finally{await browser.close();}
const report=[];
for(const file of fs.readdirSync(out).filter(f=>/^(home|plan|decisions|artifact|review|formReadonly|formError)-(1280|1440|1531)\.json$/.test(f))){const m=JSON.parse(fs.readFileSync(out+'/'+file,'utf8'));if(m.viewport[0]!==Number(file.match(/-(\d+)\.json$/)[1]))throw Error('Viewport mismatch: '+file);report.push({file,documentOverflow:m.documentOverflow,outside:m.outside,toolbar:m.toolbar,firstSection:m.firstSection,overlayStack:m.overlayStack});}
fs.writeFileSync(out+'/layout-summary.json',JSON.stringify(report,null,2));console.log(JSON.stringify({states:report.length,out}));
for(const row of report){if(row.documentOverflow||row.outside.length)throw Error('Control overflow: '+row.file);if(row.toolbar?.approxRows>3)throw Error('Artifact toolbar exceeds three control rows: '+row.file);if(row.firstSection&&row.firstSection.visiblePixels<=0)throw Error('First section body is not visible: '+row.file);}
