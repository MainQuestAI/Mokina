import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from '/Users/dingcheng/.gstack/repos/gstack/node_modules/playwright/index.mjs';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'output/demo-spacemaster-v6/qa-message-routing');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1531,height:1324}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(pathToFileURL(path.join(root,'Lilith SpaceMaster Demo V6.html')).href);
 const result=await page.evaluate(async()=>{
  window.__LILITH_QA_TIME_SCALE=100;
  const checks=[],observations={};const check=(name,ok)=>checks.push({name,ok:!!ok});
  function setup(){S=makeState();MODAL=null;S.runId=null;Object.keys(DRAFTS).forEach(k=>delete DRAFTS[k]);enterDemoProject();confirmScope(S.projectId,DEMO_KINDS);S.workModes[S.threadId]='collaborate';}
  setup();const a=newArtifact('strategy',makeContent('strategy'));openCanvas(a.id,1);bindArtifactDiscussion('audience',false);const fixed=JSON.stringify(revision(a,1));S.auto={active:true,index:0};window.__DEMO_INPUT_TRACE=[];
  const instruction='优先面向厨房焕新和旧冰箱替换用户，保留工作假设，不泛指所有家庭。';
  await sendPrompt(instruction);S.auto.active=false;
  observations.scripted={messages:thread().messages.filter(m=>m.role==='user'&&m.text===instruction).length,plans:S.plans.length,versions:a.versions.length,runs:S.runs.map(r=>r.kind)};
  check('scripted revision sends exactly one user message',observations.scripted.messages===1);
  check('scripted revision does not reopen or add to unified scope plan',S.plans.length===1&&MODAL?.kind!=='plan');
  check('scripted revision creates the intended candidate',a.versions.length===2&&revision(a,2).data.sections.find(s=>s.id==='audience').body===instruction);
  check('original version remains unchanged',JSON.stringify(revision(a,1))===fixed);
  check('typing stays visible without selected-card chip',window.__DEMO_INPUT_TRACE.length===1&&window.__DEMO_INPUT_TRACE[0].composer===instruction&&!window.__DEMO_INPUT_TRACE[0].hasSelection);
  await sendPrompt('为什么选择这类用户？先不要修改。');check('manual question creates no revision or extra plan',a.versions.length===2&&S.plans.length===1);
  setup();await sendPrompt('请安排这次内容的工作计划。');
  check('planning owns its user message exactly once',thread().messages.filter(m=>m.role==='user'&&m.text==='请安排这次内容的工作计划。').length===1&&S.plans.length===1);
  closeModal();await sendPrompt('请安排这次内容的工作计划。');
  check('intentional repeat is not globally deduplicated',thread().messages.filter(m=>m.role==='user'&&m.text==='请安排这次内容的工作计划。').length===2);
  setup();const b=newArtifact('strategy',makeContent('strategy'));openCanvas(b.id,1);bindArtifactDiscussion('audience',false);const oldContext=revision(b,1).data.sections.find(s=>s.id==='context').body;
  window.__LILITH_QA_TIME_SCALE=10;const pending=modifySelected('将厨房焕新用户作为首要目标。');S.contextSelection.section='context';await pending;
  check('in-flight modification retains captured section',revision(b,2).data.sections.find(s=>s.id==='audience').body==='将厨房焕新用户作为首要目标。'&&revision(b,2).data.sections.find(s=>s.id==='context').body===oldContext);
  check('script no longer inserts the unsolicited workflow question',!AUTO_STEPS.some(s=>s.do.toString().includes('为什么先整理六视角，再做厨房场景')));
  return {checks,observations};
 });
 result.errors=errors;const suffix=process.argv.includes('--before')?'before':'after';fs.writeFileSync(path.join(out,suffix+'.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));if(errors.length||result.checks.some(c=>!c.ok))process.exitCode=1;
}finally{await browser.close();}
