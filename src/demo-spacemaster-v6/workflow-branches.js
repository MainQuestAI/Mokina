/* V6.2 independent work and human handoffs. Local records never certify external success. */
(() => {
  const previous = {handle,homeHTML,filesHTML,libraryHTML,tasksHTML,contentHTML,showModal,renderModal,actionableReviews};
  const modeNames = {search:'独立内容检索',governance:'资料治理',check:'内容检查',continue:'存量内容接续',handoff:'外部交接与反馈'};
  const handoffNames = {description:'CL 描述建议写回',upload:'CL 原生上传审批',publish:'渠道发布',inspection:'官网巡检',knowledge:'知识回流'};
  const statusNames = {ready:'本地结果已保存',waiting_input:'待补输入',waiting_permission:'待核对权限',waiting_repair:'待处理问题',awaiting_handoff:'待交接',handoff_recorded:'已登记人工回执 · 未连接验证',external_failed:'外部处理失败',closed:'本地事项已闭环',draft:'草稿编辑中'};
  const limits = {query:200,title:160,body:20000,evidence:4000};
  const clean = (value,max=4000) => String(value ?? '').trim().slice(0,max);
  const fail = message => { throw new Error(message); };
  const byId = id => ensure().jobs.find(job => job.id===id);
  const timestamp = () => now();
  const json = value => clone(value);

  function ensure(state=S) {
    state.workflowBranches ??= {jobs:[],selected:[],draft:{},activeJob:null,mode:'search'};
    const w=state.workflowBranches;
    w.jobs ??=[]; w.selected ??=[]; w.draft ??={}; w.mode ??='search';
    w.modeDrafts ??= {[w.mode]:json(w.draft)};w.jobDrafts ??={};w.positions ??={};
    w.modeDrafts[w.mode]??={};w.draft=w.modeDrafts[w.mode];
    return w;
  }
  function modeDraft(mode=ensure().mode) {const w=ensure();return w.modeDrafts[mode]??={};}
  function jobDraft(id) {const w=ensure();return w.jobDrafts[id]??={};}
  function positionKey() {const w=ensure();return w.activeJob?'job:'+w.activeJob:'mode:'+w.mode;}
  function capturePosition() {
    if(S.view!=='workflow')return;const w=ensure(),field=document.activeElement;
    w.positions[positionKey()]={scroll:document.querySelector('.view-content')?.scrollTop||0,field:field?.dataset?.wfField||null,selectionStart:field?.selectionStart,selectionEnd:field?.selectionEnd};
  }
  function restorePosition() {
    const position=ensure().positions[positionKey()];if(!position)return;
    const schedule=typeof requestAnimationFrame==='function'?requestAnimationFrame:fn=>fn();
    schedule(()=>{if(S.view!=='workflow')return;const list=document.querySelector('.view-content');if(list)list.scrollTop=position.scroll;const field=[...document.querySelectorAll?.('[data-wf-field]')||[]].find(el=>el.dataset.wfField===position.field);field?.focus?.({preventScroll:true});if(field&&typeof field.setSelectionRange==='function'&&typeof position.selectionStart==='number')try{field.setSelectionRange(position.selectionStart,position.selectionEnd);}catch{}});
  }
  function save() { persist(); return ensure(); }
  function ownerCheck(job) {
    if(!job) fail('这项工作已不存在，请返回工作列表。');
    if(job.owner!==S.actor) fail('请由指定负责人 '+(PEOPLE[job.owner]?.name||job.owner)+' 处理，或先接受接手。');
    return job;
  }
  function newJob(type,title,data={}) {
    const job={id:uid('branch'),type,title:clean(title,limits.title),owner:S.actor,projectId:null,status:'ready',created:timestamp(),updated:timestamp(),simulation:true,externalStatus:'not_connected',events:[],...json(data),threadId:S.threadId};
    ensure().jobs.unshift(job); ensure().activeJob=job.id; save(); return job;
  }
  function event(job,action,note) {
    job.updated=timestamp();job.events.push({id:uid('event'),action,note:clean(note),actor:S.actor,at:job.updated});save();return job;
  }
  function referenceFor(item) {
    return {id:item.id,kind:item.kind||'upload',revision:item.revision,title:item.title,projectId:item.projectId||null,origin:item.origin,permission:item.permission,snapshot:json(item.snapshot)};
  }
  function catalog(source='local') {
    const items=(S.uploads||[]).map(u=>({id:u.id,title:u.name,kind:u.type==='image'?'image':'file',revision:u.inputRevision||u.revision||1,projectId:u.projectId||null,origin:'本地上传',permission:u.permission==='denied'||u.access==='denied'?'denied':u.revoked||u.expired?'revoked':'unverified',usage:u.license||'使用条件待核验',text:u.text||'',snapshot:{name:u.name,type:u.type,mime:u.mime,size:u.size,text:u.text||null,created:u.created},locator:u.name,preview:u.type==='image'?u.dataURL:null}));
    for(const a of S.artifacts||[]) {
      const v=revision(a,a.accepted||a.active||a.pending);if(!v)continue;
      items.push({id:a.id,title:a.title,kind:a.kind,revision:v.num,projectId:a.projectId||null,origin:'本地成果',permission:a.permission==='denied'?'denied':a.revoked||a.expired?'revoked':'unverified',usage:approvalFor(a,v.num)?'本地批准记录 · 外部适用性待核验':'内部草稿 · 正式使用条件待核验',text:JSON.stringify(v.data),snapshot:json(v),locator:a.title+' v'+v.num});
    }
    if(source==='demo'&&typeof ASSET_FIXTURES!=='undefined') for(const item of ASSET_FIXTURES) items.push({id:'fixture:'+item.id,title:item.name,kind:'image',revision:1,projectId:null,origin:'显式选择的演示样本',permission:item.eligible?'unverified':'denied',usage:item.license,text:item.desc||'',snapshot:json(item),locator:'离线样本 / '+item.id});
    for(const item of items)if(['denied','revoked'].includes(item.permission)){item.text='';item.preview=null;item.snapshot={title:item.title,revision:item.revision,permission:item.permission,redacted:true};}
    return items;
  }
  function resolveSource(id,num=null) {
    let item=catalog(String(id).startsWith('fixture:')?'demo':'local').find(x=>x.id===id);
    if(!item) fail('来源已不存在，请重新选择资料或成果。');
    if(item.permission==='denied'||item.permission==='revoked') fail('当前无权使用该来源，请先处理权限或失效问题。');
    if(num&&item.origin==='本地成果') {
      const a=artifact(id),v=revision(a,Number(num));if(!v)fail('指定的来源版本不存在。');
      item={...item,revision:v.num,text:JSON.stringify(v.data),snapshot:json(v),locator:a.title+' v'+v.num};
    }
    const inputIssues=window.V62Inputs?.executionIssues?.({inputSnapshot:item.snapshot?.data?.inputSnapshot})||[];
    if(inputIssues.length)fail(inputIssues.join(' '));
    return item;
  }
  function runSearch(input={}) {
    const query=clean(input.query,limits.query);if(!query)fail('请填写产品、用途或文件名。');
    const source=input.source==='demo'?'demo':'local',all=catalog(source),words=query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const results=all.filter(item=>words.every(word=>(item.title+' '+item.text+' '+item.kind).toLocaleLowerCase().includes(word))&&(input.kind==='image'?item.kind==='image'||item.kind==='assets':true));
    const usable=results.filter(item=>!['denied','revoked'].includes(item.permission));
    const job=newJob('search','检索：'+query,{query,source,kind:input.kind||'all',results:results.map(item=>({...referenceFor(item),usage:item.usage,blocked:['denied','revoked'].includes(item.permission)})),selected:[],status:!results.length?'waiting_input':!usable.length?'waiting_permission':'ready',coverage:source==='demo'?'本地资料及显式演示样本':'仅本地已上传资料和已有成果，未查询 CL'});
    event(job,'local_search',`${results.length} 个本地匹配；没有查询真实资产库。`);return job;
  }
  function selectResult(jobId,id) {
    const job=ownerCheck(byId(jobId));if(job.type!=='search')fail('请从检索结果选择资料。');
    const result=job.results.find(x=>x.id===id);if(!result)fail('此结果不在本次检索中。');
    resolveSource(id,result.revision);if(result.blocked)fail('此结果不可选用，请先核对权限。');
    job.selected=job.selected.includes(id)?job.selected.filter(x=>x!==id):[...job.selected,id];return event(job,'selection_changed','本次选择 '+job.selected.length+' 项；未授予正式使用权。');
  }
  function createInputTask(jobId,kind,input={}) {
    const source=ownerCheck(byId(jobId));const title=clean(input.title)||({missing:'补齐真实图片或资料',permission:'核对资料使用权限',production:'准备缺图制作任务'}[kind]||'补充输入');
    if(!['missing','permission','production'].includes(kind))fail('请选择补资料、核权限或缺图制作。');
    const existing=ensure().jobs.find(x=>x.parentId===source.id&&x.requestKind===kind&&x.status!=='closed');if(existing)return existing;
    return newJob('input',title,{parentId:source.id,requestKind:kind,status:kind==='permission'?'waiting_permission':'waiting_input',owner:input.owner||S.actor,requirement:clean(input.requirement)||'提供具体产品型号、所需视角/用途、原始文件与使用依据；由负责人核对后再进入制作。',evidence:'',refs:json(source.results?.filter(x=>source.selected?.includes(x.id))||source.refs||[])});
  }
  function runGovernance(input={}) {
    const ids=[...new Set(input.ids||[])];if(!ids.length)fail('请至少选择一份可读取的资料。');
    const items=ids.map(id=>resolveSource(id));
    const suggestions=items.map(item=>({id:item.id,revision:item.revision,title:item.title,field:'description',value:clean(input.description)||item.title+'；'+item.origin+'，内容与适用性待人工核验。',basis:'根据文件名和本地登记信息整理，未执行图像识别或 PDF 解析。',decision:'pending',confidence:'需人工核对'}));
    return newJob('governance','资料描述治理建议',{refs:items.map(referenceFor),suggestions,status:'waiting_input',rule:'V6.2 本地治理规则：仅形成描述建议；正式标签、关系和状态不写回。'});
  }
  function decideDescription(jobId,id,decision,text) {
    const job=ownerCheck(byId(jobId));const item=job.suggestions?.find(x=>x.id===id);if(!item)fail('描述建议不存在。');
    if(!['accepted','rejected'].includes(decision))fail('请选择保留或排除此建议。');
    if(decision==='accepted'){resolveSource(id,item.revision);item.value=clean(text)||item.value;if(!item.value)fail('请填写描述建议。');}
    item.decision=decision;job.status=job.suggestions.some(x=>x.decision==='pending')?'waiting_input':'ready';return event(job,'description_decision',item.title+'：'+(decision==='accepted'?'保留描述建议':'排除此建议'));
  }
  const claimPattern=/(省电\s*30\s*%|保鲜\s*7\s*天|销量第一|100%\s*(安全|有效))/i;
  function localFindings(text,locator) {
    const findings=[];const lines=String(text||'').split('\n');
    lines.forEach((line,index)=>{const match=line.match(claimPattern);if(match)findings.push({id:uid('issue'),title:'量化或排名声明缺少适用依据',severity:'高',locator:locator+' · 第 '+(index+1)+' 行',evidence:match[0],rule:'V6.2 本地示例声明规则',status:'open',owner:S.actor});});
    return findings;
  }
  function runCheck(input={}) {
    const location=clean(input.location),text=clean(input.text,limits.body);let item=null,body=text,locator=location||'用户粘贴内容';
    if(input.sourceId){item=resolveSource(input.sourceId,input.revision);body=text||item.text;locator=location||item.locator;}
    if(!item&&!text&&!location)fail('请选择文件、粘贴内容，或填写待巡检的页面地址。');
    if(location&&!item&&!text) {
      let url;try{url=new URL(location);}catch{fail('请填写完整的 http 或 https 页面地址。');}if(!['https:','http:'].includes(url.protocol))fail('巡检地址只支持 http 或 https。');
      return createHandoff('inspection',{title:'官网巡检：'+url.hostname,location:url.href,owner:input.owner||S.actor,materials:'页面地址、发布时间、目标资产版本、检查规则，以及有权限人员提供的页面截图或检测报告。'});
    }
    const findings=localFindings(body,locator);
    if(!body)findings.push({id:uid('issue'),title:'文件正文尚未读取',severity:'待输入',locator,evidence:'仅取得文件登记信息；未进行 PDF、Office 或图片内容识别。',rule:'输入可读性',status:'open',owner:S.actor});
    const job=newJob('check','内容检查：'+(item?.title||locator),{refs:item?[referenceFor(item)]:[],inputText:body,locator,findings,status:findings.length?'waiting_repair':'ready',check:{readable:!!body,localRulePassed:!!body&&!findings.length,authenticity:'未核验',license:'未核验',compliance:'未完成专业审核',publishEligibility:'未确认'},ruleVersion:'V6.2 本地示例规则'});
    return event(job,'local_check','仅检查可读取文字及已列出的示例声明；不代表真实性、合规或发布资格通过。');
  }
  function repairFinding(jobId,issueId,input={}) {
    const job=byId(jobId),issue=job?.findings?.find(x=>x.id===issueId);if(!issue)fail('问题不存在。');
    if(issue.owner!==S.actor)fail('请由问题负责人 '+(PEOPLE[issue.owner]?.name||issue.owner)+' 处理。');
    if(!['open','reopened'].includes(issue.status))fail('请先重新打开问题再保存新的修复。');
    const correction=clean(input.correction,limits.body),evidence=clean(input.evidence,limits.evidence);if(!correction||!evidence)fail('请填写修复后的内容和修复依据。');
    issue.correction=correction;issue.repairEvidence=evidence;issue.status='repaired';return event(job,'repair_saved',issue.locator+'：已保存本地修复，等待复检。');
  }
  function recheckFinding(jobId,issueId) {
    const job=byId(jobId),issue=job?.findings?.find(x=>x.id===issueId);if(!issue||issue.status!=='repaired')fail('请先保存修复内容及依据。');
    if(issue.owner!==S.actor)fail('请由问题负责人完成复检。');
    const matches=localFindings(issue.correction,issue.locator);issue.status=matches.length?'reopened':'rechecked';issue.recheck={at:timestamp(),passed:!matches.length,scope:'只复检修复文字的本地规则，源文件或线上页面未改变。'};
    return event(job,'local_recheck',matches.length?'仍包含示例禁用声明，需要继续修改。':'本地文字复检通过；等待负责人关闭此事项。');
  }
  function closeFinding(jobId,issueId) {
    const job=byId(jobId),issue=job?.findings?.find(x=>x.id===issueId);if(!issue||issue.status!=='rechecked')fail('请先完成本地复检。');
    if(issue.owner!==S.actor)fail('请由问题负责人关闭此事项。');
    issue.status='closed';issue.closedAt=timestamp();job.status=job.findings.every(x=>x.status==='closed')?(job.type==='handoff'?(job.receipts.some(x=>x.result==='reported_complete')?'handoff_recorded':'awaiting_handoff'):'closed'):'waiting_repair';return event(job,'issue_closed','本地问题记录已闭环；源文件修改和真实重新发布需对应系统处理。');
  }
  function continueFrom(input={}) {
    if(!['direct','extension','replan'].includes(input.mode))fail('请选择直接制作、内容拓展或二次企划。');
    const item=resolveSource(input.sourceId,input.revision);if(item.origin!=='本地成果')fail('请选择已有策略或内容成果的具体版本。');
    if(input.mode==='direct'&&!['strategy','fabe','mh'].includes(item.kind))fail('直接制作请引用已有 Strategy、FABE 或 Message House。');
    if(input.factChanged&&input.mode!=='replan')fail('已记录产品事实或策略发生变化，请明确切换为二次企划。');
    const market=clean(input.market,80),language=clean(input.language,80),channel=clean(input.channel,80),change=clean(input.change);
    if(!market||!language||!channel||!change)fail('请填写国家/市场、语言、渠道/版位和本次变化。');
    const data=item.snapshot.data||{},title=clean(input.title,limits.title)||({direct:'渠道内容草稿',extension:'内容拓展草稿',replan:'二次企划草稿'}[input.mode]);
    const extract=data.claim||data.headline||data.summary||data.sections?.map(s=>s.body).join('\n')||data.points?.map(p=>p.benefit||p.title).join('\n')||'';
    const draftText=clean(input.body,limits.body)||String(extract).slice(0,limits.body);
    if(!draftText)fail('该来源没有可复用的正文，请补充本次草稿内容。');
    const continuationKey=JSON.stringify([item.id,item.revision,input.mode,market,language,channel,change,title,draftText]);
    const existing=ensure().jobs.find(x=>x.continuationKey===continuationKey);if(existing){ensure().activeJob=existing.id;return existing;}
    const job=newJob('continue',title,{mode:input.mode,continuationKey,refs:[referenceFor(item)],market,language,channel,change,status:'draft',draftText,steps:input.mode==='replan'?['核对变化事实与适用范围','修订受影响策略','形成对应 FABE / Message House 修订','确认后制作受影响物料']:['核对复用条件','编辑本次渠道内容','检查与采用','按用途提交审批'],reuseStatus:'原批准不自动覆盖新市场、语言或用途；本次保留为内部草稿。'});
    return event(job,'continuation_created','固定引用 '+item.title+' v'+item.revision+'；未重新执行整套上市计划。');
  }
  function saveContinuation(jobId,input={}) {
    const job=ownerCheck(byId(jobId));if(job.type!=='continue')fail('这不是存量接续工作。');
    for(const ref of job.refs)resolveSource(ref.id,ref.revision);
    const title=clean(input.title,limits.title)||job.title,body=clean(input.body,limits.body)||job.draftText;if(!body)fail('请填写可阅读的草稿正文。');
    const summary=job.market+' · '+job.language+' · '+job.channel+'。'+job.reuseStatus;
    const data={title,summary,sections:[{id:'draft',title:job.mode==='replan'?'受影响策略修订草稿':'本次内容草稿',body,label:'用户编辑 · 本地草稿',sources:[]},{id:'change',title:'变化与复用条件',body:job.change,label:'待业务核对',sources:[]},{id:'origin',title:'固定来源',body:job.refs.map(r=>r.title+' v'+r.revision).join('；')+'。来源原文快照随工作记录保留；新稿未继承批准。',label:'版本引用',sources:[]}],workflowBranchId:job.id,market:job.market,language:job.language,channel:job.channel,externalVerified:false};
    const refs=job.refs.map(r=>({id:r.id,kind:r.kind,revision:r.revision,title:r.title}));
    if(job.artifactId){const a=artifact(job.artifactId);if(!a)fail('已保存成果不存在，请保留当前工作备份。');if(JSON.stringify(revision(a,a.pending||a.active)?.data)===JSON.stringify(data))return a;const v=addRevision(a,data,'存量内容接续：'+job.change,refs);if(!v)fail('当前角色不能修改已保存成果。');job.outputRevision=v.num;}
    else {const a=newArtifact('notes',data,job.projectId||null,refs,job.threadId||null);job.artifactId=a.id;job.outputRevision=1;}
    job.draftText=body;job.title=title;job.status='ready';event(job,'draft_saved','已保存可编辑本地候选；待采用与按用途审批。');return artifact(job.artifactId);
  }
  function createHandoff(kind,input={}) {
    if(!handoffNames[kind])fail('请选择要交接的外部流程。');
    const owner=input.owner||S.actor;if(!PEOPLE[owner])fail('请选择一位本地负责人。');
    const refs=json(input.refs||[]);for(const ref of refs)if(ref.origin==='本地成果'||ref.origin==='本地上传')resolveSource(ref.id,ref.revision);
    if(kind==='description'&&(!input.fields?.length||input.fields.some(f=>f.field!=='description')))fail('只允许准备已人工确认的 description 描述建议；其他语义字段需确认接口白名单。');
    if(kind==='knowledge'&&(!clean(input.evidence)||!clean(input.body)))fail('请填写拟复用知识正文及核验来源，才能准备知识回流交接。');
    const dedupe=input.dedupeKey&&ensure().jobs.find(x=>x.dedupeKey===input.dedupeKey);if(dedupe)return dedupe;
    return newJob('handoff',input.title||handoffNames[kind],{kind,owner,refs,location:clean(input.location),materials:clean(input.materials)||({description:'CL 资产标识、原描述、已确认的新描述、允许字段清单及责任人。',upload:'固定成果版本、原生文件包、用途/市场/语言、对应批准记录与 CL 原生上传审核人。',publish:'固定批准版本、渠道页面/版位、上线时间与有权限的渠道发布人。',inspection:'页面地址、线上资产版本、检查规则与有权限的巡检人。',knowledge:'已核验的知识正文、来源定位、适用范围及知识审核人。'}[kind]),status:'awaiting_handoff',fields:json(input.fields||[]),body:clean(input.body,limits.body),evidence:clean(input.evidence),dedupeKey:input.dedupeKey||null,receipts:[],findings:[],externalStatus:'not_connected'});
  }
  function recordHandoff(jobId,input={}) {
    const job=ownerCheck(byId(jobId));if(job.type!=='handoff')fail('请打开外部交接记录。');
    const evidence=clean(input.evidence,limits.evidence),location=clean(input.location)||job.location;if(!evidence||!location)fail('请填写处理回执/证据和可定位的外部记录地址或编号。');
    if(!['reported_complete','failed','partial'].includes(input.result))fail('请选择人工报告的处理结果。');
    const signature=JSON.stringify([input.result,evidence,location]);if(job.receipts.some(x=>x.signature===signature))return job;
    job.receipts.push({id:uid('receipt'),signature,result:input.result,evidence,location,actor:S.actor,at:timestamp(),verifiedByConnector:false});job.status=input.result==='failed'?'external_failed':'handoff_recorded';job.externalStatus='unverified';
    return event(job,'human_receipt_recorded','已登记人工回执，尚未通过连接核验实际系统状态。');
  }
  function addFeedback(jobId,input={}) {
    const job=ownerCheck(byId(jobId)),title=clean(input.title,limits.title),location=clean(input.location)||job.location,evidence=clean(input.evidence);if(!title||!location||!evidence)fail('请填写问题、页面/资产版本定位和证据。');
    const item={id:uid('feedback'),title,locator:location,evidence,owner:input.owner||S.actor,status:'open',severity:'待人工判定',rule:'人工巡检反馈'};if(!PEOPLE[item.owner])fail('请选择问题负责人。');
    job.findings ??=[];job.findings.push(item);job.status='waiting_repair';return event(job,'feedback_created','已登记问题与责任人：'+title);
  }
  function closeJob(jobId,evidence) {
    const job=ownerCheck(byId(jobId));if(!clean(evidence))fail('请记录完成依据。');
    if(job.findings?.some(x=>x.status!=='closed'))fail('还有未复检关闭的问题，请先处理。');
    if(job.type==='handoff'&&!job.receipts?.some(x=>x.result==='reported_complete'))fail('请先登记人工完成回执；此处只关闭本地交接事项。');
    job.status='closed';job.evidence=clean(evidence);return event(job,'local_task_closed','本地事项关闭依据：'+job.evidence);
  }
  function manualItems() {
    const list=[];
    for(const p of S.projects||[])if(p.owner===S.actor&&(p.inputsReady===false||window.V62Inputs?.inputReadiness(p.id)?.ready===false))list.push({id:'input:'+p.id,title:p.name+'：补齐产品输入',detail:'核对文件、事实缺口和来源后保存输入快照。',action:'product-intake',arg:p.id,type:'补输入'});
    for(const tr of S.transfers||[])if(tr.status==='pending'&&(tr.to===S.actor||tr.from===S.actor)){
      const task=S.tasks.find(x=>x.id===tr.taskId);list.push({id:'transfer:'+tr.id,title:(task?.name||'工作')+'：'+(tr.to===S.actor?'等待你接手':'已发出接手邀请'),detail:'接受前负责人不变；发起人可撤销，过期邀请不会改变责任。',action:tr.to===S.actor?'accept-transfer':'wf-cancel-transfer',arg:tr.id,type:'接手'});
    }
    for(const b of S.batches||[])if(b.owner===S.actor&&['failed','interrupted','paused','blocked'].includes(b.status))list.push({id:'batch:'+b.id,title:'制作批次需要处理',detail:b.error||'查看失败或等待项后继续；已成功成果保留。',action:'batch-open',arg:b.id,type:'执行异常'});
    for(const r of S.runs||[])if(['failed','interrupted'].includes(r.status)&&(r.actor||r.owner||'lin')===S.actor&&!r.batchId)list.push({id:'run:'+r.id,title:'单项工作需要恢复',detail:r.error||'原成功结果保留；请查看执行记录后恢复。',action:'run-detail',arg:r.id,type:'执行异常'});
    for(const task of S.tasks||[])if(task.assignee===S.actor&&task.status!=='done'&&task.internalReview?.status==='approved'&&task.artifactId){const a=artifact(task.artifactId),num=task.internalReview.revision||a?.accepted||a?.active;if(a&&num)list.push({id:'formal:'+task.id,title:task.name+'：待正式使用确认',detail:'内部创意评审已通过；正式系统、范围与责任确认仍待交接。',action:'open-artifact',arg:a.id+'|'+num,type:'正式使用确认'});}
    for(const job of ensure().jobs)if(job.owner===S.actor&&['waiting_input','waiting_permission','waiting_repair','awaiting_handoff','external_failed','handoff_recorded','draft'].includes(job.status))list.push({id:job.id,title:job.title,detail:statusNames[job.status]+' · '+(job.materials||job.requirement||'查看具体输入与下一步。'),action:'wf-job',arg:job.id,type:job.type==='handoff'?'交接/反馈':job.type==='continue'?'存量接续':'独立工作'});
    for(const job of ensure().jobs)if(job.owner!==S.actor)for(const issue of job.findings||[])if(issue.owner===S.actor&&issue.status!=='closed')list.push({id:issue.id,title:issue.title,detail:issue.locator+' · '+issue.status,action:'wf-job',arg:job.id,type:'反馈修复'});
    return list;
  }
  function cancelTransfer(id) {
    const tr=S.transfers.find(x=>x.id===id);if(!tr||tr.status!=='pending')fail('邀请已处理或不存在。');if(tr.from!==S.actor)fail('只有发起人可以撤销邀请。');
    tr.status='cancelled';tr.cancelledAt=timestamp();save();return tr;
  }
  function transferExpired(tr) {return !!tr?.expiresAt&&new Date(tr.expiresAt).getTime()<=Date.now();}
  function expireTransfer(id) {
    const tr=S.transfers.find(x=>x.id===id);if(!tr||tr.status!=='pending')fail('邀请已处理或不存在。');if(![tr.from,tr.to].includes(S.actor))fail('只有接手双方可以处理此邀请。');if(!transferExpired(tr))fail('此邀请尚未到期。');tr.status='expired';tr.expiredAt=timestamp();save();return tr;
  }

  const btn=(label,action,arg='',style='sm',ic='')=>button(label,action,arg,style,ic);
  const field=(name,label,value='',type='text',placeholder='')=>`<label class="wf-field"><span>${E(label)}</span><input data-wf-field="${E(name)}" value="${E(value)}" type="${type}" maxlength="${name==='query'?200:4000}" placeholder="${E(placeholder)}"></label>`;
  const area=(name,label,value='',placeholder='')=>`<label class="wf-field"><span>${E(label)}</span><textarea data-wf-field="${E(name)}" rows="5" maxlength="20000" placeholder="${E(placeholder)}">${E(value)}</textarea></label>`;
  const select=(name,label,value,options)=>`<label class="wf-field"><span>${E(label)}</span><select data-wf-field="${E(name)}">${options.map(([id,text])=>`<option value="${E(id)}" ${String(value)===String(id)?'selected':''}>${E(text)}</option>`).join('')}</select></label>`;
  function sourceOptions() {return [['','选择本地资料或成果'],...catalog().map(x=>[x.id,x.title+' v'+x.revision+(['denied','revoked'].includes(x.permission)?' · 无权使用':'')])];}
  function entryHTML(scope='home') {
    return `<section class="wf-entry" aria-label="独立工作"><strong>${scope==='files'?'资料工作':'独立工作'}</strong><div>${scope==='files'?btn('治理资料','wf-open','governance','ghost sm','layers')+btn('检查内容','wf-open','check','ghost sm','shield'):btn('检索内容','wf-open','search','ghost sm','search')+btn('治理资料','wf-open','governance','ghost sm','layers')+btn('检查内容','wf-open','check','ghost sm','shield')+btn('接续已有内容','wf-open','continue','ghost sm','arrow')}</div></section>`;
  }
  function manualHTML() {
    const items=manualItems();return `<section class="wf-manual" aria-labelledby="wf-manual-title"><div class="wf-row-head"><div><h2 id="wf-manual-title">需要你处理的其他事项</h2><p>补输入、责任接手、执行异常与外部交接。</p></div>${btn('查看独立工作记录','wf-open','history','ghost sm','tasks')}</div>${items.map(item=>`<article class="wf-list-row"><div><h3>${E(item.title)}</h3><p>${E(item.type)} · ${E(item.detail)}</p></div>${btn(item.type==='接手'?(item.action==='accept-transfer'?'接受接手':'撤销邀请'):'处理事项',item.action,item.arg)}</article>`).join('')||'<p>当前没有其他人工待办。</p>'}</section>`;
  }
  function formHTML() {
    const w=ensure(),d=modeDraft();let html='';
    if(w.mode==='search')html=field('query','产品、用途或文件名',d.query,'text','例如：正面、厨房、已上传的文件名')+select('source','检索范围',d.source||'local',[['local','本地上传与已有成果'],['demo','明确加入演示样本']])+select('kind','内容类型',d.kind||'all',[['all','所有内容'],['image','图片与素材集合']])+`<p>只检索本机已有内容。没有结果表示本地未找到，真实 CL 库存和权限仍需核对。</p>`+btn('检索本地内容','wf-search','','primary','search');
    if(w.mode==='governance')html=select('sourceId','资料或成果',d.sourceId,sourceOptions())+area('description','建议描述（可选）',d.description,'留空时按已登记的文件名形成待核对描述')+`<p>生成可编辑描述建议。仅可准备 description 写回交接；正式标签、关系和状态由 CL 管理。</p>`+btn('整理描述建议','wf-governance','','primary','layers');
    if(w.mode==='check')html=select('sourceId','检查本地文件或成果（可选）',d.sourceId,sourceOptions())+field('location','页面地址或内容定位（可选）',d.location,'text','https:// 或 文件 / 页面 / 资产版本')+area('text','要检查的文字（可选）',d.text,'粘贴正文可执行本地文字规则；图片、PDF、Office 不会假装已解析')+`<p>只检查可读取文字的示例声明。单独填写网址会生成巡检交接事项，等待有权限的负责人提供结果。</p>`+btn('检查内容 / 准备巡检','wf-check','','primary','shield');
    if(w.mode==='continue')html=select('sourceId','固定引用的已有成果',d.sourceId,[['','选择已有策略或物料'],...catalog().filter(x=>x.origin==='本地成果').map(x=>[x.id,x.title+' v'+x.revision])])+field('revision','来源版本（留空使用列表版本）',d.revision,'number')+select('continuationMode','本次工作',d.continuationMode||'direct',[['direct','已有策略直接制作'],['extension','纯内容拓展：语言、尺寸或模板'],['replan','二次企划：产品事实或策略变化']])+`<div class="wf-fields">${field('market','国家 / 市场',d.market)}${field('language','语言',d.language)}${field('channel','渠道 / 版位 / 尺寸',d.channel)}</div>`+area('change','本次变化与复用条件',d.change)+`<label class="wf-checkbox"><input type="checkbox" data-wf-field="factChanged" ${d.factChanged?'checked':''}>产品事实或策略发生变化，需要二次企划</label>`+`<p>先固定来源版本，再编辑本次草稿。旧批准不会自动覆盖本次国家、语言、渠道或用途。</p>`+btn('固定来源并编辑草稿','wf-continue','','primary','edit');
    if(w.mode==='handoff')html=select('handoffKind','交接流程',d.handoffKind||'upload',Object.entries(handoffNames))+select('sourceId','固定来源（可选）',d.sourceId,sourceOptions())+select('owner','交接负责人',d.owner||S.actor,Object.entries(PEOPLE).map(([id,p])=>[id,p.name]))+field('title','工作标题',d.title)+field('location','目标地址 / 目录 / 资产标识',d.location)+area('materials','需要交给接收方的材料',d.materials)+area('body','描述建议或拟复用知识正文',d.body)+area('evidence','正文的核验依据 / 适用范围',d.evidence)+`<p>CL 新文件走原生上传审批；发布由有权限的渠道人员执行。此处准备交接包并记录人工回执。</p>`+btn('保存交接事项','wf-handoff','','primary','upload');
    const upload=['search','governance','check'].includes(w.mode)?`<div class="wf-upload-entry">${btn('添加本地资料','wf-attach','','sm','upload')}<p>上传后保留当前工作；文字可直接读取，图片与其他文件保留实际读取范围。</p></div>`:'';
    return `<form class="wf-form" data-wf-form>${upload}${html}</form>`;
  }
  function refsHTML(refs=[]) {return refs.length?`<details class="wf-sources"><summary>固定来源 · ${refs.length} 项</summary>${refs.map(ref=>`<p><strong>${E(ref.title)} v${E(ref.revision)}</strong> · ${E(ref.origin||'固定成果')} ${artifact(ref.id)?btn('查看原版本','open-artifact',ref.id+'|'+ref.revision,'ghost sm','file'):''}</p>`).join('')}<p>来源快照保留在交接包或工作记录中，正式使用前仍需复核当前权限。</p></details>`:'';}
  function issueHTML(job,issue) {
    const d=jobDraft(job.id),key=job.id+'|'+issue.id,status={open:'待修复',reopened:'复检未通过',repaired:'待复检',rechecked:'待关闭',closed:'本地问题已关闭'}[issue.status];
    return `<article class="wf-issue"><h3>${E(issue.title)}</h3><p>${E(issue.severity)} · ${E(status)} · 负责人：${E(PEOPLE[issue.owner]?.name||issue.owner)}</p><p>定位：${E(issue.locator)}</p><p>证据：${E(issue.evidence)}</p><p>规则：${E(issue.rule)}</p>${['open','reopened'].includes(issue.status)?area('correction:'+issue.id,'修复后的内容',d['correction:'+issue.id]||issue.correction)+area('repairEvidence:'+issue.id,'修复依据',d['repairEvidence:'+issue.id]||issue.repairEvidence)+btn('保存修复内容','wf-repair',key,'sm','edit'):issue.correction?`<p class="wf-preserve">修复内容：${E(issue.correction)}</p>`:''}${issue.status==='repaired'?btn('复检修复文字','wf-recheck',key,'sm','shield'):''}${issue.status==='rechecked'?btn('关闭本地问题','wf-close-finding',key,'sm','check'):''}${issue.recheck?`<p>${E(issue.recheck.scope)}</p>`:''}</article>`;
  }
  function handoffHTML(job,d) {
    return `<dl class="wf-details"><dt>外部流程</dt><dd>${E(handoffNames[job.kind])}</dd><dt>所需材料</dt><dd>${E(job.materials)}</dd><dt>目标定位</dt><dd>${E(job.location||'待接收方提供地址 / 目录 / 资产标识')}</dd><dt>连接状态</dt><dd>未连接；人工回执尚未经过系统验证。</dd></dl>
      ${job.fields.length?`<pre>${E(JSON.stringify(job.fields,null,2))}</pre>`:''}${job.body?`<p class="wf-preserve">${E(job.body)}</p>`:''}
      <h3>记录人工处理回执</h3>${select('result','接收方报告结果',d.result||'reported_complete',[['reported_complete','人工报告已处理，待系统验证'],['partial','人工报告部分完成'],['failed','人工报告处理失败']])}${field('receiptLocation','外部记录地址或编号',d.receiptLocation||job.location)}${area('receiptEvidence','回执与证据',d.receiptEvidence)}${btn('保存人工回执','wf-record-handoff',job.id,'sm','file')}
      <h3>反馈与复检</h3>${field('feedbackTitle','发现的问题',d.feedbackTitle)}${field('feedbackLocation','页面 / 资产版本 / 问题定位',d.feedbackLocation||job.location)}${select('feedbackOwner','问题负责人',d.feedbackOwner||S.actor,Object.entries(PEOPLE).map(([id,p])=>[id,p.name]))}${area('feedbackEvidence','问题证据',d.feedbackEvidence)}${btn('登记反馈任务','wf-feedback',job.id,'sm','plus')}${(job.findings||[]).map(issue=>issueHTML(job,issue)).join('')}
      <h3>本地事项完成依据</h3>${area('resolution','关闭本地交接事项的依据',d.resolution)}${btn('关闭本地交接事项','wf-close-job',job.id,'sm','check')}
      ${job.receipts.length?`<details><summary>人工回执历史 · ${job.receipts.length}</summary>${job.receipts.map(r=>`<p>${E(r.at)} · ${E(r.result)} · ${E(r.location)}<br>${E(r.evidence)}<br>系统验证：未完成</p>`).join('')}</details>`:''}`;
  }
  function jobHTML(job) {
    if(!job)return '';const d=jobDraft(job.id);let body='';
    if(job.type==='search')body=`<p>${E(job.coverage)}</p>${job.results.map(r=>`<article class="wf-list-row"><div><h3>${E(r.title)} v${r.revision}</h3><p>${E(r.origin)} · ${E(r.usage)}</p><p>${r.blocked?'无权使用或已失效':'可选择作工作参考，正式使用条件待核验'}</p></div>${r.blocked?btn('建立权限核对事项','wf-input',job.id+'|permission','sm','shield'):btn(job.selected.includes(r.id)?'取消选用':'选用作参考','wf-select',job.id+'|'+r.id,'sm','check')}</article>`).join('')||'<p class="notice">本地没有匹配内容。可补上传资料、核对真实资产库，或明确创建缺图制作任务。</p>'}<div class="wf-actions">${btn('登记待补资料','wf-input',job.id+'|missing','sm','upload')}${btn('建立缺图制作任务','wf-input',job.id+'|production','sm','image')}${job.selected.length?btn('导出所选引用清单','wf-export-selection',job.id,'sm','download'):''}</div>`;
    if(job.type==='governance')body=`<p>${E(job.rule)}</p>${job.suggestions.map(item=>`<article class="wf-issue"><h3>${E(item.title)} v${item.revision}</h3><p>${E(item.basis)}</p><p>状态：${({pending:'待人工核对',accepted:'已保留建议',rejected:'已排除'}[item.decision])}</p>${area('description:'+item.id,'描述建议',d['description:'+item.id]??item.value)}<div class="wf-actions">${btn('保留此描述建议','wf-description',job.id+'|'+item.id+'|accepted','sm','check')}${btn('排除此建议','wf-description',job.id+'|'+item.id+'|rejected','ghost sm','close')}</div></article>`).join('')}${job.suggestions.some(x=>x.decision==='accepted')?btn('准备 CL 描述写回交接','wf-description-handoff',job.id,'primary','upload'):''}`;
    if(job.type==='check')body=`<p>可读性：${job.check.readable?'已读取本地文字':'缺少可读取正文'}；本地规则：${job.check.localRulePassed?'未命中已列示例问题':'存在待处理项'}。</p><p>产品真实性、授权、专业合规和发布资格均未完成核验。</p>${job.findings.map(issue=>issueHTML(job,issue)).join('')||'<p>本次文字规则没有发现问题，可以导出报告；不据此自动批准或发布。</p>'}`;
    if(job.type==='continue')body=`<p>${E(job.market)} · ${E(job.language)} · ${E(job.channel)}</p><p>${E(job.reuseStatus)}</p><p>本次只执行：${job.steps.map(E).join(' → ')}</p>${field('editTitle','草稿标题',d.editTitle??job.title)}${area('editBody','本次草稿正文',d.editBody??job.draftText)}<p>复制的原文尚未自动翻译、换图或证明事实变化；请编辑成当前目标内容。</p><div class="wf-actions">${btn('保存本地内容候选','wf-save-continuation',job.id,'primary','file')}${job.artifactId?btn('查看已保存候选','open-artifact',job.artifactId+'|'+job.outputRevision,'sm','arrow'):''}</div>`;
    if(job.type==='input')body=`<p>${E(job.requirement)}</p><p>添加所需文件后可以继续原检索。缺图任务不会自动生成或伪造产品图片。</p><div class="wf-actions">${btn('补充本地资料','wf-attach',job.id,'sm','upload')}${job.parentId?btn('使用已补资料重新检索','wf-rerun-search',job.parentId,'sm','search'):''}</div>${(job.uploadedIds||[]).map(id=>{const u=S.uploads.find(x=>x.id===id);return u?`<p>${E(u.name)} · ${u.type==='text'?'文字已读取':u.type==='image'?'图片已读取，事实待核验':'文件已登记，正文未解析'} ${btn('查看资料','uploaded',u.id,'ghost sm','file')}</p>`:'';}).join('')}${area('resolution','已补充内容与依据',d.resolution??job.evidence)}${btn('记录补充并关闭本地事项','wf-close-job',job.id,'primary','check')}`;
    if(job.type==='handoff')body=handoffHTML(job,d);
    return `<section class="wf-result" data-wf-job="${E(job.id)}" aria-labelledby="wf-result-title"><div class="wf-row-head"><div><h2 id="wf-result-title">${E(job.title)}</h2><p>${E(statusNames[job.status]||job.status)} · 负责人：${E(PEOPLE[job.owner]?.name||job.owner)}</p></div>${btn('导出工作与证据','wf-export',job.id,'ghost sm','download')}</div>${refsHTML(job.refs)}${body}<details class="wf-history"><summary>处理记录 · ${job.events.length}</summary>${job.events.map(x=>`<p>${E(x.at)} · ${E(PEOPLE[x.actor]?.name||x.actor)}<br>${E(x.note)}</p>`).join('')||'<p>工作已保存，等待下一步处理。</p>'}</details></section>`;
  }
  function pageHTML() {
    const w=ensure(),jobs=w.jobs.filter(x=>x.owner===S.actor),job=byId(w.activeJob);
    return `<div class="view-inner wf-page"><div class="page-head"><div><h1>独立工作</h1><p>从已有资料开始，检索、治理、检查或接续内容。</p></div>${btn('返回原工作','wf-back','','ghost sm','arrow')}</div>${select('mode','当前工作',w.mode,[...Object.entries(modeNames),['history','已保存的独立工作']])}${w.error?`<p class="notice warn" role="alert">${E(w.error)}</p>`:''}${w.mode==='history'?`<section><h2>工作记录</h2>${jobs.map(j=>`<article class="wf-list-row"><div><h3>${E(j.title)}</h3><p>${E(statusNames[j.status]||j.status)}</p></div>${btn('继续处理','wf-job',j.id)}</article>`).join('')||'<p>尚无独立工作。选择上方工作类型即可开始。</p>'}</section>`:formHTML()}${job?jobHTML(job):''}${['history','handoff'].includes(w.mode)?legacyHistoryHTML():''}</div>`;
  }
  function legacyHistoryHTML() {
    const rows=[...(S.deliveries||[]).map(x=>({id:x.id,title:artifact(x.artifactId)?.title||x.title||'历史交付',revision:x.revision,status:x.localSimulationStatus||x.status,handoffId:x.handoffId})),...(S.libraryPushes||[]).map(x=>({id:x.id,title:x.title||'历史推送',revision:x.revision,status:x.status}))];
    if(!rows.length)return '';
    return `<details class="wf-history"><summary>既有交付与模拟接收记录 · ${rows.length}</summary><p>保留原记录与成功项。旧版 received / partial 等为本地演示状态，不证明真实 CL 接收或渠道发布。</p>${rows.map(x=>`<p><strong>${E(x.title)} v${E(x.revision)}</strong> · 原记录状态：${E(x.status)} ${x.handoffId?btn('查看外部交接','wf-job',x.handoffId,'ghost sm','arrow'):btn('准备原生上传交接','wf-legacy-handoff',x.id,'ghost sm','upload')}</p>`).join('')}</details>`;
  }
  function open(mode='search',sourceId=null,num=null) {
    capturePosition();const w=ensure();if(S.view!=='workflow')w.origin={view:S.view,projectId:S.projectId,threadId:S.threadId,canvas:json(S.canvas),artifactWorkspace:json(S.artifactWorkspace||null),contextSelection:json(S.contextSelection||null)};
    if(typeof captureConversationDraft==='function')captureConversationDraft();
    closeModal();MODAL=null;S.panelStack=[];w.mode=(modeNames[mode]||mode==='history')?mode:'search';w.error='';const draft=modeDraft(w.mode);draft.owner??=S.actor;if(sourceId){draft.sourceId=sourceId;draft.revision=num||'';}if(w.mode!=='history')w.activeJob=null;
    S.view='workflow';S.projectId=null;S.canvas=null;S.artifactWorkspace=null;S.contextSelection=null;S.inspectorOpen=false;render();restorePosition();save();
  }
  function showJob(id) {const job=byId(id);if(!job)fail('工作记录不存在。');capturePosition();if(S.view!=='workflow')open('history');const w=ensure();w.activeJob=id;w.mode='history';w.error='';render();restorePosition();save();return job;}
  function selectedRefs(job) {return job.results.filter(x=>job.selected.includes(x.id)).map(x=>{resolveSource(x.id,x.revision);return json(x);});}

  homeHTML=function(){return previous.homeHTML().replace('data-action="prompt" data-arg="assets"','data-action="wf-open" data-arg="search"').replace('data-action="content-check" data-arg="content-check"','data-action="wf-open" data-arg="check"')+(!S.projectId?entryHTML():'');};
  filesHTML=function(){return previous.filesHTML()+entryHTML('files');};
  tasksHTML=function(){if(S.view==='workflow')return pageHTML();const html=previous.tasksHTML();return S.view==='review'?html+manualHTML():html;};
  contentHTML=function(a,v){const html=previous.contentHTML(a,v);return html+(['strategy','fabe','mh','pop','web','ecom','notes'].includes(a.kind)?`<div class="wf-artifact-actions">${btn('从此版本接续内容','wf-source',a.id+'|'+v.num,'ghost sm','arrow')}${btn('准备外部交接','wf-source-handoff',a.id+'|'+v.num,'ghost sm','upload')}</div>`:'');};
  if(typeof artifactBackLabel==='function'){const previousBackLabel=artifactBackLabel;artifactBackLabel=function(){return S.artifactWorkspace?.origin.view==='workflow'?'返回独立工作':previousBackLabel();};}
  if(typeof headerHTML==='function'){
    const previousHeader=headerHTML;
    headerHTML=function(){const html=previousHeader();if((typeof navigationView==='function'?navigationView():S.view)!=='workflow')return html;const title=modeNames[ensure().mode]||'工作记录';return html.replace(/<div class="crumb">[\s\S]*?<\/div>/,`<div class="crumb"><span>个人工作</span><strong>独立工作</strong></div>`).replace(/<nav class="projectbar work-context-bar"[\s\S]*?<\/nav>/,`<nav class="projectbar work-context-bar wf-context-bar" aria-label="独立工作区"><span class="personal-work-label">${E(title)}</span>${btn('工作记录','wf-open','history','ghost sm','tasks')}</nav>`);};
  }
  if(typeof sidebarHTML==='function'){
    const previousSidebar=sidebarHTML;
    sidebarHTML=function(){const active=(typeof navigationView==='function'?navigationView():S.view)==='workflow';const entry=btn('独立工作','wf-open','history','nav-item'+(active?' active':''),'search').replace('<button ',`<button aria-current="${active?'page':'false'}" `);return previousSidebar().replace(/(<button\b[^>]*data-action="capabilities"[^>]*>)/,entry+'$1');};
  }
  actionableReviews=function(){return previous.actionableReviews()+manualItems().length;};
  showModal=function(kind,arg=''){if(kind==='content-library'||kind==='deliveries')return open('handoff');return previous.showModal(kind,arg);};
  renderModal=function(){previous.renderModal();if(MODAL?.kind==='capabilities')dockRoot().querySelector('.modal-body')?.insertAdjacentHTML('beforeend',entryHTML());};
  ingest=async function(id){
    const delivery=S.deliveries.find(x=>x.id===id);if(!delivery)return;const a=artifact(delivery.artifactId),v=a&&revision(a,delivery.revision);
    const job=createHandoff('upload',{title:(a?.title||'批准成果')+' · CL 原生上传审批',owner:S.submissions.find(s=>s.id===delivery.submissionId)?.submitter||S.actor,refs:v?[{id:a.id,kind:a.kind,title:a.title,revision:v.num,projectId:a.projectId,origin:'固定批准快照',snapshot:json(v)}]:[],dedupeKey:'delivery:'+id});
    if(['received','partial'].includes(delivery.status))delivery.localSimulationStatus??=delivery.status;
    if(!delivery.localSimulationStatus)delivery.status='awaiting_handoff';delivery.simulation=true;delivery.externalVerified=false;delivery.externalStatus='not_connected';delivery.handoffId=job.id;(delivery.items||[]).forEach(item=>{if(!delivery.localSimulationStatus&&item.status!=='received')item.status='awaiting_handoff';});save();render();return job;
  };
  if(typeof handleFiles==='function'){
    const previousFiles=handleFiles;
    handleFiles=async function(files){const w=ensure(),target=w.uploadTarget,ids=new Set((S.uploads||[]).map(x=>x.id));const result=await previousFiles(files);if(target){const added=(S.uploads||[]).filter(x=>!ids.has(x.id)&&!x.projectId),job=target.jobId&&byId(target.jobId);if(job){job.uploadedIds=[...new Set([...(job.uploadedIds||[]),...added.map(x=>x.id)])];if(added.length)event(job,'input_uploaded','已添加 '+added.length+' 份本地资料；尚未核对事实或授权。');}if(added.length&&['governance','check'].includes(target.mode))modeDraft(target.mode).sourceId=added[0].id;w.uploadTarget=null;save();if(S.view==='workflow'){render();restorePosition();}}return result;};
  }
  handle=async function(action,arg=''){
    if(action==='content-check'||action==='prompt'&&arg==='assets')return open(action==='content-check'?'check':'search');
    if(action==='content-library-push')return open('handoff');
    if(action==='accept-transfer'){const tr=S.transfers.find(x=>x.id===arg);if(tr?.status==='pending'&&transferExpired(tr)){if([tr.from,tr.to].includes(S.actor))expireTransfer(arg);toast('接手邀请已过期；原负责人不变，可由原负责人重新邀请。',true);render();return;}}
    if(action==='transfer'){const result=await previous.handle(action,arg);for(const tr of S.transfers||[])if(tr.taskId===arg&&tr.status==='pending'&&!tr.expiresAt)tr.expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();save();return result;}
    if(!action.startsWith('wf-')){capturePosition();return previous.handle(action,arg);}
    const w=ensure(),d=modeDraft(),[id,part,third]=String(arg).split('|'),jd=jobDraft(id);w.error='';
    try {
      if(action==='wf-open')return open(arg);
      if(action==='wf-source'||action==='wf-source-handoff')return open(action==='wf-source'?'continue':'handoff',id,part);
      if(action==='wf-back'){capturePosition();const origin=w.origin||{view:'chat'};Object.assign(S,origin);render();save();return;}
      if(action==='wf-job')return showJob(arg);
      if(action==='wf-attach'){capturePosition();w.uploadTarget={jobId:id||w.activeJob||null,mode:w.mode};S.projectId=null;return previous.handle('attach');}
      if(action==='wf-rerun-search'){const job=byId(id);if(!job||job.type!=='search')fail('原检索记录不存在，请新建一次检索。');const next=runSearch({query:job.query,source:job.source,kind:job.kind});return showJob(next.id);}
      if(action==='wf-legacy-handoff'){const delivery=S.deliveries.find(x=>x.id===arg);if(delivery){const job=await ingest(arg);return showJob(job.id);}const push=S.libraryPushes.find(x=>x.id===arg);if(!push)fail('历史记录不存在。');const item=resolveSource(push.artifactId,push.revision);const job=createHandoff('upload',{refs:[referenceFor(item)],title:push.title+' · 原生上传交接',dedupeKey:'push:'+push.id});return showJob(job.id);}
      if(action==='wf-cancel-transfer'){cancelTransfer(arg);render();return;}
      if(action==='wf-search')runSearch(d);
      if(action==='wf-select')selectResult(id,part);
      if(action==='wf-input')createInputTask(id,part);
      if(action==='wf-governance')runGovernance({ids:d.sourceId?[d.sourceId]:[],description:d.description});
      if(action==='wf-description')decideDescription(id,part,third,jd['description:'+part]);
      if(action==='wf-description-handoff'){const job=ownerCheck(byId(id)),suggestions=job.suggestions.filter(x=>x.decision==='accepted');createHandoff('description',{refs:job.refs.filter(r=>suggestions.some(x=>x.id===r.id)),fields:suggestions.map(x=>({assetId:x.id,revision:x.revision,field:'description',value:x.value})),dedupeKey:'description:'+job.id+':'+JSON.stringify(suggestions)});}
      if(action==='wf-check')runCheck(d);
      if(action==='wf-continue')continueFrom({...d,mode:d.continuationMode||'direct'});
      if(action==='wf-save-continuation')saveContinuation(id,{title:jd.editTitle,body:jd.editBody});
      if(action==='wf-handoff'){const refs=d.sourceId?[referenceFor(resolveSource(d.sourceId,d.revision))]:[];const kind=d.handoffKind||'upload';if(kind==='description'&&(!refs.length||!clean(d.body)))fail('描述写回需要明确资产来源和已核对的新描述。');createHandoff(kind,{...d,refs,fields:kind==='description'?[{assetId:refs[0].id,revision:refs[0].revision,field:'description',value:clean(d.body)}]:[]});}
      if(action==='wf-record-handoff')recordHandoff(id,{result:jd.result||'reported_complete',location:jd.receiptLocation,evidence:jd.receiptEvidence});
      if(action==='wf-feedback')addFeedback(id,{title:jd.feedbackTitle,location:jd.feedbackLocation,evidence:jd.feedbackEvidence,owner:jd.feedbackOwner||S.actor});
      if(action==='wf-repair')repairFinding(id,part,{correction:jd['correction:'+part],evidence:jd['repairEvidence:'+part]});
      if(action==='wf-recheck')recheckFinding(id,part);
      if(action==='wf-close-finding')closeFinding(id,part);
      if(action==='wf-close-job')closeJob(id,jd.resolution);
      if(action==='wf-export'||action==='wf-export-selection'){const job=byId(id);if(!job)fail('记录不存在。');for(const ref of job.refs||[])if(artifact(ref.id)||(S.uploads||[]).some(x=>x.id===ref.id))resolveSource(ref.id,ref.revision);const data=action==='wf-export-selection'?{title:job.title,selected:selectedRefs(job),scope:'本地引用清单，非正式授权或完整素材文件包'}:job;download('Lilith-'+job.id+'.json',JSON.stringify({prototype:true,externalVerified:false,...data},null,2),'application/json');return;}
      render();save();
    }catch(error){w.error=error.message;render();save();}
  };
  function updateField(el) {const id=el.closest?.('[data-wf-job]')?.dataset.wfJob,draft=id?jobDraft(id):modeDraft();draft[el.dataset.wfField]=el.type==='checkbox'?el.checked:el.value;save();}
  document.addEventListener('input',event=>{const el=event.target,name=el.dataset?.wfField;if(!name||name==='mode')return;updateField(el);});
  document.addEventListener('change',event=>{const el=event.target,name=el.dataset?.wfField;if(!name)return;if(name==='mode'){capturePosition();const w=ensure();w.mode=el.value;w.activeJob=null;w.error='';render();restorePosition();save();}else updateField(el);});
  document.addEventListener('submit',event=>{if(event.target.matches('[data-wf-form]'))event.preventDefault();});
  window.V62Workflows={ensure,modeDraft,jobDraft,open,showJob,catalog,resolveSource,runSearch,selectResult,createInputTask,runGovernance,decideDescription,runCheck,repairFinding,recheckFinding,closeFinding,continueFrom,saveContinuation,createHandoff,recordHandoff,addFeedback,closeJob,manualItems,cancelTransfer,expireTransfer,pageHTML};
  ensure();
})();
