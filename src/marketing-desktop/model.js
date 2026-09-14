/* Marketing extensions use V6 threads, artifacts, revisions and local persistence. */
const MD = {schema:2, timers:new Map(), kindNames:{'marketing-memo':'品牌策略备忘录','social-calendar':'社媒内容与排期','operations-analysis':'运营分析','marketing-document':'工作文档'}};
for(const [kind,name] of Object.entries(MD.kindNames))KIND[kind]={name,domain:'other',icon:'file',caption:'营销工作成果'};
MD.work=(id=S.threadId)=>S.threads.find(t=>t.id===id);
MD.meta=(t=MD.work())=>t?(t.marketing??={scene:'general',goal:'',goalRevision:1,selected:[],excluded:[],status:'open'}):null;
MD.generic=(t=MD.work())=>{const p=t&&project(t.projectId);return !!t&&!(p&&(p.marketingProfessional||p.productName||p.model||p.demoScenario));};
MD.isResult=a=>!!a&&(!!MD.kindNames[a.kind]||a.marketing||!MD.legacyKinds.has(a.kind));
MD.legacyKinds=new Set(Object.keys(KIND).filter(k=>!MD.kindNames[k]));
MD.normalize=function(state){
  state.md??={};state.md.schema=MD.schema;state.md.snapshots??=[];state.md.runs??=[];state.md.decisions??=[];state.md.imports??=[];state.md.scope??='work';state.md.editDrafts??={};
  for(const old of state.works||[]){let t=state.threads.find(x=>x.id===old.id);if(!t){t={id:old.id,title:old.name,projectId:old.projectId||null,messages:old.messages||[]};state.threads.push(t);}t.marketing??={scene:old.scene||'general',goal:old.goal||'',goalRevision:1,selected:[],excluded:[],status:'open',legacyContext:clone(old.context||{})};}
  for(const t of state.threads){t.messages??=[];t.title??='新的工作';}
  for(const a of state.artifacts){
    KIND[a.kind]??={name:a.kind,domain:'other',icon:'file',caption:'历史成果'};
    a.domain??=KIND[a.kind].domain;a.versions??=[];a.active??=a.versions[0]?.num||1;a.accepted??=0;
    for(const v of a.versions){v.refs??=[];v.data??={};}
    if(!a.threadId){const owners=state.threads.filter(t=>t.messages.some(m=>m.artifactIds?.includes(a.id)||m.artifactRefs?.some(r=>r.id===a.id)));const explicit=a.workId&&state.threads.find(t=>t.id===a.workId);a.threadId=explicit?.id||(owners.length===1?owners[0].id:null);a.historical=!a.threadId;}
  }
  state.openCanvases=(state.openCanvases||[]).filter(c=>state.artifacts.some(a=>a.id===c.id));
  for(const p of state.projects)if(p.demoScenario||p.model||p.productName)p.marketingProfessional=true;
  return state;
};
MD.boot=function(){
  MD.normalize(S);for(const run of S.md.runs)if(['running','queued'].includes(run.status))run.status='interrupted';
  if(!MD.work()){S.threadId=S.threads[0]?.id;if(!MD.work())newChat();}
  if(!['chat','artifact','library','files','tasks','activity','workflow'].includes(S.view))S.view='chat';
  if(S.canvas&&!artifact(S.canvas.id))S.canvas=null;
  Object.assign(DRAFTS,S.composerDrafts||{});if(S.dockState?.kind?.startsWith('md-'))MODAL=clone(S.dockState);
};
const mdMakeState=makeState;
makeState=()=>MD.normalize(mdMakeState());
MD.results=(tid=S.threadId)=>S.artifacts.filter(a=>a.threadId===tid);
MD.newPlan=function(t=MD.work()){
  const m=MD.meta(t),p={id:uid('plan'),threadId:t.id,projectId:t.projectId||null,marketing:true,revision:1,status:'draft',goal:m.goal,exclusions:m.constraints||'不自动发布；不创建未选择的后续任务',items:[{id:uid('item'),title:MD.scenes[m.scene]?.output||'工作文档',kind:MD.scenes[m.scene]?.kind||'marketing-document',input:'本次依据中选用的资料',output:'可阅读、编辑和比较的草稿',status:'pending'}],history:[],created:now()};
  S.plans.push(p);persist();return p;
};
MD.plan=(tid=S.threadId)=>S.plans.findLast(p=>p.marketing&&p.threadId===tid);
MD.savePlan=function(p,changes){
  p.history.push({revision:p.revision,goal:p.goal,exclusions:p.exclusions,items:clone(p.items),at:now()});
  Object.assign(p,changes);p.revision++;p.status='draft';const m=MD.meta(MD.work(p.threadId));if(m.goal!==p.goal){m.goal=p.goal;m.goalRevision++;}
  for(const item of p.items){const check=MD.scopeCheck(item,p,m);if(!check.errors.length)item.config=check.config;}
  p.validation=MD.planIssues(p);persist();return p;
};
MD.resolve=function(ref){
  if(ref.type==='artifact'){
    const a=artifact(ref.id),v=a&&revision(a,Number(ref.revision));
    if(!a||!v)throw Error('引用的成果版本不存在：'+(a?.title||ref.id)+' v'+ref.revision+'，请重新选择。');
    if(a.revoked||a.expired||a.permission==='denied')throw Error('来源已撤回或不可用：'+a.title);
    if(ref.selection){
      const sections=(v.data.sections||[]).filter(s=>ref.selection.includes(s.id));
      if(!ref.selection.length||sections.length!==new Set(ref.selection).size)throw Error(a.title+' v'+v.num+' 缺少所选段落，请重新选择结论。');
      const text=sections.map(s=>s.title+'\n'+s.body).join('\n\n');
      return {...clone(ref),title:a.title,text,summary:text,data:{sections:clone(sections)}};
    }
    return {...clone(ref),title:a.title,text:documentText(a,v),data:clone(v.data)};
  }
  const u=S.uploads.find(u=>u.id===ref.id);if(!u)throw Error('所选资料已不存在，请重新选择。');if(u.revoked||u.expired||u.permission==='denied'||u.access==='denied')throw Error('来源已撤回或不可用：'+u.name);return {...clone(ref),title:u.name,text:u.text??null,fixtureKey:u.fixtureKey||null,fixtureVariant:u.fixtureVariant||null,mime:u.mime,read:typeof u.text==='string'};
};
MD.snapshot=function(tid,reason,save=true){
  const t=MD.work(tid),m=MD.meta(t),s={id:uid('context'),threadId:tid,goal:m.goal,goalRevision:m.goalRevision,reason,created:now(),selected:m.selected.filter(r=>!m.excluded.includes(r.id)).map(MD.resolve),excluded:clone(m.excluded)};
  const plan=MD.plan(tid);if(plan)s.plan={id:plan.id,revision:plan.revision,goal:plan.goal,exclusions:plan.exclusions,items:clone(plan.items)};
  if(save){S.md.snapshots.push(s);persist();}return s;
};
MD.addResult=function(tid,data,kind,snapshot,source='scenario-demo',actor=S.actor){
  const t=MD.work(tid);const a=newArtifact(kind,data,t.projectId||null,[],tid);a.marketing=true;
  Object.assign(a.versions[0],{author:actor,source,contextSnapshotId:snapshot.id,refs:snapshot.selected.map(r=>({id:r.id,title:r.title,kind:r.type==='artifact'?(artifact(r.id)?.kind||'file'):'file',revision:r.revision||1,type:r.type}))});
  addMsg('assistant',source==='local-computation'?'计算结果已保存，建议为情景演示。':'草稿已保存。情景演示结果不代表真实模型生成。',{artifactIds:[a.id],artifactRefs:[{id:a.id,revision:1}]},tid);persist();return a;
};
MD.revise=function(id,num,data,reason,section=''){
  const a=artifact(id),base=revision(a,Number(num));if(!a||!base)throw Error('基础版本不存在');if(!canWrite(a))return;
  const newer=a.versions.some(v=>v.num>base.num),v=addRevision(a,data,reason,base.refs);
  Object.assign(v,{source:'user-edit',basisVersion:base.num,sectionId:section,contextSnapshotId:base.contextSnapshotId||null,conflict:newer});
  addMsg('assistant',`已保存 v${v.num} 候选，基于 v${base.num}。${newer?'已有更新版本，请比较后决定。':'原版和采用决定保持不变。'}`,{artifactIds:[a.id],artifactRefs:[{id:a.id,revision:v.num}]},a.threadId);
  persist();return v;
};
MD.execute=function(planId,all=false,options={}){
  const p=S.plans.find(p=>p.id===planId);if(!p||!p.marketing)throw Error('计划不存在');
  if(!p.goal.trim()||!p.items.length)throw Error('请填写目标并保留至少一个交付项。');
  if(S.md.runs.some(r=>r.status==='running'))throw Error('请先完成或取消正在进行的演示操作。');
  const items=options.items|| (all?p.items.filter(i=>i.status!=='done'):[p.items.find(i=>i.id===p.currentItem)||p.items[0]]);
  if(!items.length||(!options.repeat&&items.some(i=>i.status==='done')))throw Error('所选交付已完成。请明确选择“另做一份”，原成果会保留。');
  const snapshot=MD.snapshot(p.threadId,'开始制作',false),meta=clone(MD.meta(MD.work(p.threadId)));
  // Prepare once. Validation must not persist snapshots or allocate a second set of post IDs.
  const prepared=items.map(item=>MD.produce(item,snapshot,meta));
  const run={id:uid('local-run'),threadId:p.threadId,projectId:p.projectId,planId:p.id,planRevision:p.revision,items:clone(items),snapshotId:snapshot.id,meta:clone(MD.meta(MD.work(p.threadId))),status:'running',created:now(),completedIds:[],actor:S.actor};
  run.prepared=prepared;S.md.snapshots.push(snapshot);
  p.status='running';S.md.runs.push(run);persist();render();
  MD.timers.set(run.id,setTimeout(()=>MD.finish(run.id),1800));return run;
};
MD.finish=function(id){
  const run=S.md.runs.find(r=>r.id===id);if(!run||run.status!=='running')return;
  try{
    const snapshot=S.md.snapshots.find(s=>s.id===run.snapshotId),m=run.meta;
    for(const [index,item] of run.items.entries()){if(run.completedIds.includes(item.id))continue;const data=run.prepared?.[index];if(!data)throw Error('旧操作未保存准备结果，请重新执行。');const a=MD.addResult(run.threadId,data,item.kind,snapshot,item.kind==='operations-analysis'?'local-computation':item.kind==='marketing-document'?'user-document':'scenario-demo',run.actor);run.completedIds.push(item.id);const p=S.plans.find(p=>p.id===run.planId),original=p?.items.find(i=>i.id===item.id);if(p?.revision===run.planRevision&&original){original.status='done';original.artifactId=a.id;} }
    run.status='done';const p=S.plans.find(p=>p.id===run.planId);if(p?.revision===run.planRevision)p.status='completed';
  }catch(e){run.status='failed';run.error=e.message;addMsg('assistant','未完成：'+e.message,{},run.threadId);}
  run.ended=now();MD.timers.delete(id);persist();render();
};
MD.cancel=function(id){const r=S.md.runs.find(r=>r.id===id);if(r?.status!=='running')return;r.status='cancelled';r.ended=now();clearTimeout(MD.timers.get(id));MD.timers.delete(id);const p=S.plans.find(p=>p.id===r.planId);if(p)p.status='draft';persist();render();};
MD.parseCSV=function(text){
  text=String(text).replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false,line=1;
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else{cell+=c;if(c==='\n')line++;}continue;}
    if(c==='"'){if(cell||closed)throw Error(`CSV 第 ${line} 行：引号位置错误`);quoted=true;continue;}
    if(closed&&!['\r','\n',','].includes(c))throw Error(`CSV 第 ${line} 行：闭合引号后存在多余字符`);
    if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(row.some(x=>x!==''))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;line++;}}else cell+=c;
  }
  if(quoted)throw Error('CSV 格式错误：引号未闭合');if(cell||row.length||closed){row.push(cell);if(row.some(x=>x!==''))rows.push(row);}
  if(rows.length<2)throw Error('CSV 至少需要表头和一行数据');const headers=rows.shift().map(x=>x.trim());
  if(new Set(headers).size!==headers.length)throw Error('CSV 表头存在重复列');
  for(const k of ['period','content_type','impressions','interactions'])if(!headers.includes(k))throw Error('CSV 缺少必需列：'+k);
  const data=rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`CSV 第 ${i+2} 行：应有 ${headers.length} 列，实际 ${r.length} 列`);const o=Object.fromEntries(headers.map((k,j)=>[k,r[j].trim()]));for(const k of ['period','content_type'])if(!o[k])throw Error(`CSV 第 ${i+2} 行：${k} 不能为空`);for(const k of ['impressions','interactions']){if(!/^\d+(?:\.\d+)?$/.test(o[k])||!Number.isFinite(Number(o[k])))throw Error(`CSV 第 ${i+2} 行：${k} 必须是非负数值`);o[k]=Number(o[k]);}return o;});
  return {rows:data,periods:[...new Set(data.map(x=>x.period))],groups:[...new Set(data.map(x=>x.content_type))]};
};
MD.calculate=function(text,previous='previous',current='current'){
  const parsed=MD.parseCSV(text);if(previous===current||!parsed.periods.includes(previous)||!parsed.periods.includes(current))throw Error('请明确选择不同的前期与本期，不能按文字排序推断。');
  const aggregate=(period,group)=>parsed.rows.filter(r=>r.period===period&&(!group||r.content_type===group)).reduce((s,r)=>({impressions:s.impressions+r.impressions,interactions:s.interactions+r.interactions}),{impressions:0,interactions:0});
  const totals=[previous,current].map(period=>{const x=aggregate(period);if(!x.impressions)throw Error(period+'：曝光合计为零，无法计算互动率');return {period,...x,rate:x.interactions/x.impressions};});
  const groups=parsed.groups.map(group=>({group,values:[previous,current].map((period,i)=>{const x=aggregate(period,group);return {...x,rate:x.impressions?x.interactions/x.impressions:null,share:x.impressions/totals[i].impressions};})}));
  const complete=groups.every(g=>g.values.every(v=>v.rate!==null));const weighted=complete?groups.reduce((sum,g)=>sum+g.values[0].rate*g.values[1].share,0):null;
  return {totals,groups,delta:totals[1].rate-totals[0].rate,weighted,composition:complete?weighted-totals[0].rate:null,within:complete?totals[1].rate-weighted:null,warning:complete?'':'部分分组曝光为零或缺失：分组率及结构分解不可计算，合计仍可核对。'};
};
MD.csv=rows=>'\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
MD.importBackup=function(raw){
  if(!raw||raw.schema!==APP_VERSION||!['threads','projects','artifacts','tasks','runs'].every(k=>Array.isArray(raw[k])))throw Error('备份格式不匹配：需要完整 V6 或 Marketing Desktop 备份');
  const incoming=clone(raw);for(const a of incoming.artifacts){if(!a.id||!Array.isArray(a.versions)||!a.versions.length||a.versions.some(v=>!v.num||!v.data))throw Error('备份成果版本不完整');}
  MD.normalize(incoming);
  const merge=(a,b)=>{for(const item of b||[]){const existing=a.find(x=>typeof item==='object'&&item!==null&&item.id?x?.id===item.id:JSON.stringify(x)===JSON.stringify(item));if(!existing)a.push(clone(item));else if(Array.isArray(item.versions)){for(const v of item.versions)if(!existing.versions.some(x=>x.num===v.num))existing.versions.push(clone(v));}}};
  for(const [key,val] of Object.entries(incoming))if(Array.isArray(val)){S[key]??=[];merge(S[key],val);}
  for(const key of ['snapshots','runs','decisions'])merge(S.md[key],incoming.md[key]);
  S.workflowBranches??={jobs:[]};merge(S.workflowBranches.jobs??=[],incoming.workflowBranches?.jobs);
  for(const key of ['composerDrafts','panelDrafts','workModes'])S[key]={...incoming[key],...S[key]};
  for(const [key,val] of Object.entries(incoming))if(!(key in S))S[key]=clone(val);
  for(const [key,value] of Object.entries(incoming.composerDrafts||{}))if(!DRAFTS[key])DRAFTS[key]=value;
  MD.normalize(S);for(const r of S.md.runs)if(r.status==='running')r.status='interrupted';persist();return S;
};
