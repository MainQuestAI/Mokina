import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const out='/Users/dingcheng/Coding-Project/02-key-project/Lilith-原型/output/demo-spacemaster-v6';
const test=`(async()=>{
  const checks=[];const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name)};
  check('app opens at personal launcher',S.projectId===null&&conversationStart()&&document.querySelector('.crumb').innerText.includes('个人工作'));
  check('autonomous entry is immediately discoverable',!!document.querySelector('.home-content [data-action="start-yolo"]'));
  const p=S.projects[0];goProject(p.id);addMsg('user','保留已有项目对话');render();
  const oldId=S.threadId,oldMessages=JSON.stringify(thread().messages);document.querySelector('#composer').value='未发送的项目意见';
  await handle('new-chat');
  check('global new conversation never inherits active project',!S.projectId&&!thread().projectId&&conversationStart()&&!!document.querySelector('.home-content'));
  check('previous conversation and unsent draft are preserved',JSON.stringify(S.threads.find(t=>t.id===oldId).messages)===oldMessages&&DRAFTS[oldId]==='未发送的项目意见');
  check('global and project compose controls do not use plus',document.querySelector('.new-btn path').getAttribute('d')===ICONS.compose&&[...document.querySelectorAll('.project-row-actions [data-action="new-project-thread"] path')].every(x=>x.getAttribute('d')===ICONS.compose));
  const actions=document.querySelector('.project-row-actions');document.activeElement?.blur();
  check('project actions are hidden at rest',getComputedStyle(actions).opacity==='0');
  actions.querySelector('button').focus();
  check('project actions reveal on keyboard focus',getComputedStyle(actions).opacity==='1');
  await handle('new-project-thread',p.id);const tid=S.threadId;
  check('project compose uses same personal launcher with context',conversationStart()&&thread().projectId===p.id&&document.querySelector('.crumb').innerText.includes('个人工作')&&document.querySelector('.composer-project-context').innerText.includes(p.name));
  check('project launcher has one composer and autonomous action',document.querySelectorAll('#composer').length===1&&!!document.querySelector('.home-content [data-action="start-yolo"]'));
  document.querySelector('#composer').value='带上这段尚未发送的输入';S.workModes[tid]='plan';
  await handle('project-picker');await handle('choose-project',S.projects[1].id);
  check('changing context keeps draft and chosen mode',S.threadId===tid&&thread().projectId===S.projects[1].id&&document.querySelector('#composer').value==='带上这段尚未发送的输入'&&workMode()==='plan');
  await handle('choose-project','none');
  check('context can be removed without losing draft',!S.projectId&&!thread().projectId&&document.querySelector('#composer').value==='带上这段尚未发送的输入');
  check('changing empty context does not move existing project thread',S.threads.find(t=>t.id===oldId).projectId===p.id&&project(p.id).threadId===oldId);
  await handle('project-menu',p.id);
  check('project menu offers three real destinations',document.querySelectorAll('.project-row-menu [role="menuitem"]').length===3);
  const item=document.querySelector('.project-row-menu [role="menuitem"]');item.focus();item.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  check('menu supports keyboard navigation',document.activeElement.dataset.action==='context');
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  check('Escape closes menu and returns focus to trigger',!document.querySelector('.project-row-menu')&&document.activeElement.dataset.action==='project-menu');
  await handle('project-menu',p.id);await handle('project-files',p.id);
  check('project files action opens selected project files',S.projectId===p.id&&S.view==='files'&&!projectMenuId&&!document.querySelector('.project-row-menu'));
  await handle('thread',oldId);addMsg('assistant','这是保留原图形的 Lilith 头像。');addMsg('assistant','另一条回复使用独立的 SVG 滤镜标识。');render();
  const logos=[...document.querySelectorAll('.lilith-symbol')];
  check('only assistant messages show Lilith graphic logo',logos.length===2&&logos.every(x=>x.closest('.msg-assistant'))&&!document.querySelector('.sidebar .lilith-symbol'));
  const ids=logos.map(x=>x.querySelector('filter').id);
  check('logo geometry is original and filter IDs are unique',logos.every(x=>x.querySelector('circle[r="96"]'))&&new Set(ids).size===2);
  check('avatar has neutral background and 24px symbol',logos.every(x=>x.getBoundingClientRect().width===24&&getComputedStyle(x.parentElement).backgroundColor==='rgba(0, 0, 0, 0)'));
  const savedThreads=JSON.stringify(S.threads),savedDrafts=JSON.stringify(DRAFTS);initializeConversationEntry();render();persist();
  check('default launcher restoration preserves saved conversations and drafts',!S.projectId&&conversationStart()&&JSON.stringify(S.threads)===savedThreads&&JSON.stringify(DRAFTS)===savedDrafts);
  return checks;
})()`;
const args=['run','/Users/dingcheng/.gstack/repos/gstack/bin/gstack-render.ts',out+'/finalized.html','--timeout','90000','--eval',test,'--out',out+'/conversation-entry-checks.json',
  '--screenshot',out+'/conversation-entry-personal.jpg','--width','1531','--height','1324','--jpeg',
  '--eval',`(async()=>{await handle('new-project-thread',S.projects[0].id);return true})()`,
  '--screenshot',out+'/conversation-entry-project.jpg','--width','1531','--height','1324','--jpeg',
  '--eval',`(async()=>{await handle('project-menu',S.projects[0].id);return true})()`,
  '--screenshot',out+'/conversation-entry-menu.jpg','--width','1531','--height','1324','--jpeg',
  '--eval',`(async()=>{await handle('thread',S.projects[0].threadId);return true})()`,
  '--screenshot',out+'/conversation-logo-light.jpg','--width','1531','--height','1324','--jpeg',
  '--eval',`(()=>{S.settings.theme='dark';render();return true})()`,
  '--screenshot',out+'/conversation-logo-dark.jpg','--width','1531','--height','1324','--jpeg'];
const result=spawnSync('bun',args,{encoding:'utf8',timeout:110000});
fs.writeFileSync(out+'/conversation-entry-verification.log',(result.stdout||'')+(result.stderr||''));
console.log(result.stdout);console.error(result.stderr);
if(result.status!==0||/PAGE_ERRORS=\[(?!\])/.test(result.stdout))process.exit(1);
console.log(JSON.stringify({passed:true,checks:JSON.parse(fs.readFileSync(out+'/conversation-entry-checks.json')).length}));
