/* V6.2: project-owned evidence, explicit input snapshots, and safe local drafts. */
const V62_INPUT_PREVIOUS = {makeState, ensureExperience, handle, showModal, filesHTML, projectInfoHTML, sendPrompt, makeContent, runSpec, contentHTML, refsHTML, generate, projectPlanRules, inspectContent, checkBatchDraft, artifactEvidenceCount, versionFiles, modifySelected};
const V62_INPUT_FIELDS = [['name','项目名称'],['productName','产品名称'],['category','产品品类'],['model','产品型号'],['market','目标市场'],['language','内容语言']];
const V62_CHANNELS = [['web','品牌官网'],['retail','线下门店'],['ecom','电商']];
const v62Copy = value => JSON.parse(JSON.stringify(value));
const v62Text = value => String(value ?? '').trim();
const v62Context = p => Object.fromEntries([...V62_INPUT_FIELDS.map(([key])=>[key,v62Text(p[key])]),['channels',[...(p.channels||[])]],['tier',p.tier||'Hero'],['goal',v62Text(p.goal)]]);
const v62Identity = p => JSON.stringify([p.productName,p.category,p.model,p.market,p.language,[...(p.channels||[])].sort()]);
function v62Ensure(state) {
  state.inputEvidence ??= [];
  state.inputSnapshots ??= [];
  state.inputUploadAttempts ??= [];
  state.inputContextChanges ??= [];
  state.uploads ??= [];
  state.externalSources ??= [];
  for (const p of state.projects || []) {
    p.inputContextRevision ??= 1;
    const deFixture=p.demoScenario==='spacemaster-de'&&p.inputsReady===true;
    const mxFixture=p.model===PRODUCT.model&&p.category==='冰箱'&&p.market==='MX'&&p.language==='es-MX'&&p.inputsReady!==false&&!p.homeScenario;
    if ((deFixture||mxFixture) && !p.v62InputMigrated && !state.inputSnapshots.some(x=>x.projectId===p.id)) {
      if(mxFixture&&!p.productName)p.productName='SpaceMaster';
      const records=deFixture?deSources:SOURCES.filter(x=>['P01','P02','R01','C01'].includes(x.id)).map(x=>[x.id,x.name,x.text]);
      state.inputSnapshots.push({id:'input-fixture-'+p.id,projectId:p.id,version:1,contextRevision:p.inputContextRevision,identity:v62Identity(p),context:v62Context(p),confirmedBy:p.owner,confirmedAt:p.created||now(),fixture:true,evidence:records.map(([id,name,text])=>({id:'fixture-evidence-'+p.id+'-'+id,sourceId:id,sourceType:'fixture',projectId:p.id,sourceName:name,excerpt:text,locator:'预置演示资料 / '+id,model:p.model,market:p.market,category:'product',status:'verified',verifiedBy:p.owner,verifiedAt:p.created||now()}))});
    }
    p.v62InputMigrated = true;
    for(const snapshot of state.inputSnapshots.filter(x=>x.projectId===p.id&&x.fixture))for(const e of snapshot.evidence)if(!state.inputEvidence.some(x=>x.id===e.id&&x.projectId===p.id))state.inputEvidence.push(v62Copy(e));
    p.inputsReady = v62Readiness(p.id,state).ready;
  }
  return state;
}
function v62LatestSnapshot(pid,state=S) { return state.inputSnapshots?.filter(x=>x.projectId===pid).at(-1)||null; }
function v62EvidenceLive(e,state=S) {
  if (e.sourceId && state.externalSources?.some(s=>s.id===e.sourceId && ['invalid','revoked','expired','needs-review','需复核','已失效'].includes(s.status))) return false;
  const current = state.inputEvidence?.find(x=>x.id===e.id);
  return !current || current.status==='verified';
}
function v62Readiness(pid,state=S) {
  const p=state.projects?.find(x=>x.id===pid),missing=[];
  if (!p) return {ready:false,missing:['项目不存在。'],snapshotId:null,contextRevision:null};
  for (const [key,label] of V62_INPUT_FIELDS.filter(([key])=>key!=='name')) if (!v62Text(p[key]) || (key==='model' && /^(待补充|未知|待确认)$/.test(v62Text(p[key])))) missing.push('请补充'+label+'。');
  if (!p.channels?.length) missing.push('请至少选择一个交付渠道。');
  const snapshot=v62LatestSnapshot(pid,state);
  if (!snapshot) missing.push('请核对具体资料摘录，再保存输入快照。');
  else {
    if (snapshot.identity!==v62Identity(p)) missing.push('产品、市场、语言或渠道已更新，请核对适用证据并保存下一版输入快照。');
    if (!snapshot.evidence.some(e=>e.category==='product' && v62EvidenceLive(e,state))) missing.push('缺少有效的产品事实证据。');
    if (snapshot.evidence.some(e=>!v62EvidenceLive(e,state))) missing.push('已引用来源失效，请核对替代证据并保存下一版输入快照。');
  }
  return {ready:missing.length===0,missing,snapshotId:snapshot?.id||null,contextRevision:p.inputContextRevision,version:snapshot?.version||0};
}
function v62ProjectSnapshot(pid,state=S) { const x=v62LatestSnapshot(pid,state);return x && v62Readiness(pid,state).ready?v62Copy(x):null; }
function v62GenerationSnapshot(pid) {
  if (typeof executingBatch!=='undefined' && executingBatch?.projectId===pid && executingBatch.inputSnapshot) return v62Copy(executingBatch.inputSnapshot);
  return v62ProjectSnapshot(pid);
}
function v62ExecutionIssues(batch,state=S) {
  const snapshot=batch?.inputSnapshot||batch?.projectSnapshot?.inputSnapshot;if(!snapshot)return [];
  return (snapshot.evidence||[]).filter(e=>!v62EvidenceLive(e,state)).map(e=>`已固定引用的「${e.sourceName}」现已失效或需复核，请由项目负责人补充有效依据；该分支尚未完成。`);
}
function v62CanEdit(pid,state=S,actor=state.actor) { return state.projects?.find(p=>p.id===pid)?.owner===actor; }
function v62RequireOwner(pid,state=S) { if (!v62CanEdit(pid,state)) throw new Error('仅项目负责人可以修改项目资料与事实。'); }
function v62ContextErrors(data) {
  const errors=[];
  for (const [key,label] of V62_INPUT_FIELDS) if (!v62Text(data[key])) errors.push(label+'不能为空。');
  for (const [key,label] of V62_INPUT_FIELDS) if (v62Text(data[key]).length>120) errors.push(label+'请控制在 120 字符以内。');
  if (!data.channels?.length || data.channels.some(x=>!V62_CHANNELS.some(([id])=>id===x))) errors.push('请选择当前支持的交付渠道。');
  if (v62Text(data.goal).length>1000) errors.push('项目目标请控制在 1,000 字符以内。');
  return errors;
}
function v62ContextImpact(pid,data,state=S) {
  const p=state.projects.find(x=>x.id===pid);if(!p)return {fields:[],artifacts:[],batches:[],plans:[]};
  const before=v62Context(p),after=v62Context({...p,...data});
  const fields=[...V62_INPUT_FIELDS,['channels','交付渠道'],['tier','产品等级'],['goal','项目目标']].filter(([key])=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(([key,label])=>({key,label,before:before[key],after:after[key]}));
  return {fields,artifacts:(state.artifacts||[]).filter(a=>a.projectId===pid).map(a=>({id:a.id,title:a.title})),batches:(state.batches||[]).filter(b=>b.projectId===pid&&['running','paused'].includes(b.status)).map(b=>({id:b.id,status:b.status})),plans:(state.plans||[]).filter(p=>p.projectId===pid).map(p=>({id:p.id,status:p.status}))};
}
function v62SaveContext(pid,data,state=S) {
  v62RequireOwner(pid,state);const errors=v62ContextErrors(data);if(errors.length)throw new Error(errors.join(' '));
  const p=state.projects.find(x=>x.id===pid),impact=v62ContextImpact(pid,data,state);
  if(!impact.fields.length)return impact;
  const before=v62Context(p),oldSnapshot=v62ProjectSnapshot(pid,state),next=v62Context({...p,...data});
  Object.assign(p,next,{markets:[next.market],inputContextRevision:(p.inputContextRevision||1)+1});
  p.inputsReady=v62Readiness(pid,state).ready;
  state.inputContextChanges.push({id:uid('input-change'),projectId:pid,before,after:v62Context(p),revision:p.inputContextRevision,previousSnapshotId:oldSnapshot?.id||null,actor:state.actor,at:now(),impact:v62Copy(impact)});
  return impact;
}
function v62VerifyEvidence(pid,data,state=S) {
  v62RequireOwner(pid,state);const p=state.projects.find(x=>x.id===pid),errors=[];
  const excerpt=v62Text(data.excerpt),locator=v62Text(data.locator),model=v62Text(data.model),market=v62Text(data.market);
  let sourceName=v62Text(data.sourceName),sourceId=data.sourceId||null,sourceType=data.sourceType||'manual';
  const upload=sourceType==='upload'?state.uploads.find(x=>x.id===sourceId && x.projectId===pid):null;
  const external=sourceType==='external'?state.externalSources.find(x=>x.id===sourceId && x.projectId===pid):null;
  if(sourceType==='upload') { if(!upload)errors.push('请选择当前项目中的资料。');else sourceName=upload.name; }
  if(sourceType==='external') { if(!external)errors.push('请选择当前项目登记的外部来源。');else {sourceName=external.title;if(external.status==='invalid')errors.push('该来源已标记失效，请先更新来源。');} }
  if (!['upload','external','manual'].includes(sourceType)) errors.push('请选择有效的来源类型。');
  if (!sourceName || sourceName.length>200) errors.push('请填写 200 字符以内的资料名称。');
  if (excerpt.length<12 || excerpt.length>4000) errors.push('请填写 12–4,000 字符的具体证据摘录。');
  if (!locator || locator.length>300) errors.push('请填写 300 字符以内的页码、章节或段落定位。');
  if (!model || model!==p.model || /^(待补充|未知|待确认)$/.test(model)) errors.push('请核对与项目一致的具体产品型号。');
  if (!market || market!==p.market) errors.push('请核对与项目一致的适用市场。');
  if(upload?.text && !upload.text.replace(/\s+/g,' ').includes(excerpt.replace(/\s+/g,' '))) errors.push('摘录与已读取正文不一致，请从正文复制对应段落。');
  if(!['product','market','channel','competitor'].includes(data.category)) errors.push('请选择证据用途。');
  if(!data.confirmed)errors.push('核对具体摘录、型号和市场后，请勾选核对声明。');
  if(errors.length)throw new Error(errors.join(' '));
  const record={id:uid('evidence'),projectId:pid,sourceId,sourceType,sourceName,url:external?.url||null,excerpt,locator,model,market,category:data.category,status:'verified',verifiedBy:state.actor,verifiedAt:now(),captureMethod:sourceType==='upload'&&upload?.text?'local-text-excerpt':'manual-excerpt'};
  state.inputEvidence.push(record);
  if(external){external.status='已核验摘录';external.latestEvidenceId=record.id;}
  return v62Copy(record);
}
function v62SaveSnapshot(pid,evidenceIds,state=S) {
  v62RequireOwner(pid,state);const p=state.projects.find(x=>x.id===pid),errors=v62ContextErrors(v62Context(p));
  const ids=[...new Set(evidenceIds||[])],evidence=ids.map(id=>state.inputEvidence.find(x=>x.id===id&&x.projectId===pid));
  if(!evidence.length || evidence.some(x=>!x)) errors.push('请选取当前项目已核对的证据摘录。');
  if(evidence.some(x=>x && (x.status!=='verified'||!v62EvidenceLive(x,state)||x.model!==p.model||x.market!==p.market))) errors.push('所选证据的状态、型号或市场不适用于当前项目，请重新核对。');
  if(!evidence.some(x=>x?.category==='product')) errors.push('至少需要一项产品事实证据；竞品或市场材料不能代替产品资料。');
  if(/^(待补充|未知|待确认)$/.test(p.model))errors.push('请先明确产品型号。');
  if(errors.length)throw new Error(errors.join(' '));
  const last=v62LatestSnapshot(pid,state),fingerprint=JSON.stringify([v62Identity(p),ids.slice().sort()]);
  if(last?.fingerprint===fingerprint)return v62Copy(last);
  const snapshot={id:uid('input-snapshot'),projectId:pid,version:(last?.version||0)+1,contextRevision:p.inputContextRevision,identity:v62Identity(p),context:v62Context(p),evidence:v62Copy(evidence),confirmedBy:state.actor,confirmedAt:now(),fingerprint,fixture:false};
  state.inputSnapshots.push(snapshot);p.inputsReady=true;return v62Copy(snapshot);
}
function v62InvalidateEvidence(pid,id,reason,state=S) {
  v62RequireOwner(pid,state);const record=state.inputEvidence.find(x=>x.id===id&&x.projectId===pid);
  if(!record)throw new Error('找不到当前项目的证据。');
  if(v62Text(reason).length<4)throw new Error('请说明来源失效或冲突的具体原因。');
  record.status='invalid';record.invalidReason=v62Text(reason);record.invalidatedAt=now();record.invalidatedBy=state.actor;
  const external=state.externalSources.find(x=>x.id===record.sourceId&&x.projectId===pid);if(external){external.status='需复核';external.reviewReason=record.invalidReason;}
  state.projects.find(x=>x.id===pid).inputsReady=false;
  return v62Copy(record);
}
function v62RegisterExternal(pid,data,state=S) {
  v62RequireOwner(pid,state);let url;try{url=new URL(v62Text(data.url));}catch{throw new Error('请填写完整的 http 或 https 来源网址。');}
  if(!['http:','https:'].includes(url.protocol))throw new Error('来源网址仅支持 http 或 https。');
  if(!v62Text(data.title)||v62Text(data.title).length>200)throw new Error('请填写 200 字符以内的来源名称。');
  const record={id:uid('external'),projectId:pid,title:v62Text(data.title),url:url.href,category:data.category||'产品资料',addedAt:now(),status:'待核验',addedBy:state.actor};
  state.externalSources.push(record);return v62Copy(record);
}
window.V62Inputs={ensure:v62Ensure,projectSnapshot:v62ProjectSnapshot,inputReadiness:v62Readiness,evidenceFor:(pid,state=S)=>v62ProjectSnapshot(pid,state)?.evidence||[],snapshotForGeneration:v62GenerationSnapshot,executionIssues:v62ExecutionIssues,latestSnapshot:(pid,state=S)=>{const s=v62LatestSnapshot(pid,state);return s?v62Copy(s):null;},canEdit:v62CanEdit,contextImpact:v62ContextImpact,saveContext:v62SaveContext,verifyEvidence:v62VerifyEvidence,saveSnapshot:v62SaveSnapshot,invalidateEvidence:v62InvalidateEvidence,registerExternal:v62RegisterExternal};
makeState=()=>v62Ensure(V62_INPUT_PREVIOUS.makeState());
ensureExperience=function(state,...args){return v62Ensure(V62_INPUT_PREVIOUS.ensureExperience(state,...args));};
v62Ensure(S);

function v62OpenInputs(pid,section='') {
  const p=project(pid)||project();if(!p)return toast('请先明确所属项目。',true);
  if(MODAL)closeModal();S.projectId=p.id;S.threadId=p.threadId;S.view='files';S.canvas=null;S.artifactWorkspace=null;S.inspectorOpen=false;S.v62InputSection=section;render();persist();
  if(section)requestAnimationFrame(()=>document.getElementById(section)?.scrollIntoView({block:'start'}));
}
function v62Field(id,label,value,extra='') {return `<div class="field"><label for="${id}">${E(label)}</label><input id="${id}" value="${E(value||'')}" ${extra}></div>`;}
function v62ContextForm(p) {
  const draft=S.v62ContextDraft?.projectId===p.id?S.v62ContextDraft:v62Context(p),impact=v62ContextImpact(p.id,draft),owner=v62CanEdit(p.id),disabled=owner?'':'disabled';
  return `<section id="v62-context" class="v62-input-section"><div class="row between wrap"><h2>项目基础信息</h2>${tag('上下文 v'+p.inputContextRevision)}</div><p class="muted">一个项目使用一个明确的目标市场；新市场需核对适用依据。多语言不会自动获得其他国家的适用确认。</p><form id="v62-context-form" data-project-id="${E(p.id)}"><fieldset ${disabled}><div class="v62-input-fields">${V62_INPUT_FIELDS.map(([key,label])=>v62Field('v62-context-'+key,label,draft[key],`name="${key}" maxlength="120" required`)).join('')}</div><div class="field"><label for="v62-context-tier">产品等级</label><select id="v62-context-tier" name="tier">${['Hero','系列延展'].map(t=>`<option ${draft.tier===t?'selected':''}>${t}</option>`).join('')}</select></div><fieldset class="v62-channel-options"><legend>交付渠道</legend>${V62_CHANNELS.map(([id,label])=>`<label><input type="checkbox" name="channels" value="${id}" ${draft.channels?.includes(id)?'checked':''}>${label}</label>`).join('')}</fieldset><div class="field"><label for="v62-context-goal">项目目标</label><textarea id="v62-context-goal" name="goal" maxlength="1000">${E(draft.goal||'')}</textarea></div><div id="v62-context-impact" class="v62-context-impact" aria-live="polite">${v62ImpactHTML(impact)}</div><p id="v62-context-error" class="field-error" role="alert"></p>${button('保存基础信息','v62-context-save',p.id,'primary','save')}</fieldset></form>${owner?'':`<p class="notice">仅项目负责人 ${E(PEOPLE[p.owner]?.name||p.owner)} 可以修改；你可以查看资料与快照。</p>`}</section>`;
}
function v62ImpactHTML(impact) {
  if(!impact.fields.length)return '<p class="small muted">保存前会在此列出修改字段与受影响工作。</p>';
  const sensitive=impact.fields.some(f=>['model','productName','category','market','language','channels'].includes(f.key));
  return `<p>将更新：${impact.fields.map(f=>E(f.label)).join('、')}。</p><p class="small muted">${sensitive?'需要重新核对证据并保存下一版输入快照。':''} ${impact.artifacts.length} 份成果、${impact.plans.length} 份计划需要检查适用性；${impact.batches.length} 个运行中批次继续使用启动时的输入。旧快照、成果与提交记录保留。</p>${impact.artifacts.length?`<details><summary>查看受影响成果</summary><ul>${impact.artifacts.map(a=>`<li>${E(a.title)}</li>`).join('')}</ul></details>`:''}`;
}
function v62ReadContextForm() {
  const form=document.querySelector('#v62-context-form');if(!form)return null;
  const data=new FormData(form);return {...Object.fromEntries([...data].filter(([key])=>key!=='channels').map(([key,value])=>[key,v62Text(value)])),channels:data.getAll('channels'),projectId:form.dataset.projectId};
}
function v62UploadList(p) {
  const list=S.uploads.filter(x=>x.projectId===p.id),attempts=S.inputUploadAttempts.filter(x=>x.projectId===p.id&&x.status==='failed').slice(-8);
  return `<section id="v62-files" class="v62-input-section"><div class="row between wrap"><h2>已收资料</h2>${v62CanEdit(p.id)?button('添加资料','v62-attach',p.id,'','upload'):''}</div><p class="small muted">TXT、Markdown、CSV、JSON 可读取本地正文；PDF、Word 和图片需要手工摘录并填写定位。单个文件最多 3 MB，文本最多 200,000 字符。</p>${list.length?`<ul class="v62-record-list">${list.map(u=>`<li><div><strong>${E(u.name)}</strong><p>${u.text?'本地正文已读取，尚需核对具体摘录':u.type==='image'?'图片可预览，事实与使用权尚未核验':'仅登记文件，未解析正文；请手工摘录'}</p>${u.text?`<details><summary>查看已读取正文</summary><pre>${E(u.text)}</pre></details>`:''}</div><div class="v62-row-actions">${button('查看资料','uploaded',u.id,'sm','file')}${v62CanEdit(p.id)?button('核对摘录','v62-evidence-edit',p.id+'|upload|'+u.id,'sm','check'):''}</div></li>`).join('')}</ul>`:'<p class="v62-empty">尚未添加本项目资料。上传文件或登记手工摘录后，可逐条核对产品事实。</p>'}${attempts.length?`<div class="notice warn" role="status"><strong>部分资料未添加</strong><ul>${attempts.map(x=>`<li>${E(x.name)}：${E(x.error)}</li>`).join('')}</ul>${button('重新选择失败文件','v62-attach',p.id,'sm','upload')}</div>`:''}</section>`;
}
function v62EvidenceForm(p) {
  const draft=S.v62EvidenceDraft;if(draft?.projectId!==p.id)return '';
  const u=S.uploads.find(x=>x.id===draft.sourceId&&x.projectId===p.id),external=S.externalSources.find(x=>x.id===draft.sourceId&&x.projectId===p.id);
  return `<section id="v62-evidence-form-section" class="v62-input-section"><h2>核对证据摘录</h2><p class="muted">${draft.sourceType==='upload'&&u?.text?'从已读取正文复制具体段落，并核对型号和市场。':'此处保存你人工读取的摘录及定位；系统没有抓取网页或解析该文件。'}</p><form id="v62-evidence-form" data-project-id="${E(p.id)}"><input type="hidden" name="sourceType" value="${E(draft.sourceType)}"><input type="hidden" name="sourceId" value="${E(draft.sourceId||'')}">${v62Field('v62-evidence-name','资料名称',u?.name||external?.title||draft.sourceName,`name="sourceName" maxlength="200" required ${u||external?'readonly':''}`)}${external?`<a href="${E(external.url)}" target="_blank" rel="noopener noreferrer">打开来源网页 ${icon('arrow')}</a>`:''}${u?.text?`<details open><summary>本地已读取正文</summary><pre class="v62-evidence-source">${E(u.text)}</pre></details>`:''}<div class="field"><label for="v62-evidence-excerpt">具体证据摘录</label><textarea id="v62-evidence-excerpt" name="excerpt" minlength="12" maxlength="4000" required placeholder="复制与当前型号相关的原文；不把推断或营销建议写成产品事实。">${E(draft.excerpt||'')}</textarea></div>${v62Field('v62-evidence-locator','来源定位（页码、章节或段落）',draft.locator,'name="locator" maxlength="300" required placeholder="例如：第 3 页 · 产品规格表；或网页的技术规格段落"')}<div class="v62-input-fields">${v62Field('v62-evidence-model','已核对适用型号',draft.model,'name="model" maxlength="120" required')}${v62Field('v62-evidence-market','已核对适用市场',draft.market,'name="market" maxlength="120" required')}</div><div class="field"><label for="v62-evidence-category">证据用途</label><select id="v62-evidence-category" name="category">${[['product','本产品事实'],['market','市场背景'],['channel','渠道要求'],['competitor','竞品参考']].map(([id,label])=>`<option value="${id}" ${draft.category===id?'selected':''}>${label}</option>`).join('')}</select></div><label class="v62-check-label"><input type="checkbox" name="confirmed" ${draft.confirmed?'checked':''}>我已核对上述摘录、定位、具体型号与适用市场。</label><p id="v62-evidence-error" class="field-error" role="alert"></p><div class="row wrap">${button('保存已核对摘录','v62-evidence-save',p.id,'primary','check')}${button('暂存并返回','v62-evidence-close',p.id)}</div></form></section>`;
}
function v62SnapshotHTML(p) {
  const records=S.inputEvidence.filter(e=>e.projectId===p.id),ready=v62Readiness(p.id),snapshot=v62LatestSnapshot(p.id),owner=v62CanEdit(p.id);
  const eligible=e=>e.status==='verified'&&e.model===p.model&&e.market===p.market&&v62EvidenceLive(e);
  return `<section id="v62-snapshot" class="v62-input-section"><div class="row between wrap"><h2>事实快照</h2>${tag(ready.ready?'输入已就绪':'待核对',ready.ready?'green':'amber')}</div>${snapshot?`<p>当前已保存 v${snapshot.version} · ${E(snapshot.context.model)} · ${E(snapshot.context.market)} · ${snapshot.evidence.length} 项固定证据。${snapshot.fixture?'此版来自预置德国演示资料。':''}</p>`:'<p>选择本次工作实际使用的已核对摘录，再保存输入快照。</p>'}${ready.missing.length?`<ul class="v62-missing">${ready.missing.map(x=>`<li>${E(x)}</li>`).join('')}</ul>`:''}${records.length?`<ul class="v62-record-list">${records.map(e=>`<li><label class="v62-evidence-choice"><input type="checkbox" data-v62-evidence-id="${E(e.id)}" ${owner&&eligible(e)?'':'disabled'}><span><strong>${E(e.sourceName)}</strong><small>${E(e.model)} · ${E(e.market)} · ${E(e.locator)} · ${e.status==='invalid'?'已失效':eligible(e)?'已核对':'不适用当前型号或市场'}</small><span class="v62-quote">${E(e.excerpt)}</span>${e.invalidReason?`<small>失效原因：${E(e.invalidReason)}</small>`:''}</span></label>${owner&&e.status==='verified'?button('标记失效或冲突','v62-evidence-invalidate',p.id+'|'+e.id,'ghost sm','warning'):''}</li>`).join('')}</ul>`:'<p class="small muted">尚无本轮人工核对记录。先添加资料，或登记手工摘录。</p>'}${S.v62Invalidating?.projectId===p.id?`<div class="field"><label for="v62-invalid-reason">说明 ${E(S.inputEvidence.find(e=>e.id===S.v62Invalidating.id)?.sourceName||'此来源')} 的失效或冲突</label><textarea id="v62-invalid-reason" maxlength="1000" placeholder="例如：供应商确认该段参数属于旧型号，当前型号不适用。"></textarea>${button('记录失效原因','v62-evidence-invalidate-save',p.id+'|'+S.v62Invalidating.id,'','warning')}</div>`:''}<p id="v62-snapshot-error" class="field-error" role="alert"></p><div class="row wrap">${owner?button('保存所选证据为输入快照','v62-snapshot-save',p.id,'primary','save'):''}${button(ready.ready?'继续制定交付计划':'查看交付计划','v62-plan',p.id,'','arrow')}${owner?button('登记手工摘录','v62-evidence-edit',p.id+'|manual|','','edit'):''}</div><p class="small muted">保存快照只确认已列出的事实依据；正式使用仍需检查声明、产品真实性与授权。后续输入会形成新版本。</p>${snapshot?`<details><summary>查看已保存快照与历史</summary>${S.inputSnapshots.filter(x=>x.projectId===p.id).slice().reverse().map(x=>`<article class="v62-snapshot-history"><h3>输入 v${x.version} · ${E(x.context.model)} · ${E(x.context.market)}</h3><p>${E(PEOPLE[x.confirmedBy]?.name||x.confirmedBy)} · ${E(new Date(x.confirmedAt).toLocaleString('zh-CN'))}</p>${x.evidence.map(e=>`<p><strong>${E(e.sourceName)}</strong> · ${E(e.locator)}<br>${E(e.excerpt)}</p>`).join('')}</article>`).join('')}</details>`:''}</section>`;
}
function v62ExternalHTML(p) {
  const owner=v62CanEdit(p.id),list=S.externalSources.filter(x=>x.projectId===p.id);
  return `<section id="v62-external" class="v62-input-section"><h2>外部来源</h2><p class="small muted">登记网址不会抓取或核验网页。人工读取后保存有定位的摘录，才能作为输入快照候选。</p>${list.length?`<ul class="v62-record-list">${list.map(x=>`<li><div><strong>${E(x.title)}</strong><p>${E(x.status)} · ${E(x.category)} · ${E(new Date(x.addedAt).toLocaleDateString('zh-CN'))}</p><a href="${E(x.url)}" target="_blank" rel="noopener noreferrer">${E(x.url)} ${icon('arrow')}</a></div>${owner?button('核对网页摘录','v62-evidence-edit',p.id+'|external|'+x.id,'sm','check'):''}</li>`).join('')}</ul>`:'<p class="v62-empty">当前项目尚未登记外部来源。</p>'}${owner?`<form id="v62-external-form" data-project-id="${E(p.id)}">${v62Field('v62-external-title','来源名称','','name="title" maxlength="200" required')}${v62Field('v62-external-url','来源网址','','name="url" type="url" required placeholder="https://"')}<div class="field"><label for="v62-external-category">来源类型</label><select id="v62-external-category" name="category"><option>产品资料</option><option>竞品信息</option><option>渠道信息</option><option>行业报告</option><option>市场动态</option></select></div><p id="v62-external-error" class="field-error" role="alert"></p>${button('登记来源网址','v62-external-save',p.id,'','link')}</form>`:''}</section>`;
}
filesHTML=function() {
  const p=project();if(!p)return V62_INPUT_PREVIOUS.filesHTML();
  const ready=v62Readiness(p.id);
  return `<div class="view-inner v62-input-page"><div class="page-head"><div><h1>项目资料与事实</h1><p>${E(p.name)} · ${E(p.model||'型号待补充')} · ${E(p.market)}</p></div>${tag(ready.ready?'已就绪 · 输入 v'+ready.version:'待补充输入',ready.ready?'green':'amber')}</div><nav class="v62-input-nav" aria-label="项目输入步骤"><a href="#v62-context">基础信息</a><a href="#v62-files">资料</a><a href="#v62-snapshot">事实快照</a><a href="#v62-external">外部来源</a></nav>${v62EvidenceForm(p)}${v62ContextForm(p)}${v62UploadList(p)}${v62SnapshotHTML(p)}${v62ExternalHTML(p)}${p.demoScenario==='spacemaster-de'?`<details class="v62-provided-images"><summary>查看预置德国项目图片与原始来源</summary>${V62_INPUT_PREVIOUS.filesHTML()}</details>`:''}</div>`;
};
projectInfoHTML=function(){
  const p=project(S.inspectorProjectId)||project();if(!p)return V62_INPUT_PREVIOUS.projectInfoHTML();
  const ready=v62Readiness(p.id);
  return `<section class="project-facts"><h3>${E(p.name)}</h3><dl>${V62_INPUT_FIELDS.filter(([key])=>key!=='name').map(([key,label])=>`<div><dt>${label}</dt><dd>${E(p[key]||'待补充')}</dd></div>`).join('')}<div><dt>渠道</dt><dd>${(p.channels||[]).map(c=>E(CHANNEL[c]||c)).join('、')}</dd></div><div><dt>负责人</dt><dd>${E(PEOPLE[p.owner]?.name||p.owner)}</dd></div><div><dt>事实快照</dt><dd>${ready.ready?'输入 v'+ready.version+' 已就绪':'待核对输入'}</dd></div></dl><h4>项目目标</h4><p>${E(p.goal||'尚未填写项目目标。')}</p>${button(v62CanEdit(p.id)?'修订基础信息':'查看基础信息','v62-input-open',p.id+'|v62-context','','edit')}${button('资料与事实快照','v62-input-open',p.id+'|v62-snapshot','','file')}${p.officialSource?`<h4>已登记官网资料</h4><p>${E(p.officialSource.facts)}</p><a href="${E(p.officialSource.url)}" target="_blank" rel="noopener noreferrer">查看原始网页 ${icon('arrow')}</a><p class="small muted">仍需核对当前项目适用的具体摘录。</p>`:''}</section>`;
};
showModal=function(kind,arg='') {if(['product-intake','external-sources'].includes(kind))return v62OpenInputs(arg||S.projectId,kind==='external-sources'?'v62-external':'v62-files');return V62_INPUT_PREVIOUS.showModal(kind,arg);};
handleFiles=async function(files) {
  const pid=S.projectId,p=project(pid),actor=S.actor;
  if(p&&!v62CanEdit(pid))return toast('仅项目负责人可以添加资料。',true);
  let added=0,failed=0;
  for(const file of files) {
    try {
      if(file.size>3*1024*1024)throw new Error('超过 3 MB，请压缩或拆分后重试。');
      if(!/\.(txt|md|csv|json|pdf|docx|png|jpe?g|webp)$/i.test(file.name))throw new Error('格式不支持；请使用 TXT、MD、CSV、JSON、PDF、DOCX、PNG、JPG 或 WebP。');
      const u={id:uid('upload'),name:file.name,size:file.size,mime:file.type,created:now(),projectId:pid,uploadedBy:actor,inputStatus:'pending_review'};
      if(/\.(txt|md|csv|json)$/i.test(file.name)) {u.type='text';u.text=await file.text();if(u.text.length>200000)throw new Error('正文超过 200,000 字符，请拆分后重试。');if(!u.text.trim())throw new Error('正文为空，请核对文件后重试。');}
      else if(/\.(png|jpe?g|webp)$/i.test(file.name)) {u.type='image';u.dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败，请重新选择文件。'));reader.readAsDataURL(file)});u.eligible=false;u.scope='用户上传';u.license='使用条件待确认';u.desc='图片已读取，事实与使用权尚未核验。';}
      else {u.type='file';u.text=null;}
      if(p&&project(pid)?.owner!==actor)throw new Error('资料读取期间项目负责人已变化，请由现负责人重新添加。');
      S.uploads.push(u);attachedIds.push(u.id);added++;
      S.inputUploadAttempts.push({id:uid('upload-attempt'),projectId:pid,name:file.name,status:'added',at:now()});
    } catch(error) {failed++;S.inputUploadAttempts.push({id:uid('upload-attempt'),projectId:pid,name:file.name,status:'failed',error:error.message||'读取失败，请重新选择文件。',at:now()});}
  }
  persist();render();toast(storageWarning?'本地存储空间不足，请导出备份后处理空间；当前内容仅保留在本次页面。':`已添加 ${added} 份资料${failed?'，'+failed+' 份未添加，请查看失败原因':''}。上传后的资料仍需核对摘录。`,storageWarning||!!failed);
  return {added,failed,projectId:pid};
};
function v62ReadEvidenceForm(){const form=document.querySelector('#v62-evidence-form');if(!form)return null;const data=new FormData(form);return {...Object.fromEntries(data),confirmed:data.has('confirmed'),projectId:form.dataset.projectId};}
function v62ShowError(id,error){const node=document.getElementById(id);if(node){node.textContent=error.message||String(error);node.scrollIntoView?.({block:'nearest'});}else toast(error.message||String(error),true);}
handle=async function(action,arg='',...rest) {
  const [pid,type,sourceId]=String(arg).split('|');
  if(action==='v62-draft-edit')return v62OpenDraftEditor(pid,Number(type));
  if(action==='v62-draft-edit-close'){delete S.v62DraftEditor;render();persist();return;}
  if(action==='v62-draft-edit-save'){try{const draft=v62ReadDraftEditor();if(!draft)return;const v=v62SaveDraftEdit(pid,Number(type),draft);delete S.v62DraftEditor;S.contextSelection=null;openCanvas(pid,v.num);persist();toast('人工编辑已保存为 v'+v.num+' 候选。原采用版、事实快照与固定提交保留。');}catch(error){v62ShowError('v62-draft-edit-error',error)}return;}
  if(['product-intake','external-sources','project-info-edit','save-context','project-info-save'].includes(action))return v62OpenInputs(pid||S.projectId,action==='external-sources'?'v62-external':action==='product-intake'?'v62-files':'v62-context');
  if(action==='v62-input-open')return v62OpenInputs(pid,type);
  if(action==='v62-attach'){if(!v62CanEdit(pid))return toast('仅项目负责人可以添加资料。',true);S.projectId=pid;document.querySelector('#file-input')?.click();return;}
  if(action==='attach'&&project()&&!v62CanEdit(S.projectId))return toast('仅项目负责人可以添加资料。',true);
  if(action==='v62-context-save'){try{const data=v62ReadContextForm();if(!data)return;v62SaveContext(pid,data);delete S.v62ContextDraft;persist();render();toast('基础信息已保存。请查看输入就绪状态与受影响工作。');}catch(error){v62ShowError('v62-context-error',error)}return;}
  if(action==='v62-evidence-edit'){if(!v62CanEdit(pid))return toast('仅项目负责人可以核对事实。',true);const p=project(pid),saved=S.v62EvidenceSavedDraft;S.v62EvidenceDraft=saved?.projectId===pid&&saved.sourceType===type&&v62Text(saved.sourceId)===v62Text(sourceId)?v62Copy(saved):{projectId:pid,sourceType:type,sourceId,sourceName:'',excerpt:'',locator:'',model:p.model,market:p.market,category:'product',confirmed:false};return v62OpenInputs(pid,'v62-evidence-form-section');}
  if(action==='v62-evidence-close'){S.v62EvidenceSavedDraft=v62ReadEvidenceForm()||S.v62EvidenceDraft;delete S.v62EvidenceDraft;persist();render();return;}
  if(action==='v62-evidence-save'){try{const data=v62ReadEvidenceForm();if(!data)return;v62VerifyEvidence(pid,data);delete S.v62EvidenceDraft;persist();render();toast('已保存核对记录。请将本次要使用的证据选入输入快照。');}catch(error){v62ShowError('v62-evidence-error',error)}return;}
  if(action==='v62-snapshot-save'){try{const ids=[...document.querySelectorAll('[data-v62-evidence-id]:checked')].map(x=>x.dataset.v62EvidenceId),snapshot=v62SaveSnapshot(pid,ids);persist();render();toast('输入 v'+snapshot.version+' 已就绪，可以继续制定交付计划。');}catch(error){v62ShowError('v62-snapshot-error',error)}return;}
  if(action==='v62-plan')return openUnifiedPlan(pid);
  if(action==='v62-external-save'){try{const form=document.querySelector('#v62-external-form');if(!form)return;const source=v62RegisterExternal(pid,Object.fromEntries(new FormData(form)));persist();return handle('v62-evidence-edit',pid+'|external|'+source.id);}catch(error){v62ShowError('v62-external-error',error)}return;}
  if(action==='v62-evidence-invalidate'){if(!v62CanEdit(pid))return toast('仅项目负责人可以更新证据状态。',true);S.v62Invalidating={projectId:pid,id:type};render();return;}
  if(action==='v62-evidence-invalidate-save'){try{v62InvalidateEvidence(pid,type,document.querySelector('#v62-invalid-reason')?.value);delete S.v62Invalidating;persist();render();toast('已记录失效原因。旧快照保留，后续执行需补充有效依据。');}catch(error){v62ShowError('v62-snapshot-error',error)}return;}
  if(action==='source'&&S.inputEvidence.some(e=>e.id===arg)){const e=S.inputEvidence.find(x=>x.id===arg);return v62OpenInputs(e.projectId,'v62-snapshot');}
  if(action==='external-source-save')return v62OpenInputs(S.projectId,'v62-external');
  const beforeProjectIds=action==='project-create-save'?S.projects.map(p=>p.id):null;
  const result=await V62_INPUT_PREVIOUS.handle(action,arg,...rest);
  if(action==='project-create-save'&&project()&&!beforeProjectIds.includes(S.projectId)){v62Ensure(S);v62OpenInputs(S.projectId,'v62-files');}
  return result;
};
document.addEventListener('input',event=>{
  if(event.target.closest?.('#v62-draft-edit-form')){S.v62DraftEditor=v62ReadDraftEditor();persist();}
  if(event.target.closest?.('#v62-context-form')) {S.v62ContextDraft=v62ReadContextForm();const node=document.querySelector('#v62-context-impact');if(node)node.innerHTML=v62ImpactHTML(v62ContextImpact(S.v62ContextDraft.projectId,S.v62ContextDraft));persist();}
  if(event.target.closest?.('#v62-evidence-form')){S.v62EvidenceDraft=v62ReadEvidenceForm();persist();}
});
document.addEventListener('submit',event=>{if(event.target.id==='v62-draft-edit-form'){event.preventDefault();handle('v62-draft-edit-save',event.target.dataset.artifactId+'|'+event.target.dataset.revision);return;}const action={'v62-context-form':'v62-context-save','v62-evidence-form':'v62-evidence-save','v62-external-form':'v62-external-save'}[event.target.id];if(action){event.preventDefault();handle(action,event.target.dataset.projectId)}});

function v62CreationIntent(text) {return /创建|建立|新建|筹备|变成.*项目/.test(text)&&/项目|上市|空间/.test(text)&&!/(不用|不要|不必|无需|先不|不先|不需要).{0,4}(创建|建立|新建|建|筹备)/.test(text);}
window.V62Inputs.creationIntent=v62CreationIntent;
createProject=function(){return openProjectCreation();};
sendPrompt=async function(text) {
  text=v62Text(text);if(!text)return;
  const target=artifact(S.contextSelection?.artifactId||S.canvas?.id),targetVersion=target&&revision(target,S.contextSelection?.revision||S.canvas?.num||target.pending||target.active);
  const editIntent=/修改|改成|改为|重写|调整|优化|更短|缩短|替换/.test(text)&&!/(不要|不用|不必|无需|先不).{0,4}(修改|重写|调整|替换)/.test(text);
  if(targetVersion?.data.projectInputDraft&&editIntent){if(S.runId)return toast('当前工作尚未结束。请等待或取消后继续。');clearComposer();addMsg('user',text);return modifySelected(text);}
  if(v62CreationIntent(text)){S.projectCreationDraft={...(S.projectCreationDraft||{}),goal:text};clearComposer();return openProjectCreation();}
  if(!project()) {
    if(S.runId)return toast('当前工作尚未结束。请等待或取消后继续。');
    clearComposer();addMsg('user',text);S.view='chat';
    addMsg('assistant','这条输入保留在个人工作中，尚未关联项目。当前没有目标产品的已核对事实；如要制作上市内容，请选择项目，或创建项目后补充资料。',{action:'create'});render(true);persist();return;
  }
  if(!v62UsesFixture(S.projectId)) {
    if(S.runId)return toast('当前工作尚未结束。请等待或取消后继续。');
    if(/为什么|什么意思|解释|依据|怎么理解/.test(text)) {const snap=v62ProjectSnapshot(S.projectId);clearComposer();addMsg('user',text);addMsg('assistant',snap?'当前工作只依据输入 v'+snap.version+' 中的 '+snap.evidence.length+' 项核对摘录。未提供的功能优势、市场结论和宣传表达仍保留待判断；请在成果“来源”中核对原文。':'本项目尚无当前适用的事实快照。先核对产品资料，再继续形成可追溯工作稿。');render(true);persist();return;}
    const kind=/FABE|价值推导/i.test(text)?'fabe':/message house|信息屋|传播主张/i.test(text)?'mh':/策略/.test(text)?'strategy':/POP|门店物料|线下物料/i.test(text)?'pop':/官网.*内容|产品页/.test(text)?'web':/电商/.test(text)?'ecom':/素材|产品图|图片|场景图/.test(text)?'assets':null;
    if(kind){clearComposer();addMsg('user',text);render(true);return generate(kind);}
    return discussPlan(text,typeof workMode==='function'?workMode():'collaborate');
  }
  return V62_INPUT_PREVIOUS.sendPrompt(text);
};
function v62UsesFixture(pid) {return v62GenerationSnapshot(pid)?.fixture===true;}
function v62EditableSection(section){return section.id!=='identity'&&!(section.sources||[]).length&&!section.id.startsWith('fact-');}
function v62OpenDraftEditor(id,num,instruction='') {
  const a=artifact(id),v=a&&revision(a,num||a.pending||a.active);if(!v?.data.projectInputDraft)return toast('请先打开本项目的结构化工作草稿。',true);
  if(!canWrite(a,false))return toast('请由当前成果负责人编辑。',true);
  if(a.pending&&a.pending!==v.num)return toast('已有较新的候选 v'+a.pending+'，请打开该候选再编辑。',true);
  const editable=(v.data.sections||[]).filter(v62EditableSection),selection=S.contextSelection?.artifactId===id?S.contextSelection.section:null;
  const draft={artifactId:id,revision:v.num,title:v.data.title||a.title,summary:v.data.summary||'',sections:Object.fromEntries(editable.map(s=>[s.id,s.body])),instruction:v62Text(instruction).slice(0,1000)};
  const explicit=instruction.match(/(?:改为|改成|替换为|修改为)[：:\s“「"]*([\s\S]+)/)?.[1]?.replace(/[”」"]$/,'').trim();
  if(explicit&&selection&&Object.hasOwn(draft.sections,selection))draft.sections[selection]=explicit;
  S.v62DraftEditor=draft;openCanvas(id,v.num);persist();requestAnimationFrame(()=>document.getElementById('v62-draft-edit-form')?.scrollIntoView({block:'start'}));return draft;
}
function v62ReadDraftEditor(){const form=document.querySelector('#v62-draft-edit-form');if(!form)return null;const data=new FormData(form),draft=S.v62DraftEditor;return {...draft,artifactId:form.dataset.artifactId,revision:Number(form.dataset.revision),title:v62Text(data.get('title')),summary:v62Text(data.get('summary')),sections:Object.fromEntries([...data].filter(([key])=>key.startsWith('section:')).map(([key,value])=>[key.slice(8),v62Text(value)]))};}
function v62SaveDraftEdit(id,num,edit) {
  const a=artifact(id),base=a&&revision(a,num);if(!base?.data.projectInputDraft)throw new Error('工作稿版本不存在。');
  if(!canWrite(a,false))throw new Error('请由当前成果负责人编辑。');
  if(a.pending&&a.pending!==num)throw new Error('已有较新的候选，请重新打开后编辑。');
  const data=v62Copy(base.data),editable=data.sections.filter(v62EditableSection),allowed=new Set(editable.map(s=>s.id));
  if(Object.keys(edit.sections||{}).some(id=>!allowed.has(id)))throw new Error('产品身份与事实摘录不可在改稿中覆盖，请到项目资料核对下一版事实。');
  const title=v62Text(edit.title),summary=v62Text(edit.summary);if(!title||title.length>160||!summary||summary.length>1000)throw new Error('请填写 160 字符以内的标题和 1,000 字符以内的摘要。');
  for(const section of editable){const body=v62Text(edit.sections?.[section.id]);if(!body||body.length>10000)throw new Error('请填写「'+section.title+'」正文（最多 10,000 字符）。');if(body!==section.body){section.body=body;section.label='人工编写，待业务核对';}}
  data.title=title;data.summary=summary;if(JSON.stringify(data)===JSON.stringify(base.data))throw new Error('正文尚未修改；可直接返回原候选继续查看。');
  data.manualEdit={actor:S.actor,at:now(),instruction:v62Text(edit.instruction).slice(0,1000),modelCalled:false};
  const next=addRevision(a,data,'人工编辑结构化工作草稿',base.refs);if(!next)throw new Error('保存失败，请检查编辑权限。');return next;
}
window.V62Inputs.openDraftEditor=v62OpenDraftEditor;
window.V62Inputs.saveDraftEdit=v62SaveDraftEdit;
modifySelected=function(instruction){const a=artifact(S.contextSelection?.artifactId||S.canvas?.id),num=S.contextSelection?.revision||S.canvas?.num||a?.pending||a?.active,v=a&&revision(a,num);return v?.data.projectInputDraft?v62OpenDraftEditor(a.id,num,instruction):V62_INPUT_PREVIOUS.modifySelected(instruction);};
function v62DraftEditorHTML(a,v) {
  const draft=S.v62DraftEditor;if(draft?.artifactId!==a.id||draft.revision!==v.num)return '';
  return `<form id="v62-draft-edit-form" class="v62-draft-editor" data-artifact-id="${E(a.id)}" data-revision="${v.num}"><h3>编辑工作稿正文</h3><p>在这里直接编写文字，保存后形成新候选。产品身份、事实摘录与来源快照保持只读；事实修订请回到项目资料。</p>${draft.instruction?`<p class="notice">修改要求：${E(draft.instruction)}<br>尚未调用模型修改内容，请核对或编辑下方正文。</p>`:''}${v62Field('v62-draft-title','工作稿标题',draft.title,'name="title" maxlength="160" required')}<div class="field"><label for="v62-draft-summary">摘要</label><textarea id="v62-draft-summary" name="summary" maxlength="1000" required>${E(draft.summary)}</textarea></div>${v.data.sections.filter(v62EditableSection).map((s,i)=>`<div class="field"><label for="v62-draft-section-${i}">${E(s.title)}</label><textarea id="v62-draft-section-${i}" name="section:${E(s.id)}" maxlength="10000" required>${E(draft.sections[s.id])}</textarea></div>`).join('')}<p id="v62-draft-edit-error" class="field-error" role="alert"></p><div class="row wrap">${button('保存为新候选','v62-draft-edit-save',a.id+'|'+v.num,'primary','save')}${button('返回当前版本','v62-draft-edit-close',a.id)}</div></form>`;
}
function v62SafeDraft(kind,pid,fixedSnapshot) {
  const snapshot=fixedSnapshot||v62GenerationSnapshot(pid),batch=typeof executingBatch!=='undefined'&&executingBatch?.projectId===pid?executingBatch:null,scope=batch?.projectSnapshot||fixedSnapshot?.workContext,p={...(snapshot?.context||v62Context(project(pid)||{})),...(scope?v62Context(scope):{})},evidence=snapshot?.evidence||[];
  if(batch?.plan?.goal)p.goal=batch.plan.goal;
  const productEvidence=evidence.filter(e=>e.category==='product'),ids=evidence.map(e=>e.id),facts=productEvidence.map(e=>({id:'fact-'+e.id,title:e.sourceName,body:e.excerpt,label:'已核对产品摘录',sources:[e.id]}));
  const name=KIND[kind]?.name||'工作草稿',purpose={strategy:'整理产品身份、事实依据与待验证的业务方向。',fabe:'由已核对摘录建立 Feature 候选；Advantage、Benefit 与宣传语仍需业务推导。',mh:'汇集已确认事实与上游选用表达，待人工补充目标语言的传播主张。',assets:'记录本项目已提供的素材与待补缺口，未检索外部资产，也未生成图片。',web:'整理本项目官网内容结构，页面视觉与正式文案待制作。',pop:'整理本项目门店物料结构，未生成产品图或可印刷设计。',ecom:'整理本项目电商内容结构；价格、促销与渠道规格仍待补充。',research:'整理可核对的研究输入；未进行在线市场检索。'}[kind]||'仅整理当前项目输入，尚未连接真实模型。';
  const sections=[{id:'identity',title:'本次使用的产品与范围',body:`${p.productName||'产品待补充'} / ${p.model||'型号待补充'}\n品类：${p.category||'未知'}\n市场：${p.market||'未知'}\n语言：${p.language||'未知'}\n渠道：${(p.channels||[]).map(c=>CHANNEL[c]||c).join('、')||'未知'}`,label:'项目输入快照',sources:ids},...facts,{id:'goal',title:'工作目标',body:p.goal||'目标尚未明确。',label:'用户输入',sources:[]},{id:'work',title:'本次整理范围',body:purpose,label:'本地结构化整理',sources:[]},{id:'unknown',title:'仍需补充与判断',body:'目标人群、使用场景、竞争结论、功能优势、利益点、传播主张、适用声明和素材使用权，只有在相应依据或人工判断完成后才能确定。未提供的信息保留未知。',label:'证据与业务缺口',sources:[]}];
  return {title:(p.productName||'项目')+' · '+name,summary:purpose,sections,projectInputDraft:true,simulation:true,modelCalled:false,imageGenerated:false,language:p.language||null,inputSnapshot:snapshot,sourceEvidence:v62Copy(evidence),points:kind==='fabe'||kind==='mh'?productEvidence.map(e=>({id:'point-'+e.id,title:e.sourceName,feature:e.excerpt,advantage:'待业务推导',benefit:'待业务确认',evidence:[e.id],selected:true,claim:'待编写并核对',short:'待编写',long:'待编写',disclaimer:'仅记录事实摘录，尚未形成已批准宣传表述。'})):undefined};
}
makeContent=function(kind) {return project()&&!v62UsesFixture(S.projectId)?v62SafeDraft(kind,S.projectId):V62_INPUT_PREVIOUS.makeContent(kind);};
runSpec=function(kind) {
  if(!project()||v62UsesFixture(S.projectId))return V62_INPUT_PREVIOUS.runSpec(kind);
  const snapshot=v62GenerationSnapshot(S.projectId);return {name:'整理'+(KIND[kind]?.name||'当前工作'),module:'workspace',sources:snapshot?.evidence.map(e=>e.id)||[],thought:'读取本项目已确认的输入快照，按结构保存工作草稿。未知信息保留缺口；未调用实时模型或外部搜索。',steps:[['input.snapshot.read','读取固定输入快照','本地原型',{snapshotId:snapshot?.id||null,model:snapshot?.context.model||null},{evidenceCount:snapshot?.evidence.length||0}],['draft.organize','整理结构化工作草稿','本地规则整理',{kind},{modelCalled:false,imageGenerated:false,approved:false}]]};
};
function v62DraftHTML(a,v) {const d=v.data;return `<article class="document v62-safe-draft"><p class="notice">本地结构化工作草稿 · 未调用实时模型 · 未生成图片</p><p class="lead">${E(d.summary)}</p>${(d.sections||[]).map(s=>`<section><h3>${E(s.title)}</h3><p>${E(s.body).replaceAll('\n','<br>')}</p><small>${E(s.label)}</small>${(s.sources||[]).length?`<p class="small muted">依据：${s.sources.map(id=>E(d.sourceEvidence.find(e=>e.id===id)?.sourceName||id)).join('、')}</p>`:''}</section>`).join('')}</article>`;}
contentHTML=function(a,v) {return v.data.projectInputDraft?v62DraftHTML(a,v)+(canWrite(a,false)?`<div class="row wrap">${button('编辑工作稿正文','v62-draft-edit',a.id+'|'+v.num,'','edit')}${button('修订产品事实','v62-input-open',a.projectId+'|v62-snapshot','','file')}</div>`:'')+v62DraftEditorHTML(a,v):V62_INPUT_PREVIOUS.contentHTML(a,v);};
artifactEvidenceCount=function(a,v){return v.data.projectInputDraft?(v.data.sourceEvidence||[]).length:V62_INPUT_PREVIOUS.artifactEvidenceCount(a,v);};
inspectContent=function(a,v){
  if(!v.data.projectInputDraft)return V62_INPUT_PREVIOUS.inspectContent(a,v);
  const snapshot=v.data.inputSnapshot,invalid=(v.data.sourceEvidence||[]).filter(e=>!v62EvidenceLive(e)),structured=!!snapshot&&(v.data.sections||[]).length>0;
  return {passed:structured&&!invalid.length,artifactId:a.id,revision:v.num,at:now(),draftOnly:true,findings:[{title:'结构与固定依据',ok:structured&&!invalid.length,detail:invalid.length?'已固定的来源出现失效，请补充并重新形成工作草稿。':structured?'结构化草稿与已核对输入快照已保存。':'缺少已核对的输入快照。'},{title:'草稿使用范围',ok:true,detail:'仅核对结构与来源。产品真实性、宣传表达、授权和正式渠道交付尚需检查；未调用模型或生成图片。'}]};
};
checkBatchDraft=function(a,v){return v.data.projectInputDraft?inspectContent(a,v):V62_INPUT_PREVIOUS.checkBatchDraft(a,v);};
versionFiles=function(a,v,label){if(!v.data.projectInputDraft)return V62_INPUT_PREVIOUS.versionFiles(a,v,label);const stem=a.kind+'_v'+v.num,body=documentText(a,v);return {[stem+'.md']:'> '+label+' · 本地结构化工作草稿 · 未调用模型或生成图片\n\n'+body,[stem+'.html']:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>'+E(a.title)+'</title><style>body{font-family:system-ui,sans-serif;max-width:75ch;margin:40px auto;padding:0 24px;line-height:1.8}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>'+E(a.title)+'</h1><p>本地结构化工作草稿；未调用模型或生成图片。</p><pre>'+E(body)+'</pre></html>',[stem+'.json']:JSON.stringify({artifactId:a.id,status:label,revision:v},null,2),'input-snapshot.json':JSON.stringify(v.data.inputSnapshot,null,2)};};
refsHTML=function(a,v) {
  if(!v.data.projectInputDraft)return V62_INPUT_PREVIOUS.refsHTML(a,v);
  const snapshot=v.data.inputSnapshot;return `<div class="reference-sections"><h3>固定事实快照${snapshot?' v'+snapshot.version:''}</h3><p>${E(snapshot?.context.model||'未保存')} · ${E(snapshot?.context.market||'市场未明确')}</p>${(v.refs||[]).length?`<section><h3>固定引用成果</h3>${v.refs.map(r=>button(E(r.title)+' · v'+r.revision,'open-artifact',r.id+'|'+r.revision,'','file')).join('')}</section>`:''}${(v.data.sourceEvidence||[]).map(e=>`<section><h3>${E(e.sourceName)}</h3><p>${E(e.model)} · ${E(e.market)} · ${E(e.locator)}</p><blockquote>${E(e.excerpt)}</blockquote><p class="small muted">${E(PEOPLE[e.verifiedBy]?.name||e.verifiedBy)} 核对 · ${E(new Date(e.verifiedAt).toLocaleString('zh-CN'))}${v62EvidenceLive(e)?'':' · 该来源现已失效，正式使用前需处理'}</p>${e.url?`<a href="${E(e.url)}" target="_blank" rel="noopener noreferrer">打开原始来源 ${icon('arrow')}</a>`:''}</section>`).join('')}</div>`;
};
projectPlanRules=function(pid){const p=project(pid);let rows=V62_INPUT_PREVIOUS.projectPlanRules(pid);if(!p)return rows;if(p.demoScenario==='spacemaster-de'&&!v62UsesFixture(pid)&&typeof DEMO_PREVIOUS!=='undefined')rows=DEMO_PREVIOUS.rulesFor(p.channels||[],p.tier).map(r=>({...r,name:r.kind==='mh'?'Message House':r.name,reason:r.kind==='mh'?p.market+' · '+p.language:r.reason}));const channelFor={web:'web',pop:'retail',ecom:'ecom',websitePoster:'web'};return rows.filter(r=>!channelFor[r.kind]||p.channels.includes(channelFor[r.kind]));};
generate=function(kind) {
  const p=project();if(p&&!v62Readiness(p.id).ready)return v62OpenInputs(p.id,'v62-snapshot');
  const channelFor={web:'web',pop:'retail',ecom:'ecom',websitePoster:'web'};if(p&&channelFor[kind]&&!p.channels.includes(channelFor[kind]))return toast('本次项目未选择该渠道，请先修订基础信息与计划。',true);
  if(!p||v62UsesFixture(p.id))return V62_INPUT_PREVIOUS.generate(kind);
  if(!p.scopeConfirmed&&!['research','assets','notes'].includes(kind))return openUnifiedPlan(p.id);
  const task=taskFor(kind,p.id);if(S.actor==='reviewer'||(task?task.assignee!==S.actor:p.owner!==S.actor))return toast('请由当前工作负责人执行。',true);
  const deps=BATCH_DEPS[kind]||[],missing=deps.filter(k=>!byKind(k,p.id));if(missing.length)return toast('先完成：'+missing.map(k=>KIND[k]?.name||k).join('、')+'。',true);
  const pid=p.id,tid=S.threadId,actor=S.actor,snapshot=v62GenerationSnapshot(pid),refs=sourceRefs(deps,pid);snapshot.workContext=v62Context(p);
  return runWork(kind,()=>{if((task&&task.assignee!==actor)||(!task&&project(pid)?.owner!==actor))throw new Error('负责人已变化，请由现负责人重新开始。');const issues=v62ExecutionIssues({inputSnapshot:snapshot});if(issues.length)throw new Error(issues.join(' '));const data=v62SafeDraft(kind,pid,snapshot);let a=byKind(kind,pid);if(a)addRevision(a,data,'依据输入快照整理新工作草稿',refs);else a=newArtifact(kind,data,pid,refs,tid);return {artifactIds:[a.id],text:'已保存本项目的结构化工作草稿，保留事实与缺口。尚未调用实时模型或生成图片，请查看内容后继续补充。'};});
};
