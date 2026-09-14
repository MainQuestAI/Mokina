const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function harness() {
  const dock = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const document = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} } };
  const ctx = { document, window: {}, setTimeout, clearTimeout, console, Uint8Array, Date,
    requestAnimationFrame: cb => cb(), atob: x => Buffer.from(x, 'base64').toString('binary'),
    innerWidth: 1200, dock, messages: [], downloads: [], counter: 0 };
  vm.createContext(ctx);
  vm.runInContext(`
    const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const clone=x=>JSON.parse(JSON.stringify(x)); const uid=p=>p+'-'+(++counter); const now=()=>new Date().toISOString();
    const PEOPLE={lin:{name:'李林'},ana:{name:'Ana'},reviewer:{name:'审核人'}};
    const KIND={web:{name:'官网内容',domain:'material'},scene:{name:'场景',domain:'asset'},websitePoster:{name:'海报',domain:'material'}};
    const ASSET_FIXTURES=[]; const SOURCES=[]; const DRAFTS={};
    const MERGED_ASSETS={actionIcons:{},demoImages:['K01','K06','K07','K08','K09','K10','K11','PM00','PM01','PM04','FT01'].map(id=>({id,name:id,sha256:'hash-'+id,file:id+'.jpg',width:100,height:100,previewURL:id+'.jpg'}))};
    const S={actor:'lin',projectId:'p',threadId:'th',projects:[{id:'p',name:'项目',threadId:'th'}],threads:[{id:'th',messages:[]}],artifacts:[],tasks:[],submissions:[],deliveries:[],batches:[],uploads:[],imageViews:{},runs:[],settings:{speed:1},openCanvases:[]};
    let MODAL=null;
    function artifact(id){return S.artifacts.find(x=>x.id===id)}
    function revision(a,n){return a?.versions.find(x=>x.num===Number(n))}
    function project(id=S.projectId){return S.projects.find(x=>x.id===id)}
    function taskFor(kind,pid){return S.tasks.find(x=>x.kind===kind&&x.projectId===pid)}
    function currentSource(a){return revision(a,a.accepted||a.active)}
    function thread(){return S.threads[0]} function byKind(k){return S.artifacts.find(a=>a.kind===k)}
    function persist(){} function log(...args){messages.push(args.join(' '))} function render(){} function renderModal(){}
    function headerHTML(){return ''} function sidebarHTML(){return ''} function tasksHTML(){return ''} function chatHTML(){return ''}
    function conversationStart(){return false} function batchPanelHTML(){return ''} function renderBatchPanel(){} function batchLabel(b){return b.status}
    function taskRow(){return ''} function workStatusHTML(){return ''} function batchById(id){return S.batches.find(x=>x.id===id)}
    function recalcBatch(b){b.status=b.items.every(i=>['accepted','submitted','approved'].includes(i.decision))?'reviewed':'ready'}
    function selectedBatchItems(b){return b.items.filter(x=>x.selected!==false)}
    function showModal(kind,arg=''){MODAL={kind,arg};renderModal()} function closeModal(){MODAL=null}
    function modalFrame(title,body,foot){return '<h2>'+title+'</h2>'+body+foot} function dockRoot(){return dock} function mountDock(){}
    function canvasHTML(){return '<section><footer></footer></section>'} function contentHTML(){return ''} function versionsHTML(){return ''}
    function versionFiles(){return {}} function exportOne(){} function bindArtifactDiscussion(){} function captureConversationDraft(){}
    function demoImage(id){return MERGED_ASSETS.demoImages.find(x=>x.id===id)}
    function demoView(a,v){return S.imageViews[a.id+'|'+v.num]??={member:v.data.mainMember}}
    function demoCurrentMember(a,v){return demoView(a,v).member}
    async function preloadDemoFiles(vs){for(const v of vs)for(const f of v.data.files)window.DEMO_ORIGINALS[f.id]='data:image/jpeg;base64,YQ=='}
    function download(name,bytes,mime){downloads.push({name,bytes,mime})} function zipStore(files){return files}
    async function handle(action,arg){if(action==='adopt'){const [id,n]=arg.split('|');return adopt(id,Number(n))}if(action==='submit')return submitArtifact(arg);}
    window.DEMO_ORIGINALS={};
  `, ctx);
  for (const file of ['base/core.js', 'base/engine.js']) vm.runInContext(fs.readFileSync(path.join(root, 'src/demo-spacemaster-v6', file), 'utf8'), ctx, { filename: file });
  vm.runInContext(`toast=(m,e=false)=>messages.push({message:m,error:e}); openCanvas=(id,num)=>{S.canvas={id,num,tab:'content'};}; ingest=()=>{};`, ctx);
  for (const file of ['decision-ui.js', 'decision-refinement.js']) vm.runInContext(fs.readFileSync(path.join(root, 'src/demo-spacemaster-v6', file), 'utf8'), ctx, { filename: file });
  const run = code => vm.runInContext(code, ctx);
  return { ctx, run, state: run('S'), api: ctx.window.V62Decisions };
}

function addArtifact(h, image = false) {
  h.run(`
    S.tasks.push({id:'t',kind:'${image ? 'websitePoster' : 'web'}',projectId:'p',assignee:'lin',reviewer:'reviewer',maturity:'approved',requirement:'检查固定内容',status:'working'});
    S.artifacts.push({id:'a',title:'成果',kind:'${image ? 'websitePoster' : 'web'}',projectId:'p',taskId:'t',active:1,accepted:1,pending:null,versions:[{num:1,id:'v1',author:'lin',created:now(),refs:[],data:${image ? `{imageCollection:true,items:['K09','K10','K11'],files:['K09','K10','K11'].map(id=>clone(demoImage(id))),memberStates:{K09:{selected:true},K10:{selected:false},K11:{selected:false}},mainMember:'K09',language:'de-DE',country:'DE',variants:{K09:{language:'de-DE',country:'DE'},K10:{language:'fr',country:null},K11:{language:'ar',country:null}},renderRequests:[],summary:'官网海报',deliveryNote:'创意评审'}` : `{headline:'SpaceMaster',sections:[]}`}}]});
    S.canvas={id:'a',num:1,tab:'content'};
  `);
  return h.state.artifacts[0];
}

async function submitInternal(h) {
  h.run(`openDecisionSubmission([{id:'a',num:artifact('a').accepted}])`);
  await h.run(`handle('v62-submission-scope','internal-review')`);
  await h.run(`handle('decision-submit-check')`);
  await h.run(`handle('v62-submission-confirm','confirmed')`);
  await h.run(`handle('decision-submit-final')`);
  return h.state.submissions.at(-1);
}

test('declining a candidate preserves the adopted version, history and the old submission snapshot', async () => {
  const h = harness(), a = addArtifact(h), old = JSON.stringify(a.versions[0]);
  const submission = await submitInternal(h), snapshot = JSON.stringify(submission.snapshot);
  h.run(`addRevision(artifact('a'),{headline:'不满意的新标题'},'新建议',[]);S.canvas.num=2;`);
  assert.equal(h.run('pendingAdoptions().length'), 1);
  await h.run(`handle('v62-candidate-decline','a|2')`);
  assert.equal(a.accepted, 1); assert.equal(a.active, 1); assert.equal(a.pending, null);
  assert.equal(a.versions.length, 2); assert.equal(a.candidateDecisions[2].status, 'declined');
  assert.equal(h.run('pendingAdoptions().length'), 0); assert.equal(JSON.stringify(a.versions[0]), old);
  assert.equal(JSON.stringify(submission.snapshot), snapshot);
  await h.run(`handle('v62-withdraw','${submission.id}')`);
  assert.equal(h.run(`decisionSubmissionReason(artifact('a'),1)`), '');
  await h.run(`handle('v62-candidate-reopen','a|2')`);
  assert.equal(a.pending, 2); assert.equal(h.run('pendingAdoptions().length'), 1);
  assert.equal(a.candidateDecisions[2].history.length, 2);
});

test('defer first candidate removes its pending count without inventing an adopted result', async () => {
  const h = harness(), a = addArtifact(h);
  a.accepted = 0; a.pending = 1;
  await h.run(`handle('v62-candidate-defer','a|1')`);
  assert.equal(a.accepted, 0); assert.equal(a.versions.length, 1);
  assert.equal(h.run('pendingAdoptions().length'), 0);
  await h.run(`handle('v62-candidate-reopen','a|1')`);
  assert.equal(h.run('pendingAdoptions().length'), 1);
});

test('selection cancellation creates a new collection version and zero selection cannot complete delivery', async () => {
  const h = harness(), a = addArtifact(h, true), before = JSON.stringify(a.versions[0]);
  await h.run(`handle('demo-member-adopt')`);
  assert.equal(a.versions.length, 2); assert.equal(JSON.stringify(a.versions[0]), before);
  assert.equal(h.api.selectedIds(a.versions[1]).length, 0);
  h.run(`adopt('a',2)`);
  assert.equal(a.accepted, 1);
  await h.run(`handle('v62-export-selected','a|2')`);
  assert.equal(h.ctx.downloads.length, 0);
  await h.run(`handle('demo-member-adopt')`);
  assert.equal(h.api.selectedIds(a.versions[2]).join(','), 'K09');
  h.run(`adopt('a',3)`); assert.equal(a.accepted, 3);
});

test('German selection cannot absorb French or Arabic members, and known person defects cannot be selected', async () => {
  const h = harness(), a = addArtifact(h, true);
  for (const id of ['K10', 'K11']) {
    h.run(`demoView(artifact('a'),revision(artifact('a'),1)).member='${id}'`);
    await h.run(`handle('demo-member-adopt')`);
    assert.equal(a.versions.length, 1);
  }
  a.versions[0].data.items.push('PM04'); a.versions[0].data.files.push(h.run(`clone(demoImage('PM04'))`));
  assert.equal(h.api.memberAssessment(a, a.versions[0], 'PM04').selectable, false);
});

test('file readability is distinct from authenticity, rights and local declarations', () => {
  const h = harness(), a = addArtifact(h, true), result = h.run(`inspectContent(artifact('a'),revision(artifact('a'),1))`);
  assert.equal(result.passed, true); assert.equal(result.previewReady, true); assert.equal(result.formalReady, false);
  assert.equal(result.layers.find(x => x.key === 'file').status, 'checked');
  assert.equal(result.layers.find(x => x.key === 'claims').status, 'pending');
  assert.equal(result.layers.find(x => x.key === 'rights').status, 'pending');
  a.versions[0].data.files[0].sha256 = 'wrong';
  assert.equal(h.run(`inspectContent(artifact('a'),revision(artifact('a'),1)).passed`), false);
});

test('formal submission remains blocked while explicit internal review pins selected members and scope', async () => {
  const h = harness(), a = addArtifact(h, true);
  h.run(`openDecisionSubmission([{id:'a',num:1}])`);
  await h.run(`handle('decision-submit-check')`);
  assert.equal(h.state.submissions.length, 0);
  assert.match(h.run('decisionSubmission.error'), /真实性|授权|声明/);
  await h.run(`handle('v62-submission-scope','internal-review')`);
  await h.run(`handle('decision-submit-check')`);
  await h.run(`handle('decision-submit-final')`);
  assert.equal(h.state.submissions.length, 0);
  await h.run(`handle('v62-submission-confirm','confirmed')`);
  await h.run(`handle('decision-submit-final')`);
  const s = h.state.submissions[0];
  assert.equal(s.approvalScope, 'internal-review'); assert.equal(s.deliveryScope.members.join(','), 'K09');
  assert.match(s.scopeStatement, /不代表真实性/);
  h.run(`S.actor='reviewer';reviewDecision('${s.id}','approved','创意方向可用于内部讨论')`);
  assert.equal(s.status, 'approved'); assert.equal(h.run(`versionLabel(artifact('a'),1)[0]`), '内部评审通过');
  assert.equal(a.versions[0].data.memberStates.K10.selected, false);
  assert.equal(h.state.deliveries.length, 0); assert.equal(h.state.tasks[0].status, 'working');
  assert.equal(h.state.tasks[0].internalReview.status, 'approved');
});

test('withdrawal is limited to the pending submitter who still owns the task', async () => {
  const h = harness(); addArtifact(h);
  const s = await submitInternal(h), snapshot = JSON.stringify(s.snapshot);
  h.run(`S.actor='reviewer'`); await h.run(`handle('v62-withdraw','${s.id}')`); assert.equal(s.status, 'pending');
  h.run(`S.actor='lin';S.tasks[0].assignee='ana'`); await h.run(`handle('v62-withdraw','${s.id}')`); assert.equal(s.status, 'pending');
  h.run(`S.tasks[0].assignee='lin'`); await h.run(`handle('v62-withdraw','${s.id}')`); assert.equal(s.status, 'withdrawn');
  assert.equal(JSON.stringify(s.snapshot), snapshot);
  h.run(`S.actor='reviewer';reviewDecision('${s.id}','approved','晚到决定')`); assert.equal(s.status, 'withdrawn');
});

test('returned fixed version requires a new candidate, adoption and recheck before resubmission', async () => {
  const h = harness(), a = addArtifact(h);
  const old = await submitInternal(h), snapshot = JSON.stringify(old.snapshot);
  h.run(`S.actor='reviewer';reviewDecision('${old.id}','returned','缩短标题')`);
  assert.equal(old.status, 'returned');
  h.run(`S.actor='lin'`);
  assert.match(h.run(`decisionSubmissionReason(artifact('a'),1)`), /已经退回/);
  await h.run(`handle('v62-revise-return','${old.id}')`);
  assert.equal(a.pending, 2); assert.equal(a.versions[1].returnedSubmissionId, old.id);
  h.run(`adopt('a',2)`);
  assert.match(h.run(`decisionSubmissionReason(artifact('a'),2)`), /尚未包含.*具体修改/);
  h.run(`addRevision(artifact('a'),{headline:'简短标题'},'按意见修改',[]);adopt('a',3)`);
  const next = await submitInternal(h);
  assert.notEqual(next.id, old.id); assert.equal(next.revision, 3); assert.equal(JSON.stringify(old.snapshot), snapshot);
});

test('selected delivery exports omit unselected languages while candidate archive retains history', async () => {
  const h = harness(); addArtifact(h, true);
  await h.run(`handle('v62-export-selected','a|1')`);
  const files = h.ctx.downloads[0].bytes;
  assert.ok(files['K09.jpg']); assert.equal(files['K10.jpg'], undefined); assert.equal(files['K11.jpg'], undefined);
  assert.equal(JSON.parse(files['snapshot.json']).members.join(','), 'K09');
  await h.run(`handle('v62-export-history','a|1')`);
  const all = h.ctx.downloads[1].bytes;
  assert.ok(all['v1/K10.jpg']); assert.ok(all['v1/K11.jpg']);
  assert.equal(JSON.parse(all['selection-manifest.json']).commercialUseVerified, false);
});

test('closing a batch candidate keeps its version link but removes the adoption action', async () => {
  const h = harness(); addArtifact(h);
  h.run(`addRevision(artifact('a'),{headline:'candidate'},'new',[]);S.batches.push({id:'b',status:'ready',items:[{artifactId:'a',revision:2,status:'ready',decision:'pending',selected:true}]})`);
  await h.run(`handle('v62-candidate-decline','a|2')`);
  assert.equal(h.state.batches[0].items[0].revision, 2);
  assert.equal(h.state.batches[0].items[0].decision, 'declined');
  assert.equal(h.run(`batchDecisionCounts(S.batches[0]).adopt.length`), 0);
});

test('member adoption advances the active batch result while keeping the plan and prior execution result', async () => {
  const h = harness(), a = addArtifact(h, true);
  h.run(`S.batches.push({id:'b',status:'ready',plan:{revision:1,country:'DE'},items:[{taskId:'t',artifactId:'a',revision:1,status:'ready',decision:'pending',checks:[],selected:true}]});
    S.batches.push({id:'unrelated',status:'running',items:[{artifactId:'other',revision:1,status:'making',decision:'pending'}]});`);
  const plan = JSON.stringify(h.state.batches[0].plan), original = JSON.stringify(a.versions[0]);
  await h.run(`handle('demo-member-adopt')`);
  await h.run(`handle('demo-member-adopt')`);
  assert.equal(h.state.batches[0].items[0].candidateRevision, 3);
  h.run(`adopt('a',3)`);
  const item = h.state.batches[0].items[0];
  assert.equal(item.revision, 3); assert.equal(item.decision, 'accepted'); assert.equal(item.candidateRevision, null);
  assert.equal(item.resultHistory[0].revision, 1); assert.equal(item.checks.at(-1).revision, 3);
  assert.equal(JSON.stringify(h.state.batches[0].plan), plan); assert.equal(JSON.stringify(a.versions[0]), original);
  assert.equal(h.state.batches[1].status, 'running');
});

test('legacy adopted members are read compatibly without rewriting fixed historical data', () => {
  const h = harness(), a = addArtifact(h, true), v = a.versions[0];
  v.data.memberStates.K09 = { adopted: true }; v.data.memberStates.K10 = { adopted: true, selected: false };
  const before = JSON.stringify(v);
  assert.equal(h.api.selectedIds(v).join(','), 'K09'); assert.equal(JSON.stringify(v), before);
});

test('the visible member evidence form saves a fixed record into a new candidate and preserves prior submission', async () => {
  const h = harness(), a = addArtifact(h, true), s = await submitInternal(h);
  const versionBefore = JSON.stringify(a.versions[0]), submissionBefore = JSON.stringify(s.snapshot);
  await h.run(`handle('v62-member-evidence-open','a|1|K09')`);
  const html = h.run(`v62EvidenceFormHTML(artifact('a'),revision(artifact('a'),1),'K09')`);
  assert.match(html, /hash-K09/); assert.match(html, /de-DE/); assert.match(html, /证据定位/); assert.match(html, /核对责任人/);
  const form = { fields: { key: 'rights', evidence: '授权文件明确允许指定德语官网场景使用此图片。', locator: '授权书 DE-2026 第 2 页', reviewer: '王敏 / 品牌团队', confirmed: 'on', expiresAt: '2099-12-31' } };
  h.ctx.document.querySelector = selector => selector === '#v62-member-evidence-form' ? form : null;
  h.ctx.FormData = function(node) { return Object.entries(node.fields); };
  await h.run(`handle('v62-member-evidence-save','a|1|K09')`);
  assert.equal(a.versions.length, 2); assert.equal(a.pending, 2); assert.equal(a.accepted, 1);
  const record = a.versions[1].data.memberReviews.K09.rights;
  assert.equal(record.fileSha256, 'hash-K09'); assert.equal(record.country, 'DE'); assert.equal(record.language, 'de-DE');
  assert.equal(record.locator, form.fields.locator); assert.equal(record.reviewer, form.fields.reviewer);
  assert.equal(record.externalApprovalVerified, false);
  assert.equal(h.api.memberAssessment(a, a.versions[1], 'K09').layers.find(x => x.key === 'rights').status, 'user-confirmed');
  assert.equal(h.api.assess(a, a.versions[1]).formalReady, false);
  assert.equal(JSON.stringify(a.versions[0]), versionBefore); assert.equal(JSON.stringify(s.snapshot), submissionBefore);
});

test('member evidence requires location, responsible person, scope, a valid future expiry and current edit authority', () => {
  const h = harness(), a = addArtifact(h, true);
  const fields = { key: 'rights', evidence: '已核对该固定图片适用于德国官网评审与使用。', locator: '授权书第 2 页', reviewer: '品牌团队王敏', confirmed: true };
  for (const extra of [{ locator: '' }, { reviewer: '' }, { expiresAt: '2020-01-01' }, { expiresAt: '2099-02-31' }, { confirmed: false }]) {
    assert.throws(() => h.api.recordMemberEvidence(a, 1, 'K09', { ...fields, ...extra }));
  }
  assert.throws(() => h.api.recordMemberEvidence(a, 1, 'K10', fields), /市场或语言待确认/);
  h.state.actor = 'reviewer'; assert.throws(() => h.api.recordMemberEvidence(a, 1, 'K09', fields), /负责人/);
  assert.equal(a.versions.length, 1);
});

test('user evidence cannot overwrite a known defect or silently apply to a changed file hash', () => {
  const h = harness(), a = addArtifact(h, true), v = a.versions[0];
  v.data.items.push('PM04'); v.data.files.push(h.run(`clone(demoImage('PM04'))`));
  const fields = { key: 'authenticity', evidence: '仅填写说明并不能证明已经修正这张人物候选图片。', locator: '复核记录 3', reviewer: '产品团队李明', confirmed: true };
  assert.throws(() => h.api.recordMemberEvidence(a, 1, 'PM04', fields), /实际返修/);
  const next = h.api.recordMemberEvidence(a, 1, 'K09', { ...fields, key: 'rights' });
  next.data.files.find(f => f.id === 'K09').sha256 = 'changed-hash';
  const result = h.api.memberAssessment(a, next, 'K09');
  assert.equal(result.readable, false); assert.equal(result.layers.find(x => x.key === 'rights').status, 'pending');
});

test('new evidence history is versioned and expired evidence is not considered confirmed', () => {
  const h = harness(), a = addArtifact(h, true);
  const fields = { key: 'rights', evidence: '授权书确认该德语官网固定图片在指定范围内使用。', locator: '授权书第 2 页', reviewer: '品牌团队王敏', confirmed: true };
  const first = h.api.recordMemberEvidence(a, 1, 'K09', fields), snapshot = JSON.stringify(first);
  const next = h.api.recordMemberEvidence(a, first.num, 'K09', { ...fields, locator: '授权书续期记录第 3 页' });
  assert.equal(next.data.memberReviews.K09.rights.history.length, 2); assert.equal(JSON.stringify(first), snapshot);
  next.data.memberReviews.K09.rights.expiresAt = '2020-01-01T00:00:00Z';
  assert.equal(h.api.memberAssessment(a, next, 'K09').layers.find(x => x.key === 'rights').status, 'pending');
});

test('structured project-input drafts can be previewed but cannot pass formal content readiness', () => {
  const h = harness(), a = addArtifact(h), v = a.versions[0];
  v.data.projectInputDraft = true; v.data.modelCalled = false; v.data.imageGenerated = false;
  const check = h.run(`inspectContent(artifact('a'),revision(artifact('a'),1))`);
  assert.equal(check.previewReady, true); assert.equal(check.formalReady, false);
  assert.equal(check.layers.find(x => x.key === 'formal-content').status, 'pending');
  assert.match(h.api.scopeReason(a, v, 'formal-use'), /结构化草稿/);
  assert.equal(h.api.scopeReason(a, v, 'internal-review'), '');
});
