import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const out='/Users/dingcheng/Coding-Project/02-key-project/Lilith-原型/output/demo-spacemaster-v6';
const setup=`(()=>{
  S=makeState();MODAL=null;S.inspectorOpen=false;
  const p=S.projects[0];goProject(p.id);p.scopeConfirmed=false;p.channels=['web','retail'];addMsg('user','确认本次交付范围');
  showModal('scope',p.id);return true;
})()`;
const checks=`(()=>{
  const checks=[];
  const check=(name,ok)=>checks.push({name,ok:!!ok});
  const boxes=[...document.querySelectorAll('[data-scope-channel]')];
  const metrics=boxes.map(box=>{
    const b=box.getBoundingClientRect(),label=box.closest('label'),t=label.querySelector('span').getBoundingClientRect();
    return {width:b.width,height:b.height,aligned:Math.abs(b.y+b.height/2-t.y-t.height/2)<2,textToRight:t.x>=b.right,display:getComputedStyle(label).display,padding:getComputedStyle(box).padding};
  });
  check('channel controls use 20px squares',metrics.length===3&&metrics.every(m=>m.width===20&&m.height===20));
  check('channel labels are inline and center aligned',metrics.every(m=>m.display==='flex'&&m.aligned&&m.textToRight));
  check('checkboxes do not inherit text-input padding',metrics.every(m=>m.padding==='0px'));
  check('select retains 44px height',document.querySelector('#scope-tier').getBoundingClientRect().height===44);
  document.querySelector('[data-scope-channel="web"]').closest('label').click();
  check('label click updates channel and dependent deliverables',!scopeDraft.channels.includes('web')&&!scopeDraft.selected.includes('web'));
  document.querySelector('[data-scope-channel="web"]').closest('label').click();
  check('channel can be selected again',scopeDraft.channels.includes('web'));
  const before=[...scopeDraft.channels];project().scopeConfirmed=true;renderModal();
  document.querySelector('[data-scope-channel="web"]').closest('label').click();
  check('confirmed channels remain locked',document.querySelector('[data-scope-channel="web"]').disabled&&JSON.stringify(scopeDraft.channels)===JSON.stringify(before));
  project().scopeConfirmed=false;renderModal();
  const node=document.createElement('div');node.innerHTML=runCard({id:'scope-control-test',module:MODULES[0].id,name:'编写本地化 Message House',status:'running',sources:[],events:[{id:1,status:'running',label:'组织信息层与表达层级'}]});
  document.querySelector('.conversation').appendChild(node);
  check('running status is 10px',getComputedStyle(node.querySelector('.run-line>.tiny')).fontSize==='10px');
  check('other caption sizes remain 12px',getComputedStyle(node.querySelector('.run-head>.tiny')).fontSize==='12px');
  check('no desktop horizontal overflow',document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.dock-host').scrollWidth<=document.querySelector('.dock-host').clientWidth);
  node.remove();
  return {width:innerWidth,theme:S.settings.theme,metrics,checks};
})()`;
const args=['run','/Users/dingcheng/.gstack/repos/gstack/bin/gstack-render.ts',out+'/finalized.html','--timeout','60000','--eval',setup,
  '--screenshot',out+'/scope-controls-light.jpg','--width','1531','--height','1324','--jpeg','--eval',checks,'--out',out+'/scope-controls-light.json',
  '--eval',`(()=>{S.settings.theme='dark';render();return true})()`,
  '--screenshot',out+'/scope-controls-dark.jpg','--width','1888','--height','1324','--jpeg','--eval',checks,'--out',out+'/scope-controls-dark.json'];
const result=spawnSync('bun',args,{encoding:'utf8',timeout:75000});
fs.writeFileSync(out+'/scope-controls-verification.log',(result.stdout||'')+(result.stderr||''));
if(result.status!==0||/PAGE_ERRORS=\[(?!\])/.test(result.stdout)){console.error(result.stdout,result.stderr);process.exit(1)}
const results=['light','dark'].map(theme=>JSON.parse(fs.readFileSync(out+'/scope-controls-'+theme+'.json','utf8')));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.checks.some(c=>!c.ok)))process.exit(1);
