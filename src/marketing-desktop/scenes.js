/* Authored synthetic stories. No network, model inference or external receipts. */
MD.scenes={
  brand:{name:'品牌战略',icon:'compass',hint:'比较受众与沟通方向',kind:'marketing-memo',output:'90 天品牌策略备忘录',goal:'比较北岚生活的年轻租住人群与有孩子家庭，制定 90 天品牌沟通方向，只维护两个内容触点；不做产品上市。'},
  social:{name:'社媒内容',icon:'message',hint:'已有表达直接写内容',kind:'social-calendar',output:'下周五条社媒文字与排期',goal:'根据已有事实、确认表达和旧文案，制作下周五条社媒文字及排期，包含目标、角度、正文和 CTA。不要图片，不重做 FABE/MH，不发布。'},
  analytics:{name:'运营分析',icon:'tasks',hint:'比较数据，选择下一步',kind:'operations-analysis',output:'两期社媒运营分析',goal:'比较两期社媒数据，区分结构变化与分组表现，给出两项实验建议；先不写文案、不改排期。'},
  launch:{name:'产品上市',icon:'globe',hint:'沿用 V6.2 专业流程',goal:'准备产品上市计划，先核对产品资料与交付范围。'}
};
MD.fixtures={
  brand:[{key:'renters',name:'北岚生活-年轻租住人群访谈.txt',text:'【合成访谈 v1】北岚生活是虚构家居服务品牌。年轻租住人群在搬家与短期居住中希望少做不可逆改造，喜欢可带走、可小步尝试的空间整理方法。顾虑：被当成临时生活、预算浪费、建议不适合小空间。愿意保存具体清单，通过小红书发现方法；每周可尝试一件小事。没有代表性样本量，不能推断市场规模。'},
    {key:'families',name:'北岚生活-有孩子家庭访谈.txt',text:'【合成访谈 v1】有孩子家庭关注日常收纳协作、长期稳定与安全边界，希望看到完整使用条件和真实验证。顾虑：泛泛的美好生活承诺、整理增加家长负担。信任需要较长周期与持续服务案例，现有资料尚不足以作安全或功效声明。'}],
  social:[{key:'facts',name:'北岚生活-已有事实.txt',text:'【合成事实 v1】北岚生活提供一份可下载的空间整理清单及每周一次文字答疑。清单覆盖玄关、桌面和搬家打包三个主题；不包含上门服务，不承诺效果比例。'},
    {key:'expression',name:'北岚生活-确认表达.txt',text:'【合成表达 v1】确认方向：让当下的生活更有条理。语气具体、平等、不制造焦虑。不夸大空间变化；不使用保证、最好、第一等绝对承诺。'},
    {key:'old-copy',name:'北岚生活-旧文案.txt',text:'【合成旧文案 v1】新的一周，从桌面的一小块开始。不是一次整理所有东西，先为每天用的物件找到固定位置。收藏清单，周末挑一件试试。'}],
  analytics:[{key:'metrics',name:'北岚生活-两期社媒数据.csv',text:'period,content_type,impressions,interactions\nprevious,practical_tips,30000,1800\nprevious,product_intro,10000,300\ncurrent,practical_tips,10000,650\ncurrent,product_intro,30000,900\n'}]
};
MD.loadFixtures=function(variant='base'){
  const t=MD.work(),m=MD.meta(t),files=MD.fixtures[m.scene];if(!files)throw Error('请先选择品牌、社媒或运营演示场景。');
  const added=[];for(const f of files){const key=m.scene+':'+f.key+':'+variant;let u=S.uploads.find(u=>u.threadId===t.id&&u.fixtureKey===key);if(!u){let text=f.text;
    if(variant==='changed'&&f.key==='renters')text='【合成访谈 v2】年轻租住人群表示近期频繁迁居，无法持续参与每周活动，主要希望偶尔查询搬家清单；当前 90 天沟通条件下难以稳定触达。';
    if(variant==='changed'&&f.key==='families')text='【合成访谈 v2】有孩子家庭已有稳定的每周整理交流小组，愿意连续 90 天记录整理协作问题。关注减轻家长负担，不希望看到安全或功效的无依据承诺。';
    if(variant==='changed'&&f.key==='facts')text='【合成事实 v2】北岚生活只提供搬家打包文字清单，暂不提供每周答疑；不包含上门服务。';
    u={id:uid('upload'),threadId:t.id,projectId:t.projectId||null,name:f.name.replace(/(\.[^.]+)$/,(variant==='changed'?'-变体':'')+'$1'),text,type:'text',mime:f.name.endsWith('.csv')?'text/csv':'text/plain',size:new TextEncoder().encode(text).length,created:now(),revision:1,fixtureKey:key,fixtureVariant:variant};S.uploads.push(u);}
    added.push({type:'upload',id:u.id,revision:1});
  }
  const old=m.selected.filter(r=>S.uploads.find(u=>u.id===r.id)?.fixtureKey);m.excluded=[...new Set([...m.excluded,...old.map(r=>r.id)])];m.selected=[...m.selected.filter(r=>!old.some(o=>o.id===r.id)),...added];m.excluded=m.excluded.filter(id=>!added.some(r=>r.id===id));m.variant=variant;
  addMsg('assistant',`已载入 ${files.length} 份合成资料${variant==='changed'?'变体':''}。本轮选用已更新；已有成果仍保留原引用。`,{},t.id);persist();
};
MD.brandData=function(variant='base',alternative=false){
  const family=(variant==='changed')!==alternative;
  return {title:alternative?'北岚生活 · 对照沟通方案':'北岚生活 · 90 天品牌策略备忘录',summary:family?'先面向有孩子家庭，围绕减轻日常整理协作负担建立认知。':'先面向年轻租住人群，以可小步尝试、可带走的生活方法建立认知。',sections:[
    {id:'audience',title:'优先受众与取舍',body:family?'选择有孩子家庭：用持续记录日常协作问题建立关系，不泛讲“理想家庭”。'+(variant==='changed'?'访谈变体提供了稳定交流小组与连续参与意愿，年轻租住人群近期难以稳定参与。':'这是保留的对照方向，优点是问题持续；代价是信任建立与服务证明需求更高，现有证据尚不充分。'):'选择年轻租住人群：访谈中的小空间、可移动与低承诺尝试，适合在 90 天内以具体方法建立认知。有孩子家庭对稳定、安全与长期服务证据要求更高，本轮不同时覆盖。'},
    {id:'direction',title:'90 天沟通方向',body:family?'方向：让一家人的整理更容易协作。前 30 天收集真实分工问题，中 30 天分享过程记录，后 30 天复盘哪些方法愿意重复。避免把全部整理责任压给家长。':'方向：住得不必永久，日常可以有条理。前 30 天聚焦一个小空间，中 30 天围绕搬家与可移动组织方法，后 30 天收集重复使用和适用边界反馈。'},
    {id:'touchpoints',title:'只维护两个触点',body:family?'触点一：微信公众号，展开家庭整理分工案例和适用条件。触点二：固定频率的小组文字交流，收集持续使用反馈。不增加第三渠道。':'触点一：小红书，呈现可保存的小空间清单。触点二：每周文字答疑，整理尝试反馈与不适用情形。两个触点分别承担发现与持续交流。'},
    {id:'validation',title:'验证方式与停止条件',body:'先记录收藏、有效问题、重复尝试反馈及触达构成，不把点赞等同于品牌认知或购买。30 天后比较两个主题的有效反馈；若没有稳定反馈，缩小主题或停止该方向。缺少样本量、成本及销售归因数据，不给出市场份额或销量承诺。'}],simulation:true,variant,alternative};
};
MD.socialData=function(variant='base',count=5,followup=false){
  const angles=followup?['桌面整理步骤','搬家清单方法','整理协作复盘']:['一小块桌面','玄关物件归位','搬家打包','整理常见问题','一周复盘'];
  const posts=angles.slice(0,count).map((angle,i)=>({id:uid('post'),date:'下周'+['一','二','三','四','五'][i],channel:'小红书',goal:i===0?'建立认知':'收集有效反馈',angle,body:followup?`围绕“${angle}”制作一条实用方法内容。先明确适用情境，再给出可尝试的步骤，最后记录读者反馈；具体事实和服务能力待补充，不作承诺。`:variant==='changed'?`搬家前，先从${angle.includes('搬家')?'打包顺序':'一份物件清单'}开始。北岚生活目前提供搬家打包文字清单，先确认哪些东西要带走，再决定如何分装。不提供答疑或上门服务。`:[
    '新的一周，不必一次整理所有东西。先为桌面上每天用的三件物品找一个固定位置，观察明天是否更容易取用。让当下的生活更有条理。',
    '回家时，钥匙和随身物件放在哪里？今天只观察一个习惯，再试着留出固定归位的位置。清单提供参考，不要求你的家长得一样。',
    '搬家时，先写下到新住处第一晚会用到的物品，再决定哪些装在同一箱。把明天要用的东西留在容易找到的位置，不必今天解决所有收纳问题。北岚生活的搬家打包清单可以作为开始。',
    '整理不是对生活打分。如果一个方法总让你多走几步，先记录不方便的地方。每周文字答疑里，我们从具体问题讨论适合你的调整。',
    '这一周，哪一处整理愿意继续保留？选一件有用的方法，也记下一件不适用的建议。小步尝试，比一次完成所有事情更容易复盘。'
  ][i],cta:followup?'收集读者对步骤的反馈':variant==='changed'?'查看搬家打包文字清单':'收藏清单，选择一件尝试'}));
  return {title:followup?'下周三条实用内容计划':'下周五条社媒文字与排期',summary:followup?'依据所选分析结论增加实用内容；具体产品事实需另行补充。':'文字草稿与排期可逐条修改；没有图片和发布前置要求。',posts,simulation:true,variant};
};
MD.analysisData=function(result){
  const pct=x=>(x*100).toFixed(3).replace(/\.?0+$/,'')+'%',pp=x=>(x*100).toFixed(3).replace(/\.?0+$/,'')+' 个百分点';
  const changed=result.groups.map(g=>`${g.group}：${g.values.map(v=>v.rate===null?'不可计算':pct(v.rate)).join(' → ')}`).join('；');
  return {title:'两期社媒运营分析',summary:`总体互动率 ${pct(result.totals[0].rate)} → ${pct(result.totals[1].rate)}，变化 ${pp(result.delta)}。需同时看分组表现和曝光构成。`,analysis:result,sections:[
    {id:'overall',title:'总体与分组表现',body:`总体变化不能替代分组判断。${changed}。`},
    {id:'mix',title:'内容结构与接续方向',body:result.composition===null?result.warning:`使用前期分组率与本期曝光权重计算为 ${pct(result.weighted)}。结构项 ${pp(result.composition)}，分组率变化项 ${pp(result.within)}。对实用内容可考虑增加曝光进行验证；这不是因果证明。`},
    {id:'experiments',title:'两项建议实验（情景演示）',body:'实验一：在相近时段和投入条件下增加实用内容占比，比较分组互动率及总互动。实验二：同一实用主题分别测试步骤清单与问题答疑表达，记录收藏和有效提问。先固定观察窗口与样本要求，不声称实验已经有效。'},
    {id:'limits',title:'口径与数据不足',body:'互动率＝互动次数÷曝光次数；合计使用总互动除以总曝光，不简单平均分组率。结构分解采用固定顺序，仅描述构成变化。缺少曝光用户去重、流量来源、成本和销售归因，不能推断品牌认知、销量或广告收益。'+result.warning} ]};
};
MD.produce=function(item,snapshot,m){
  if(item.kind==='marketing-document')return {title:item.title||'工作文档',summary:'用户目标与选用资料已固定。正文由用户编辑，本原型未调用模型。',sections:[{id:'goal',title:'本次目标',body:snapshot.goal},{id:'body',title:'工作正文',body:'在此编辑工作内容。'}]};
  const plan=snapshot.plan||{goal:snapshot.goal,exclusions:m.constraints||''},check=MD.scopeCheck(item,plan,m);
  if(check.errors.length)throw Error('需确认演示范围：'+check.errors.join('；'));
  const config=check.config;
  if(item.kind==='operations-analysis'){const files=snapshot.selected.filter(r=>r.type==='upload'&&/\.csv$/i.test(r.title));if(files.length>1)throw Error('选中了多个 CSV，请只保留本次要分析的一个文件。');const csv=files[0];if(!csv)throw Error('请在本次依据中选用一个 CSV 文件。');return MD.analysisData(MD.calculate(csv.text,m.previous||'previous',m.current||'current'));}
  if(item.kind==='social-calendar'&&m.followup){
    const supported=snapshot.selected.some(r=>r.type==='artifact'&&r.selection&&artifact(r.id)?.kind==='operations-analysis'&&r.data.sections.some(s=>/增加实用内容|实用内容可考虑增加曝光/.test(s.body)&&!/(不要|不应|不再)增加/.test(s.body)));
    if(!supported)throw Error('请选用支持“增加实用内容进行验证”的分析结论；当前结论未覆盖此接续示例，可人工编辑普通文档。');
    return MD.configureSocial(MD.socialData('base',config.count,true),config);
  }
  const scene=item.kind==='marketing-memo'?'brand':'social',refs=snapshot.selected.filter(r=>r.type==='upload');
  if(refs.length!==MD.fixtures[scene].length||refs.some(r=>!r.fixtureKey?.startsWith(scene+':')))throw Error('当前资料不是完整合成示例组合，不能声称据此生成。可以编辑普通文档，或显式选择示例资料后演示。');
  const variants=new Set(refs.map(r=>r.fixtureVariant));if(variants.size!==1)throw Error('所选示例存在版本冲突，请统一选择一组资料；不会自动补入默认事实。');
  const variant=[...variants][0],data=item.kind==='marketing-memo'?MD.brandData(variant,!!item.alternative):MD.socialData(variant,config.count);
  if(item.kind==='marketing-memo'){
    const family=(variant==='changed')!==!!item.alternative;
    const descriptions={xiaohongshu:family?'小红书：用具体家庭整理协作记录呈现适用条件，不增加安全或功效承诺。':'小红书：呈现可保存的小空间清单，承担方法发现与收藏。',wechat:family?'微信公众号：展开家庭整理分工案例、过程记录和适用条件。':'微信公众号：展开小空间整理清单、尝试过程与不适用情形，持续收集反馈。',discussion:family?'家庭小组文字交流：收集日常分工问题与持续尝试反馈。':'每周文字答疑：整理尝试反馈与不适用情形，承担持续交流。'};
    const section=data.sections.find(s=>s.id==='touchpoints');section.title='本轮 '+config.touchpoints.length+' 个触点';section.body=config.touchpoints.map((k,i)=>(i+1)+'. '+descriptions[k]).join('\n');
    data.config=clone(config);
  }else MD.configureSocial(data,config);
  if(item.title)data.title=item.kind==='social-calendar'&&/^下周[一二三四五\d]+条社媒文字与排期(?: · 另做一份)?$/.test(item.title)?item.title.replace(/^下周[一二三四五\d]+条/,'下周'+config.count+'条'):item.title;return data;
};
MD.configureSocial=function(data,config){
  // Follow-up may also request four/five entries: these remain explicitly incomplete outlines.
  while(data.posts.length<config.count){const i=data.posts.length;data.posts.push({id:uid('post'),date:'下周'+['一','二','三','四','五'][i],channel:'小红书',goal:'收集有效反馈',angle:['','', '', '方法适用边界','实用内容复盘'][i],body:'记录一种实用方法的适用情境和反馈。具体事实待补充，不作效果承诺。',cta:'收集读者反馈'});}
  data.posts=data.posts.slice(0,config.count);
  data.posts.forEach((p,i)=>{p.channel=MD.channelNames[config.channel];if(config.startDate){const d=new Date(config.startDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);p.date=d.toISOString().slice(0,10);}});
  data.title='下周'+config.count+'条社媒文字与排期';data.summary+=' 当前 '+config.count+' 条；渠道是排期配置，不代表平台专门改写。';data.config=clone(config);return data;
};
