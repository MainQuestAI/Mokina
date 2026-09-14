const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/marketing-desktop/marketing-desktop.js'),'utf8');

function boot(){
  const store=new Map();
  const noop=()=>{};
  const context={
    APP_VERSION:'6.2.0',S:{},KIND:{},console,Date,Math,JSON,setTimeout,clearTimeout,
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
    window:{},toast:noop,render:noop,headerHTML:noop,sidebarHTML:noop,homeHTML:noop,tasksHTML:noop,libraryHTML:noop,filesHTML:noop,contentHTML:noop,refsHTML:noop,artifactCard:noop,
    handle:noop,sendPrompt:noop,handleFiles:noop,renderModal:()=>'',persist:noop,openCanvas:noop,
    document:{createElement:()=>({click:noop}),getElementById:()=>null},
    Blob:class{},URL:{createObjectURL:()=>'',revokeObjectURL:noop}
  };
  vm.createContext(context);vm.runInContext(source,context,{filename:'marketing-desktop.js'});return context.window.MarketingDesktop;
}

test('运营 CSV 真实计算指定样例的总体互动率和变化',()=>{
  const api=boot();
  const result=api.parseCsv(api.fixtures.find(x=>x.id==='mkt-analytics-csv').text);
  assert.equal(result.before.rate,5.25);
  assert.equal(result.after.rate,3.875);
  assert.equal(result.change,-1.375);
  assert.equal(result.byType.length,4);
});

test('CSV 对缺列、非数值、零分母给出具体错误',()=>{
  const api=boot();
  assert.throws(()=>api.parseCsv('period,impressions,interactions\n2026-08,1,1'),/缺少字段：content_type/);
  assert.throws(()=>api.parseCsv('period,content_type,impressions,interactions\n2026-08,A,no,1'),/impressions 必须为非负数/);
  assert.throws(()=>api.parseCsv('period,content_type,impressions,interactions\n2026-08,A,0,0\n2026-09,A,1,1'),/曝光量为 0/);
});

test('品牌工作保存计划不产生成果，生成后成果固定所属工作和依据',()=>{
  const api=boot(),t=api.testing;
  const work=t.createWork('brand');
  t.createPlan(work);
  assert.equal(api.state().artifacts.length,0);
  t.generate('brand');
  const artifact=api.state().artifacts[0];
  assert.equal(artifact.workId,work.id);
  assert.equal(artifact.versions[0].refs.length,2);
  assert.match(artifact.versions[0].data.sections[3].text,/不创建产品项目/);
});

test('修订创建候选版本，不改写初稿',()=>{
  const api=boot(),t=api.testing,work=t.createWork('social');
  const artifact=t.createArtifact(work,'socialPlan',t.socialData(),'九月社媒内容计划');
  const original=artifact.versions[0].data.items[2].copy;
  const changed={...artifact.versions[0].data,items:artifact.versions[0].data.items.map((x,i)=>i===2?{...x,copy:'第三条候选文案'}:x)};
  t.reviseArtifact(artifact,changed,'第三条候选');
  assert.equal(artifact.versions.length,2);
  assert.equal(artifact.versions[0].data.items[2].copy,original);
  assert.equal(artifact.versions[1].data.items[2].copy,'第三条候选文案');
  assert.equal(artifact.versions[1].data.items[0].copy,artifact.versions[0].data.items[0].copy);
});

test('入口使用独立存储键，且构建产物保留 V6.2 对照入口',()=>{
  assert.match(source,/mokina-marketing-desktop-prototype/);
  const build=fs.readFileSync(path.join(root,'src/marketing-desktop/build.mjs'),'utf8');
  assert.match(build,/Lilith SpaceMaster Demo V6\.html/);
  assert.match(build,/Marketing Desktop Demo\.html/);
});
