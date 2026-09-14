/* One adapter at the V6.2 interaction boundary, not a second UI shell. */
const MD_PREVIOUS={homeHTML,composerHTML,headerHTML,workStatusHTML,projectInfoHTML,renderModal,handle,sendPrompt,handleFiles,contentHTML,refsHTML,documentText,visibleArtifacts,libraryHTML,filesHTML,tasksHTML,messageHTML,adopt,openCanvas,discussionThread,canvasHTML,exportOne};
const mdNewChat=newChat;
newChat=function(...args){captureConversationDraft();S.openCanvases=[];if(S.md)S.md.scope='work';attachedIds=[];return mdNewChat(...args);};
const mdBtn=(label,action,arg='',cls='sm',ic='')=>button(label,'md-'+action,arg,cls,ic);
const mdArtifactCard=artifactCard;
artifactCard=function(a,n){const html=mdArtifactCard(a,n);return MD.isResult(a)?html.replace('项参考成果','项固定来源'):html;};
canvasHTML=function(){let html=MD_PREVIOUS.canvasHTML();const a=artifact(S.canvas?.id),v=selectedRevision();if(MD.isResult(a)&&v)html=html.replace(/\d+ 项引用成果 · \d+ 项资料来源/,`${v.refs.filter(r=>r.type==='artifact').length} 项成果引用 · ${v.refs.filter(r=>r.type!=='artifact').length} 项资料来源`).replace('采用后完成草稿交付','草稿已保存；是否采用由你决定');return html;};
const mdHomeScenarios=homeScenariosHTML;
homeScenariosHTML=function(){return S.projects.some(demoProject)?mdHomeScenarios():'<section class="sample-space"></section>';};
MD.field=(label,id,value='',area=false)=>`<div class="field"><label for="${E(id)}">${E(label)}</label><${area?'textarea':'input'} id="${E(id)}" ${area?'':'value="'+E(value)+'"'}>${area?E(value)+'</textarea>':''}</div>`;
MD.show=(kind,arg='')=>showModal('md-'+kind,arg);
MD.scopeButtons=()=>`<div class="md-scope row wrap" aria-label="显示范围">${mdBtn('当前工作','scope','work',S.md.scope==='work'?'primary sm':'sm')}${S.projectId?mdBtn('项目全部工作','scope','project',S.md.scope==='project'?'primary sm':'sm'):''}${mdBtn('全部历史','scope','all',S.md.scope==='all'?'primary sm':'sm')}</div>`;
homeHTML=function(){
  const cards=Object.entries(MD.scenes).map(([key,s])=>`<button class="quick-card" data-action="md-scene" data-arg="${key}">${icon(s.icon)}<strong>${s.name}</strong><small>${s.hint}</small></button>`).join('');
  return MD_PREVIOUS.homeHTML().replace(/<p class="home-desc">[\s\S]*?<\/p>/,'<p class="home-desc">讨论品牌方向，准备社媒内容，分析运营表现。<br>从一个问题开始，也可以先一起制定计划。</p>').replace(/<div class="quick-grid">[\s\S]*?<\/div>/,'<div class="quick-grid">'+cards+'</div>').replace(/<section class="yolo-home">[\s\S]*?<\/section>/,`<section class="yolo-home"><div><h2>先定计划，再开始制作。</h2><p>保存计划不会生成成果；讨论、修改和采用仍由你决定。</p></div>${mdBtn('制定工作计划','plan','','primary','tasks')}</section>`).replace(/<section class="sample-space">[\s\S]*?<\/section>/,`<section class="sample-space"><div class="space-preview"><div class="product-tile">${fridge()}</div><div><h3>产品上市 · 专业示例</h3><p class="small muted">在同一个工作台使用 V6.2 的产品输入与七类交付。</p></div><span class="spacer"></span>${mdBtn('选择上市示例','launch','','sm','arrow')}</div></section>`);
};
composerHTML=function(home=false){
  let html=MD_PREVIOUS.composerHTML(home).replace('id="composer"','id="composer" data-thread-id="'+E(S.threadId)+'"').replace('交给我一个问题，或一个完整的上市目标…','交给我一个问题，或说明这次营销目标…');
  if(!MD.generic())return html;
  const m=MD.meta(),run=S.md.runs.findLast(r=>r.threadId===S.threadId&&r.status==='running');
  const strip=`<div class="md-context-strip">${tag('情景演示')}${m.scene!=='general'?tag(MD.scenes[m.scene]?.name||'内容接续','blue'):''}${mdBtn('本次依据 · '+m.selected.length,'sources')}${MD.fixtures[m.scene]?mdBtn('使用示例资料','fixtures','base'):''}${mdBtn('工作计划','plan')}${mdBtn('普通文档','document')}${run?mdBtn('取消演示','cancel',run.id):''}</div>`;
  return html+strip;
};
headerHTML=function(){let html=MD_PREVIOUS.headerHTML();if(MD.generic())html=html.replace('data-action="auto-start"','data-action="md-guide"').replace('播放完整故事','演示路线');return html;};
inCurrentWork=item=>item.threadId===S.threadId;
workStatusHTML=function(){
  if(!MD.generic())return MD_PREVIOUS.workStatusHTML();
  return `<section class="inspector-section"><h3>当前工作</h3><p>${E(MD.meta().goal||'尚未提交目标')}</p>${mdBtn('查看计划','plan')}${mdBtn('本次依据','sources')}</section>`+S.md.runs.filter(r=>r.threadId===S.threadId).slice(-5).reverse().map(r=>`<section class="md-run"><strong>${({running:'演示制作中',done:'本地结果已保存',cancelled:'已取消',interrupted:'待重新执行',failed:'未完成'})[r.status]}</strong><p>${E(r.error||'策略与文案采用合成示例；文件操作在本地执行。')}</p>${r.status==='running'?mdBtn('取消演示','cancel',r.id):['interrupted','failed'].includes(r.status)?mdBtn('查看计划后重新执行','plan',r.planId):''}</section>`).join('');
};
projectInfoHTML=function(){const p=project(S.inspectorProjectId)||project();if(!p||p.marketingProfessional)return MD_PREVIOUS.projectInfoHTML();return `<section class="project-facts"><h3>${E(p.name)}</h3><p>${E(p.goal||'未填写项目目标')}</p><p>一般营销项目。产品型号、市场与渠道仅在适用工作中补充。</p>${mdBtn('编辑基本信息','project',p.id)}</section>`;};
visibleArtifacts=function(){return S.artifacts.filter(a=>S.md.scope==='all'?true:S.md.scope==='project'?!!S.projectId&&a.projectId===S.projectId:a.threadId===S.threadId);};
libraryHTML=function(){return MD.scopeButtons()+MD_PREVIOUS.libraryHTML();};
filesHTML=function(){if(!MD.generic())return MD_PREVIOUS.filesHTML();return `<div class="view-inner"><div class="page-head"><div><h1>工作资料</h1><p>可查看不代表已选用；本次依据单独选择。</p></div>${mdBtn('本次依据','sources','','primary')}${button('添加本地资料','attach','','sm','upload')}</div>${MD.scopeButtons()}${S.uploads.filter(u=>S.md.scope==='all'||(S.md.scope==='project'?u.projectId===S.projectId:u.threadId===S.threadId)).map(u=>`<section class="md-source"><strong>${E(u.name)}</strong><p>${typeof u.text==='string'?'已载入本地正文':'未解析正文'} · ${E(u.fixtureKey?'合成资料':'本地文件')}</p>${mdBtn('查看资料','source',u.id)}</section>`).join('')||'<p class="muted">当前范围还没有资料。</p>'}</div>`;};
tasksHTML=function(){if(S.view==='workflow'||!MD.generic())return MD_PREVIOUS.tasksHTML();return `<div class="view-inner"><div class="page-head"><div><h1>当前工作计划</h1><p>保存不制作；解释不产生新交付。</p></div>${mdBtn('查看或制定计划','plan','','primary')}</div>${S.plans.filter(p=>p.marketing&&p.threadId===S.threadId).map(p=>`<section class="section"><h3>${E(p.goal||'未填写目标')}</h3><p>计划 v${p.revision} · ${p.items.length} 项</p>${mdBtn('打开计划','plan',p.id)}</section>`).join('')}</div>`;};
messageHTML=function(m){return MD_PREVIOUS.messageHTML(m)+(m.mdActions?`<div class="message-actions">${m.mdActions.map(([label,action,arg])=>mdBtn(E(label),action,arg||'')).join('')}</div>`:'');};
MD.sourcesBody=function(){
  const t=MD.work(),m=MD.meta(),uploads=S.uploads.filter(u=>u.threadId===t.id||t.projectId&&u.projectId===t.projectId||m.selected.some(r=>r.id===u.id));
  const arts=S.artifacts.filter(a=>S.md.sourceAll||a.threadId===t.id||t.projectId&&a.projectId===t.projectId||m.selected.some(r=>r.id===a.id));
  const refRow=(o,type)=>{
    const selected=m.selected.find(r=>r.id===o.id),checked=!!selected&&!m.excluded.includes(o.id),num=selected?.revision||o.accepted||o.active;let preview='';
    if(selected&&type==='artifact')try{const ref=MD.resolve(selected);preview=ref.selection?`<pre class="md-pre">${E(ref.text)}</pre>`:'';}catch(e){preview=`<p class="notice warn">${E(e.message)}</p>`;}
    return `<section class="md-source"><label><input type="checkbox" data-md-source="${E(o.id)}" data-type="${type}" ${checked?'checked':''}><span><strong>${E(o.name||o.title)}</strong><br>${checked?'本轮选用':m.excluded.includes(o.id)?'已排除':'可供参考'} · ${type==='upload'?(typeof o.text==='string'?'已载入本地正文':'未解析正文'):'固定成果版本'}</span></label>${type==='artifact'?`<select data-md-ref-version="${E(o.id)}" aria-label="${E(o.title)}引用版本">${o.versions.map(v=>`<option value="${v.num}" ${v.num===num?'selected':''}>v${v.num}</option>`).join('')}</select>`:''}${mdBtn('查看','source',type==='artifact'?'artifact|'+o.id+'|'+num:o.id)}${selected?.selection?mdBtn('重新选择结论','reselect',o.id+'|'+num):''}${preview}</section>`;
  };
  let html=`<p class="notice">本次选择仅影响下一次操作。已有成果保留当时的资料正文和版本，不会跟随这里改变。</p>${button('添加本地资料','attach','','sm','upload')}${MD.fixtures[m.scene]?mdBtn('使用示例资料','fixtures','base')+mdBtn('使用输入变体','fixtures','changed'):''}<div class="md-source-picker">${uploads.map(u=>refRow(u,'upload')).join('')}${arts.map(a=>refRow(a,'artifact')).join('')||''}</div>`;
  if(m.scene==='analytics'){const csv=m.selected.map(r=>S.uploads.find(u=>u.id===r.id)).find(u=>u?.name.endsWith('.csv'));if(csv)try{const parsed=MD.parseCSV(csv.text);html+=`<div class="md-field-pair">${['previous','current'].map((key,i)=>`<div class="field"><label for="md-${key}">${i?'本期':'前期'}</label><select id="md-${key}"><option value="">请选择</option>${parsed.periods.map(p=>`<option value="${E(p)}" ${p===(m[key]||key)?'selected':''}>${E(p)}</option>`).join('')}</select></div>`).join('')}</div>`;}catch(e){html+=`<p class="notice warn">${E(e.message)}</p>`;}}
  return html+mdBtn(S.md.sourceAll?'仅显示当前范围成果':'从其他工作选择成果','source-scope');
};
MD.configFields=function(item,p){
  const c={...MD.defaultConfig(item,MD.meta(MD.work(p.threadId))),...item.config},id=item.id;
  if(item.kind==='marketing-memo')return `<fieldset class="md-config"><legend>品牌触点（一至两个） · 90 天</legend>${Object.entries(MD.channelNames).map(([k,n])=>`<label class="choice"><input id="md-touch-${id}-${k}" type="checkbox" ${c.touchpoints.includes(k)?'checked':''}>${n}</label>`).join('')}</fieldset>`;
  if(item.kind==='social-calendar')return `<div class="md-config">${MD.field('文字条数（1–5）','md-count-'+id,c.count)}<div class="field"><label for="md-channel-${id}">统一排期渠道</label><select id="md-channel-${id}">${['xiaohongshu','wechat'].map(k=>`<option value="${k}" ${c.channel===k?'selected':''}>${MD.channelNames[k]}</option>`).join('')}</select></div>${MD.field('起始日期（YYYY-MM-DD，留空为下周）','md-date-'+id,c.startDate)}<p class="small muted">按天排期；渠道调整不代表平台专门改写。</p></div>`;
  return '';
};
MD.planBody=function(p){
  const issues=MD.planIssues(p);
  return `<div class="plan-intro"><h3>本次工作计划</h3>${tag('计划 v'+p.revision,'blue')}<p>保存不开始制作。开始后使用固定计划与依据快照。</p></div>${issues.length?`<div class="notice warn" role="status"><strong>需确认演示范围</strong>${issues.map(x=>'<p>'+E(x)+'</p>').join('')}${mdBtn('按文字同步参数','config-sync',p.id)}${mdBtn('人工编辑普通文档','document')}</div>`:''}${MD.field('本次目标','md-plan-goal',p.goal,true)}${p.items.map((item,i)=>`<section class="md-plan-item" data-md-item="${item.id}"><div class="row between"><strong>交付 ${i+1} · ${item.status==='done'?'已完成':'待制作'}</strong><div>${mdBtn('上移','item-up',p.id+'|'+item.id)}${mdBtn('移除','item-remove',p.id+'|'+item.id)}</div></div>${MD.field('交付名称','md-item-title-'+item.id,item.title)}<div class="field"><label for="md-item-kind-${item.id}">成果类型</label><select id="md-item-kind-${item.id}">${Object.entries(MD.kindNames).map(([k,n])=>`<option value="${k}" ${item.kind===k?'selected':''}>${n}</option>`).join('')}</select></div>${MD.configFields(item,p)}${MD.field('输入','md-item-input-'+item.id,item.input)}${MD.field('预期输出','md-item-output-'+item.id,item.output)}<label><input type="radio" name="md-current-item" value="${item.id}" ${(p.currentItem||p.items[0]?.id)===item.id?'checked':''}> 开始当前项时选择此交付</label></section>`).join('')}${mdBtn('添加交付项','item-add',p.id)}${MD.field('本轮排除','md-plan-exclusions',p.exclusions,true)}<p class="small muted">未覆盖的内容可以保存计划，但制作前需确认范围。不会默认生成相冲突的示例。</p>`;
};
MD.collectPlan=function(p){
  const value=(id,fallback)=>document.getElementById(id)?.value??fallback;
  return {goal:value('md-plan-goal',p.goal),exclusions:value('md-plan-exclusions',p.exclusions),currentItem:document.querySelector('[name="md-current-item"]:checked')?.value||p.currentItem,items:p.items.map(i=>{
    const item={...i,title:value('md-item-title-'+i.id,i.title),kind:value('md-item-kind-'+i.id,i.kind),input:value('md-item-input-'+i.id,i.input),output:value('md-item-output-'+i.id,i.output)};
    const original={...MD.defaultConfig(item,MD.meta(MD.work(p.threadId))),...i.config};let config=clone(original);
    if(item.kind==='marketing-memo'&&document.getElementById('md-touch-'+i.id+'-wechat'))config.touchpoints=Object.keys(MD.channelNames).filter(k=>document.getElementById('md-touch-'+i.id+'-'+k)?.checked);
    if(item.kind==='social-calendar'){config.count=Number(value('md-count-'+i.id,config.count));config.channel=value('md-channel-'+i.id,config.channel);config.startDate=value('md-date-'+i.id,config.startDate);}
    item.config=config;item.configExplicit=i.configExplicit||JSON.stringify(original)!==JSON.stringify(config);return item;
  })};
};
MD.planDirty=p=>{if(MODAL?.kind!=='md-plan'||MODAL.arg!==p.id)return false;const c=MD.collectPlan(p);return c.currentItem!==(p.currentItem||p.items[0]?.id)||['goal','exclusions','items'].some(k=>JSON.stringify(c[k])!==JSON.stringify(k==='items'?p.items.map(i=>({...i,config:{...MD.defaultConfig(i,MD.meta(MD.work(p.threadId))),...i.config},configExplicit:!!i.configExplicit})):p[k]));};
MD.editBody=function(a,v,section){
  const key=a.id+'|'+v.num+'|'+section,d=S.md.editDrafts[key]||v.data;let html=`<div class="notice">编辑 ${E(a.title)} · 基于 v${v.num}${section?' · 选定条目':''}。保存为候选，不覆盖原版。</div><div class="md-editor">`;
  const f=(label,path,value,area)=>MD.field(label,'md-edit-'+path,value,area).replace('id="md-edit-'+path+'"','data-md-path="'+path+'" id="md-edit-'+path+'"');
  if(d.posts){d.posts.forEach((p,i)=>{if(section&&p.id!==section)return;html+=`<h3>第 ${i+1} 条 · ${E(p.angle)}</h3>`;for(const [k,label] of Object.entries({date:'日期',channel:'渠道',goal:'目标',angle:'角度',body:'正文',cta:'CTA'}))html+=f(label,'posts.'+i+'.'+k,p[k],k==='body');});}
  else if(d.sections){if(!section)html+=f('摘要','summary',d.summary||'',true);d.sections.forEach((s,i)=>{if(section&&section!==s.id)return;html+=f(s.title,'sections.'+i+'.body',s.body,true);});}
  else html+='<p>该格式暂不支持正文编辑，可以查看原始信息并导出。</p>';
  return html+'</div>';
};
MD.writePath=(obj,path,value)=>{const parts=path.split('.');let current=obj;for(const key of parts.slice(0,-1))current=current[key];current[parts.at(-1)]=value;};
MD.collectEdit=function(key){const [id,n]=key.split('|'),v=revision(artifact(id),+n);const d=clone(S.md.editDrafts[key]||v.data);document.querySelectorAll('[data-md-path]').forEach(el=>MD.writePath(d,el.dataset.mdPath,el.value));S.md.editDrafts[key]=d;return d;};
renderModal=function(){
  if(!MODAL?.kind?.startsWith('md-')){
    if(MODAL?.kind==='project-picker'){dockRoot().innerHTML=modalFrame('选择项目',`<p>项目可选，不选择也能开始。</p><div class="project-options">${S.projects.map(p=>button(E(p.name),'choose-project',p.id,'project-option','folder')).join('')}${button('暂不关联项目','choose-project','none','project-option','message')}</div>`,mdBtn('创建一般项目','project','','primary','plus')+button('创建产品上市项目','create-project','','sm'));mountDock();return;}
    return MD_PREVIOUS.renderModal();
  }
  const kind=MODAL.kind.slice(3),arg=MODAL.arg||'',parts=arg.split('|');let title='',body='',foot='';
  if(kind==='sources'){title='本次依据';body=MD.sourcesBody();foot=button('完成选择','modal-close','','primary');}
  if(kind==='reselect'){const a=artifact(parts[0]),v=a&&revision(a,+parts[1]),ref=MD.meta().selected.find(r=>r.id===a?.id);title='重新选择结论';body=v?`<p>${E(a.title)} · v${v.num}；只影响下一次引用。</p>${(v.data.sections||[]).map(s=>`<label class="choice"><input type="checkbox" data-md-conclusion="${E(s.id)}" ${ref?.selection?.includes(s.id)?'checked':''}><span>${E(s.title)}<small>${E(s.body)}</small></span></label>`).join('')}`:'来源版本不存在';foot=mdBtn('确认所选结论','reselect-save',arg,'primary');}
  if(kind==='start-confirm'){title='确认开始使用的计划';body='<p>当前面板有未保存修改。请选择保存这些修改后开始，或仅使用已保存计划。未保存底稿会保留。</p>';foot=mdBtn('保存并开始','start-choice','save','primary')+mdBtn('使用已保存计划','start-choice','saved')+button('继续编辑','panel-back');}
  if(kind==='repeat'){title='所选交付已经完成';body='<p>不会重复执行已完成项。确认另做一份后会新增独立成果，原稿和采用记录保留。</p>';foot=mdBtn('确认另做一份','repeat-confirm',arg,'primary')+button('取消','modal-close');}
  if(kind==='source'){let text='';if(parts[0]==='artifact'){const a=artifact(parts[1]);title=(a?.title||'成果')+' · v'+parts[2];try{const selected=MD.meta().selected.find(r=>r.id===a?.id);text=MD.resolve({...selected,type:'artifact',id:parts[1],revision:+parts[2]}).text;}catch(e){text=e.message;}}else{const u=S.uploads.find(u=>u.id===arg);title=u?.name||'来源';text=u?.text??'未解析正文，仅保留文件信息。';}body=`<pre class="md-pre">${E(text)}</pre>`;if(parts[0]!=='artifact'){const u=S.uploads.find(u=>u.id===arg);if(u)foot=mdBtn('导出原始文件','file-export',u.id)+mdBtn('保存为文件成果','file-artifact',u.id);}}
  if(kind==='snapshot'){const s=S.md.snapshots.find(s=>s.id===arg);title='固定依据快照';body=s?`<p>${E(s.goal)} · ${E(s.created)}</p>${s.selected.map(r=>`<section class="section"><h3>${E(r.title)} · v${r.revision||1}</h3><pre class="md-pre">${E(r.text??'未解析正文')}</pre></section>`).join('')}<p>排除资料：${E(s.excluded.join('、')||'无')}</p>${s.plan?`<p>计划 v${s.plan.revision} · ${E(s.plan.goal)}</p><p>本轮排除：${E(s.plan.exclusions)}</p>`:''}`:'历史快照未提供，不能推断来源已读取。';}
  if(kind==='plan'){const p=S.plans.find(p=>p.id===arg);if(!p)return;title='工作计划';body=MD.planBody(p);foot=mdBtn('保存计划','plan-save',p.id)+mdBtn('开始当前项','plan-start',p.id+'|current','primary')+mdBtn('全部制作','plan-start',p.id+'|all');}
  if(kind==='edit'){const a=artifact(parts[0]),v=revision(a,+parts[1]);if(!v)return;title='编辑工作稿';body=MD.editBody(a,v,parts[2]||'');foot=button('取消','modal-close')+mdBtn('保存为新候选','edit-save',arg,'primary');}
  if(kind==='project'){const p=project(arg);title=p?'编辑一般项目':'创建一般项目';body=MD.field('项目名称（必填）','md-project-name',p?.name||'')+MD.field('项目目标（选填）','md-project-goal',p?.goal||'',true);foot=mdBtn('保存项目','project-save',arg,'primary');}
  if(kind==='followup'){const a=artifact(parts[0]),v=revision(a,+parts[1]);if(!v)return;title='选择结论，另开工作';body=`<p>引用 ${E(a.title)} · v${v.num}。只带入勾选结论，不复制全部历史或批准。</p>${(v.data.sections||[]).map(s=>`<label class="choice"><input type="checkbox" data-md-conclusion="${E(s.id)}"><span><strong>${E(s.title)}</strong><small>${E(s.body)}</small></span></label>`).join('')}${MD.field('新工作目标','md-followup-goal','依据所选结论，制定下周三条实用内容计划；具体产品事实后续补充。',true)}`;foot=mdBtn('预览带入内容','followup-preview',arg,'primary');}
  if(kind==='followup-preview'){const f=S.md.followupDraft;title='确认新工作引用';body=f?`<p>${E(f.goal)}</p><p>来源：${E(f.title)} · v${f.revision}</p><pre class="md-pre">${E(f.summary)}</pre><p class="notice">不会复制未选择的结论、原始 CSV 或完整对话。</p>`:'';foot=mdBtn('确认并另开工作','followup-create','','primary');}
  if(kind==='launch'){title='产品上市 · V6.2 专业流程';body='<p>显式载入专业示例，仍在当前工作台操作。不会改变已有个人工作的资料。</p>';foot=mdBtn('载入德国七类交付示例','launch-de','','primary')+button('创建自己的产品项目','create-project','','sm');}
  if(kind==='guide'){title='三条演示路线';body='<p>选择示例 → 使用示例资料 → 发送目标 → 调整计划 → 开始制作 → 打开成果 → 讨论／修订／比较／采用。</p><p>运营分析完成后，选择结论另开工作。全程可手动操作；不使用自动点击代替你的选择。</p>'+Object.entries(MD.scenes).map(([id,s])=>mdBtn(s.name,'scene',id)).join('');}
  if(kind==='import'){title='导入备份';body=`<p>合并保留 ID、版本与提交记录。重复导入不重复创建；未知归属保留历史范围。同 ID 冲突保留当前内容。</p><p>${window.pendingBackup?.artifacts?.length||0} 份成果；${window.pendingBackup?.threads?.length||0} 个工作。</p>`;foot=button('导出当前备份','export-backup')+mdBtn('合并导入','import-confirm','','primary');}
  dockRoot().innerHTML=modalFrame(title,body,foot);mountDock();restorePanelValues();syncOverlayLayers();
};
contentHTML=function(a,v){
  if(!MD.isResult(a))return MD_PREVIOUS.contentHTML(a,v);const d=v.data,key=a.id+'|'+v.num;
  let html=`<div class="poster-toolbar">${d.sections||d.posts?mdBtn('编辑正文与排期','edit',key,'sm','edit'):''}${mdBtn('导出文字','export',key+'|md','sm','download')}${d.posts||d.analysis?mdBtn('导出 CSV','export',key+'|csv','sm','download'):''}${d.sections?mdBtn('选择结论另开工作','followup',key,'sm','link'):''}</div><div class="notice md-notice">${v.source==='local-computation'?'数值由本地 CSV 计算；实验建议为情景演示。':v.source==='user-edit'?'用户编辑候选；保留原来源，不代表按新资料重新生成。':d.simulation?'情景演示 · 基于显式选择的合成资料。':'本地工作文档 · 未调用模型。'}</div><div class="document md-document"><p class="doc-lead">${E(d.summary||'')}</p>`;
  if(d.file)html+=`<p>${E(d.file.name)} · ${d.file.size||0} bytes · ${E(d.file.mime||'未知格式')}</p>${mdBtn('下载此版本原文件','artifact-file',key)}<pre class="md-pre">${E(d.file.text??'该格式不支持正文预览或编辑，原始文件已保留。')}</pre>`;
  if(d.posts)html+=`<div class="md-table-scroll" tabindex="0" aria-label="社媒内容与排期表"><table class="md-table"><thead><tr>${['条目','日期／渠道','目标／角度','正文／CTA','操作'].map(x=>'<th>'+x+'</th>').join('')}</tr></thead><tbody>${d.posts.map((p,i)=>`<tr data-post-id="${p.id}"><td>${i+1}</td><td>${E(p.date)}<br>${E(p.channel)}</td><td>${E(p.goal)}<br>${E(p.angle)}</td><td class="md-body-cell">${E(p.body)}<br><strong>CTA：</strong>${E(p.cta)}</td><td>${mdBtn('编辑第'+(i+1)+'条','edit',key+'|'+p.id)}${button('选中讨论','select-section',key+'|'+p.id,'ghost sm')}${mdBtn('缩短此条','shorten',key+'|'+p.id)}</td></tr>`).join('')}</tbody></table></div>`;
  if(d.analysis){const r=d.analysis,pct=n=>n===null?'不可计算':(n*100).toFixed(3)+'%';html+=`<div class="md-table-scroll" tabindex="0" aria-label="计算结果表"><table class="md-table"><thead><tr><th>指标</th><th>${E(r.totals[0].period)}</th><th>${E(r.totals[1].period)}</th></tr></thead><tbody>${[['总曝光',...r.totals.map(x=>x.impressions)],['总互动',...r.totals.map(x=>x.interactions)],['总体互动率',...r.totals.map(x=>pct(x.rate))],...r.groups.flatMap(g=>[[g.group+' 互动率',...g.values.map(v=>pct(v.rate))],[g.group+' 曝光占比',...g.values.map(v=>pct(v.share))]])].map(row=>'<tr>'+row.map(x=>'<td>'+E(x)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;}
  for(const s of d.sections||[])html+=`<section class="section" data-section-id="${E(s.id)}"><h3>${E(s.title)}</h3><p>${E(s.body)}</p><div class="row wrap">${button('选中讨论','select-section',key+'|'+s.id,'ghost sm','message')}${mdBtn('修改此段','edit',key+'|'+s.id)}</div></section>`;
  if(!d.sections&&!d.posts&&!d.analysis&&!d.file)html+=`<p>此类型暂不支持编辑，以下为保存的原始内容。</p><pre class="md-pre">${E(JSON.stringify(d,null,2))}</pre>`;
  return html+'</div>';
};
refsHTML=function(a,v){if(!MD.isResult(a))return MD_PREVIOUS.refsHTML(a,v);const s=S.md.snapshots.find(x=>x.id===v.contextSnapshotId);return `<div class="notice">以下为此版本的固定来源，当前工作选择变化不会改写历史。</div>${MD.historicalMismatch(s)?'<p class="notice warn">历史引用不一致：版本标记与摘录正文不一致。原记录未改写；再次使用前请重新选择来源版本和结论。</p>':''}${s?mdBtn('查看固定正文与排除项','snapshot',s.id):'<p>此历史版本未保存可核验的完整依据快照。</p>'}${(v.refs||[]).map(r=>`<section class="md-source"><strong>${E(r.title||r.name||r.id)}</strong> · v${r.revision||r.version||1}${r.type==='artifact'?button('打开原成果','open-artifact',r.id+'|'+r.revision,'sm'):''}</section>`).join('')}${s?.selected.filter(r=>r.selection).map(r=>'<pre class="md-pre">'+E(r.text)+'</pre>').join('')||''}`;};
documentText=function(a,v){if(!MD.isResult(a))return MD_PREVIOUS.documentText(a,v);const d=v.data,snapshot=S.md.snapshots.find(s=>s.id===v.contextSnapshotId);return '# '+a.title+' · v'+v.num+'\n\n'+(d.summary||'')+'\n\n'+(d.posts?d.posts.map((p,i)=>`## ${i+1}. ${p.angle}\n${p.date} · ${p.channel}\n目标：${p.goal}\n${p.body}\nCTA：${p.cta}`).join('\n\n'):(d.sections||[]).map(s=>'## '+s.title+'\n'+s.body).join('\n\n'))+(!d.posts&&!d.sections?JSON.stringify(d,null,2):'')+'\n\n来源：'+JSON.stringify(v.refs||[])+'\n依据快照：'+(v.contextSnapshotId||'历史未提供')+(MD.historicalMismatch(snapshot)?'\n历史引用不一致：保留原记录，再次使用需重新确认。':'')+(snapshot?.selected.filter(r=>r.selection).map(r=>'\n\n固定结论：'+r.title+' v'+r.revision+'\n'+r.text).join('')||'')+'\n本地原型，不代表正式发布。';};
MD.export=function(id,n,format){const a=artifact(id),v=revision(a,+n);if(!v)throw Error('版本不存在');let text=documentText(a,v),ext='md',type='text/markdown';if(format==='csv'){let rows;if(v.data.posts)rows=[['id','date','channel','goal','angle','body','cta'],...v.data.posts.map(p=>['id','date','channel','goal','angle','body','cta'].map(k=>p[k]))];else if(v.data.analysis)rows=[['period','content_type','impressions','interactions','interaction_rate','share'],...v.data.analysis.groups.flatMap(g=>g.values.map((x,i)=>[v.data.analysis.totals[i].period,g.group,x.impressions,x.interactions,x.rate,x.share]))];else throw Error('当前成果不是表格');text=MD.csv(rows);ext='csv';type='text/csv';}download(a.title.replace(/[\\/:*?"<>|]/g,'_')+'_v'+v.num+'.'+ext,text,type+';charset=utf-8');};
exportOne=function(id,n){if(MD.isResult(artifact(id)))return MD.export(id,n,'md');return MD_PREVIOUS.exportOne(id,n);};
adopt=function(id,n){const a=artifact(id);if(!MD.isResult(a))return MD_PREVIOUS.adopt(id,n);const v=revision(a,+n);if(!v||!canWrite(a))return;S.md.decisions.push({id:uid('decision'),artifactId:id,revision:v.num,previous:a.accepted,action:'adopt',actor:S.actor,at:now(),threadId:a.threadId});a.accepted=v.num;a.active=v.num;if(a.pending===v.num)a.pending=null;persist();render();toast('已采用此草稿版本。不是正式批准或发布。');};
discussionThread=function(a){return a.threadId?MD.work(a.threadId)||MD_PREVIOUS.discussionThread(a):MD_PREVIOUS.discussionThread(a);};
openCanvas=function(id,n=null,tab='content'){const a=artifact(id);if(!a)return;captureConversationDraft();MD_PREVIOUS.openCanvas(id,n,tab);if(a.threadId){S.threadId=a.threadId;S.projectId=a.projectId||null;render();persist();}};
MD.target=function(){const sel=S.contextSelection,a=artifact(sel?.artifactId||S.canvas?.id);if(a&&MD.isResult(a))return {a,v:revision(a,sel?.revision||S.canvas?.num||a.active),section:sel?.section||''};const list=MD.results().filter(MD.isResult);if(list.length===1)return {a:list[0],v:revision(list[0],list[0].pending||list[0].active),section:''};return null;};
MD.begin=function(p,scope='unspecified',options={}){
  if(MD.planDirty(p)){S.md.pendingStart={planId:p.id,scope,options,changes:MD.collectPlan(p),threadId:p.threadId};MD.show('start-confirm',p.id);return '请确认使用未保存修改还是已保存计划。';}
  if(scope==='unspecified'&&p.items.length>1){MD.show('plan',p.id);return '请选择“开始当前项”或“全部制作”，不会猜测执行范围。';}
  const chosen=scope==='all'?p.items.filter(i=>i.status!=='done'):[p.items.find(i=>i.id===p.currentItem)||p.items[0]];
  if(!options.repeat&&(!chosen.length||chosen.some(i=>i.status==='done'))){MD.show('repeat',p.id);return '所选交付已完成，是否另做一份由你确认。';}
  try{MD.execute(p.id,scope==='all',options);closeModal();openInspector('status');return '已开始所选范围的情景演示，可取消；结果保存为草稿。';}
  catch(e){MD.show('plan',p.id);return e.message;}
};
sendPrompt=async function(text){
  if(!MD.generic())return MD_PREVIOUS.sendPrompt(text);
  text=String(text||'').trim();if(!text)return;
  const t=MD.work(),m=MD.meta(t),target=MD.target(),intent=MD.parseIntent(text,target),first=!t.messages.some(x=>x.role==='user');
  clearComposer();addMsg('user',text,{},t.id);
  const reply=(body,actions)=>{addMsg('assistant',body,actions?{mdActions:actions}:{},t.id);render(true);persist();};
  if(intent.polarity==='negative')return reply('已保留你的否定要求，本次不制作、不改稿，也不新增计划项。');
  if(intent.polarity==='clarify')return reply(intent.reason,[['调整工作计划','plan']]);
  if(intent.action==='stop'){const r=S.md.runs.find(r=>r.threadId===t.id&&r.status==='running');if(r)MD.cancel(r.id);m.status='closed';return reply('已停止本次推进。已有内容保留，不创建后续待办。');}
  if(intent.action==='explain'){
    if(!target)return reply('请先打开要解释的成果或选中段落，不按最新类型猜测。');
    const d=target.v.data,section=d.sections?.find(s=>s.id===target.section)||d.sections?.find(s=>s.id==='audience'),post=d.posts?.find(p=>p.id===target.section);
    return reply('针对「'+target.a.title+'」v'+target.v.num+'：'+(section?.body||post?.body||d.summary||'请查看此版本的固定来源。')+'\n这是对当前示例内容的说明，不新增版本或改变采用。');
  }
  if(intent.action==='alternative'){
    if(!target)return reply('请先打开要另做一份的成果。');
    const p=MD.plan()||MD.newPlan(),original=p.items.find(i=>i.artifactId===target.a.id)||p.items.find(i=>i.kind===target.a.kind);
    if(!original)return reply('请先在计划中选择对应交付项。',[['调整工作计划','plan',p.id]]);
    const item={...clone(original),id:uid('item'),status:'pending',title:target.a.kind==='marketing-memo'?'独立对照方案':original.title+' · 另做一份',alternative:target.a.kind==='marketing-memo'?!target.v.data.alternative:original.alternative};delete item.artifactId;
    if(MD.planDirty(p))return reply('计划有未保存修改，请先保存，再提出另做方案。',[['调整工作计划','plan',p.id]]);
    if(workMode()==='plan'){MD.savePlan(p,{items:[...p.items,item],currentItem:item.id});return reply('已加入计划；明确开始前不制作。',[['调整工作计划','plan',p.id]]);}
    return reply(MD.begin(p,'current',{items:[item],repeat:true}),[['查看工作状态','status']]);
  }
  if(['edit','shorten'].includes(intent.action)){
    if(!target)return reply('请先打开要修改的成果，多份成果不会按最新一份猜测。');
    const section=intent.index!==undefined?target.v.data.posts?.[intent.index]?.id:target.section;
    if(intent.index!==undefined&&!section)return reply('所选版本没有这条内容，请重新选择条目。');
    if(intent.action==='shorten'&&target.v.data.posts&&section&&workMode()!=='plan')return handle('md-shorten',target.a.id+'|'+target.v.num+'|'+section);
    MD.show('edit',target.a.id+'|'+target.v.num+'|'+(section||''));return reply('已打开指定版本的编辑面板；保存为候选，原版保持不变。');
  }
  if(first&&!/^(请)?开始(制作|执行)?[。！!]*$/.test(text)){m.goal=text;m.goalRevision++;}
  if(!m.goal)m.goal=text;
  if(m.scene==='general')return reply('本原型未接实时模型，原文已保留。请选择演示场景，或人工编辑普通文档。',[['建立普通文档','document'],['制定计划','plan'],['选择演示场景','guide']]);
  if(m.scene==='launch')return MD.show('launch');
  const existing=MD.plan(),p=existing||MD.newPlan();
  if(intent.action==='start'){
    if(!existing&&workMode()==='plan'){MD.show('plan',p.id);return reply('请先确认并保存计划，再明确开始。');}
    // Do not discard substantive constraints in a new start request.
    if(!/^(请)?(开始(制作|执行|当前项)?|全部(制作|执行)|执行计划)[。！!]*$/.test(text)){
      const directive=MD.scopeInput(text,p.items[0]?.kind);
      if(directive.errors.length)return reply('需确认演示范围：'+directive.errors.join('；'),[['调整工作计划','plan',p.id],['人工编辑普通文档','document']]);
      if(existing){MD.show('plan',p.id);return reply('请将本次条数、渠道或排除要求保存到计划后开始，避免沿用旧范围。');}
    }
    return reply(MD.begin(p,intent.scope),[['调整工作计划','plan',p.id],['检查本次依据','sources']]);
  }
  reply('先讨论并保存范围；制作前会校验计划要求。未覆盖的内容可以人工编辑。',[['调整工作计划','plan',p.id],['检查本次依据','sources']]);MD.show('plan',p.id);
};
handleFiles=async function(files){
  if(!MD.generic()||S.view==='workflow')return MD_PREVIOUS.handleFiles(files);const tid=S.threadId,pid=S.projectId,m=MD.meta(MD.work(tid));
  for(const f of files){if(f.size>3*1024*1024)throw Error(f.name+' 超过 3 MB，请选择较小文件');const u={id:uid('upload'),threadId:tid,projectId:pid,name:f.name,mime:f.type,size:f.size,revision:1,created:now(),type:'file'};
    if(/\.(txt|md|csv|json)$/i.test(f.name)){u.text=await f.text();u.type='text';}else{const data=await f.arrayBuffer();u.dataURL='data:'+(f.type||'application/octet-stream')+';base64,'+btoa(Array.from(new Uint8Array(data),c=>String.fromCharCode(c)).join(''));}
    S.uploads.push(u);m.selected.push({type:'upload',id:u.id,revision:1});addMsg('assistant',`已添加 ${f.name}：${u.text!==undefined?'已载入本地正文':'已保存文件，未解析正文'}。`,{},tid);
  }persist();render();if(MODAL?.kind==='md-sources')renderModal();
};
handle=async function(action,arg=''){
  try{
    if(action==='restore-backup'){const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{window.pendingBackup=JSON.parse(await input.files[0].text());MD.show('import');}catch(e){toast(e.message,true);}};input.click();return;}
    if(['demo-guide','guide'].includes(action)&&MD.generic())return MD.show('guide');
    if(action==='create-project'){if(MD.generic())MD.meta().scene='launch';return MD_PREVIOUS.handle('project-create',arg);}
    if(action==='start-yolo'&&MD.generic()){S.workModes[S.threadId]='yolo';return handle('md-plan');}
    if(!action.startsWith('md-')){if(['new-chat','thread','project','new-project-thread'].includes(action)){captureConversationDraft();S.openCanvases=[];S.md.scope='work';attachedIds=[];}return await MD_PREVIOUS.handle(action,arg);}
    const key=action.slice(3),parts=String(arg).split('|'),m=MD.meta();
    if(['sources','source','snapshot','edit','project','followup','launch','guide','reselect'].includes(key))return MD.show(key,arg);
    if(key==='status')return openInspector('status');
    if(key==='open')return openCanvas(parts[0],+parts[1]);
    if(key==='scene'){if(thread()?.messages.length)newChat();const meta=MD.meta();meta.scene=arg;meta.goal=MD.scenes[arg].goal;DRAFTS[S.threadId]=meta.goal;const c=document.querySelector('#composer');if(c)c.value=meta.goal;closeModal();render();persist();return;}
    if(key==='fixtures'){MD.loadFixtures(arg);render();if(MODAL?.kind==='md-sources')renderModal();return;}
    if(key==='plan'){let p=arg&&S.plans.find(p=>p.id===arg);p=p||MD.plan()||MD.newPlan();return MD.show('plan',p.id);}
    if(key==='plan-save'||key==='plan-start'){
      const p=S.plans.find(p=>p.id===parts[0]);MD.savePlan(p,MD.collectPlan(p));delete S.panelDrafts[panelKey()];
      // Re-render saved values before checking for unsaved edits.
      renderModal();
      if(key==='plan-save')toast(p.validation.length?'计划已保存；需确认演示范围，尚未制作。':'计划已保存，没有开始制作。');
      else{const message=MD.begin(p,parts[1]==='all'?'all':'current');addMsg('assistant',message,{},p.threadId);persist();render();}return;
    }
    if(key==='config-sync'){const p=S.plans.find(p=>p.id===arg),changes=MD.collectPlan(p);changes.items.forEach(i=>{i.configExplicit=false;});MD.savePlan(p,changes);delete S.panelDrafts[panelKey()];renderModal();return;}
    if(key==='start-choice'){
      const pending=S.md.pendingStart,p=pending&&S.plans.find(p=>p.id===pending.planId);
      if(!p||pending.threadId!==S.threadId)throw Error('请返回发起开始请求的工作，再确认计划。');
      if(arg==='save'){MD.savePlan(p,pending.changes);delete S.panelDrafts['md-plan|'+p.id];}
      delete S.md.pendingStart;closeModal();const message=MD.begin(p,pending.scope,pending.options);addMsg('assistant',message,{},p.threadId);persist();render();return;
    }
    if(key==='repeat-confirm'){
      const p=S.plans.find(p=>p.id===arg);if(!p||p.threadId!==S.threadId)throw Error('请返回此计划所属工作。');
      const original=p.items.find(i=>i.id===p.currentItem)||p.items[0],item={...clone(original),id:uid('item'),status:'pending',title:original.title+' · 另做一份'};delete item.artifactId;
      closeModal();const message=MD.begin(p,'current',{items:[item],repeat:true});addMsg('assistant',message,{},p.threadId);persist();render();return;
    }
    if(key==='reselect-save'){
      const ref=MD.meta().selected.find(r=>r.id===parts[0]);if(!ref)throw Error('请先勾选来源。');
      const selection=[...document.querySelectorAll('[data-md-conclusion]:checked')].map(el=>el.dataset.mdConclusion);
      const resolved=MD.resolve({...ref,revision:+parts[1],selection});Object.assign(ref,{revision:resolved.revision,selection,summary:resolved.summary});persist();MD.show('sources');return;
    }
    if(key.startsWith('item-')){const p=S.plans.find(p=>p.id===parts[0]);Object.assign(p,MD.collectPlan(p));if(key==='item-add')p.items.push({id:uid('item'),title:'另一份工作文档',kind:'marketing-document',input:'本次选用资料',output:'可编辑文档',status:'pending'});if(key==='item-remove')p.items=p.items.filter(i=>i.id!==parts[1]);if(key==='item-up'){const i=p.items.findIndex(i=>i.id===parts[1]);if(i>0)[p.items[i-1],p.items[i]]=[p.items[i],p.items[i-1]];}delete S.panelDrafts[panelKey()];persist();renderModal();return;}
    if(key==='document'){const s=MD.snapshot(S.threadId,'建立普通文档'),a=MD.addResult(S.threadId,MD.produce({kind:'marketing-document',title:'工作文档'},s,m),'marketing-document',s,'user-document');openCanvas(a.id,1);return MD.show('edit',a.id+'|1|');}
    if(key==='edit-save'){const data=MD.collectEdit(arg),v=MD.revise(parts[0],+parts[1],data,'用户编辑指定内容',parts[2]);if(!v)return;delete S.md.editDrafts[arg];delete S.panelDrafts[panelKey()];closeModal();openCanvas(parts[0],v.num);return;}
    if(key==='shorten'){const a=artifact(parts[0]),v=revision(a,+parts[1]),d=clone(v.data),p=d.posts?.find(p=>p.id===parts[2]);if(!p)throw Error('请选定具体文案条目');const sentences=p.body.match(/[^。！？]+[。！？]?/g)||[p.body];p.body=sentences.slice(0,2).join('');if(p.body===v.data.posts.find(x=>x.id===p.id).body)p.body=p.body.slice(0,Math.max(12,Math.floor(p.body.length*.65)))+'…';const next=MD.revise(a.id,v.num,d,'缩短选定条目（确定性文字裁剪演示）',p.id);if(next)openCanvas(a.id,next.num);return;}
    if(key==='project-save'){const name=document.querySelector('#md-project-name').value.trim(),goal=document.querySelector('#md-project-goal').value.trim();if(!name)throw Error('请填写项目名称');let p=project(arg);if(p){p.name=name;p.goal=goal;}else{p={id:uid('project'),name,goal,channels:[],owner:S.actor,contextArtifacts:[],created:now(),marketingProfessional:false};S.projects.push(p);newChat(p.id);p.threadId=S.threadId;}closeModal();persist();render();return;}
    if(key==='artifact-file'||key==='file-export'){const d=key==='file-export'?S.uploads.find(u=>u.id===arg):revision(artifact(parts[0]),+parts[1])?.data.file;if(!d)throw Error('文件不存在');const link=document.createElement('a');link.href=d.dataURL||URL.createObjectURL(new Blob([d.text??''],{type:d.mime||'text/plain'}));link.download=d.name;link.click();if(!d.dataURL)setTimeout(()=>URL.revokeObjectURL(link.href),1000);return;}
    if(key==='file-artifact'){const u=S.uploads.find(u=>u.id===arg);if(!u)throw Error('文件不存在');const s=MD.snapshot(S.threadId,'保存文件成果');s.selected=[MD.resolve({type:'upload',id:u.id,revision:u.revision||1})];const a=MD.addResult(S.threadId,{title:u.name,summary:'原始文件；仅保存本地内容，不推断正文。',file:{name:u.name,mime:u.mime,size:u.size,dataURL:u.dataURL,text:u.text}},'file-attachment',s,'user-document');closeModal();openCanvas(a.id,1);return;}
    if(key==='scope'){S.md.scope=arg;render();persist();return;}
    if(key==='source-scope'){S.md.sourceAll=!S.md.sourceAll;renderModal();return;}
    if(key==='cancel')return MD.cancel(arg);
    if(key==='export')return MD.export(parts[0],parts[1],parts[2]);
    if(key==='followup-preview'){const a=artifact(parts[0]),v=revision(a,+parts[1]),ids=[...document.querySelectorAll('[data-md-conclusion]:checked')].map(el=>el.dataset.mdConclusion);if(!ids.length)throw Error('请选择至少一条要带入的结论');S.md.followupDraft={artifactId:a.id,revision:v.num,title:a.title,ids,summary:v.data.sections.filter(s=>ids.includes(s.id)).map(s=>s.title+'\n'+s.body).join('\n\n'),goal:document.querySelector('#md-followup-goal').value};return MD.show('followup-preview');}
    if(key==='followup-create'){const f=S.md.followupDraft;if(!f)throw Error('请先选择结论');closeModal();newChat();const meta=MD.meta();meta.scene='social';meta.followup=true;meta.goal=f.goal;meta.selected=[{type:'artifact',id:f.artifactId,revision:f.revision,selection:clone(f.ids),summary:f.summary}];addMsg('user',f.goal);addMsg('assistant','带入所选结论：\n'+f.summary+'\n来源：'+f.title+' v'+f.revision,{mdActions:[['制定三条内容计划','plan']]});MD.newPlan().items[0].title='下周三条实用内容计划';delete S.md.followupDraft;persist();render();return;}
    if(key==='launch-de'){seedDemo(S,true);MD.normalize(S);window.V62Inputs.ensure(S);closeModal();enterDemoProject();return;}
    if(key==='import-confirm'){MD.importBackup(window.pendingBackup);delete window.pendingBackup;closeModal();render();toast('备份已合并；重复对象未复制。');return;}
  }catch(e){toast(e.message,true);}
};
document.addEventListener('input',e=>{const el=e.target;if(el.id==='composer'){DRAFTS[el.dataset.threadId||S.threadId]=el.value;persist();}if(el.dataset.mdPath&&MODAL?.kind==='md-edit'){MD.collectEdit(MODAL.arg);persist();}});
document.addEventListener('change',e=>{
  const el=e.target,m=MD.meta();
  if(el.dataset.mdSource){const id=el.dataset.mdSource;if(el.checked){const version=document.querySelector(`[data-md-ref-version="${id}"]`)?.value||1;if(!m.selected.some(r=>r.id===id))m.selected.push({type:el.dataset.type,id,revision:Number(version)});m.excluded=m.excluded.filter(x=>x!==id);}else{m.selected=m.selected.filter(r=>r.id!==id);m.excluded=[...new Set([...m.excluded,id])];}persist();renderModal();}
  if(el.dataset.mdRefVersion){
    const ref=m.selected.find(r=>r.id===el.dataset.mdRefVersion);
    if(ref){ref.revision=Number(el.value);try{const resolved=MD.resolve(ref);if(ref.selection)ref.summary=resolved.summary;}catch(e){toast(e.message,true);}}
    persist();renderModal();toast('所选版本将影响下一次操作；历史成果不变。');
  }
  if(el.id==='md-previous'||el.id==='md-current'){m[el.id.slice(3)]=el.value;persist();}
  if(el.id.startsWith('md-item-kind-')&&MODAL?.kind==='md-plan'){const p=MD.plan();Object.assign(p,MD.collectPlan(p));delete S.panelDrafts[panelKey()];renderModal();}
});
