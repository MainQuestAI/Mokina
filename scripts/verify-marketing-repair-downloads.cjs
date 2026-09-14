// 0.2.1 evidence only: these files were saved from actual browser downloads.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../output/playwright/downloads');
const read=n=>fs.readFileSync(path.join(dir,'fix021-'+n),'utf8');
const json=n=>JSON.parse(read(n));
function csv(text){
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
  assert.equal(quoted,false);if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}return rows;
}
const before=csv(read('social-v1.csv')),after=csv(read('social-v2.csv'));
assert.equal(before.length,6);assert.equal(after.length,6);
for(const i of [1,2,4,5])assert.deepEqual(before[i],after[i]);
for(const i of [0,1,2,3,4,6])assert.equal(before[3][i],after[3][i]);assert.notEqual(before[3][5],after[3][5]);
const three=csv(read('social-three.csv'));assert.equal(three.length,4);
assert.deepEqual(three.slice(1).map(r=>r[1]),['2026-09-21','2026-09-22','2026-09-23']);assert.ok(three.slice(1).every(r=>r[2]==='微信公众号'));
assert.match(read('social-three.md'),/下周3条/);assert.match(read('social-three.md'),/2026-09-23/);assert.match(read('social-three.md'),/v1/);
const brand=json('brand-reference.json'),memo=brand.artifacts.find(a=>a.kind==='marketing-memo'&&a.versions.length===2);
assert.equal(memo.accepted,2);assert.ok(brand.md.decisions.some(d=>d.artifactId===memo.id&&d.revision===2));
assert.doesNotMatch(memo.versions[0].data.sections.find(s=>s.id==='touchpoints').body,/小红书|答疑/);
assert.ok(brand.md.runs.some(r=>r.status==='cancelled'&&!r.completedIds.length));assert.equal(brand.artifacts.filter(a=>a.kind==='marketing-memo').length,2);
const partial=brand.md.snapshots.flatMap(s=>s.selected).filter(r=>r.selection);
assert.ok(partial.some(r=>r.revision===1));assert.ok(partial.some(r=>r.revision===2));
for(const r of partial){const a=brand.artifacts.find(a=>a.id===r.id),v=a.versions.find(v=>v.num===r.revision),sections=v.data.sections.filter(s=>r.selection.includes(s.id));assert.deepEqual(r.data.sections,sections);assert.equal(r.text,sections.map(s=>s.title+'\n'+s.body).join('\n\n'));if(r.revision===1)assert.doesNotMatch(r.text,/0.2.1 引用验证/);}
assert.match(read('reference-v2.md'),/0.2.1 引用验证：只面向有孩子家庭/);
const social=json('social-state.json');assert.ok(social.md.runs.some(r=>r.status==='interrupted'&&!r.completedIds.length));assert.ok(social.md.runs.at(-1).status==='done');assert.ok(Object.values(social.composerDrafts).includes('B 的草稿，A 完成不能覆盖'));
assert.ok(social.artifacts.every(a=>a.accepted===0));
const ops=json('operations-followup.json'),analysis=ops.artifacts.find(a=>a.kind==='operations-analysis'),followup=ops.artifacts.find(a=>a.kind==='social-calendar');
assert.equal(ops.artifacts.length,2);assert.equal(followup.versions[0].data.posts.length,3);
const ctx=ops.md.snapshots.find(s=>s.id===followup.versions[0].contextSnapshotId);assert.equal(ctx.selected.length,1);assert.equal(ctx.selected[0].type,'artifact');assert.equal(ctx.selected[0].id,analysis.id);assert.equal(ctx.selected[0].data.sections.length,1);assert.ok(!ops.uploads.some(u=>u.threadId===followup.threadId));
const rows=csv(read('operations.csv')).slice(1),sum=p=>rows.filter(r=>r[0]===p).reduce((v,r)=>[v[0]+Number(r[2]),v[1]+Number(r[3])],[0,0]);const p=sum('previous'),c=sum('current');assert.equal(p[1]/p[0],.0525);assert.equal(c[1]/c[0],.03875);
const professional=json('professional.json');assert.equal(professional.auto.finishedSteps,21);assert.equal(professional.auto.completed,true);assert.deepEqual(professional.submissions.map(s=>s.status),['returned','approved']);assert.ok(professional.submissions.every(s=>s.approvalScope==='internal-review'));assert.equal(professional.deliveries.length,0);
const product=json('product.json'),project=product.projects.find(p=>p.model==='QX-100');assert.deepEqual(project.channels,['web']);assert.deepEqual(product.artifacts.filter(a=>a.projectId===project.id).map(a=>a.kind),['strategy','fabe','mh','assets','web']);assert.equal(product.batches.find(b=>b.projectId===project.id).status,'ready');
const unpacked=json('unpacked.json');assert.deepEqual(unpacked.artifacts.map(a=>a.kind),['marketing-memo','social-calendar','operations-analysis']);assert.ok(unpacked.plans.every(p=>p.items.length===1));assert.equal(unpacked.artifacts[1].versions.length,2);assert.ok(unpacked.artifacts.every(a=>a.accepted===0));
assert.doesNotMatch(unpacked.artifacts[0].versions[0].data.sections.find(s=>s.id==='touchpoints').body,/小红书|答疑/);
for(const i of [0,1,3,4])assert.deepEqual(unpacked.artifacts[1].versions[0].data.posts[i],unpacked.artifacts[1].versions[1].data.posts[i]);
console.log('0.2.1 actual downloads verified: exclusions, adopted history, v1/v2 partial source consistency, five-post local delta, three-post channel/date exports, interrupted retry, B draft, CSV totals, selected continuation, 21-step professional story, single-channel new product.');
