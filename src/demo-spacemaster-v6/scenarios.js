/* Official product images; scenario goals are authored examples, not new product claims. */
const HOME_SCENARIOS=[
  {id:'dishwasher',name:'Sense Wash 新品上市',productName:'Sense Wash 嵌入式洗碗机',category:'洗碗机',model:'MDWPS1401KSS',channels:['web'],goal:'梳理洗碗机使用场景、产品卖点与官网内容。',summary:'从餐后清洁场景，梳理卖点与官网内容',facts:'14 套餐具容量、第三层餐具架、5 个自动程序。',url:'https://www.midea.com/mx/lavavajillas/lavavajillas-empotrables/lavavajillas-sense-wash-empotrable-14-servicios.mdwps1401kss'},
  {id:'air-fryer',name:'Xpress Chef 电商上新',productName:'Xpress Chef Pro 空气炸锅',category:'空气炸锅',model:'MAF7DSTBSKV',channels:['ecom'],goal:'准备空气炸锅的烹饪场景、卖点与电商详情内容。',summary:'围绕日常烹饪，准备卖点与电商详情',facts:'7 L 容量、可视炸篮、9 种预设。',url:'https://www.midea.com/mx/enseres-menores/freidora-de-aire/freidora-de-aire-xpress-chef.maf7dstbsk'}
];
const singleScenarioHomeHTML=homeHTML;
homeHTML=()=>singleScenarioHomeHTML().replace(/<section class="sample-space">[\s\S]*?<\/section>/,homeScenariosHTML());
function homeScenariosHTML(){
  const launch=S.projects.find(p=>p.id==='sample-launch')||S.projects.find(p=>p.model===PRODUCT.model);
  const cards=[{id:'launch',name:'SpaceMaster 墨西哥上市',summary:'产品策略、价值主张、官网内容与门店 POP',visual:fridge(),action:'project',arg:launch?.id},...HOME_SCENARIOS.map(s=>({...s,visual:`<svg class="scenario-product" viewBox="${s.id==='dishwasher'?'570 300 1860 2350':'450 0 2100 2680'}" role="img" aria-label="${E(s.productName)}官网产品照片"><image href="${MERGED_ASSETS.scenarios[s.id]}" width="3000" height="3000"/></svg>`,action:'scenario-open',arg:s.id}))];
  return `<section class="sample-space scenario-grid" aria-label="产品工作场景">${cards.map(s=>`<article class="space-preview" data-scenario="${s.id}"><div class="product-tile">${s.visual}</div><div><h3>${E(s.name)}</h3><p class="small muted">${E(s.summary)}</p></div>${button('进入项目',s.action,s.arg,'sm','arrow')}</article>`).join('')}</section>`;
}
function enterHomeScenario(id){
  const s=HOME_SCENARIOS.find(s=>s.id===id);if(!s)return;
  let p=S.projects.find(p=>p.homeScenario===id);
  if(!p){
    const pid=uid('project'),tid=uid('chat');
    p={id:pid,name:s.name,productName:s.productName,category:s.category,model:s.model,channels:[...s.channels],goal:s.goal,tier:'Hero',market:'MX',markets:['MX'],language:'es-MX',owner:S.actor,scopeConfirmed:false,ruleVersion:2,threadId:tid,created:now(),contextArtifacts:[],homeScenario:id,inputsReady:false,officialSource:{url:s.url,facts:s.facts,checked:'2026-09-10'}};
    S.projects.push(p);S.threads.push({id:tid,title:'产品资料与内容计划',projectId:pid,messages:[],created:now()});
    goProject(pid,false);
    addMsg('assistant',`已建立「${s.name}」项目，整理了美的墨西哥官网的产品基础资料。\n\n${s.productName} · ${s.model}\n${s.facts}\n\n在上方“资料”中查看来源。接下来补充目标人群、渠道要求与可用声明，再确认本次内容计划。`);
  }
  goProject(p.id);S.inspectorOpen=false;render();persist();
}
