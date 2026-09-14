import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const out='/Users/dingcheng/Coding-Project/02-key-project/Lilith-原型/output/demo-spacemaster-v6';
const setup=`(async()=>{S=makeState();MODAL=null;globalReturn=null;S.inspectorOpen=false;Object.keys(DRAFTS).forEach(k=>delete DRAFTS[k]);newChat();render();await Promise.all([...document.fonts].map(f=>f.load()));await document.fonts.ready;return {faces:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})),version:APP_VERSION};})()`;
const test=`(async()=>{
const r=[];const check=(name,ok)=>{r.push({name,ok:!!ok});if(!ok)throw Error(name)};
check('four real Gotham weights load',[...document.fonts].length===4&&[...document.fonts].every(f=>f.status==='loaded'&&f.family.includes('HCo Gotham')));
check('body uses 16px and Gotham',getComputedStyle(document.body).fontSize==='16px'&&getComputedStyle(document.body).fontFamily.includes('HCo Gotham'));
check('wordmark retains requested 600',getComputedStyle(document.querySelector('.wordmark')).fontWeight==='600');
check('Midea mark meets 27.5px minimum',document.querySelector('.brand-lockup img').getBoundingClientRect().height>=27.5);
check('composer shadow removed',getComputedStyle(document.querySelector('.composer-frame')).boxShadow==='none');
check('icon stroke matches baseline',getComputedStyle(document.querySelector('.icon')).strokeWidth==='1.5px');
await handle('settings');check('density switch is removed',!document.querySelector('#pref-density'));
check('fixed input height is 44',document.querySelector('#pref-theme').getBoundingClientRect().height===44);
document.querySelector('#pref-theme').value='dark';await handle('save-settings');check('settings saves without density control',S.settings.theme==='dark'&&S.settings.density==='comfortable');
S.settings.theme='light';const p=S.projects[0];goProject(p.id);p.scopeConfirmed=true;
S.tasks=rulesFor(['web','retail'],'Hero').filter(x=>x.category!=='推荐').map((x,i)=>({...x,id:'visual-task-'+i,projectId:p.id,status:'draft_ready',assignee:'lin',reviewer:'reviewer',revision:1}));
for(const t of S.tasks){const a=newArtifact(t.kind,makeContent(t.kind),p.id,sourceRefs(BATCH_DEPS[t.kind]||[],p.id));t.artifactId=a.id;t.status='draft_ready'}
openCanvas(byKind('strategy').id,1);
const source=document.querySelector('.source-link');check('source remains readable 12px',getComputedStyle(source).fontSize==='12px');
check('source uses semantic link',getComputedStyle(source).color==='rgb(0, 108, 163)');
check('body content is 16px',getComputedStyle(document.querySelector('.section p')).fontSize==='16px');
check('detail panel padding fixed24',getComputedStyle(document.querySelector('.canvas-body')).paddingTop==='24px');
openCanvas(byKind('mh').id,1);showModal('edit-document',byKind('mh').id+'|1');
check('Message House editor has semantic groups',document.querySelectorAll('.editor-group-title').length===4);
check('short editor fields no longer force130px',getComputedStyle(document.querySelector('#doc-field-0')).minHeight==='80px');
closeModal();openModeDialog('collaborate');const neutral=getComputedStyle(document.querySelector('.mode-option.mode-yolo'));check('unselected autonomous option has no warning fill',neutral.backgroundColor==='rgba(0, 0, 0, 0)');closeModal();
S.settings.theme='dark';openModeDialog('collaborate');check('dark mode also distinguishes selection rather than warning',getComputedStyle(document.querySelector('.mode-option.mode-yolo')).backgroundColor==='rgba(0, 0, 0, 0)');closeModal();S.settings.theme='light';
S.view='library';S.canvas=null;render();const rows=new Map();for(const c of document.querySelectorAll('.library-grid>.result-card')){const y=Math.round(c.getBoundingClientRect().y);if(!rows.has(y))rows.set(y,[]);rows.get(y).push(c.querySelector('.result-foot').getBoundingClientRect().y)}check('artifact footers remain aligned',[...rows.values()].every(a=>Math.max(...a)-Math.min(...a)<2));
return r;
})()`;
const layout=`(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,containers:[...document.querySelectorAll('.library-grid,.result-card,.task-card,.composer-frame,.work-inspector,.dock-host,.utility-page')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+3).map(e=>({class:e.className,width:e.clientWidth,scroll:e.scrollWidth}))}))()`;
const args=['run','/Users/dingcheng/.gstack/repos/gstack/bin/gstack-render.ts',out+'/finalized.html','--timeout','90000','--eval',setup,'--out',out+'/v54-fonts.json','--screenshot',out+'/v54-home.jpg','--width','1440','--height','1080','--jpeg','--eval',test,'--out',out+'/v54-checks.json','--screenshot',out+'/v54-library.jpg','--width','1440','--height','960','--jpeg','--eval',layout,'--out',out+'/v54-library-layout.json',
'--eval',`(()=>{openCanvas(byKind('mh').id,1);return true})()`,'--screenshot',out+'/v54-mh.jpg','--width','1888','--height','1324','--jpeg','--eval',layout,'--out',out+'/v54-mh-layout.json',
'--eval',`(()=>{showModal('edit-document',byKind('mh').id+'|1');return true})()`,'--screenshot',out+'/v54-editor.jpg','--width','1440','--height','960','--jpeg','--eval',layout,'--out',out+'/v54-editor-layout.json',
'--eval',`(()=>{closeModal();showModal('settings');return true})()`,'--screenshot',out+'/v54-settings.jpg','--width','1440','--height','960','--jpeg',
'--eval',`(()=>{closeModal();S.settings.theme='dark';openCanvas(byKind('mh').id,1);openModeDialog('collaborate');return true})()`,'--screenshot',out+'/v54-mode-dark.jpg','--width','1440','--height','960','--jpeg',
'--eval',`(()=>{closeModal();S.view='tasks';S.canvas=null;render();return true})()`,'--screenshot',out+'/v54-tasks-dark.jpg','--width','1440','--height','960','--jpeg','--eval',layout,'--out',out+'/v54-dark-layout.json'];
const result=spawnSync('bun',args,{encoding:'utf8',timeout:110000});fs.writeFileSync(out+'/v54-verification.log',(result.stdout||'')+(result.stderr||''));console.log(result.stdout);console.error(result.stderr);if(result.status!==0||/PAGE_ERRORS=\[(?!\])/.test(result.stdout))process.exit(1);
for(const n of ['library','mh','editor','dark']){const l=JSON.parse(fs.readFileSync(out+'/v54-'+n+'-layout.json'));if(l.overflow||l.containers.length)throw Error('Layout overflow: '+JSON.stringify(l))}
console.log(JSON.stringify({checks:JSON.parse(fs.readFileSync(out+'/v54-checks.json')).length,passed:true,scope:'desktop-only'}));
