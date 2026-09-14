import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const test=`(async()=>{
S=makeState();MODAL=null;render();const checks=[];const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name)};
const old=S.projects.find(demoProject);goProject(old.id);const before=JSON.stringify(old),count=S.projects.length,tasks=S.tasks.length,batches=S.batches.length;
showModal('project-picker');await handle('prompt','create');
check('creation opens focused form, not a prompt',!!document.querySelector('#project-create-form')&&MODAL.kind==='create-project');
await handle('project-create-save');check('required fields block empty creation',S.projects.length===count&&!!document.querySelector('[aria-invalid="true"]'));
for(const [key,value] of Object.entries({name:'洗碗机英国上市',productName:'嵌入式洗碗机',category:'洗碗机',market:'英国',language:'英语',goal:'准备官网上市资料'})){const el=document.querySelector('#project-create-'+key);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
const channel=document.querySelector('[name="channels"][value="web"]');channel.checked=true;channel.dispatchEvent(new Event('input',{bubbles:true}));
closeModal();await handle('prompt','create');check('cancel retains entered draft',document.querySelector('#project-create-name').value==='洗碗机英国上市');
await handle('project-create-save');await handle('project-create-save');
check('creates exactly one independent project',S.projects.length===count+1&&project().market==='英国'&&project().productName==='嵌入式洗碗机');
check('original project unchanged',JSON.stringify(old)===before);
check('does not start or create tasks and batches',S.tasks.length===tasks&&S.batches.length===batches);
check('new project has empty own conversation',thread().projectId===project().id&&thread().messages.length===0);
check('requires product inputs before execution',project().inputsReady===false&&validateUnifiedPlan(ensureUnifiedPlan(project().id)).some(x=>x.includes('产品资料')));
await handle('prompt','create');check('next project starts blank',!document.querySelector('#project-create-name').value);
return checks;
})()`;
const result=spawnSync('bun',['run','/Users/dingcheng/.gstack/repos/gstack/bin/gstack-render.ts',path.join(root,'Lilith SpaceMaster Demo V6.html'),'--timeout','45000','--eval',test,'--out',path.join(root,'output/demo-spacemaster-v6/project-creation-checks.json')],{encoding:'utf8',timeout:60000});
console.log(result.stdout,result.stderr);if(result.status||/PAGE_ERRORS=\[(?!\])/.test(result.stdout))process.exit(1);
