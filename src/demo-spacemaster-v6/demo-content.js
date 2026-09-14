/* SpaceMaster demo: extend the established Midea work surface; never mutate the v5 store. */
const DEMO_KINDS=['strategy','fabe','mh','productImages','scene','featureImages','websitePoster'];
const DEMO_IMAGE_KINDS=['productImages','scene','featureImages','websitePoster'];
const DEMO_BRIEF='为 SpaceMaster 准备德国官网上市海报，型号 MDRS761MYM45A。使用 Canva 提供的图片，整理产品六视角、木色厨房场景、四类卖点图、模特替换候选和德语官网横幅。法语、阿拉伯语作为其他语言示例。保留策略、FABE 和 Message House，完成后集中查看草稿。';
const DEMO_PREVIOUS={makeState,makeContent,rulesFor,generate,runSpec,inspectContent,checkBatchDraft,modifySelected,sendPrompt,homeScenariosHTML,filesHTML,versionFiles,exportOne,exportApproved,exportProject,exportDraftBatch,documentText,contentHTML};
Object.assign(KIND,{productImages:{name:'产品六视角集合',domain:'asset',icon:'image',caption:'Product Image · Asset'},scene:{name:'厨房场景素材',domain:'asset',icon:'image',caption:'Lifestyle Image · Asset'},featureImages:{name:'卖点图集合',domain:'asset',icon:'layers',caption:'Feature Image · Asset'},websitePoster:{name:'德国官网海报',domain:'material',icon:'globe',caption:'Website Poster · Material'}});
Object.assign(BATCH_DEPS,{productImages:[],scene:['productImages','mh'],featureImages:['fabe','mh','productImages'],websitePoster:['mh','scene','featureImages']});
BATCH_ORDER.push('productImages','scene','featureImages','websitePoster');
PEOPLE.ana.role='内容协作';
const demoProject=p=>p?.demoScenario==='spacemaster-de';
function seedDemo(state,explicit=false){
  if(window.MARKETING_DESKTOP&&!explicit)return state;
  if(!state.projects.some(demoProject)){
    const id='spacemaster-de',tid='spacemaster-de-chat';
    state.projects.push({id,threadId:tid,name:'SpaceMaster 德国官网上市海报',productName:'SpaceMaster',model:'MDRS761MYM45A',category:'冰箱',tier:'Hero',market:'DE',markets:['DE'],language:'de-DE',channels:['web'],goal:DEMO_BRIEF,owner:'lin',scopeConfirmed:false,ruleVersion:1,created:now(),contextArtifacts:[],inputsReady:true,demoScenario:'spacemaster-de'});
    state.threads.push({id:tid,title:'上市工作计划',projectId:id,messages:[],created:now()});
  }
  state.imageViews??={};return state;
}
makeState=()=>seedDemo(DEMO_PREVIOUS.makeState());seedDemo(S);
function enterDemoProject(){const p=S.projects.find(demoProject);goProject(p.id);return p;}
ensurePlanProject=function(){return project()||enterDemoProject();};
const deSources=[
  ['DE01','SpaceMaster 产品与图像输入','用户确认型号 MDRS761MYM45A；Canva 六视角、厨房场景与四语言海报，另有用户提供卖点图及模特候选。图中文字不反写产品事实。'],
  ['DE02','德国官网创意与内容 Brief','德国 / de-DE / 官网横幅。厨房焕新和冰箱替换作为工作假设；木色厨房、自然光、产品清晰可辨。'],
  ['DE03','图像及声明检查边界','文件齐套不代表结构真实性已确认。德国配置、安装方式缺少适用依据；现成 PNG 不等于已接入实时生成或图层编辑。'],
  ['DE04','交付规则与来源','七项交付：Strategy、FABE、Message House、六视角、场景、卖点图和德国官网海报。前六项确认草稿，德语海报固定版演示审核；法语和阿语国家待选。']
];
for(const [id,name,text] of deSources)SOURCES.push({id,name,text,type:'项目资料',version:'v1',scope:'SpaceMaster / 德国官网创意',status:'用户提供',locator:'SpaceMaster Demo V6 / 来源记录'});
function demoRules(){return DEMO_KINDS.map(kind=>({kind,domain:KIND[kind].domain,name:KIND[kind].name,category:'必需',reason:'已确认的德国官网交付范围',maturity:kind==='websitePoster'?'approved':'draft',requirement:kind==='websitePoster'?'固定德语图片、文案转录、用途与来源说明通过演示审核。':'内容、来源与固定引用完整；集中确认草稿。'}));}
rulesFor=function(...args){return demoProject(project())?demoRules():DEMO_PREVIOUS.rulesFor(...args);};
const priorPlanHTML=planPanelHTML;
planPanelHTML=function(plan){if(!demoProject(project(plan.projectId)))return priorPlanHTML(plan);const locked=plan.status!=='draft';return `<div class="plan-intro"><h3>${E(project(plan.projectId).name)}</h3><p>MDRS761MYM45A · 德国 · 德语 · 官网横幅</p>${tag(locked?'计划已确认':'等待确认','blue')}</div><div class="field"><label for="plan-goal">本次目标</label><textarea id="plan-goal" ${locked?'readonly':''}>${E(plan.goal)}</textarea></div><section class="plan-deliverables"><h3>七项交付</h3>${demoRules().map(r=>`<label class="plan-item"><input type="checkbox" data-plan-kind="${r.kind}" ${plan.kinds.includes(r.kind)?'checked':''} ${locked?'disabled':''}><span>${icon(KIND[r.kind].icon)}<strong>${r.name}</strong><small>${r.requirement}</small></span></label>`).join('')}</section><p>视角、语言和人物候选属于成果成员，不额外建立任务。普通制作和自检连续进行，完成后由你集中采用。</p>`;};
function demoSections(rows){return rows.map(([id,title,body,label='创作建议'])=>({id,title,body,label,sources:['DE01','DE02','DE03']}));}
function demoPoints(){return [
  {id:'identity',title:'产品辨识',feature:'同一 SpaceMaster 产品与对开门外观',advantage:'多角度维持可辨识的外观，帮助不同构图仍指向同一产品。',benefit:'在不同页面和语言版本中更容易识别正在了解的产品。',evidence:['DE01'],selected:true,claim:'SpaceMaster entdecken.',short:'Ein Produkt, aus mehreren Blickwinkeln.',long:'Entdecke SpaceMaster aus verschiedenen Perspektiven. Die Ansichten zeigen das Produktdesign und helfen dabei, die Darstellung für unterschiedliche Inhalte zu planen.',disclaimer:'表达推论；背面与隐藏结构仍待实物依据。'},
  {id:'kitchen',title:'厨房生活',feature:'已提供的产品与厨房场景画面',advantage:'让观者看到产品置于生活空间的创意示意。',benefit:'更容易想象产品与日常厨房生活的关系。',evidence:['DE01','DE02'],selected:true,claim:'Raum für deinen Alltag.',short:'Eine neue Perspektive für deine Küche.',long:'Die Kücheninszenierung verbindet das Produkt mit einer Idee vom Alltag. Sie dient als Gestaltungsvorschlag und ersetzt keine Prüfung der konkreten Einbausituation.',disclaimer:'创作解释，不宣称嵌入式或任意厨房适配。'},
  {id:'clarity',title:'简洁呈现',feature:'同一产品用于简洁图文横幅',advantage:'减少主画面的信息负担，突出品牌与品类。',benefit:'快速知道这是什么产品，继续了解详细信息。',evidence:['DE02'],selected:true,claim:'Ein klarer Blick auf dein nächstes Küchengerät.',short:'Produkt und Alltag im Blick.',long:'Eine klare Bildsprache führt vom Produkt zur Wohnsituation. Ergänzende Informationen bleiben dort, wo sie zum Verständnis beitragen.',disclaimer:'营销表达方向，不是产品技术功能。'}];}
function demoImageContent(kind){
  const groups={productImages:['K01','K02','K03','K04','K05','K06'],scene:['K07','PM00','PM01','PM02','PM03','PM04'],featureImages:['FT01','FT02','FT03','FT04'],websitePoster:['K08','K09','K10','K11']};
  const items=groups[kind];return {title:'SpaceMaster · '+KIND[kind].name,summary:({productImages:'正面、左右 45°、左右侧与背面；六个实际产品视角。',scene:'暖木色厨房与自然光；带人物内容保留原图及四个本地化候选。',featureImages:'空间容量、温度检测、Platinum Fresh 与 Vario Box 四种表达。',websitePoster:'德国官网横幅主版；英文母版、法语与阿语候选独立保存。'})[kind],imageCollection:true,businessRole:kind==='websitePoster'?'Material':'Asset',sourceContentType:({productImages:'Product Image',scene:'Product Lifestyle Image',featureImages:'Selling Point/Feature Image',websitePoster:'Product Poster Image'})[kind],items,files:items.map(id=>{const f=MERGED_ASSETS.demoImages.find(f=>f.id===id);return {id,file:f.file,sha256:f.sha256,width:f.width,height:f.height,version:1,origin:f.origin}}),memberStates:Object.fromEntries(items.map(id=>[id,{status:id==='PM04'?'needs_revision':'available',adopted:false}])),mainMember:kind==='websitePoster'?'K09':items[0],language:kind==='websitePoster'?'de-DE':null,country:kind==='websitePoster'?'DE':null,variants:kind==='websitePoster'?{K08:{language:'en',country:null,status:'candidate'},K09:{language:'de-DE',country:'DE',status:'candidate'},K10:{language:'fr',country:null,status:'candidate'},K11:{language:'ar',country:null,status:'candidate'}}:null,deliveryNote:'供德国官网创意与内容流程评审使用。',relationBasis:'user-described',pixelRevision:1,pixelChanges:false,renderRequests:[],note:'原图由 Canva / 用户提供。来源与衍生关系依据用户说明，无本轮真实生成日志。'};
}
makeContent=function(kind){
  if(!demoProject(project())&&!DEMO_IMAGE_KINDS.includes(kind))return DEMO_PREVIOUS.makeContent(kind);
  if(DEMO_IMAGE_KINDS.includes(kind))return demoImageContent(kind);
  if(kind==='research')return {title:'从产品外观到官网主视觉的表达依据',summary:'从现有图片与 Brief 组织内部创意；不冒充德国消费者调研。',sections:demoSections([['recognition','产品识别','先保持门体比例、分配器位置和产品身份，再扩展视角。多视角有助于后续构图，但背面图不能替代实物资料。'],['scene','生活情境','明亮木色厨房是一种创意选择，不代表德国住宅统计画像，也不证明产品能按画面方式安装。','工作假设'],['channel','渠道取舍','官网横幅以品牌、品类和主视觉为中心。母版与语言变体在同一组中比较，按实际尺寸展示。'],['gaps','待验证问题','德国适用配置、安装资料、不可见结构依据，以及法语和阿语目标国家仍待补充。','证据缺口']])};
  if(kind==='strategy')return {title:'以生活场景承接产品识别，让官网主视觉更完整',summary:'先保证产品一致，再用厨房场景展示生活关系，以简洁品类表达完成德国官网横幅。',sections:demoSections([['audience','优先人群','以关注厨房焕新和冰箱替换的用户作为创意讨论对象。该设定来自工作目标，未经过德国消费者研究验证，不填写人群占比或购买转化结论。','工作假设'],['context','生活场景','明亮木色厨房、岛台与自然光形成主场景，产品清晰可辨；画面不替代安装说明。'],['position','产品定位','以 SpaceMaster 产品身份、可见设计和厨房情境构成官网入口。暂不采用容量、电压、节能、保鲜时长与嵌入式承诺。'],['priorities','表达优先级','产品外观一致、生活关系清楚、各语种含义一致。按照文字长度和阅读方向核对版式。'],['channel','渠道表达','官网横幅包含品类标题、简短副文、品牌、产品小图和场景，不等于完整 PDP、页面上线或门店印刷物料。'],['exclusions','不进入本次传播','不从场景贴合推断嵌入式，不从外观推断内部参数，不将翻译当市场批准，不把现成 PNG 展示称作新模型调用。']])};
  if(kind==='fabe')return {title:'三组表达，连接产品与厨房生活',summary:'产品辨识、厨房生活与简洁呈现；保留创作推论及依据。',points:demoPoints()};
  if(kind==='mh')return {title:'SpaceMaster · 德国 Message House',brand:'Midea',product:'SpaceMaster / MDRS761MYM45A',claim:'Raum für deinen Alltag.',summary:'Entdecke SpaceMaster aus neuen Perspektiven.',needs:'厨房焕新或冰箱替换时，识别产品并理解它与生活空间的关系。',emotion:'让日常空间更贴近自己的生活。',language:'de-DE',points:clone(currentSource(byKind('fabe'))?.data.points||demoPoints()).filter(x=>x.selected!==false),disclaimer:'德国官网创意工作稿。品类标题取原图；宣传语建议不覆盖尚未修改的图片。'};
  return DEMO_PREVIOUS.makeContent(kind);
};
runSpec=function(kind){if(!demoProject(project()))return DEMO_PREVIOUS.runSpec(kind);const name=KIND[kind]?.name||({ask:'解释当前内容与依据',modify:'按反馈形成新候选',check:'核对固定内容版本'})[kind]||'整理项目输入';return {name,module:DEMO_IMAGE_KINDS.includes(kind)?'production':'gtm',sources:['DE01','DE02','DE03'],thought:'读取当前项目与固定来源。已提供图片作为演示结果展示，制作与检查分开记录；候选不自动采用，图片未变不声称已完成像素修改。',steps:[['source.read','读取项目与固定来源','本地资料',{model:PRODUCT.model,market:'DE'},{origin:'supplied',runtime:false}],['artifact.prepare','整理'+name+'与来源关系','本地演示',{kind},{saved:true,autoApprove:false}]]};};
generate=async function(kind){
  if(!demoProject(project()))return DEMO_PREVIOUS.generate(kind);
  const p=project(),pid=p.id,tid=S.threadId;if(!p.scopeConfirmed&&kind!=='research'){showModal('scope',pid);return;}
  if(!DEMO_KINDS.includes(kind)&&kind!=='research')return toast('本项目按七项交付制作，请从计划或成果继续。');
  const deps=BATCH_DEPS[kind]||[],missing=deps.filter(k=>!byKind(k,pid));if(missing.length)return toast('先完成 '+missing.map(k=>KIND[k].name).join('、'),true);
  const t=taskFor(kind,pid);if(S.actor==='reviewer'||t&&t.assignee!==S.actor)return toast('请由当前交付负责人制作。',true);
  return runWork(kind,()=>{const saved=S.projectId;S.projectId=pid;let data;try{data=makeContent(kind)}finally{S.projectId=saved}const refs=sourceRefs(deps,pid);let a=byKind(kind,pid);if(a)addRevision(a,data,'整理新的完整候选',refs);else a=newArtifact(kind,data,pid,refs,tid);return {artifactIds:[a.id],text:KIND[kind].name+'已保存。可以查看内容、来源和固定版本，再决定采用。',action:nextAction(kind)};});
};
const priorNextAction=nextAction;
nextAction=function(kind){if(!demoProject(project()))return priorNextAction(kind);const next=DEMO_KINDS[DEMO_KINDS.indexOf(kind)+1];return next?'generate-'+next:'deliverables';};
inspectContent=function(a,v){if(!demoProject(project(a.projectId))&&!v.data.imageCollection)return DEMO_PREVIOUS.inspectContent(a,v);const missing=(v.data.files||[]).filter(f=>!MERGED_ASSETS.demoImages.some(x=>x.id===f.id&&x.sha256===f.sha256));const pending=v.data.renderRequests?.some(r=>r.blocksSubmission&&r.status!=='done');const failed=Object.values(v.data.memberStates||{}).some(s=>s.status==='failed');return {passed:!missing.length&&!pending&&!failed,artifactId:a.id,revision:v.num,at:now(),findings:[{title:'文件与固定版本',ok:!missing.length&&!failed,detail:missing.length||failed?'存在缺失成员，可只恢复该文件。':'文件、尺寸与哈希完整。六视角齐套不代表不可见结构已验证。'},{title:'用途与内容',ok:!pending,detail:pending?'所请求的图片像素修改仍待渲染。':'用于德国官网创意演示；图内安装声明保留待核验，不等于产品事实批准。'},{title:'来源与范围',ok:true,detail:'Canva / 用户提供。法语、阿语国家待选；人物候选变化独立记录，不影响其他已完成内容。'}]};};
checkBatchDraft=function(a,v){return demoProject(project(a.projectId))?inspectContent(a,v):DEMO_PREVIOUS.checkBatchDraft(a,v);};
modifySelected=async function(instruction){const selection=clone(S.contextSelection),a=artifact(selection?.artifactId||S.canvas?.id);if(!a||!demoProject(project(a.projectId)))return DEMO_PREVIOUS.modifySelected(instruction);if(!canWrite(a))return;const n=selection?.revision||S.canvas?.num||a.active,base=revision(a,n),member=selection?.member||demoCurrentMember(a,base);return runWork('modify',()=>{const data=clone(base.data);if(data.imageCollection){if(/说明|用途|来源/.test(instruction)&&!/像素|图内|删除.*安装|副文/.test(instruction)){data.deliveryNote=instruction;data.pixelChanges=false;}else{data.renderRequests.push({id:uid('change'),member,instruction,status:'pending_render',blocksSubmission:a.kind==='websitePoster',created:now()});}}else if(data.sections){const sec=data.sections.find(s=>s.id===selection?.section)||data.sections[0];sec.body=instruction;}else if(data.claim)data.claim=instruction;const v=addRevision(a,data,'用户反馈：'+instruction,base.refs);S.canvas={id:a.id,num:v.num,tab:'content'};return {artifactIds:[a.id],text:data.imageCollection?(data.renderRequests.some(r=>r.status==='pending_render')?'修改要求已保存，图片尚未更新。其他内容可以继续。':'交付说明已更新，图片保持不变。请比较后采用新版。'):'已保存新候选，原采用版本保持不变。'};});};
sendPrompt=async function(text){
  text=String(text||'').trim();if(!text)return;
  if(!project()&&/SpaceMaster|德国|六视角/i.test(text)){const p=S.projects.find(demoProject),t=thread();t.projectId=p.id;S.projectId=p.id;}
  if(!demoProject(project()))return DEMO_PREVIOUS.sendPrompt(text);
  // Typing hides the reference chip for presentation, not the request's target.
  const selection=clone(S.contextSelection),mode=workMode(),tid=S.threadId;
  if(S.auto?.active){await autoTypeInput(text);if(S.threadId!==tid)return;S.contextSelection=selection;}
  const question=/为什么|什么意思|解释/.test(text);
  const model=/模特|人物|人种/.test(text)&&!/检查|返修|只修|恢复/.test(text);
  const modifying=!!selection||/修改|返修|补齐.*说明|图片保持不变/.test(text);
  const kind=/卖点图|功能图/.test(text)?'featureImages':/海报|横幅/.test(text)&&project().scopeConfirmed?'websitePoster':/六视角|六视图/.test(text)&&project().scopeConfirmed?'productImages':null;
  // A plan owns its own user message. Decide routing before appending anything.
  if(!question&&!selection&&['plan','yolo'].includes(mode))return discussPlan(text,mode);
  if(!question&&!model&&!modifying&&!kind)return discussPlan(text,'collaborate');
  clearComposer();addMsg('user',text);render(true);
  if(question)return runWork('ask',()=>({text:'先整理六视角，是为了保持产品识别并复用到不同构图；厨房场景承接生活关系。背面等不可见结构仍需实物资料。这里解释当前固定版本，不产生新候选。'}));
  if(model){
    const a=byKind('scene');if(!a)return toast('先准备厨房基础场景。');
    openCanvas(a.id);return handle(/融入|加入|添加/.test(text)?'demo-integrate-model':'demo-person-mode');
  }
  if(modifying)return modifySelected(text);
  return generate(kind);
};
homeScenariosHTML=function(){const p=S.projects.find(demoProject),f=MERGED_ASSETS.demoImages.find(x=>x.id==='K01');return `<section class="sample-space scenario-grid product-scenario-grid" aria-label="产品工作场景"><article class="space-preview"><div class="product-tile"><img src="${f.previewURL}" alt="SpaceMaster 冰箱白底正视图" width="${f.width}" height="${f.height}"></div><div><h3>SpaceMaster 德国官网上市</h3><p>六视角、场景、卖点图、人物候选与多语言海报</p></div>${button('进入项目','project',p.id,'sm','arrow')}</article></section>`;};
filesHTML=function(){if(!demoProject(project()))return DEMO_PREVIOUS.filesHTML();return `<div class="view-inner"><div class="page-head"><div><h1>工作依据，都在这里。</h1><p>20 张提供图片 · 同一 SpaceMaster 项目 · 原图与来源可追溯</p></div></div><div class="demo-source-grid">${MERGED_ASSETS.demoImages.map(f=>`<article class="file-card"><img src="${f.previewURL}" alt="${E(f.name)}" loading="lazy"><h3>${E(f.name)}</h3><p>${f.origin} · ${f.width} × ${f.height}</p>${button('查看原图','demo-source-image',f.id,'sm')}${button('下载原图','demo-download',f.id,'sm','download')}</article>`).join('')}</div></div>`;};
