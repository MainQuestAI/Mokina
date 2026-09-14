/* Bounded prototype contracts. Unknown wording is a choice, never permission to run a template. */
MD.actionWords={
  alternative:/对照方案|第二个方案|第二份方案|另一份方案|另一个方案|另做一份|再做一份/,
  shorten:/缩短|更短|精简/,
  edit:/修改|改为|改成|重写|调整正文/,
  explain:/为什么|为何|解释|理由|依据是什么|怎么考虑/,
  start:/开始制作|开始执行|开始当前项|全部制作|全部执行|执行计划|直接生成|直接制作|制作|生成|^开始$/
};
MD.clauses=text=>String(text||'').split(/[，,。；;\n]+/).map(s=>s.trim()).filter(Boolean);
MD.negative=text=>/不要|不需要|先不|暂不|不做|不生成|不制作|不开始|不执行|别|不用|排除|不包含|不含|不安排/.test(text);
MD.parseIntent=function(text,target=null){
  const result={action:'discuss',polarity:'positive',target:target?{artifactId:target.a.id,revision:target.v.num,section:target.section}:null,scope:'unspecified',text};
  if(/不是不|并非不|不能不|不要不|不无|并不是不要/.test(text))return {...result,polarity:'clarify',reason:'这句话包含双重否定，请明确选择要执行的动作。'};
  if(/^(停止|取消|结束|先到这里)|不再继续/.test(text))return {...result,action:'stop'};
  if(/^(修改计划|调整计划|制定计划|先讨论|只讨论)/.test(text))return {...result,action:'plan'};
  const actions=[];
  for(const clause of MD.clauses(text)){
    for(const [action,pattern] of Object.entries(MD.actionWords)){
      const match=pattern.exec(clause);if(!match)continue;
      actions.push({action,negative:MD.negative(clause.slice(0,match.index+match[0].length)),clause});break;
    }
  }
  const yes=actions.filter(x=>!x.negative);
  if(!yes.length&&actions.length)return {...result,action:actions[0].action,polarity:'negative'};
  if(yes.length>1)return {...result,polarity:'clarify',reason:'请一次明确一个制作动作，或在计划里选择全部制作。'};
  if(yes.length){result.action=yes[0].action;if(/全部/.test(yes[0].clause))result.scope='all';else if(/当前项/.test(yes[0].clause))result.scope='current';}
  const index=text.match(/第([一二三四五六七八九十\d]+)条/);
  if(index)result.index=MD.number(index[1])-1;
  return result;
};
MD.number=value=>/^\d+$/.test(value)?+value:({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[value]||NaN);
MD.channelNames={xiaohongshu:'小红书',wechat:'微信公众号',discussion:'文字交流'};
MD.channelAliases={xiaohongshu:/小红书/,wechat:/微信公众号|公众号/,discussion:/文字交流|文字答疑|答疑|家庭小组|小组文字交流/};
MD.defaultConfig=function(item,m={}){
  if(item.kind==='marketing-memo')return {touchpoints:m.variant==='changed'?['wechat','discussion']:['xiaohongshu','discussion']};
  if(item.kind==='social-calendar')return {count:m.followup?3:5,channel:'xiaohongshu',startDate:''};
  return {};
};
MD.scopeInput=function(text,kind){
  const out={only:[],excluded:[],count:null,startDate:null,errors:[],recognized:false};
  const normalized=String(text||'').trim();
  const known=new Set([
    ...Object.values(MD.scenes).filter(s=>s.kind===kind).flatMap(s=>MD.clauses(s.goal)),
    '本次依据中选用的资料','本次选用资料','当前选用资料','本次依据','当前资料','可阅读、编辑和比较的草稿','可编辑文档',
    '保留原方案','另做独立成果','不自动发布','不创建未选择的后续任务','具体产品事实后续补充',
    '依据所选结论','制定下周三条实用内容计划','先讨论目标','先不制作','只讨论','不开始制作',
    '不做产品上市','不要图片','不重做 FABE/MH','不发布','只分析','先不写文案','不改排期','不新增触点',
    '不需要图片','不要发布','不需要发布','不做 FABE/MH','不要 FABE/MH',
    '当前选用的完整合成示例','只调整参数，不新增事实'
  ].map(x=>x.replace(/[。！!\s]/g,'')));
  for(const clause of MD.clauses(normalized)){
    const compact=clause.replace(/[。！!\s]/g,'');
    if(known.has(compact)){
      // A familiar template is not permission to ignore its explicit quantity.
      const count=clause.match(/([一二两三四五六七八九十\d]+)条/);
      if(count&&kind==='social-calendar'){const n=MD.number(count[1]);if(out.count!==null&&out.count!==n)out.errors.push('计划文字包含不同条数，请统一后再开始。');out.count=n;}
      continue;
    }
    let recognized=false;
    const channels=Object.keys(MD.channelAliases).filter(k=>MD.channelAliases[k].test(clause));
    if(channels.length){
      recognized=true;
      if(MD.negative(clause))out.excluded.push(...channels);else out.only.push(...channels);
      // Channel clauses may express routing, not invent additional facts or promises.
      let rest=clause.replace(/小红书|微信公众号|公众号|每周文字答疑|文字答疑|文字交流|小组文字交流|家庭小组|答疑/g,'');
      rest=rest.replace(/不要|不需要|先不|暂不|不做|不用|排除|不包含|不含|不安排|只用|只做|只选|仅用|仅做|仅选|只维护|只保留|改为|改成|选择|渠道|触点|发布到|排到|排期到|和|与|及|、|：|:|在|用|做|上/g,'').trim();
      if(rest)out.errors.push('未覆盖的渠道或内容要求：'+clause);
    }
    const count=clause.match(/([一二两三四五六七八九十\d]+)条/);
    if(count&&kind==='social-calendar'){
      recognized=true;const n=MD.number(count[1]);if(MD.negative(clause))out.errors.push('请正面指定要制作的条数，不能仅排除某个数量。');if(out.count!==null&&out.count!==n)out.errors.push('计划文字包含不同条数，请统一后再开始。');out.count=n;
      const rest=clause.replace(/([一二两三四五六七八九十\d]+)条/g,'').replace(/只|仅|做|制作|生成|需要|下周|社媒|文字|文案|内容|及|与|和|排期|改为|改成|调整为|减少到|增加到|计划|请|直接|一份|不要图片/g,'').trim();
      if(rest)out.errors.push('未覆盖的内容要求：'+clause);
    }
    const date=clause.match(/\d{4}-\d{2}-\d{2}/);
    if(date&&kind==='social-calendar'&&/^(从)?\d{4}-\d{2}-\d{2}(开始|起)?(每天一条|按天排期)?$/.test(compact)){recognized=true;out.startDate=date[0];}
    if(/^(请)?(开始(制作|执行|当前项)?|全部(制作|执行)|执行计划|直接(生成|制作))$/.test(compact))recognized=true;
    if(!recognized)out.errors.push('尚未覆盖的计划文字：'+clause);
    out.recognized ||= recognized;
  }
  out.only=[...new Set(out.only)];out.excluded=[...new Set(out.excluded)];return out;
};
MD.validateConfig=function(kind,c){
  if(kind==='marketing-memo'&&(!Array.isArray(c.touchpoints)||c.touchpoints.length<1||c.touchpoints.length>2||c.touchpoints.some(k=>!MD.channelNames[k])))throw Error('品牌触点请选择一至两个；周期固定为 90 天。');
  if(kind==='social-calendar'){
    if(!Number.isInteger(c.count)||c.count<1||c.count>5)throw Error('社媒情景演示支持一至五条。');
    if(!['xiaohongshu','wechat'].includes(c.channel))throw Error('社媒排期仅支持小红书或微信公众号。');
    if(c.startDate){const d=new Date(c.startDate+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(c.startDate)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==c.startDate)throw Error('起始日期无效，请使用 YYYY-MM-DD。');}
  }
};
MD.scopeCheck=function(item,p,m){
  const c={...MD.defaultConfig(item,m),...clone(item.config||{})},errors=[],hints=[];
  if(item.kind==='marketing-document')return {config:c,errors};
  const texts=[p.goal,p.exclusions,item.input,item.output];
  const directive={only:[],excluded:[],count:null,startDate:null};
  for(const text of texts){const v=MD.scopeInput(text,item.kind);errors.push(...v.errors);directive.only.push(...v.only);directive.excluded.push(...v.excluded);if(v.count!==null){if(directive.count!==null&&directive.count!==v.count)errors.push('计划文字包含不同条数，请统一目标与预期输出。');directive.count=v.count;}if(v.startDate){if(directive.startDate&&directive.startDate!==v.startDate)errors.push('计划文字包含不同起始日期，请统一后再开始。');directive.startDate=v.startDate;}}
  const only=[...new Set(directive.only)],excluded=[...new Set(directive.excluded)];
  const proposed=clone(c);
  if(item.kind==='marketing-memo'){
    if(only.length)proposed.touchpoints=only;
    proposed.touchpoints=proposed.touchpoints.filter(k=>!excluded.includes(k));
  }
  if(item.kind==='social-calendar'){
    if(only.length>1)errors.push('本轮统一使用一个社媒排期渠道。');
    if(only.length)proposed.channel=only[0];
    if(excluded.includes(proposed.channel))errors.push('当前排期渠道已被排除，请重新选择。');
    if(directive.count!==null)proposed.count=directive.count;
    if(directive.startDate)proposed.startDate=directive.startDate;
  }
  const changed=JSON.stringify(c)!==JSON.stringify(proposed);
  if(changed&&item.configExplicit)errors.push('文字要求与已选参数冲突，请选择“按文字同步参数”或修改计划文字。');
  try{MD.validateConfig(item.kind,proposed);}catch(e){errors.push(e.message);}
  return {config:item.configExplicit?c:proposed,proposed,errors:[...new Set(errors)],hints};
};
MD.historicalMismatch=s=>(s?.selected||[]).some(r=>r.selection&&r.data?.sections?.some(sec=>typeof r.text!=='string'||!r.text.includes(sec.body)));
MD.planIssues=function(p){return p.items.flatMap(i=>MD.scopeCheck(i,p,MD.meta(MD.work(p.threadId))).errors.map(e=>i.title+'：'+e));};
