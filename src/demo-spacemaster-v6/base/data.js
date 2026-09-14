/* Lilith Agent-first demo. Fixture content and integrations are explicitly simulated. */
'use strict';
const RELEASE_VERSION='6.2.0';
// Storage/backup schema stays compatible with existing V6 work.
const APP_VERSION='6.0.0-spacemaster-demo';
const STORAGE_KEY=window.MARKETING_DESKTOP?'mokina-marketing-desktop-prototype':'lilith-spacemaster-demo-v6';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));
const uid=p=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
const now=()=>new Date().toISOString();
const PEOPLE={lin:{name:'李林',role:'产品营销',initial:'李'},ana:{name:'Ana',role:'墨西哥市场',initial:'A'},reviewer:{name:'陈蕾',role:'品牌审核',initial:'陈'}};
const KIND={research:{name:'市场观察',domain:'strategy',icon:'search',caption:'研究成果'},strategy:{name:'产品策略',domain:'strategy',icon:'compass',caption:'策略成果'},fabe:{name:'FABE 价值体系',domain:'strategy',icon:'layers',caption:'价值推导'},mh:{name:'Message House',domain:'strategy',icon:'message',caption:'信息屋'},assets:{name:'产品素材集合',domain:'asset',icon:'image',caption:'素材成果'},pop:{name:'线下 POP',domain:'material',icon:'layout',caption:'渠道物料'},web:{name:'官网内容',domain:'material',icon:'globe',caption:'渠道物料'},ecom:{name:'电商详情内容',domain:'material',icon:'shop',caption:'渠道物料'},notes:{name:'资料摘要',domain:'other',icon:'file',caption:'工作成果'}};
const DOMAIN={strategy:'策略',asset:'素材',material:'物料',other:'其他工作'};
const CHANNEL={web:'品牌官网',retail:'线下门店',ecom:'电商'};
const PRODUCT={name:'SpaceMaster',model:'MDRS761MYM45A',category:'冰箱',tier:'Hero',market:'MX',marketName:'墨西哥',language:'es-MX',facts:[['结构','Side by Side'],['容量','570 L'],['外形尺寸','1775 × 910 × 698 mm'],['额定电压','115 V']],note:'沿用用户附件中的产品记录；本 Demo 不重新核验实时产品规格。'};
const SOURCES=[
{id:'P01',name:'墨西哥产品资料',type:'产品',version:'附件记录 · 2026-09-09',scope:'MDRS761MYM45A / MX',text:'用户提供的历史资料记录：570 L；115 V；1775 × 910 × 698 mm；Side by Side。此处演示产品事实读取，不是实时 PIM 查询。',status:'演示可用',locator:'归档(2)/04-Demo数据与验收清单.md'},
{id:'P02',name:'产品功能说明',type:'产品',version:'附件记录 · v1',scope:'SpaceMaster / MX',text:'历史记录列有薄壁空间设计、Counter Depth、Inverter Quattro、WiFi 和水／冰分配。不能从功能名称推断节能百分比或适配所有厨房。',status:'演示可用',locator:'归档(2)/04-Demo数据与验收清单.md'},
{id:'R01',name:'墨西哥厨房与购买场景',type:'研究',version:'模拟研究 · v1',scope:'MX / 工作假设',text:'演示观察：厨房升级、集中采购、日常饮品取用，可作为候选使用情境。这不是实际访谈、市场统计或代表性结论。',status:'工作假设',locator:'Demo fixture / market-observation'},
{id:'B01',name:'美的品牌表达与视觉',type:'品牌',version:'用户设计包 · v1.0',scope:'数字界面 / 品牌表达',text:'美的蓝 #0092D8、深蓝 #00284C、白色。人本、简约、轻盈。交互蓝与品牌蓝分工；不分发字体，不重新绘制官方标志。',status:'用户提供',locator:'归档(1)/DESIGN.md'},
{id:'C01',name:'MX 渠道表达建议',type:'渠道',version:'演示规则 · v1',scope:'es-MX / 官网与门店',text:'POP 标题简短，产品与声明可辨识；官网可展开功能。不得添加无依据的销量排名、节能比例或保鲜天数。用于演示检查，不代替法规审核。',status:'演示规则',locator:'Demo fixture / channel-pack'},
{id:'T01',name:'品类与渠道交付规则',type:'组织规则',version:'演示规则集 · v2',scope:'冰箱 / Hero / MX',text:'Hero 基础交付：策略、FABE、MH。含视觉渠道时需素材集合；官网需要页面内容；门店需要 POP；电商需要商品内容。独立市场报告为推荐项，不自动进入承诺。',status:'演示预设',locator:'Lilith native / deliverable-rules'},
{id:'X01',name:'全球参考素材中的声明',type:'待核对',version:'模拟冲突样本',scope:'其他配置 / 不适用于本型号',text:'“保鲜 7 天”“省电 30%”没有目标型号与当地适用证据。本例将其隔离，不用于正式输出；不影响其他有依据的工作。',status:'已隔离',locator:'Demo fixture / rejected-claims'}
];
const ASSET_FIXTURES=[
{id:'img-front',name:'产品正面',view:'front',type:'产品图',scope:'MX / 目标型号',license:'演示可用',eligible:true,desc:'用于产品识别与 POP。图为结构示意，不是实物照片。'},
{id:'img-open',name:'内部空间',view:'open',type:'功能图',scope:'MX / 目标型号',license:'演示可用',eligible:true,desc:'展示储物布局。禁止依据示意图量化容量提升。'},
{id:'img-detail',name:'取水与取冰',view:'detail',type:'细节图',scope:'MX / 目标型号',license:'演示可用',eligible:true,desc:'演示细节选图，不承诺未核验的安装方式。'},
{id:'img-scene',name:'日常厨房',view:'warm',type:'场景图',scope:'概念场景',license:'仅概念演示',eligible:true,desc:'使用场景示意，不能视为完成安装适配核验。'},
{id:'img-global',name:'全球参考款',view:'front',type:'参考图',scope:'其他型号',license:'型号不匹配',eligible:false,desc:'目标型号不同；保留搜索结果，但不能纳入交付素材。'},
{id:'img-review',name:'区域历史场景',view:'cool',type:'场景图',scope:'历史素材',license:'授权待确认',eligible:false,desc:'未确认使用权，不得作为成品正式引用。'}
];
const MODULES=[
{id:'gtm',name:'产品价值与 GTM',icon:'compass',kind:'专业能力组合',description:'策略、FABE 与 Message House。方法、结构化成果、工具与专用工作面协同。',skills:['Product Strategy v2','FABE Value Design v2','Message House v2'],tools:['product.read','knowledge.search','evidence.lookup'],ui:['价值卡片','FABE 展开编辑','信息屋'],native:false},
{id:'research',name:'研究与分析',icon:'search',kind:'委派 Agent',description:'带着具体研究问题寻找资料，保留假设、来源与缺口。',skills:['Market Research v1','Evidence Synthesis v1'],tools:['research.search','evidence.read'],ui:['发现卡片','比较详情'],native:false},
{id:'asset',name:'素材认知与检索',icon:'image',kind:'可复用服务',description:'检索产品图与场景图，检查型号、使用范围和素材适用性。',skills:['Asset Matching v1'],tools:['assets.search','assets.inspect'],ui:['缩略图','素材清单'],native:false},
{id:'production',name:'内容制作',icon:'layout',kind:'委派 Agent',description:'读取指定 MH 和素材版本，为渠道制作可编辑候选。',skills:['Channel Composition v1','Localization es-MX v1'],tools:['material.compose','design.preview'],ui:['POP 编辑器','官网预览'],native:false},
{id:'check',name:'内容检查',icon:'shield',kind:'可复用服务',description:'检查品牌表达、事实与本渠道要求；给出定位和可执行修改。',skills:['Brand & Claim Check v1'],tools:['content.check'],ui:['检查结果','差异定位'],native:false},
{id:'workspace',name:'项目与成果协作',icon:'folder',kind:'Lilith 原生能力',description:'建立上下文空间，查询交付规则，维护任务、版本、提交与批准记录。',skills:['Delivery Planning v2'],tools:['project.create','scope.resolve','artifact.save','submission.create'],ui:['交付清单','成果工作面','审核'],native:true}
];
const SCENE_PROMPTS={research:'先帮我看看墨西哥冰箱的厨房使用场景，不用创建项目。',create:'为 SpaceMaster 创建一个上市项目，首发墨西哥，覆盖官网和线下门店。',assets:'帮我找一组 SpaceMaster 产品图，先不建项目。',notes:'帮我整理会议纪要：本周明确墨西哥上市表达；李林负责产品策略；Ana 确认门店 POP；不采用未经验证的节能数据。'};
function makeState(){return{schema:APP_VERSION,actor:'lin',view:'chat',threadId:'quick-1',projectId:null,threads:[{id:'quick-1',title:'新的工作',projectId:null,messages:[],created:now()}],projects:[],tasks:[],artifacts:[],submissions:[],deliveries:[],transfers:[],runs:[],activity:[],uploads:[],selectedAssets:['img-front','img-open','img-detail'],canvas:null,contextSelection:null,filters:{domain:'all'},settings:{theme:'light',density:'comfortable',speed:1},auto:null,runId:null,paused:false,mobileNav:false};}
let S;try{let s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');const defaults=makeState();S=s&&s.schema===APP_VERSION?{...defaults,...s,settings:{...defaults.settings,...s.settings},schema:APP_VERSION}:defaults}catch{S=makeState()}
S.settings.density='comfortable';
let storageWarning=false;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(S));storageWarning=false}catch{storageWarning=true}}
if(S.runId){const r=S.runs.find(x=>x.id===S.runId);if(r){r.status='interrupted';r.ended=now();r.events.filter(x=>x.status==='running').forEach(x=>x.status='interrupted')}S.runId=null;S.activity.unshift({id:uid('ev'),title:'工作已恢复',detail:'未完成运行已标记中断，可重试。已保存的成果与批准快照不变。',at:now(),actor:S.actor});}
if(S.auto){S.auto.active=false;S.auto.paused=true;}S.paused=false;
function project(id=S.projectId){return S.projects.find(p=>p.id===id)}
function thread(){return S.threads.find(t=>t.id===S.threadId)}
function artifact(id){return S.artifacts.find(a=>a.id===id)}
function revision(a,n){return a?.versions.find(v=>v.num===(n??a.active))}
function currentSource(a){return revision(a,a?.accepted||a?.active)}
function taskFor(kind,pid=S.projectId){return S.tasks.find(t=>t.projectId===pid&&t.kind===kind&&t.status!=='cancelled')}
function byKind(kind,pid=S.projectId){return S.artifacts.filter(a=>a.projectId===pid&&a.kind===kind).at(-1)}
function log(title,detail='',pid=S.projectId){S.activity.unshift({id:uid('ev'),title,detail,projectId:pid,at:now(),actor:S.actor});persist()}
function sourceRefs(kinds,pid=S.projectId){return kinds.map(k=>byKind(k,pid)).filter(Boolean).map(a=>({id:a.id,kind:a.kind,revision:currentSource(a).num,title:a.title}));}
function rulesFor(channels=['web','retail'],tier='Hero'){
const r=[
{kind:'strategy',domain:'strategy',name:'产品策略',reason:tier+' 产品基础交付',category:'必需',maturity:'draft',requirement:'可讨论的策略草稿；区分产品事实、工作假设与证据缺口。'},
{kind:'fabe',domain:'strategy',name:'FABE 价值体系',reason:tier+' 产品基础交付',category:'必需',maturity:'draft',requirement:'形成可用价值主题，完整关联 Feature、Advantage、Benefit 与 Evidence。'},
{kind:'mh',domain:'strategy',name:'西班牙语 Message House',reason:'MX · es-MX 传播基础',category:'必需',maturity:'draft',requirement:'完整 MH 草稿，保留长短表达、功能支撑与适用说明。'}];
if(channels.length)r.push({kind:'assets',domain:'asset',name:'产品与功能素材包',reason:'已选择视觉内容渠道',category:'条件匹配',maturity:'draft',requirement:'至少两项适用素材；型号与用途一致；排除未确认授权项。'});
if(channels.includes('web'))r.push({kind:'web',domain:'material',name:'官网产品页内容',reason:'品牌官网渠道',category:'条件匹配',maturity:'draft',requirement:'可预览官网内容草稿；含主张、卖点与型号说明。'});
if(channels.includes('retail'))r.push({kind:'pop',domain:'material',name:'门店 POP',reason:'线下门店渠道',category:'条件匹配',maturity:'approved',requirement:'通过内容检查；指定审核人批准固定版本；成品可导出。'});
if(channels.includes('ecom'))r.push({kind:'ecom',domain:'material',name:'电商详情内容',reason:'电商渠道',category:'条件匹配',maturity:'draft',requirement:'标题、核心卖点、规格与素材建议完整。'});
if(tier==='系列延展'){r[0].category='推荐';r[0].reason='系列延展：策略补充为建议，不强制重做';}
r.push({kind:'research',domain:'strategy',name:'独立市场观察报告',reason:'历史同类项目推荐；非组织必需项',category:'推荐',maturity:'draft',requirement:'独立研究草稿；来源与假设明确。'});return r;}
function makeContent(kind){
 const fabe=[
{id:'space',title:'为日常安排更多空间',feature:'570 L 容量 + 薄壁空间设计',advantage:'以内部空间与食品安排组织功能表达，不声称同级容量领先。',benefit:'让家庭日常采购的食物与饮品更容易组织。',evidence:['P01','P02'],selected:true,claim:'Más espacio para lo que importa.',short:'Espacio para organizar tu día a día.',long:'Una capacidad de 570 L y un diseño de paredes delgadas para organizar alimentos y bebidas de la vida cotidiana.',disclaimer:'容量保留附件记录原值；不将不同容量单位擅自视为等值。'},
{id:'kitchen',title:'让产品融入厨房',feature:'Counter Depth + 1775 × 910 × 698 mm',advantage:'以产品深度和安装条件帮助判断空间关系。',benefit:'厨房升级时，更从容地规划布局。',evidence:['P01','P02'],selected:true,claim:'Diseñado para tu cocina.',short:'Un diseño pensado para integrarse.',long:'Diseño Counter Depth para una cocina bien integrada. Revisa las dimensiones del producto y los requisitos de instalación.',disclaimer:'需核对实际安装空间，不承诺适用于所有橱柜。'},
{id:'daily',title:'日常取用更顺手',feature:'水与冰分配',advantage:'在产品上集中完成饮品取用。',benefit:'让日常饮水与饮品准备更方便。',evidence:['P02'],selected:true,claim:'Agua y hielo a tu alcance.',short:'Comodidad en los pequeños momentos.',long:'Agua y opciones de hielo al alcance para acompañar los momentos cotidianos.',disclaimer:'供水及安装条件需以型号说明书为准。'}];
if(kind==='research')return{title:'墨西哥冰箱 · 三个值得验证的切入点',summary:'先从厨房升级、日常储物与饮品取用理解使用场景，再选择产品表达。以下是演示研究假设，不是实际市场结论。',sections:[{id:'r1',title:'厨房升级，而非笼统大家庭',body:'将更换旧冰箱、厨房改造作为候选触发情境。需要验证厨房深度、通道与安装条件，而非假设容量越大越好。',label:'工作假设',sources:['R01','P01']},{id:'r2',title:'从日常安排解释空间价值',body:'食品收纳与集中采购可作为研究方向。现有资料不能支持频次、占比或量化转化结论。',label:'待研究验证',sources:['R01']},{id:'r3',title:'比较产品，不编造竞品',body:'建议比较容量、深度、饮水与制冰方式。未提供可核验竞品型号时，不生成虚构价格、份额与排名。',label:'证据缺口',sources:['P01','P02']}]};
if(kind==='strategy')return{title:'以厨房空间与日常便利建立产品价值',summary:'面向厨房升级人群，先讲空间组织与厨房整合，再用饮品取用提供可感知的功能支撑。',sections:[{id:'audience',title:'优先人群',body:'以厨房升级、冰箱更换的家庭作为优先讨论对象。这个方向来自产品能力与演示场景假设，尚不代表经过消费者研究验证。',label:'工作假设',sources:['P01','R01']},{id:'position',title:'产品定位',body:'一款兼顾储存安排、厨房整合与日常饮品取用的 Side by Side 冰箱。不使用未经证实的低价、排名或量化领先定位。',label:'推荐方向',sources:['P01','P02']},{id:'value',title:'价值优先级',body:'第一：空间与食品安排；第二：厨房整合；第三：饮品取用。WiFi 与 Inverter Quattro 保留为功能信息，不自动转成量化承诺。',label:'业务取舍',sources:['P02']},{id:'channel',title:'渠道表达',body:'官网展开三组价值与安装说明；门店 POP 用一条主张、少量支撑和明确型号。西班牙语按墨西哥用途组织，不直译长篇技术材料。',label:'渠道建议',sources:['C01','B01']}],exclusions:['不使用“省电 30%”','不使用“保鲜 7 天”','不虚构竞品数据']};
if(kind==='fabe')return{title:'三组价值，连接功能与日常生活',summary:'多项 Feature 可共同支撑同一个利益点；Evidence 单独绑定，不把建议当事实。',points:fabe};
if(kind==='mh'){let a=byKind('fabe'),v=currentSource(a);return{title:'SpaceMaster · Message House',brand:'Midea',product:'SpaceMaster',claim:'Más espacio para lo que importa.',summary:'Espacio, integración y comodidad para tu día a día.',needs:'Organizar alimentos y bebidas y mantener una cocina bien integrada.',emotion:'Disfruta lo cotidiano.',language:'es-MX',points:clone(v?.data.points?.filter(x=>x.selected)||fabe),disclaimer:'MDRS761MYM45A. Revisa dimensiones y requisitos de instalación. Material de demostración.'};}
if(kind==='assets')return{title:'SpaceMaster · 可用素材集合',summary:'为官网与门店挑选匹配素材，保留型号、用途及演示授权边界。',items:[...S.selectedAssets],note:'全部内置图为概念示意；演示可用不代表真实商业授权。'};
if(['pop','web','ecom'].includes(kind)){let mh=currentSource(byKind('mh'))?.data;return{title:kind==='pop'?'门店 POP':kind==='web'?'官网产品页':'电商详情内容',headline:mh?.claim||'Más espacio para lo que importa.',subtitle:'SpaceMaster · Refrigerador Side by Side',summary:'Diseño Counter Depth · Capacidad de 570 L',body:mh?.summary||'Espacio e integración para tu vida cotidiana.',points:clone(mh?.points||fabe),template:'product',image:'front',footer:'MDRS761MYM45A · Imagen ilustrativa · Demo',language:'es-MX',reviewNote:'默认长标题将用于演示一次审核修改；未添加功效数字。'};}
return{title:'工作摘要',summary:'把讨论整理成可以继续引用的工作结果。',sections:[{id:'notes',title:'会议决定',body:'本周明确墨西哥上市表达。李林负责产品策略，Ana 确认门店 POP；不采用未经验证的节能数据。',label:'用户输入整理',sources:[]}]};
}
