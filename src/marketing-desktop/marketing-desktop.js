/* Marketing Desktop prototype layer. It intentionally uses deterministic scene
   outputs while keeping local files, revisions, context snapshots and exports real. */
(()=>{
  const MKT_STORAGE_KEY='mokina-marketing-desktop-prototype';
  const MKT_SCHEMA='marketing-desktop-prototype-v1';
  const MKT_NOW=()=>new Date().toISOString();
  const MKT_ID=(prefix='mkt')=>prefix+'_'+Math.random().toString(36).slice(2,10);
  const MKT_ESC=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MKT_DATE=iso=>new Date(iso||Date.now()).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const MKT_FIXTURES=[
    {id:'mkt-brand-renters',scenario:'brand',name:'北岚生活｜年轻租住人群访谈',kind:'访谈纪要',version:1,text:'12 位 23–31 岁租住用户：搬家频繁、空间有限，不愿为“功能堆砌”付费。她们会分享让生活更轻一点的小方法，购买前最在意清洁、收纳和不占地方。',note:'合成资料 · 本轮选用'},
    {id:'mkt-brand-family',scenario:'brand',name:'北岚生活｜有孩子家庭访谈',kind:'访谈纪要',version:1,text:'10 个有孩子家庭：希望家务效率更高，但决策重点是耐用、安全和全家都能用。对“生活方式表达”兴趣较低，倾向看真实口碑与长期价值。',note:'合成资料 · 本轮选用'},
    {id:'mkt-social-facts',scenario:'social',name:'北岚生活｜已确认品牌事实与表达',kind:'品牌事实',version:1,text:'确认事实：模块化收纳、可水洗面料、48 小时发货。表达边界：不承诺“治愈焦虑”、不比较竞品、避免绝对化功效。主张：把生活腾出一点空间。',note:'合成资料 · 本轮选用'},
    {id:'mkt-social-calendar',scenario:'social',name:'九月内容节奏约束',kind:'排期约束',version:1,text:'渠道：小红书与品牌公众号；节奏：每周 1–2 条；目标：收藏与品牌认知；无图片制作与发布授权。',note:'合成资料 · 本轮选用'},
    {id:'mkt-analytics-csv',scenario:'analytics',name:'八月与九月社媒运营样例.csv',kind:'CSV',version:1,text:'period,content_type,impressions,interactions\n2026-08,技巧型,12000,720\n2026-08,故事型,8000,330\n2026-09,技巧型,16000,640\n2026-09,故事型,8000,290',note:'合成 CSV · 可真实计算'}
  ];
  const MKT_SCENES={
    brand:{label:'品牌战略',title:'北岚生活 · 90 天品牌沟通方向',description:'比较年轻租住人群与有孩子家庭，形成沟通选择和两个触点建议。',sources:['mkt-brand-renters','mkt-brand-family']},
    social:{label:'社媒内容',title:'北岚生活 · 九月社媒内容计划',description:'把已有事实与表达直接转换成五条内容和可编辑排期。',sources:['mkt-social-facts','mkt-social-calendar']},
    analytics:{label:'运营分析',title:'北岚生活 · 社媒互动表现分析',description:'导入 CSV，真实计算互动率，并把选定结论接续为内容计划。',sources:['mkt-analytics-csv']}
  };

  const mktBaseState=()=>({
    schema:typeof APP_VERSION==='undefined'?'6.2.0':APP_VERSION,
    marketingSchema:MKT_SCHEMA,marketingDesktop:true,examplesAdded:true,unifiedPlanMigration:true,
    settings:{autoAccept:false},projects:[],threads:[],tasks:[],artifacts:[],submissions:[],deliveries:[],transfers:[],runs:[],activity:[],workModes:{},
    uploads:[],selectedAssets:[],canvas:null,contextSelection:{},filters:{},panelDrafts:{},panelStack:[],threadId:null,projectId:null,tab:'tasks',
    auto:{active:false,stage:0},runId:0,paused:false,
    works:[],plans:[],contextSnapshots:[],mktImportLog:[]
  });
  const mktNormalize=raw=>{
    const fresh=mktBaseState();
    if(!raw||typeof raw!=='object') return fresh;
    const state={...fresh,...raw,marketingSchema:MKT_SCHEMA,marketingDesktop:true,examplesAdded:true};
    for(const key of ['projects','threads','tasks','artifacts','submissions','deliveries','transfers','runs','activity','uploads','selectedAssets','works','plans','contextSnapshots','mktImportLog']){
      if(!Array.isArray(state[key])) state[key]=[];
    }
    state.works=state.works.map(w=>({...w,context:w.context||{selected:[],excluded:[]},createdAt:w.createdAt||MKT_NOW(),updatedAt:w.updatedAt||MKT_NOW()}));
    if(!state.workModes||typeof state.workModes!=='object') state.workModes={};
    state.works.forEach(w=>{state.workModes[w.id]??='collaborate'});
    state.artifacts=state.artifacts.map(a=>({...a,workId:a.workId||a.threadId||null,versions:Array.isArray(a.versions)?a.versions:[],active:a.active||1,accepted:a.accepted||0}));
    if(state.canvas?.artifactId) state.canvas={id:state.canvas.artifactId,num:state.canvas.version||1,tab:state.canvas.tab||'content'};
    if(state.canvas) state.view='chat';
    return state;
  };
  const mktRestore=()=>{
    try{return mktNormalize(JSON.parse(localStorage.getItem(MKT_STORAGE_KEY)||'null'))}catch(_){return mktBaseState()}
  };
  const mktPersist=()=>{
    try{localStorage.setItem(MKT_STORAGE_KEY,JSON.stringify(S))}catch(err){console.warn('Marketing Desktop storage failed',err)}
  };
  const mktWork=id=>S.works.find(w=>w.id===id);
  const mktCurrent=()=>mktWork(S.threadId);
  const mktArtifacts=workId=>S.artifacts.filter(a=>a.workId===workId);
  const mktArtifact=id=>S.artifacts.find(a=>a.id===id);
  const mktVersion=(a,num)=>a?.versions.find(v=>v.num===Number(num))||a?.versions?.[0];
  const mktSource=id=>S.uploads.find(x=>x.id===id)||MKT_FIXTURES.find(x=>x.id===id);
  const mktSources=work=>((work?.context?.selected)||[]).map(mktSource).filter(Boolean);
  const mktSnapshot=(work,reason)=>{
    const refs=mktSources(work).map(x=>({id:x.id,name:x.name,kind:x.kind,version:x.version||1,text:x.text||'',length:(x.text||'').length}));
    const snapshot={id:MKT_ID('snap'),workId:work.id,reason,at:MKT_NOW(),excluded:[...(work.context?.excluded||[])],refs};
    S.contextSnapshots.push(snapshot);
    return snapshot;
  };
  const mktLog=(type,detail,workId=S.threadId)=>S.activity.unshift({id:MKT_ID('log'),type,detail,workId,at:MKT_NOW()});
  const mktThreadFor=work=>({id:work.id,projectId:work.projectId||null,title:work.name,messages:work.messages||[],createdAt:work.createdAt});

  function mktCreateWork(scene='general',opts={}){
    const preset=MKT_SCENES[scene];
    const now=MKT_NOW();
    const work={id:MKT_ID('work'),name:opts.name||preset?.title||'未命名营销工作',scene,mode:opts.mode||'自由工作',goal:opts.goal||preset?.description||'',projectId:opts.projectId||null,
      context:{selected:[...(preset?.sources||[])],excluded:[]},createdAt:now,updatedAt:now,messages:[],status:'进行中'};
    S.works.unshift(work);S.threads.unshift(mktThreadFor(work));S.threadId=work.id;S.projectId=work.projectId;S.tab='tasks';S.view='tasks';S.canvas=null;S.artifactWorkspace=null;
    mktLog('work-created',work.name,work.id);mktPersist();return work;
  }
  function mktEnsureWork(scene='general'){
    const active=mktCurrent();
    return active||mktCreateWork(scene);
  }
  function mktAddMessage(work,role,text){
    work.messages=work.messages||[];
    work.messages.push({id:MKT_ID('msg'),role,text,at:MKT_NOW()});
    const linked=S.threads.find(t=>t.id===work.id);if(linked) linked.messages=work.messages;
    work.updatedAt=MKT_NOW();
  }
  function mktPlanFor(work){return S.plans.find(p=>p.workId===work.id)}
  function mktMakePlan(work){
    const scene=work.scene;
    const templates={
      brand:[
        ['界定沟通目标','90 天内建立“腾出一点空间”的可理解主张','访谈资料','目标、受众取舍与排除项'],
        ['比较受众与证据','比较两类人群的情境、动机和进入门槛','两份访谈','受众选择说明；不生成产品上市链路'],
        ['形成策略备忘录','确定沟通方向、触点建议与验证口径','已选资料','品牌策略备忘录 + 可选对照方案']
      ],
      social:[
        ['确认表达边界','锁定事实、语气及禁止表达','品牌事实与排期约束','内容约束清单'],
        ['形成五条内容','按不同角度写五条可编辑文案','已确认事实','五条内容草案'],
        ['编排节奏','按条目安排渠道与发布时间','内容草案','可编辑排期表与 CSV']
      ],
      analytics:[
        ['读取原始 CSV','检查字段、数值与分母','CSV 文件','不可变原始数据与校验结果'],
        ['计算表现变化','按周期聚合互动率并看内容类型','通过校验的数据','分析结论与限制'],
        ['带入下一项工作','仅选择必要结论创建内容计划','用户选定结论','新工作中的内容计划输入']
      ],
      general:[
        ['明确目标','记录本次要解决的问题','用户输入','工作目标与排除项'],
        ['选择依据','选择本轮资料并固定版本','本地资料','依据快照'],
        ['形成成果','创建可编辑、可版本化的成果','已选依据','成果与下一步']
      ]
    };
    const steps=(templates[scene]||templates.general).map(([title,goal,input,output],i)=>({id:'step_'+(i+1),title,goal,input,output,excluded:'不自动创建无关的产品上市步骤',status:i===0?'ready':'draft'}));
    const plan={id:MKT_ID('plan'),workId:work.id,title:(MKT_SCENES[scene]?.label||'营销')+'工作计划',goal:work.goal,steps,createdAt:MKT_NOW(),updatedAt:MKT_NOW()};
    S.plans=S.plans.filter(p=>p.workId!==work.id);S.plans.push(plan);mktLog('plan-saved',plan.title,work.id);return plan;
  }
  function mktCreateArtifact(work,kind,data,title){
    const snapshot=mktSnapshot(work,'创建 '+title);
    const artifact={id:MKT_ID('artifact'),workId:work.id,projectId:work.projectId||null,kind,title,origin:'scene-demo',createdAt:MKT_NOW(),active:1,accepted:0,
      versions:[{id:MKT_ID('version'),num:1,createdAt:MKT_NOW(),label:'初稿',source:'情景演示 · 结果可编辑',data,refs:snapshot.refs,snapshotId:snapshot.id}]};
    S.artifacts.unshift(artifact);mktLog('artifact-created',title,work.id);return artifact;
  }
  function mktReviseArtifact(artifact,data,label='修订候选'){
    const current=mktVersion(artifact,artifact.active);
    const next={...current,id:MKT_ID('version'),num:Math.max(...artifact.versions.map(v=>v.num))+1,createdAt:MKT_NOW(),label,data,refs:[...current.refs]};
    artifact.versions.push(next);artifact.active=next.num;mktLog('artifact-revised',artifact.title,artifact.workId);return next;
  }
  function mktBrandData(variant=false){return {type:'document',sections:[
    {id:'audience',heading:'受众选择',text:variant?'将有孩子家庭作为对照受众：以安全、耐用和全家可用为核心，适合口碑型内容验证。':'优先年轻租住人群。她们与“腾出一点空间”有直接的日常张力，也更愿意分享轻量、可复制的生活方法。'},
    {id:'direction',heading:'90 天沟通方向',text:variant?'“让家务少占一点心力”：从可靠与省心建立信任，再补充生活秩序感。':'“把生活腾出一点空间”：不把产品说成拯救者，而是呈现它如何替用户留出一点行动与呼吸的余地。'},
    {id:'touchpoints',heading:'两个触点建议',items:variant?['家庭决策前：真实长期使用问答，回应安全与耐用疑虑。','入住后的 7 天：以收纳和清洁习惯形成低压力复购/口碑提醒。']:['搬家或换租房时：用“空间重新开始”的收纳清单进入真实情境。','工作日晚上：邀请分享一个被腾出来的 20 分钟，累积真实微故事。']},
    {id:'boundary',heading:'本轮排除项',text:'不创建产品项目、不要求 SKU，不生成 FABE、Message House 或任何发布待办。'}
  ]};}
  function mktSocialData(){return {type:'social',items:[
    {id:'post_1',week:'第 1 周',channel:'小红书',angle:'租房收纳',copy:'不是把家塞满，才叫过日子。留一格给刚搬来的你，也留一点空间给今天的自己。'},
    {id:'post_2',week:'第 1 周',channel:'公众号',angle:'品牌主张',copy:'把生活腾出一点空间，不是做得更多，而是让每一件常用的事少占一点心力。'},
    {id:'post_3',week:'第 2 周',channel:'小红书',angle:'可水洗面料',copy:'有些生活痕迹不用藏起来：可水洗的面料，留给周末、朋友和不小心打翻的下午。'},
    {id:'post_4',week:'第 3 周',channel:'小红书',angle:'模块化收纳',copy:'搬家不必从头整理。模块化收纳跟着你的生活变，不让空间先替你做决定。'},
    {id:'post_5',week:'第 4 周',channel:'公众号',angle:'48 小时发货',copy:'决定把生活理顺的那一刻，不必等太久。48 小时发货，让小改变尽快发生。'}
  ],boundary:'无图片制作、无发布动作；文案是演示结果，可逐条编辑。'};}
  function mktParseCsv(text){
    const lines=String(text||'').trim().split(/\r?\n/).filter(Boolean);
    if(lines.length<2) throw new Error('CSV 至少需要表头和一行数据。');
    const headers=lines[0].split(',').map(x=>x.trim());
    const required=['period','content_type','impressions','interactions'];
    const missing=required.filter(x=>!headers.includes(x));if(missing.length) throw new Error('CSV 缺少字段：'+missing.join('、'));
    const rows=lines.slice(1).map((line,index)=>{
      const cells=line.split(',').map(x=>x.trim());if(cells.length!==headers.length) throw new Error('第 '+(index+2)+' 行字段数与表头不一致。');
      const row=Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));
      for(const key of ['impressions','interactions']){row[key]=Number(row[key]);if(!Number.isFinite(row[key])||row[key]<0) throw new Error('第 '+(index+2)+' 行 '+key+' 必须为非负数。');}
      if(!row.period||!row.content_type) throw new Error('第 '+(index+2)+' 行 period 和 content_type 不能为空。');return row;
    });
    const periods={};rows.forEach(r=>{const p=periods[r.period]||{period:r.period,impressions:0,interactions:0};p.impressions+=r.impressions;p.interactions+=r.interactions;periods[r.period]=p;});
    const totals=Object.values(periods).sort((a,b)=>a.period.localeCompare(b.period)).map(p=>{if(p.impressions===0) throw new Error(p.period+' 的曝光量为 0，无法计算互动率。');return {...p,rate:p.interactions/p.impressions*100};});
    if(totals.length<2) throw new Error('至少需要两个周期，才能比较变化。');
    const before=totals[0],after=totals[totals.length-1],change=after.rate-before.rate;
    const type={};rows.forEach(r=>{const k=r.content_type+'|'+r.period;const item=type[k]||{content_type:r.content_type,period:r.period,impressions:0,interactions:0};item.impressions+=r.impressions;item.interactions+=r.interactions;type[k]=item;});
    const byType=Object.values(type).map(x=>({...x,rate:x.impressions?x.interactions/x.impressions*100:null}));
    return {rows,totals,before,after,change,byType};
  }
  function mktAnalyticsData(result){return {type:'analytics',result,sections:[
    {id:'headline',heading:'总体互动率',text:result.before.rate.toFixed(3)+'% → '+result.after.rate.toFixed(3)+'%，下降 '+Math.abs(result.change).toFixed(3)+' 个百分点。'},
    {id:'interpretation',heading:'可确认与不可确认',text:'可确认：整体加权互动率下降。不可确认：不能据此判断“技巧型”和“故事型”两类内容都变差；需要分别看曝光与互动的构成。'},
    {id:'next',heading:'可带入下一项工作',text:'选择“强调保存价值而非泛互动”作为内容计划输入，并保留原 CSV 与完整分析在本工作。'}
  ]};}
  function mktGenerate(scene){
    scene=MKT_SCENES[scene]?scene:'general';
    const work=mktEnsureWork(scene);work.scene=scene;
    const plan=mktPlanFor(work)||mktMakePlan(work);
    let artifact;
    if(scene==='brand') artifact=mktCreateArtifact(work,'brandStrategy',mktBrandData(false),'北岚生活 · 品牌策略备忘录');
    if(scene==='social') artifact=mktCreateArtifact(work,'socialPlan',mktSocialData(),'北岚生活 · 九月社媒内容计划');
    if(scene==='analytics'){
      const csv=mktSources(work).find(x=>x.kind==='CSV')||mktSource('mkt-analytics-csv');
      try{artifact=mktCreateArtifact(work,'marketingAnalysis',mktAnalyticsData(mktParseCsv(csv.text)),'北岚生活 · 社媒互动表现分析')}catch(err){toast(err.message,'error');return}
    }
    plan.steps.forEach((x,i)=>x.status=i===plan.steps.length-1?'ready':'done');
    mktAddMessage(work,'assistant','已按“'+MKT_SCENES[scene].label+'”场景生成可编辑成果。本轮依据已固定；调整资料只影响下一次创建。');
    mktPersist();openCanvas(artifact.id,1,'content');
  }
  function mktScenario(scene){
    scene=MKT_SCENES[scene]?scene:'general';
    const work=mktCreateWork(scene);mktAddMessage(work,'assistant','已建立“'+(MKT_SCENES[scene]?.label||'通用')+'”工作，并预选本轮合成资料。你可以先调整计划或直接生成演示成果。');
    mktMakePlan(work);mktPersist();render();
  }
  function mktCurrentCSV(){
    const work=mktCurrent();return mktSources(work).find(x=>/csv/i.test(x.kind||'')||/\.csv$/i.test(x.name||''));
  }
  function mktSend(text){
    const work=mktEnsureWork('general');const clean=String(text||'').trim();if(!clean) return;
    mktAddMessage(work,'user',clean);
    const lowered=clean.toLowerCase();
    const canvasArtifact=mktArtifact(S.canvas?.id);
    if(/为什么|依据|why/.test(lowered)&&canvasArtifact){
      const version=mktVersion(canvasArtifact,S.canvas.num);
      mktAddMessage(work,'assistant','这是解释，不会新增版本：当前选择基于 '+version.refs.map(r=>'《'+r.name+'》').join('、')+'。它们支持该判断，但不替代真实用户研究。');
    }else if(/对照方案|第二方案|保留方向/.test(clean)&&canvasArtifact?.kind==='brandStrategy'){
      const other=mktCreateArtifact(work,'brandStrategy',mktBrandData(true),'北岚生活 · 品牌策略备忘录（家庭对照）');
      mktAddMessage(work,'assistant','已保留原方向，并新增独立的“有孩子家庭”对照方案。');openCanvas(other.id,1,'content');
    }else if(/csv|互动率|运营分析/.test(lowered)){
      if(!mktCurrentCSV()){mktAddMessage(work,'assistant','请先导入包含 period、content_type、impressions、interactions 的 CSV；我会在本地计算，不把原始数据写回。');}
      else mktGenerate('analytics');
    }else if(/社媒|内容|文案|排期/.test(clean)){mktGenerate('social');
    }else if(/品牌|受众|战略|沟通/.test(clean)){mktGenerate('brand');
    }else{mktAddMessage(work,'assistant','已记录目标。此原型只对已覆盖场景给出情景演示；你可以编辑计划、选择资料，或从品牌战略、社媒内容、运营分析中开始。');}
    mktPersist();render();
  }
  function mktToggleSource(id){
    const work=mktCurrent();if(!work) return;
    const selected=work.context.selected||[];work.context.selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];
    work.context.excluded=MKT_FIXTURES.filter(x=>x.scenario===work.scene).map(x=>x.id).filter(x=>!work.context.selected.includes(x));
    mktLog('context-changed',mktSource(id)?.name||id,work.id);mktPersist();render();
  }
  async function mktHandleFiles(files){
    const work=mktEnsureWork('analytics');
    for(const file of [...files]){
      const name=file.name||'本地文件';const text=await file.text();
      const item={id:MKT_ID('upload'),name,kind:/\.csv$/i.test(name)?'CSV':'本地正文',version:1,text,workId:work.id,createdAt:MKT_NOW(),readonly:/\.csv$/i.test(name)};
      S.uploads.unshift(item);work.context.selected=[...(work.context.selected||[]),item.id];
      if(item.kind==='CSV'){try{mktParseCsv(text);toast('已载入本地 CSV，可开始分析。','success')}catch(err){toast(err.message,'error')}}
    }
    mktPersist();render();
  }
  function mktOpenEdit(id){
    const a=mktArtifact(id);if(!a)return;const v=mktVersion(a,a.active);
    const fields=v.data.type==='social'?v.data.items.map(x=>({id:x.id,label:x.week+' · '+x.channel+' · '+x.angle,value:x.copy})):v.data.sections.map(x=>({id:x.id,label:x.heading,value:x.text||((x.items||[]).join('\n'))}));
    S.modal={kind:'mkt-edit',artifactId:a.id,fields};showModal('mkt-edit',a.id);
  }
  function mktSaveEdit(){
    const modal=S.modal,a=mktArtifact(modal?.artifactId);if(!a)return;
    const values={};modal.fields.forEach(f=>{const el=document.getElementById('mkt-field-'+f.id);values[f.id]=el?.value??f.value;});
    const source=mktVersion(a,a.active).data;let data;
    if(source.type==='social') data={...source,items:source.items.map(x=>({...x,copy:values[x.id]}))};
    else data={...source,sections:source.sections.map(x=>({...x,text:values[x.id]??x.text,items:x.items?String(values[x.id]??x.items.join('\n')).split('\n').filter(Boolean):x.items}))};
    mktReviseArtifact(a,data,'手动修订候选');S.modal=null;closeModal();mktPersist();render();toast('已保存为候选版本，原版仍可查看。','success');
  }
  function mktAdopt(id,num){
    const a=mktArtifact(id);if(!a)return;a.accepted=Number(num);a.active=Number(num);mktLog('version-adopted',a.title,a.workId);mktPersist();render();toast('已采用版本 '+num+'；没有触发发布或外部提交。','success');
  }
  function mktExport(id){
    const a=mktArtifact(id);if(!a)return;const v=mktVersion(a,a.active),d=v.data;
    if(d.type==='social'){
      const csv=['week,channel,angle,copy',...d.items.map(x=>[x.week,x.channel,x.angle,x.copy].map(value=>'"'+String(value).replaceAll('"','""')+'"').join(','))].join('\n');
      mktDownload(a.title+'.csv',csv,'text/csv;charset=utf-8');toast('已生成本地 CSV 下载。','success');return;
    }
    const text=(d.sections||[]).map(s=>s.heading+'\n'+(s.text||s.items?.join('\n')||'')).join('\n\n')+'\n\n依据快照：'+v.refs.map(r=>r.name+' v'+r.version).join('；');
    mktDownload(a.title+'.txt',text,'text/plain;charset=utf-8');toast('已生成本地文本下载。','success');
  }
  function mktNewFollowup(){
    const source=mktArtifact(S.canvas?.id);if(!source)return;
    const v=mktVersion(source,S.canvas.num);const work=mktCreateWork('social',{name:'基于分析结论的内容计划',goal:'将用户选定的结论用于下一轮内容计划'});
    const selected={id:MKT_ID('carry'),name:'来自「'+source.title+'」的选定结论',kind:'成果摘录',version:v.num,text:'选定结论：强调保存价值而非泛互动。来源版本 '+v.num+'；原分析和 CSV 保留在原工作。',workId:work.id,createdAt:MKT_NOW()};
    S.uploads.unshift(selected);work.context.selected=[selected.id];mktMakePlan(work);mktAddMessage(work,'assistant','已新建独立内容计划工作，仅带入你选定的结论和必要摘要。');mktPersist();render();
  }
  const mktRenderDoc=data=>{
    if(data.type==='social') return '<table class="mkt-table"><thead><tr><th>节奏</th><th>渠道</th><th>角度</th><th>文案</th></tr></thead><tbody>'+data.items.map(x=>'<tr><td>'+MKT_ESC(x.week)+'</td><td>'+MKT_ESC(x.channel)+'</td><td>'+MKT_ESC(x.angle)+'</td><td>'+MKT_ESC(x.copy)+'</td></tr>').join('')+'</tbody></table><div class="mkt-callout">'+MKT_ESC(data.boundary)+'</div>';
    if(data.type==='analytics'){
      const r=data.result;return '<table class="mkt-table"><thead><tr><th>周期</th><th>曝光</th><th>互动</th><th>互动率</th></tr></thead><tbody>'+r.totals.map(x=>'<tr><td>'+x.period+'</td><td>'+x.impressions+'</td><td>'+x.interactions+'</td><td>'+x.rate.toFixed(3)+'%</td></tr>').join('')+'</tbody></table>'+data.sections.map(s=>'<h2>'+MKT_ESC(s.heading)+'</h2><p>'+MKT_ESC(s.text)+'</p>').join('');
    }
    return data.sections.map(s=>'<h2>'+MKT_ESC(s.heading)+'</h2>'+(s.items?'<ul>'+s.items.map(x=>'<li>'+MKT_ESC(x)+'</li>').join('')+'</ul>':'<p>'+MKT_ESC(s.text)+'</p>')).join('');
  };

  const MKT_PREVIOUS={render,headerHTML,sidebarHTML,homeHTML,tasksHTML,libraryHTML,filesHTML,contentHTML,refsHTML,artifactCard,handle,sendPrompt,handleFiles,renderModal};
  Object.assign(KIND,{brandStrategy:{name:'品牌策略备忘录',domain:'strategy'},socialPlan:{name:'社媒内容计划',domain:'content'},marketingAnalysis:{name:'运营分析',domain:'research'},marketingDoc:{name:'营销文档',domain:'other'}});

  headerHTML=()=>{const w=mktCurrent();return '<header class="topbar"><div class="mkt-brand"><span class="mkt-brand-mark">M</span>Marketing Desktop</div><div class="topbar-center">'+(w?'<span class="mkt-work-chip"><i class="mkt-dot"></i>'+MKT_ESC(w.name)+'</span>':'<span class="mkt-work-chip">选择或新建一项工作</span>')+'</div><div class="topbar-actions"><button class="btn" data-action="mkt-new-work">新建工作</button><a class="btn" href="Lilith SpaceMaster Demo V6.html">V6.2 专业流程</a></div></header>'};
  sidebarHTML=()=>{
    const workItems=S.works.slice(0,8).map(w=>'<div class="mkt-sidebar-work '+(w.id===S.threadId?'active':'')+'" data-action="mkt-switch-work" data-arg="'+w.id+'"><strong>'+MKT_ESC(w.name)+'</strong><span>'+MKT_ESC(MKT_SCENES[w.scene]?.label||'通用工作')+' · '+MKT_DATE(w.updatedAt)+'</span></div>').join('');
    return '<aside class="sidebar"><div class="sidebar-top"><button class="new-chat" data-action="mkt-new-work">＋ 新建工作</button></div><nav class="nav"><button class="nav-item '+(S.tab==='tasks'?'active':'')+'" data-action="mkt-nav" data-arg="tasks">当前工作</button><button class="nav-item '+(S.tab==='library'?'active':'')+'" data-action="mkt-nav" data-arg="library">全部成果</button><button class="nav-item '+(S.tab==='files'?'active':'')+'" data-action="mkt-nav" data-arg="files">本次依据</button></nav><div class="mkt-nav-title">最近工作</div>'+workItems+'<div class="mkt-nav-title">资料与恢复</div><nav class="nav"><button class="nav-item" data-action="mkt-import-backup">导入备份</button><button class="nav-item" data-action="mkt-export-backup">导出备份</button></nav></aside>';
  };
  homeHTML=()=>'<main id="main-work" class="mkt-home"><div class="mkt-eyebrow">通用 Marketing Agent · 本地原型</div><div class="mkt-hero"><h1>从一项营销工作开始，<br>而不是从一条固定流程开始。</h1><p>工作、计划、依据快照和成果版本使用同一套结构。文本、CSV、编辑、版本和恢复在本地真实执行；判断与生成明确为情景演示。</p></div><div class="mkt-quick-grid">'+Object.entries(MKT_SCENES).map(([id,x],i)=>'<button class="mkt-quick" data-action="mkt-scenario" data-arg="'+id+'"><span class="mkt-index">0'+(i+1)+'</span><h3>'+x.label+'</h3><p>'+x.description+'</p></button>').join('')+'</div><div class="mkt-fact-strip"><div><strong>本轮选用</strong>资料版本在每次成果创建时固定。</div><div><strong>已载入本地正文</strong>文本文件和 CSV 可读、可算、可恢复。</div><div><strong>情景演示</strong>策略与文案是可选择、可编辑的示例结果。</div></div></main>';
  tasksHTML=()=>{
    const w=mktCurrent();if(!w)return homeHTML();const plan=mktPlanFor(w),arts=mktArtifacts(w.id);
    const scenePicker=!MKT_SCENES[w.scene]?'<div class="mkt-btns"><button class="mkt-btn" data-action="mkt-start-scene" data-arg="brand">品牌战略</button><button class="mkt-btn" data-action="mkt-start-scene" data-arg="social">社媒内容</button><button class="mkt-btn" data-action="mkt-start-scene" data-arg="analytics">运营分析</button></div>':'';
    return '<main id="main-work" class="mkt-main"><div class="mkt-heading"><div><div class="mkt-eyebrow">'+MKT_ESC(MKT_SCENES[w.scene]?.label||'通用工作')+' · '+MKT_ESC(w.mode)+'</div><h1>'+MKT_ESC(w.name)+'</h1><p>'+MKT_ESC(w.goal||'尚未填写目标')+'</p></div><div class="mkt-btns"><button class="mkt-btn" data-action="mkt-edit-plan">调整计划</button><button class="mkt-btn primary" data-action="mkt-generate" data-arg="'+w.scene+'">生成演示成果</button></div></div>'+scenePicker+'<div class="mkt-work-grid"><section class="mkt-panel"><div class="mkt-heading"><div><h2>工作计划</h2><p>保存计划不会生成成果。</p></div><span class="mkt-status '+(plan?'ready':'draft')+'">'+(plan?'已保存':'未保存')+'</span></div>'+(plan?plan.steps.map((x,i)=>'<div class="mkt-plan-row"><span class="mkt-step">'+(i+1)+'</span><div><strong>'+MKT_ESC(x.title)+'</strong><p>目标：'+MKT_ESC(x.goal)+'<br>输入：'+MKT_ESC(x.input)+' · 输出：'+MKT_ESC(x.output)+'</p></div><span class="mkt-status '+x.status+'">'+(x.status==='done'?'已完成':x.status==='ready'?'可开始':'草稿')+'</span></div>').join(''):'<div class="mkt-empty"><h2>先保存一份计划</h2><p>计划只固定目标、输入、输出和排除项。</p><button class="mkt-btn accent" data-action="mkt-save-plan">保存计划</button></div>')+'</section><aside class="mkt-panel"><div class="mkt-heading"><div><h2>当前工作成果</h2><p>共 '+arts.length+' 份，互不串用。</p></div></div><div class="mkt-artifact-list">'+(arts.length?arts.map(mktArtifactCard).join(''):'<div class="mkt-empty">还没有成果。<br>可先调整计划，再开始。</div>')+'</div></aside></div></main>';
  };
  const mktArtifactCard=a=>{const v=mktVersion(a,a.active);return '<article class="mkt-artifact" data-action="mkt-open-artifact" data-arg="'+a.id+'"><div class="type">'+MKT_ESC(KIND[a.kind]?.name||'未知成果')+'</div><h3>'+MKT_ESC(a.title)+'</h3><p>版本 '+v.num+' · '+MKT_DATE(v.createdAt)+(a.accepted?' · 已采用 v'+a.accepted:'')+'</p></article>'};
  artifactCard=a=>mktArtifactCard(a);
  libraryHTML=()=>'<main id="main-work" class="mkt-main"><div class="mkt-heading"><div><div class="mkt-eyebrow">项目全部工作</div><h1>全部成果</h1><p>按所属工作定位；不按“最新同类型成果”猜测。</p></div></div><div class="mkt-artifact-list">'+(S.artifacts.length?S.artifacts.map(a=>'<div><span class="mkt-work-chip">'+MKT_ESC(mktWork(a.workId)?.name||'历史／项目共享成果')+'</span>'+mktArtifactCard(a)+'</div>').join(''):'<div class="mkt-empty"><h2>尚无成果</h2><p>创建一项工作后，成果会在这里保留。</p></div>')+'</div></main>';
  filesHTML=()=>{
    const w=mktCurrent();if(!w)return homeHTML();const all=[...MKT_FIXTURES.filter(x=>x.scenario===w.scene),...S.uploads.filter(x=>x.workId===w.id)];
    const selected=mktSources(w),snap=S.contextSnapshots.filter(x=>x.workId===w.id).at(-1);
    return '<main id="main-work" class="mkt-main"><div class="mkt-heading"><div><div class="mkt-eyebrow">工作依据</div><h1>本轮选用的资料</h1><p>调整选择只影响下一次操作；已有成果保留创建时的引用。</p></div><div class="mkt-btns"><button class="mkt-btn" data-action="choose-files">导入本地文件</button>'+(w.scene==='analytics'?'<button class="mkt-btn primary" data-action="mkt-generate" data-arg="analytics">计算 CSV</button>':'')+'</div></div><section class="mkt-panel">'+all.map(x=>'<div class="mkt-source"><label><input type="checkbox" '+(w.context.selected.includes(x.id)?'checked':'')+' data-action="mkt-toggle-source" data-arg="'+x.id+'"><span><strong>'+MKT_ESC(x.name)+'</strong><span>'+MKT_ESC(x.kind)+' · '+MKT_ESC(x.note||'已载入本地正文')+'</span></span></label><button class="mkt-btn" data-action="mkt-preview-source" data-arg="'+x.id+'">查看正文</button></div>').join('')+'</section>'+(snap?'<div class="mkt-snapshot"><strong>最近一次依据快照：</strong>'+MKT_ESC(snap.reason)+' · '+snap.refs.map(x=>x.name+' v'+x.version).join('；')+(snap.excluded.length?' · 排除 '+snap.excluded.length+' 项':'')+'</div>':'<div class="mkt-snapshot">尚未创建成果，当前选择会成为下一次操作的依据。</div>')+'</main>';
  };
  contentHTML=(a,v)=>{
    if(!a||!v)return '<div class="mkt-empty">未找到该成果版本。</div>';
    const versions=[...a.versions].sort((x,y)=>y.num-x.num).map(x=>'<button class="mkt-version '+(x.num===v.num?'active':'')+'" data-action="mkt-open-artifact-version" data-arg="'+a.id+'|'+x.num+'">v'+x.num+' · '+MKT_ESC(x.label)+'<br><span>'+MKT_DATE(x.createdAt)+'</span></button>').join('');
    return '<div class="mkt-canvas"><div class="mkt-canvas-top"><div><div class="mkt-eyebrow">'+MKT_ESC(KIND[a.kind]?.name||'未知成果')+' · '+MKT_ESC(a.origin==='scene-demo'?'情景演示':'本地文档')+'</div><h1>'+MKT_ESC(a.title)+'</h1><p>所属工作：'+MKT_ESC(mktWork(a.workId)?.name||'历史／项目共享成果')+' · '+MKT_ESC(v.source)+'</p></div><div class="mkt-btns"><button class="mkt-btn" data-action="mkt-edit-artifact" data-arg="'+a.id+'">编辑为候选</button><button class="mkt-btn" data-action="mkt-export" data-arg="'+a.id+'">导出</button>'+(a.kind==='marketingAnalysis'?'<button class="mkt-btn accent" data-action="mkt-followup">带入内容计划</button>':'')+'</div></div><div class="mkt-work-grid"><article class="mkt-document">'+mktRenderDoc(v.data)+'<div class="mkt-callout">依据快照：'+v.refs.map(r=>MKT_ESC(r.name)+' v'+r.version).join('；')+'。这是创建时固定的引用。</div></article><aside class="mkt-panel"><h3>版本与决定</h3>'+versions+(a.accepted?'<div class="mkt-callout">已采用 v'+a.accepted+'。内部采用不代表正式发布或外部提交。</div>':'<button class="mkt-btn primary" data-action="mkt-adopt" data-arg="'+a.id+'|'+v.num+'">采用当前版本</button>')+'</aside></div></div>';
  };
  refsHTML=(a,v)=>'<div class="mkt-canvas"><div class="mkt-heading"><div><div class="mkt-eyebrow">引用与依据</div><h1>创建时的依据快照</h1><p>该版本不随当前资料选择变化。</p></div></div><section class="mkt-panel"><table class="mkt-info-table">'+v.refs.map(r=>'<tr><td>'+MKT_ESC(r.name)+'</td><td>'+MKT_ESC(r.kind)+' · v'+r.version+' · '+r.length+' 字符</td></tr>').join('')+'</table></section></div>';
  renderModal=()=>{
    if(MODAL?.kind==='mkt-edit')return document.querySelector('#modal-root').innerHTML='<div class="modal-backdrop"><section class="modal mkt-modal-fields" role="dialog" aria-modal="true"><div class="modal-head"><h2>编辑为候选版本</h2><button class="icon-btn" data-action="modal-close">×</button></div><p class="modal-copy">保存会新增版本，不改写当前版本。</p>'+S.modal.fields.map(f=>'<label for="mkt-field-'+f.id+'">'+MKT_ESC(f.label)+'</label><textarea id="mkt-field-'+f.id+'">'+MKT_ESC(f.value)+'</textarea>').join('')+'<div class="modal-actions"><button class="btn" data-action="modal-close">取消</button><button class="btn primary" data-action="mkt-save-edit">保存候选</button></div></section></div>';
    if(MODAL?.kind==='mkt-preview-source'){const x=mktSource(S.modal.sourceId);return document.querySelector('#modal-root').innerHTML='<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>'+MKT_ESC(x?.name)+'</h2><button class="icon-btn" data-action="modal-close">×</button></div><pre class="raw-preview">'+MKT_ESC(x?.text)+'</pre><div class="modal-actions"><button class="btn primary" data-action="modal-close">关闭</button></div></section></div>'}
    return MKT_PREVIOUS.renderModal();
  };
  handleFiles=mktHandleFiles;
  sendPrompt=mktSend;
  handle=async(action,arg,extra)=>{
    if(action==='mkt-new-work'){mktCreateWork('general');render();return}
    if(action==='mkt-scenario'){mktScenario(arg);return}
    if(action==='mkt-start-scene'){mktScenario(arg);return}
    if(action==='mkt-switch-work'){S.threadId=arg;S.projectId=mktWork(arg)?.projectId||null;S.tab='tasks';mktPersist();render();return}
    if(action==='mkt-nav'){S.tab=arg;mktPersist();render();return}
    if(action==='mkt-save-plan'){mktMakePlan(mktEnsureWork());mktPersist();render();toast('计划已保存；尚未生成成果。','success');return}
    if(action==='mkt-edit-plan'){const w=mktCurrent();if(w){mktMakePlan(w);mktPersist();render();toast('已用当前目标重新保存计划。','success')}return}
    if(action==='mkt-generate'){mktGenerate(arg||mktCurrent()?.scene||'general');return}
    if(action==='mkt-open-artifact'){const a=mktArtifact(arg);if(a)openCanvas(a.id,a.active,'content');return}
    if(action==='mkt-open-artifact-version'){const [id,num]=String(arg).split('|');const a=mktArtifact(id);if(a)openCanvas(a.id,Number(num),'content');return}
    if(action==='mkt-edit-artifact'){mktOpenEdit(arg);return}
    if(action==='mkt-save-edit'){mktSaveEdit();return}
    if(action==='mkt-adopt'){const [id,num]=String(arg).split('|');mktAdopt(id,num);return}
    if(action==='mkt-export'){mktExport(arg);return}
    if(action==='mkt-followup'){mktNewFollowup();return}
    if(action==='mkt-toggle-source'){mktToggleSource(arg);return}
    if(action==='mkt-preview-source'){S.modal={kind:'mkt-preview-source',sourceId:arg};showModal('mkt-preview-source',arg);return}
    if(action==='mkt-import-backup'){const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{mktImport(JSON.parse(await file.text()));toast('备份已合并导入。','success')}catch(err){toast('导入失败：'+err.message,'error')}};input.click();return}
    if(action==='mkt-export-backup'){mktDownload('marketing-desktop-backup.json',JSON.stringify(S,null,2),'application/json');return}
    return MKT_PREVIOUS.handle(action,arg,extra);
  };
  function mktDownload(name,data,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function mktImport(raw){
    const incoming=mktNormalize(raw);const merge=(key)=>{const ids=new Set(S[key].map(x=>x.id));S[key].push(...incoming[key].filter(x=>!ids.has(x.id)))};
    ['works','threads','artifacts','uploads','plans','contextSnapshots','activity','projects','tasks','submissions'].forEach(merge);
    S.mktImportLog.push({id:MKT_ID('import'),at:MKT_NOW(),sourceSchema:raw.marketingSchema||raw.schema||'legacy'});mktPersist();render();
  }
  function mktInstall(){
    S=mktRestore();persist=mktPersist;
    const nativeRender=render;
    render=()=>{if(!S.marketingDesktop)S=mktNormalize(S);nativeRender();};
    window.MarketingDesktop={schema:MKT_SCHEMA,fixtures:MKT_FIXTURES,parseCsv:mktParseCsv,normalize:mktNormalize,importBackup:mktImport,state:()=>S,
      testing:{createWork:mktCreateWork,createPlan:mktMakePlan,createArtifact:mktCreateArtifact,reviseArtifact:mktReviseArtifact,generate:mktGenerate,brandData:mktBrandData,socialData:mktSocialData}};
    render();persist();
  }
  mktInstall();
})();
