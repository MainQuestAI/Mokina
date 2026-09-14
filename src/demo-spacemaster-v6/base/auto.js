const AUTO_STEPS=[
{name:'先做一次无项目查询',description:'研究结果独立保存，不强迫先创建项目。',do:()=>handle('prompt','research')},
{name:'建立上下文空间与交付范围',description:'创建后回报；规则匹配的交付范围由人确认。',do:async()=>{await handle('prompt','create');const p=S.projects.find(p=>p.model===PRODUCT.model&&p.channels.includes('web')&&p.channels.includes('retail')),r=S.artifacts.find(x=>x.kind==='research');goProject(p.id);if(r)await handle('link-project-confirm',r.id+'|'+p.id);await autoPresent('scope',p.id,2300);confirmScope(p.id);}},
{name:'从产品事实形成策略',description:'调用产品、市场与品牌知识，保留工作假设。',do:async()=>{await autoRequest('请根据产品资料和墨西哥市场背景，形成 SpaceMaster 产品策略。',()=>generate('strategy'));openCanvas(byKind('strategy').id);}},
{name:'围绕具体内容询问',description:'只读解释不产生新版本。',do:async()=>{await sendPrompt('为什么优先选择厨房升级人群？');}},
{name:'修改、比较并确认策略',description:'先形成新候选，采用前不覆盖已有内容。',do:async()=>{await sendPrompt('把人群修改为厨房升级与旧冰箱替换，不泛指大家庭。');let a=byKind('strategy');openCanvas(a.id);await autoPresent('compare',a.id+'|'+a.pending,2100);adopt(a.id,a.pending);}},
{name:'建立 FABE 价值体系',description:'功能、优势、利益与证据相互关联。',do:async()=>{await autoRequest('继续梳理 FABE 价值体系，把功能、优势、利益与依据对应起来。',()=>generate('fabe'));const a=byKind('fabe');openCanvas(a.id);await autoWait(1800);adopt(a.id,1);}},
{name:'编写墨西哥 Message House',description:'使用已有草稿，组织完整信息屋与本地表达。',do:async()=>{await autoRequest('基于这些价值主题，编写面向墨西哥市场的 Message House。',()=>generate('mh'));const a=byKind('mh');openCanvas(a.id);await autoWait(2000);adopt(a.id,1);}},
{name:'准备产品与功能素材',description:'排除错误型号与授权未确认项，保存可用集合。',do:async()=>{await autoRequest('帮我查找适合官网和门店使用的产品素材，核对型号与使用范围。',()=>generate('assets'));const a=byKind('assets');openCanvas(a.id);await autoWait(2000);adopt(a.id,1);}},
{name:'形成官网内容草稿',description:'同一价值体系，为官网组织更充分的内容。',do:async()=>{await autoRequest('使用现有文案与素材，制作墨西哥官网产品页内容。',()=>generate('web'));const a=byKind('web');openCanvas(a.id);await autoWait(1700);adopt(a.id,1);}},
{name:'制作门店 POP 候选',description:'固定引用文案与素材，生成可查看和修改的物料。',do:async()=>{await autoRequest('再制作一份门店 POP，突出核心卖点，保留产品型号和适用说明。',()=>generate('pop'));const a=byKind('pop');openCanvas(a.id);await autoWait(2200);adopt(a.id,1);}},
{name:'区域同事接受接手',description:'接受前原负责人继续负责；接受后才能变更责任。',do:async()=>{const t=taskFor('pop');requestTransfer(t.id);S.view='tasks';S.canvas=null;render();await autoWait(1200);await handle('set-role','ana');acceptTransfer(S.transfers.at(-1).id);await autoWait(1000);openCanvas(byKind('pop').id);}},
{name:'检查并提交固定版本',description:'AI 检查与人的正式批准是不同动作。',do:async()=>{let a=byKind('pop');await checkArtifact(a.id);await autoPresent('check-detail',a.id+'|1',1700);submitArtifact(a.id,1);await handle('set-role','reviewer');}},
{name:'审核人退回具体修改',description:'审核只针对物料快照，不审批整段对话。',do:async()=>{const s=S.submissions.at(-1);await autoPresent('review',s.id,2500);reviewDecision(s.id,'returned','请缩短门店标题，提升远距离识别；保留型号和适用说明。');await handle('set-role','ana');}},
{name:'修改并重新检查',description:'旧提交保留，新候选需要重新采用和检查。',do:async()=>{const a=byKind('pop');openCanvas(a.id);await sendPrompt('把 POP 标题缩短，保留产品型号和适用说明。');await autoPresent('compare',a.id+'|'+a.pending,2000);adopt(a.id,a.pending);await checkArtifact(a.id);}},
{name:'批准准确的成果版本',description:'批准新提交后任务完成，历史退回记录仍在。',do:async()=>{const a=byKind('pop');submitArtifact(a.id,a.active);await handle('set-role','reviewer');const s=S.submissions.at(-1);await autoPresent('review',s.id,2200);reviewDecision(s.id,'approved','批准 v'+s.revision+' 的门店 POP 演示内容。');}},
{name:'独立处理内容库接收',description:'模拟附件失败，只重试失败项，不撤销原批准。',do:async()=>{const d=S.deliveries.at(-1);while(d.status==='sending')await new Promise(r=>setTimeout(r,60));await autoPresent('deliveries','',2000);await ingest(d.id,true);await autoPresent('deliveries','',1700);}},
{name:'交付闭环，成果继续可用',description:'汇总已确认草稿、批准物料与接收记录，实际导出。',do:async()=>{await handle('set-role','lin');const ts=S.tasks.filter(t=>t.projectId===S.projectId);addMsg('assistant','本次 '+ts.length+' 项交付已完成：策略、FABE、信息屋、素材集合和官网内容达到草稿目标，门店 POP 已批准并完成模拟内容库接收。\n\n研究结果、依据、草稿版本和审核记录都保留在项目中。你可以下载交付包，或者继续对任意成果开展下一轮工作。',{action:'deliverables'});S.canvas=null;S.view='tasks';render();}}
];
async function autoWait(ms){let remain=ms;while(remain>0){if(!S.auto?.active)throw new Error('AUTO_STOPPED');if(S.paused){await new Promise(r=>setTimeout(r,50));continue}let scale=S.settings.speed*(window.__LILITH_QA_TIME_SCALE||1),step=Math.min(45,remain/scale);await new Promise(r=>setTimeout(r,Math.max(1,step)));remain-=step*scale;}}
async function autoPresent(kind,arg,ms){if(!S.auto?.active)throw new Error('AUTO_STOPPED');window.__AUTO_PRESENTATION_MODAL=true;showModal(kind,arg);window.__AUTO_PRESENTATION_MODAL=false;await autoWait(ms);closeModal();}
async function startAuto(reset=false){
  if(S.runId)return toast('请先结束当前执行。');
  const settings=clone(S.settings);resetState();S.settings=settings;
  if(window.MARKETING_DESKTOP){seedDemo(S,true);MD.normalize(S);window.V62Inputs.ensure(S);}
  S.auto={active:true,index:0,finishedSteps:0,started:now()};render();persist();
  try{
    for(let i=0;i<AUTO_STEPS.length;i++){
      if(!S.auto?.active)break;
      S.auto.index=i;render();await autoWait(500);await AUTO_STEPS[i].do();
      S.auto.finishedSteps=i+1;await autoWait(i===AUTO_STEPS.length-1?700:1800);
    }
    if(S.auto){S.auto.active=false;S.auto.completed=S.auto.finishedSteps===AUTO_STEPS.length;S.auto.businessComplete=S.tasks.length>0&&S.tasks.every(t=>t.status==='done');S.auto.ended=now();}
    S.paused=false;closeModal();render();persist();
    if(S.auto?.completed)toast('完整流程已展示。草稿、正式使用与外部交付状态请分别查看。');
  }catch(e){
    if(e.message!=='AUTO_STOPPED'){console.error(e);toast('自动流程停在当前状态：'+e.message,true);}
    if(S.auto)S.auto.active=false;S.paused=false;render();persist();
  }
}
