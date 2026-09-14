/* V6.2: candidate decisions, explicit delivery members, and scoped approvals. */
const V62_DECISION_PREVIOUS = {
  handle, renderModal, canvasHTML, contentHTML, versionsHTML, versionLabel,
  pendingAdoptions, adopt, inspectContent, decisionSubmissionReason,
  renderDecisionSubmission, decisionSubmitHTML, reviewDecision, recalcBatch,
  versionFiles, exportOne, documentText, batchDecisionCounts,
  checkArtifact, batchPanelHTML, commitSubmission: DECISION_UI.submitArtifact
};

function v62SelectedIds(v) {
  return (v?.data?.items || []).filter(id => {
    const state = v.data.memberStates?.[id];
    return typeof state?.selected === 'boolean' ? state.selected : state?.adopted === true;
  });
}

function v62MemberScope(a, v, id) {
  const variant = v.data.variants?.[id];
  if (variant) return { country: variant.country || null, language: variant.language || null };
  const saved = v.data.memberReviewScopes?.[id], context = v.data.inputSnapshot?.context || project(a.projectId);
  return { country: saved?.country || v.data.country || context?.market || null,
    language: saved?.language || v.data.language || context?.language || null };
}

function v62MemberAssessment(a, v, id) {
  const file = v?.data?.files?.find(f => f.id === id);
  const known = typeof demoImage === 'function' ? demoImage(id) : null;
  const state = v?.data?.memberStates?.[id] || {};
  const variant = v?.data?.variants?.[id];
  const scope = v62MemberScope(a, v, id);
  const readable = !!file && state.status !== 'failed' && !!known && file.sha256 === known.sha256;
  const changedPerson = /^PM0[1-4]$/.test(id), knownDefect = changedPerson || state.status === 'needs_revision';
  const declared = /^(K0[89]|K1[01]|FT0[1-4])$/.test(id);
  const hasScope = !variant || (variant.country && variant.country === v.data.country && variant.language === v.data.language);
  const layers = [
    { key: 'file', label: '文件可读', status: readable ? 'checked' : 'failed', detail: readable ? '归档文件与固定哈希一致；不证明产品真实。' : '文件缺失、读取失败或哈希与归档不一致，请恢复此成员。' },
    { key: 'authenticity', label: '产品真实性', status: knownDefect ? 'failed' : 'pending', detail: changedPerson ? '存在超出只换人物的变化，请返修产品、文字、背景或画幅。' : knownDefect ? '此成员已被标记为待返修，请先处理已知问题。' : id === 'K06' ? '缺少实物背面对照，结构真实性待产品责任人核对。' : '产品身份与画面细节待产品责任人按适用型号核对。' },
    { key: 'rights', label: '使用授权', status: 'pending', detail: 'Canva / 用户提供仅说明来源；缺少适用范围与商业使用授权依据。' },
    { key: 'claims', label: '本地声明', status: declared ? 'pending' : 'not-applicable', detail: declared ? '图内安装、参数或功能声明缺少本市场依据，待对应责任人核验。' : '本轮未列出特定声明；不代表法规或发布认证。' },
    { key: 'scope', label: '市场与语言', status: hasScope ? 'checked' : 'pending', detail: hasScope ? '成员属于本次市场与语言范围。' : '目标国家未选定或语言不属于本次交付；请另建该市场的交付范围。' }
  ];
  // A saved user record can supply evidence, but cannot silently override a known defect.
  for (const layer of layers) {
    const evidence = v.data.memberReviews?.[id]?.[layer.key];
    if (layer.status !== 'pending' || !evidence) continue;
    if (evidence.status === 'confirmed' && evidence.evidence?.trim() && evidence.locator?.trim() && evidence.reviewer?.trim() &&
        evidence.fileSha256 === file?.sha256 && evidence.country === scope.country &&
        evidence.language === scope.language && !evidence.revoked &&
        (!evidence.expiresAt || Date.parse(evidence.expiresAt) > Date.now())) {
      layer.status = 'user-confirmed';
      layer.detail = '用户核对记录：' + evidence.evidence + '；定位：' + (evidence.locator || '历史记录未登记定位') + '；责任人：' + evidence.reviewer + '。未代替外部审批。';
    }
  }
  return { id, readable, selectable: readable && !knownDefect && !!hasScope, layers,
    formalReady: layers.every(x => ['checked', 'user-confirmed', 'not-applicable'].includes(x.status)) };
}

function v62Assess(a, v) {
  if (!a || !v) return { previewReady: false, formalReady: false, selectedIds: [], layers: [], reason: '成果版本不存在。' };
  if (!v.data.imageCollection) {
    const check = V62_DECISION_PREVIOUS.inspectContent(a, v);
    const layers = (check.findings || []).map((x, i) => ({ key: 'content-' + i, label: x.title, status: x.ok ? 'checked' : 'failed', detail: x.detail }));
    if (v.data.projectInputDraft || check.draftOnly) layers.push({ key: 'formal-content', label: '正式内容与图片', status: 'pending', detail: '当前仅按项目输入整理结构和证据摘录，尚未形成并验证正式宣传文案、成品图片、真实性与使用授权。需要完成对应内容制作与核验后形成新版本。' });
    const formalReady = !!check.passed && !v.data.projectInputDraft && !check.draftOnly;
    return { previewReady: !!check.passed, formalReady, selectedIds: [], layers,
      reason: !check.passed ? '内容检查存在未处理问题，请修改后重新检查。' : !formalReady ? '这是项目输入的结构化草稿；正式文案、图片与使用条件尚未完成，只可用于内部讨论。' : '' };
  }
  const selectedIds = v62SelectedIds(v), members = selectedIds.map(id => v62MemberAssessment(a, v, id));
  const pendingRender = (v.data.renderRequests || []).filter(r => selectedIds.includes(r.member) && r.status !== 'done');
  const previewReady = members.every(x => x.readable) && !pendingRender.some(x => x.blocksSubmission);
  const layers = members.flatMap(member => member.layers.map(x => ({ ...x, member: member.id })));
  if (pendingRender.length) layers.push({ key: 'render', label: '图片修改', status: 'pending', detail: '所选成员仍有待渲染要求；原图可查看，不能描述为像素已经更新。' });
  const formalReady = selectedIds.length > 0 && previewReady && members.every(x => x.formalReady) && !pendingRender.length;
  return { previewReady, formalReady, selectedIds, layers,
    reason: !selectedIds.length ? '尚未选择交付成员。请选用至少一张图片，或下载全部候选用于查看。' : !previewReady ? '所选成员存在文件或阻塞修改问题，请定位成员处理。' : !formalReady ? '所选成员的真实性、授权或本地声明尚未核实，仅可用于内部创意评审。' : '' };
}

function v62Scope(v) {
  return { members: v.data.imageCollection ? v62SelectedIds(v) : [], country: v.data.country || null,
    language: v.data.language || null, selectionVersion: v.num };
}

function v62ScopeReason(a, v, scope = 'formal-use') {
  const result = v62Assess(a, v);
  if (v?.data.imageCollection && !result.selectedIds.length) return result.reason;
  if (!result.previewReady) return result.reason;
  if (scope !== 'internal-review' && !result.formalReady) return result.reason;
  return '';
}

inspectContent = function(a, v) {
  const old = V62_DECISION_PREVIOUS.inspectContent(a, v), assessment = v62Assess(a, v);
  return { ...old, passed: assessment.previewReady, previewReady: assessment.previewReady,
    formalReady: assessment.formalReady, checkScope: 'internal-preview', deliveryScope: v62Scope(v),
    layers: assessment.layers,
    findings: assessment.layers.map(x => ({ title: (x.member ? x.member + ' · ' : '') + x.label,
      ok: ['checked', 'user-confirmed', 'not-applicable'].includes(x.status), status: x.status, detail: x.detail })) };
};

checkArtifact = async function(id) {
  const a = artifact(id || S.canvas?.id); if (!a) return toast('先打开需要检查的成果。');
  const num = S.canvas?.id === a.id ? S.canvas.num : a.pending || a.active, v = revision(a, num);
  return runWork('check', () => {
    const check = inspectContent(a, v); a.checks ??= {}; a.checks[num] = check;
    log('完成分级检查', a.title + ' v' + num + ' · ' + (check.previewReady ? '可继续内部预览' : '有问题待处理') + ' · ' + (check.formalReady ? '当前规则未列出正式使用阻塞' : '正式使用待核验'), a.projectId);
    return { artifactIds: [a.id], check, text: check.previewReady ? '内部预览检查完成。请分别查看真实性、授权与本地声明；提交时明确选择内部创意评审或正式使用审批。' : '所选范围存在文件或内容问题，请按检查明细处理后重试。' };
  });
};

pendingAdoptions = function() {
  return V62_DECISION_PREVIOUS.pendingAdoptions().filter(({ a, num }) => !['declined', 'deferred'].includes(a.candidateDecisions?.[num]?.status));
};

versionLabel = function(a, num) {
  const approved = approvalFor(a, num);
  if (approved?.approvalScope === 'internal-review') return ['内部评审通过', 'blue'];
  const record = a.candidateDecisions?.[num];
  if (record?.status === 'declined') return ['不采用', ''];
  if (record?.status === 'deferred') return ['暂不处理', ''];
  return V62_DECISION_PREVIOUS.versionLabel(a, num);
};

function v62RecordCandidate(a, num, status, reason) {
  const v = revision(a, num);
  if (!v || !canWrite(a)) return false;
  if (a.accepted === num || approvalFor(a, num) || S.submissions.some(s => s.artifactId === a.id && s.revision === num && s.status === 'pending')) {
    toast('此版本已采用或已提交，请处理当前新候选；固定提交需由提交人撤回。', true); return false;
  }
  if (status !== 'pending' && a.pending !== num) { toast('这已不是当前待处理候选，请重新查看版本。', true); return false; }
  if (status === 'pending' && a.pending && a.pending !== num) { toast('已有另一个待处理候选，请先处理 v' + a.pending + '。', true); return false; }
  a.candidateDecisions ??= {};
  const previous = a.candidateDecisions[num];
  const entry = { status, reason, actor: S.actor, at: now() };
  a.candidateDecisions[num] = { ...entry, history: [...(previous?.history || []), entry] };
  if (status === 'pending') a.pending = num;
  else if (a.pending === num) a.pending = null;
  if (a.accepted) a.active = a.accepted;
  for (const b of S.batches || []) {
    let changed = false;
    for (const i of b.items.filter(i => i.artifactId === a.id && i.revision === num && !['submitted', 'approved'].includes(i.decision))) {
      i.decision = status; i.reviewedBy = S.actor; i.reviewedAt = now(); i.feedback = reason;
      changed = true;
    }
    for (const i of b.items.filter(i => i.artifactId === a.id && i.candidateRevision === num)) { i.candidateRevision = status === 'pending' ? num : null; changed = true; }
    if (changed) recalcBatch(b);
  }
  const t = S.tasks.find(t => t.id === a.taskId);
  if (t && status !== 'pending' && a.accepted && t.maturity === 'draft') t.status = 'done';
  log(status === 'pending' ? '重新考虑候选' : status === 'deferred' ? '暂不处理候选' : '不采用候选', a.title + ' v' + num + ' · ' + reason, a.projectId);
  render(); persist(); return true;
}

recalcBatch = function(b) {
  if (['running', 'paused', 'cancelled', 'interrupted', 'failed'].includes(b.status)) return;
  V62_DECISION_PREVIOUS.recalcBatch(b);
  if (!['running', 'paused', 'cancelled', 'interrupted', 'failed'].includes(b.status) &&
      b.items.length && b.items.every(i => ['accepted', 'submitted', 'approved', 'internal_reviewed', 'declined', 'deferred'].includes(i.decision))) b.status = 'reviewed';
};

batchPanelHTML = function(b) {
  return V62_DECISION_PREVIOUS.batchPanelHTML(b).replaceAll('internal_reviewed', '内部评审通过').replaceAll('declined', '不采用').replaceAll('deferred', '暂不处理');
};

batchDecisionCounts = function(b) {
  const counts = V62_DECISION_PREVIOUS.batchDecisionCounts(b);
  counts.adopt = counts.adopt.filter(i => {
    const a = artifact(i.artifactId), v = revision(a, i.revision);
    return !['declined', 'deferred'].includes(a.candidateDecisions?.[i.revision]?.status) && (!v.data.imageCollection || v62SelectedIds(v).length);
  });
  return counts;
};

adopt = function(id, num) {
  const a = artifact(id); num = Number(num) || a?.pending || a?.active;
  const v = a && revision(a, num); if (!v || !canWrite(a)) return;
  if (['declined', 'deferred'].includes(a.candidateDecisions?.[num]?.status)) return toast('此候选已退出待处理。请在版本记录中选择“重新考虑”后采用。', true);
  if (v.data.imageCollection && !v62SelectedIds(v).length) return toast('请至少选用一张图片后再采用集合；全部候选仍可查看与下载。', true);
  const assessment = v62Assess(a, v);
  if (!assessment.previewReady) return toast(assessment.reason, true);
  const result = V62_DECISION_PREVIOUS.adopt(id, num);
  if (a.accepted !== num) return result;
  // The execution plan and old result history remain fixed; only the current result pointer advances.
  for (const b of S.batches || []) {
    let changed = false;
    for (const i of b.items.filter(i => i.artifactId === id && (!i.taskId || i.taskId === a.taskId) &&
        !['submitted', 'approved', 'internal_reviewed'].includes(i.decision) && i.revision !== num)) {
      i.resultHistory ??= [];
      i.resultHistory.push({ revision: i.revision, decision: i.decision, status: i.status, checks: clone(i.checks || []), replacedAt: now() });
      i.revision = num; i.candidateRevision = null; i.decision = 'accepted'; i.status = 'ready'; i.error = null;
      i.reviewedBy = S.actor; i.reviewedAt = now(); i.checks ??= []; i.checks.push(clone(inspectContent(a, v))); changed = true;
    }
    if (changed) recalcBatch(b);
  }
  render(); persist(); return result;
};

decisionSubmissionReason = function(a, num) {
  const original = V62_DECISION_PREVIOUS.decisionSubmissionReason(a, num);
  const internalOnly = original === '这个版本已经批准' && S.submissions.filter(s => s.artifactId === a.id && s.revision === num && s.status === 'approved').every(s => s.approvalScope === 'internal-review');
  if (original && !(internalOnly && v62SubmissionScope() === 'formal-use')) return original;
  const v = revision(a, num);
  if (v.data.imageCollection && !v62SelectedIds(v).length) return '请至少选择一个交付成员。';
  if (S.submissions.some(s => s.artifactId === a.id && s.revision === num && s.status === 'returned')) return '这个固定版本已经退回，请依据退回意见形成新候选、采用并重新检查。';
  const returned = S.submissions.findLast(s => s.artifactId === a.id && s.status === 'returned' && s.revision < num);
  if (returned) {
    const normalized = data => { const copy = clone(data); delete copy.reviewFeedback; return JSON.stringify(copy); };
    if (normalized(v.data) === normalized(returned.snapshot.data)) return '新候选尚未包含退回后的具体修改，请先按意见修改内容再提交。';
  }
  return '';
};

function v62WithdrawalReason(s, actor = S.actor, authorized = null) {
  if (!s) return '提交不存在。';
  if (s.status !== 'pending') return '仅可撤回仍在等待审批的提交。';
  if (s.submitter !== actor) return '仅原提交人可撤回此提交。';
  const a = artifact(s.artifactId);
  if (authorized === null) authorized = !!a && canWrite(a, false);
  return authorized ? '' : '当前已无这份成果的编辑权限，请联系任务负责人。';
}

function v62Withdraw(sid) {
  const s = S.submissions.find(x => x.id === sid), reason = v62WithdrawalReason(s);
  if (reason) return toast(reason, true);
  s.status = 'withdrawn'; s.withdrawn = now(); s.withdrawnBy = S.actor; s.withdrawalReason = '提交人撤回固定版本，准备继续修改或重新提交。';
  const t = S.tasks.find(t => t.id === s.taskId); if (t) t.status = 'working';
  for (const b of S.batches || []) { const rows = b.items.filter(i => i.artifactId === s.artifactId && i.revision === s.revision && i.decision === 'submitted'); for (const i of rows) i.decision = 'accepted'; if (rows.length) recalcBatch(b); }
  log('已撤回提交', s.title + ' v' + s.revision + '；快照与历史保留。', s.projectId);
  closeModal(); render(); persist();
}

function v62ReviseReturn(sid) {
  const s = S.submissions.find(x => x.id === sid), a = s && artifact(s.artifactId);
  if (!s || s.status !== 'returned' || !a || !canWrite(a)) return toast('请由成果负责人处理已退回的提交。', true);
  if (a.pending) return openCanvas(a.id, a.pending);
  const data = clone(s.snapshot.data); data.reviewFeedback = s.reviewComment;
  const next = addRevision(a, data, '按退回意见开始修订：' + s.reviewComment, s.snapshot.refs);
  if (!next) return;
  next.returnedSubmissionId = s.id;
  openCanvas(a.id, next.num);
  bindArtifactDiscussion('', false);
  const input = document.querySelector('#composer');
  if (input) { input.value = '请按退回意见修改：' + s.reviewComment; DRAFTS[S.threadId] = input.value; input.focus(); }
  toast('已保留原提交并创建新候选。请完成具体修改后采用、重检和重新提交。'); persist();
}

function v62LayersHTML(assessment) {
  return `<div class="v62-check-layers">${assessment.layers.map(x => `<div><strong>${E(x.member ? x.member + ' · ' : '')}${E(x.label)}</strong><span>${E(({ checked: '已检查', 'user-confirmed': '有用户核对依据', pending: '待核验', failed: '不合格', 'not-applicable': '未列出特定声明' })[x.status] || x.status)}</span><p>${E(x.detail)}</p></div>`).join('')}</div>`;
}

function v62EvidenceFormHTML(a, v, id) {
  const draft = S.v62MemberEvidenceDraft;
  if (!draft || draft.artifactId !== a.id || draft.revision !== v.num || draft.member !== id) return '';
  const assessment = v62MemberAssessment(a, v, id), scope = v62MemberScope(a, v, id), file = v.data.files.find(f => f.id === id);
  return `<section class="v62-member-evidence" aria-label="登记成员核对依据"><h3>登记 ${E(id)} 的核对依据</h3><p>固定成员 ${E(id)} · 文件 SHA-256 ${E(file?.sha256)}<br>适用市场：${E(scope.country || '待确认')} · 语言：${E(scope.language || '待确认')}</p><p>此处记录用户实际核对的依据及责任人。保存会形成新候选，不代表外部审批，也不修改旧提交。</p><form id="v62-member-evidence-form"><div class="field"><label for="v62-member-evidence-key">核对项</label><select id="v62-member-evidence-key" name="key">${[['authenticity','产品真实性'],['rights','使用授权'],['claims','本地声明']].map(([key,label]) => `<option value="${key}" ${draft.key === key ? 'selected' : ''} ${assessment.layers.find(x => x.key === key)?.status === 'failed' ? 'disabled' : ''}>${label}${assessment.layers.find(x => x.key === key)?.status === 'failed' ? '（先处理已知返修问题）' : ''}</option>`).join('')}</select></div><div class="field"><label for="v62-member-evidence-text">证据内容与核对结论</label><textarea id="v62-member-evidence-text" name="evidence" minlength="12" maxlength="3000" required placeholder="写明原始证据支持的具体画面、声明或使用权范围。">${E(draft.evidence || '')}</textarea></div><div class="field"><label for="v62-member-evidence-locator">证据定位</label><input id="v62-member-evidence-locator" name="locator" maxlength="400" required value="${E(draft.locator || '')}" placeholder="文档名称与页码、授权编号、实物比对记录或来源链接"></div><div class="field"><label for="v62-member-evidence-reviewer">核对责任人</label><input id="v62-member-evidence-reviewer" name="reviewer" maxlength="100" required value="${E(draft.reviewer || '')}" placeholder="填写实际核对人员及所属团队"></div><div class="field"><label for="v62-member-evidence-expiry">依据到期日（选填）</label><input id="v62-member-evidence-expiry" name="expiresAt" type="date" value="${E(draft.expiresAt || '')}"></div><label class="v62-scope-confirm"><input name="confirmed" type="checkbox" ${draft.confirmed ? 'checked' : ''}>我已核对以上证据与固定成员、市场和语言一致。</label><p id="v62-member-evidence-error" class="field-error" role="alert">${E(draft.error || '')}</p><div class="row wrap">${button('保存依据为新候选','v62-member-evidence-save',a.id+'|'+v.num+'|'+id,'primary sm','save')}${button('暂存并关闭','v62-member-evidence-close','','sm')}</div></form></section>`;
}

function v62RecordMemberEvidence(a, num, id, fields) {
  const v = a && revision(a, num);
  if (!v?.data.imageCollection || !v.data.items.includes(id)) throw Error('该版本不包含所指定的图片成员。');
  if (!canWrite(a, false)) throw Error('请由当前成果负责人登记核对依据。');
  if (a.pending && a.pending !== num) throw Error('已有新候选 v' + a.pending + '，请在该候选中登记，避免遗漏现有修改。');
  const key = String(fields.key || ''), evidence = String(fields.evidence || '').trim(), locator = String(fields.locator || '').trim(), reviewer = String(fields.reviewer || '').trim();
  if (!['authenticity', 'rights', 'claims'].includes(key)) throw Error('请选择真实性、使用授权或本地声明。');
  if (evidence.length < 12 || evidence.length > 3000) throw Error('请填写 12 至 3000 字符的具体证据与核对结论。');
  if (!locator || locator.length > 400) throw Error('请填写可定位的文档页码、编号、记录或链接（不超过 400 字符）。');
  if (!reviewer || reviewer.length > 100) throw Error('请填写实际核对责任人（不超过 100 字符）。');
  if (fields.confirmed !== true && fields.confirmed !== 'on') throw Error('请确认已核对固定成员与本次适用范围。');
  const scope = v62MemberScope(a, v, id), assessment = v62MemberAssessment(a, v, id);
  if (!scope.country || !scope.language) throw Error('成员的市场或语言待确认，请先明确该成员的交付范围。');
  if (!assessment.readable) throw Error('文件尚不可读取或哈希不一致，请先恢复固定文件。');
  if (assessment.layers.find(x => x.key === key)?.status === 'failed') throw Error('此成员已有明确返修问题，登记说明不能解除不合格状态；请先完成实际返修。');
  const expiresAt = String(fields.expiresAt || '').trim();
  if (expiresAt && (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) || !Number.isFinite(Date.parse(expiresAt)) || new Date(expiresAt).toISOString().slice(0, 10) !== expiresAt || Date.parse(expiresAt + 'T23:59:59Z') <= Date.now())) throw Error('到期日须为有效的未来日期；已到期依据不能确认为可用。');
  const data = clone(v.data), file = data.files.find(f => f.id === id);
  data.memberReviews ??= {}; data.memberReviews[id] ??= {}; data.memberReviewScopes ??= {}; data.memberReviewScopes[id] = scope;
  const prior = data.memberReviews[id][key];
  const entry = { status: 'confirmed', evidence, locator, reviewer, country: scope.country, language: scope.language,
    fileSha256: file.sha256, recordedBy: S.actor, recordedAt: now(), expiresAt: expiresAt ? expiresAt + 'T23:59:59Z' : null,
    confirmationType: 'user-recorded', externalApprovalVerified: false };
  data.memberReviews[id][key] = { ...entry, history: [...(prior?.history || []), ...(prior && !prior.history ? [prior] : []), entry] };
  const next = addRevision(a, data, '登记 ' + id + ' 的' + ({ authenticity: '真实性', rights: '授权', claims: '本地声明' })[key] + '核对依据：' + locator, v.refs);
  if (!next) throw Error('保存未完成，请检查当前编辑权限后重试。');
  for (const b of S.batches || []) for (const i of b.items.filter(i => i.artifactId === a.id && (!i.taskId || i.taskId === a.taskId) && !['submitted', 'approved', 'internal_reviewed'].includes(i.decision))) i.candidateRevision = next.num;
  log('已登记成员核对依据', a.title + ' v' + next.num + ' · ' + id + ' · ' + locator + '；仍需采用新候选。', a.projectId);
  persist(); return next;
}

function v62CandidateHTML(a, v) {
  const record = a.candidateDecisions?.[v.num], isPending = a.pending === v.num, write = canWrite(a, false);
  if (!isPending && !record) return '';
  return `<section class="v62-candidate-decision" aria-label="候选处理"><h3>${isPending ? '这个候选如何处理' : '候选处理记录'}</h3><p>${a.accepted ? '当前采用 v' + a.accepted + '。不采用新候选后，仍可继续使用原采用版。' : '尚无采用版。暂不处理会移出待处理列表，任务仍保留。'}</p>${record ? `<p>${E(record.reason)} · ${E(PEOPLE[record.actor]?.name || record.actor)}</p>` : ''}${write && isPending ? `<label for="v62-candidate-reason">处理说明（选填）</label><input id="v62-candidate-reason" maxlength="500" placeholder="例如：新候选改变了原有主张"><div class="row wrap">${button(a.accepted ? '不采用候选，保留 v' + a.accepted : '不采用此候选', 'v62-candidate-decline', a.id + '|' + v.num, 'sm', 'close')}${!a.accepted ? button('暂不处理', 'v62-candidate-defer', a.id + '|' + v.num, 'sm', 'clock') : ''}</div>` : write && ['declined', 'deferred'].includes(record?.status) ? button('重新考虑此候选', 'v62-candidate-reopen', a.id + '|' + v.num, 'sm', 'refresh') : ''}</section>`;
}

contentHTML = function(a, v) {
  let html = V62_DECISION_PREVIOUS.contentHTML(a, v);
  if (v.data.imageCollection) {
    const selected = v62SelectedIds(v), id = demoCurrentMember(a, v), assessment = v62Assess(a, v);
    const memberSelected = selected.includes(id), member = v62MemberAssessment(a, v, id);
    html = html.replace(/(<button\b[^>]*data-action="demo-member-adopt"[^>]*>)[\s\S]*?(<\/button>)/g,
      (_whole, start, end) => start.replace('<button', '<button aria-pressed="' + memberSelected + '"' + (!memberSelected && !member.selectable ? ' disabled' : '')) + icon(memberSelected ? 'close' : 'check') + (memberSelected ? '取消选用此图片' : '选用此图片') + end);
    html = `<section class="v62-delivery-selection" aria-label="本次交付成员"><h3>本次选用 ${selected.length} / ${v.data.items.length} 张</h3><p>${selected.length ? selected.map(mid => E(demoImage(mid)?.name || mid)).join('、') : '尚未选择交付成员。选用后会创建集合新候选，采用集合才完成草稿交付。'}</p><p>正在查看图片与选用成员分别记录；选择仅属于当前集合版本与市场语言。</p><div class="row wrap">${button('下载所选交付', 'v62-export-selected', a.id + '|' + v.num, 'sm', 'download').replace('<button ', '<button ' + (selected.length ? '' : 'disabled '))}${button('下载全部候选及历史', 'v62-export-history', a.id + '|' + v.num, 'sm', 'history')}</div></section>` + html;
    html += `<details class="v62-check-details" ${S.v62MemberEvidenceDraft?.artifactId === a.id ? 'open' : ''}><summary>查看分级检查：文件、真实性、授权与声明</summary><p>${E(assessment.reason || '当前检查未列出阻塞项；采用仍不等于正式批准。')}</p>${v62LayersHTML({ layers: v62MemberAssessment(a, v, id).layers.map(x => ({ ...x, member: id })) })}<p>可以继续内部预览。正式使用缺失依据时，请补充责任人的核对记录或完成返修；不以自检通过代替真实性或授权。</p>${canWrite(a, false) ? button('登记当前成员核对依据','v62-member-evidence-open',a.id+'|'+v.num+'|'+id,'sm','edit') : ''}${v62EvidenceFormHTML(a, v, id)}</details>`;
  }
  return html + v62CandidateHTML(a, v);
};

versionsHTML = function(a) {
  let html = V62_DECISION_PREVIOUS.versionsHTML(a);
  const decisions = Object.entries(a.candidateDecisions || {}).filter(([, x]) => x.status !== 'pending');
  if (decisions.length) html += `<section class="v62-candidate-history"><h3>未采用的候选</h3>${decisions.map(([num, x]) => `<div><strong>v${Number(num)} · ${x.status === 'declined' ? '不采用' : '暂不处理'}</strong><p>${E(x.reason)}</p>${canWrite(a, false) ? button('重新考虑', 'v62-candidate-reopen', a.id + '|' + num, 'sm', 'refresh') : ''}</div>`).join('')}</section>`;
  const submissions = S.submissions.filter(s => s.artifactId === a.id);
  if (submissions.length) html += `<section class="v62-submission-history"><h3>提交与审批记录</h3>${submissions.map(s => `<div><strong>v${s.revision} · ${E(({ pending: '待审批', withdrawn: '已撤回', returned: '已退回', approved: s.approvalScope === 'internal-review' ? '内部评审通过' : '已批准' })[s.status] || s.status)}</strong><p>${E(s.reviewComment || s.withdrawalReason || '固定快照等待处理')} · ${s.approvalScope === 'internal-review' ? '仅内部创意评审' : '正式使用范围'}</p>${button('查看固定提交', 'review', s.id, 'sm', 'shield')}${!v62WithdrawalReason(s) ? button('撤回此提交', 'v62-withdraw', s.id, 'sm', 'undo') : ''}${s.status === 'returned' && canWrite(a, false) ? button('按退回意见修订', 'v62-revise-return', s.id, 'sm', 'edit') : ''}</div>`).join('')}</section>`;
  return html;
};

canvasHTML = function() {
  let html = V62_DECISION_PREVIOUS.canvasHTML();
  const a = artifact(S.canvas?.id), v = selectedRevision(); if (!a || !v) return html;
  if (['declined', 'deferred'].includes(a.candidateDecisions?.[v.num]?.status)) html = html.replace(/<button\b[^>]*data-action="adopt"[^>]*>[\s\S]*?<\/button>/g, '');
  const s = S.submissions.findLast(x => x.artifactId === a.id && x.revision === v.num && x.status === 'pending');
  if (s && !v62WithdrawalReason(s)) html = html.replace('</footer>', button('撤回提交', 'v62-withdraw', s.id, 'sm', 'undo') + '</footer>');
  const internal = approvalFor(a, v.num)?.approvalScope === 'internal-review';
  if (internal && !s && canWrite(a, false) && a.accepted === v.num) {
    html = html.replace('已批准 · 固定版本保持不变', '内部创意评审通过 · 正式使用仍需核验');
    html = html.replace(/<button\b[^>]*data-action="deliveries"[^>]*>[\s\S]*?<\/button>/g, '');
    html = html.replace('</footer>', button('准备正式使用审批', 'submit', a.id + '|' + v.num, 'sm', 'shield') + '</footer>');
  }
  if (v.data.imageCollection) html = html.replace(/(data-action=")export-one("[^>]*data-arg=")/g, '$1v62-export-options$2');
  return html;
};

function v62SubmissionScope() { return decisionSubmission?.scope === 'internal-review' ? 'internal-review' : 'formal-use'; }

function v62SubmissionBlock(ctx) {
  if (!ctx?.targets.length) return '没有选定提交版本。';
  for (const x of ctx.targets) {
    const a = artifact(x.id), reason = decisionSubmissionReason(a, x.num) || v62ScopeReason(a, a && revision(a, x.num), v62SubmissionScope());
    if (reason) return reason;
  }
  return '';
}

decisionSubmitHTML = function() {
  const ctx = decisionSubmission; if (!ctx) return '';
  const scope = v62SubmissionScope();
  return `<fieldset class="v62-scope-choice"><legend>这次提交的用途</legend><label><input type="radio" name="v62-submission-scope" value="formal-use" ${scope === 'formal-use' ? 'checked' : ''}> 正式使用审批</label><p>需要真实性、授权与市场声明等条件满足后再提交。审批系统与客户规则待确认时保留限制。</p><label><input type="radio" name="v62-submission-scope" value="internal-review" ${scope === 'internal-review' ? 'checked' : ''}> 内部创意评审</label><p>评审创意方向和内容效果，批准结果仅用于内部；不产生正式外发或商业使用资格。</p></fieldset>${ctx.targets.map(x => {
    const a = artifact(x.id), v = a && revision(a, x.num), assessment = v62Assess(a, v), t = S.tasks.find(t => t.id === a?.taskId);
    return `<section class="v62-submission-target"><h3>${E(a?.title || '成果不存在')} · v${x.num}</h3><p>审核人：${E(PEOPLE[t?.reviewer]?.name || '未指定')} · ${v?.data.imageCollection ? '仅提交所选成员：' + assessment.selectedIds.map(E).join('、') : '固定当前成果及其引用'}</p>${assessment.reason ? `<p class="notice warn">${E(assessment.reason)}</p>` : ''}<details ${x.check ? 'open' : ''}><summary>${x.check ? '分级检查结果' : '查看已知问题与缺失依据'}</summary>${v62LayersHTML(assessment)}</details><p>${x.check ? (assessment.previewReady ? '内部预览检查完成；' : '检查未通过；') + (assessment.formalReady ? '当前规则未列出正式使用阻塞。' : '正式使用条件尚未满足。') : '尚未执行提交前检查。'}</p></section>`;
  }).join('')}<label class="v62-scope-confirm"><input type="checkbox" data-v62-submit-confirm ${ctx.scopeConfirmed ? 'checked' : ''}> ${scope === 'internal-review' ? '我已查看所选成员的问题与待核验项，本次仅提交内部创意评审，后续正式使用仍需补齐依据。' : '我已核对本次固定成员、适用市场语言与使用用途，并确认按可见规则提交正式使用审批。'}</label>${ctx.error ? `<p role="alert" class="notice warn">${E(ctx.error)}</p>` : ''}`;
};

renderDecisionSubmission = function() {
  const ctx = decisionSubmission; if (!ctx) return;
  const blocked = v62SubmissionBlock(ctx), checked = ctx.targets.length && ctx.targets.every(x => x.check?.passed);
  const action = checked ? 'decision-submit-final' : 'decision-submit-check';
  const disabled = !!blocked || ctx.checking || (checked && !ctx.scopeConfirmed);
  const label = ctx.checking ? '正在检查…' : checked ? '提交' + (v62SubmissionScope() === 'internal-review' ? '内部评审' : '正式使用审批') : '检查并准备提交';
  const controls = button(label, action, '', 'primary', 'shield').replace('<button ', '<button ' + (disabled ? 'disabled aria-describedby="v62-submit-reason" ' : ''));
  const reason = blocked || (checked && !ctx.scopeConfirmed ? '请核对并勾选本次用途与固定范围。' : '采用版本与正式审批分别记录。');
  dockRoot().innerHTML = modalFrame('提交固定版本', decisionSubmitHTML() + `<p id="v62-submit-reason" class="decision-action-reason">${E(reason)}</p>`, button('返回修改', 'panel-close') + controls); mountDock();
};

DECISION_UI.submitArtifact = function(id, num) {
  const a = artifact(id), v = a && revision(a, num), scope = v62SubmissionScope();
  const reason = decisionSubmissionReason(a, num) || v62ScopeReason(a, v, scope);
  if (reason || !decisionSubmission?.scopeConfirmed) return toast(reason || '请先核对提交用途与范围。', true);
  const before = new Set(S.submissions.map(x => x.id));
  V62_DECISION_PREVIOUS.commitSubmission(id, num);
  for (const s of S.submissions.filter(x => !before.has(x.id) && x.artifactId === id)) {
    s.approvalScope = scope; s.deliveryScope = v62Scope(s.snapshot);
    s.scopeStatement = scope === 'internal-review' ? '仅内部创意评审；不代表真实性、授权、正式外发或商业使用已获批准。' : '按所记录的固定成员及市场语言提交正式使用审批。';
    s.checkSnapshot = clone(a.checks?.[num]);
  }
  persist();
};

reviewDecision = function(sid, decision, comment) {
  const s = S.submissions.find(x => x.id === sid);
  if (!s || !['approved', 'returned'].includes(decision)) return;
  if (decision === 'approved' && s.status === 'pending' && S.actor === s.reviewer) {
    const reason = v62ScopeReason(artifact(s.artifactId), s.snapshot, s.approvalScope || 'formal-use');
    if (reason) return toast('该固定提交暂不可批准：' + reason, true);
  }
  if (s.approvalScope === 'internal-review') {
    if (s.status !== 'pending') return toast('这个提交已处理，固定记录保持不变。', true);
    if (S.actor !== s.reviewer) return toast('仅指定审核人可作出评审决定。', true);
    if (decision === 'returned' && !comment?.trim()) return toast('请填写明确的修改意见。', true);
    s.status = decision; s.decided = now(); s.reviewComment = comment?.trim() || '通过内部创意评审；正式使用条件仍待核验。';
    const t = S.tasks.find(t => t.id === s.taskId);
    if (t) { t.status = 'working'; t.internalReview = { submissionId: s.id, revision: s.revision, status: decision }; }
    for (const b of S.batches || []) {
      const rows = b.items.filter(i => i.artifactId === s.artifactId && i.revision === s.revision);
      for (const i of rows) { i.decision = decision === 'approved' ? 'internal_reviewed' : 'changes_requested'; if (decision === 'returned') { i.status = 'changes_requested'; i.feedback = s.reviewComment; } }
      if (rows.length) recalcBatch(b);
    }
    log(decision === 'approved' ? '内部创意评审通过' : '内部评审退回修改', s.title + ' v' + s.revision + ' · 未创建正式入库或发布记录。', s.projectId);
    closeModal(); render(); persist(); return;
  }
  return V62_DECISION_PREVIOUS.reviewDecision(sid, decision, comment);
};

function v62ReviewDecoration() {
  if (MODAL?.kind !== 'review') return;
  const s = S.submissions.find(x => x.id === MODAL.arg); if (!s) return;
  const root = dockRoot(); root.querySelector('.v62-review-scope')?.remove();
  const text = s.approvalScope === 'internal-review' ? '内部创意评审：仅审查方向和效果。真实性、授权与正式使用条件仍独立保留。' : '正式使用审批：只针对该固定版本的明确成员和适用范围。';
  root.querySelector('.modal-body')?.insertAdjacentHTML('afterbegin', `<p class="notice v62-review-scope">${E(text)}${s.deliveryScope?.members?.length ? '<br>固定成员：' + s.deliveryScope.members.map(E).join('、') : ''}</p>`);
  const approve = root.querySelector('[data-action="review-approve"]');
  if (approve && s.approvalScope === 'internal-review') approve.innerHTML = icon('check') + '通过内部创意评审';
  if (s.status === 'withdrawn') { root.querySelectorAll('.tag').forEach(n => { if (n.textContent === '已退回') n.textContent = '已撤回'; }); }
  if (!v62WithdrawalReason(s) && !root.querySelector('[data-action="v62-withdraw"]')) root.querySelector('.modal-foot')?.insertAdjacentHTML('beforeend', button('撤回提交', 'v62-withdraw', s.id, 'sm', 'undo'));
  if (s.status === 'returned' && canWrite(artifact(s.artifactId), false) && !root.querySelector('[data-action="v62-revise-return"]')) root.querySelector('.modal-foot')?.insertAdjacentHTML('beforeend', button('按退回意见修订', 'v62-revise-return', s.id, 'sm', 'edit'));
}

renderModal = function() { V62_DECISION_PREVIOUS.renderModal(); v62ReviewDecoration(); };

documentText = function(a, v) {
  const text = V62_DECISION_PREVIOUS.documentText(a, v);
  return v.data.imageCollection ? text + '\n\n本次选用成员：' + (v62SelectedIds(v).join(', ') || '尚未选择') + '\n其他成员为候选记录，不属于本次交付。' : text;
};

versionFiles = function(a, v, label = '内部工作草稿', scope = 'selected') {
  if (label.includes('批准') && approvalFor(a, v.num)?.approvalScope === 'internal-review') label = '内部创意评审固定快照；不适用正式外发';
  if (!v.data.imageCollection) return V62_DECISION_PREVIOUS.versionFiles(a, v, label);
  const ids = scope === 'all-candidates' ? v.data.items : v62SelectedIds(v);
  if (!ids.length) throw Error('未选择交付成员，无法导出所选交付。请先选用图片或下载全部候选。');
  const copy = clone(v); copy.data.items = [...ids]; copy.data.files = v.data.files.filter(f => ids.includes(f.id));
  copy.data.memberStates = Object.fromEntries(ids.map(id => [id, clone(v.data.memberStates[id] || {})]));
  const files = {}, members = copy.data.files;
  for (const f of members) {
    const raw = window.DEMO_ORIGINALS?.[f.id]; if (!raw) throw Error('原图尚未加载：' + f.id);
    files[f.file] = Uint8Array.from(atob(raw.split(',')[1]),c => c.charCodeAt(0));
  }
  const purpose = scope === 'all-candidates' ? '候选档案，不是交付包' : '本次所选交付';
  files['content.md'] = '> ' + purpose + ' · ' + label + '\n\n' + documentText(a, copy);
  files['snapshot.json'] = JSON.stringify({ artifactId: a.id, revision: copy, label, scope, members: ids, simulation: true }, null, 2);
  files['preview.html'] = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>' + E(a.title) + '</title><style>body{margin:32px;font:16px/1.6 sans-serif;color:#00284c}img{max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>' + E(a.title) + ' v' + v.num + '</h1><p>' + E(purpose + ' · ' + label) + '</p>' + members.map(f => '<figure><img src="' + E(f.file) + '" alt="' + E(demoImage(f.id)?.name || f.id) + '"><figcaption>' + E(f.id) + '</figcaption></figure>').join('') + '</html>';
  return files;
};

async function v62Export(id, num, scope) {
  const a = artifact(id), v = a && revision(a, num); if (!v) return;
  if (!v.data.imageCollection) return V62_DECISION_PREVIOUS.exportOne(id, num);
  if (scope !== 'all-candidates' && !v62SelectedIds(v).length) return toast('请至少选用一个交付成员；全部候选可从单独入口下载。', true);
  try {
    const versions = scope === 'all-candidates' ? a.versions : [v];
    const needed = versions.map(x => { const copy = clone(x); if (scope !== 'all-candidates') copy.data.files = copy.data.files.filter(f => v62SelectedIds(copy).includes(f.id)); return copy; });
    await preloadDemoFiles(needed);
    let files = {};
    for (const item of versions) for (const [path, bytes] of Object.entries(versionFiles(a, item, scope === 'all-candidates' ? '全部候选及历史，仅供内部查看' : versionLabel(a, item.num)[0], scope))) files[(scope === 'all-candidates' ? 'v' + item.num + '/' : '') + path] = bytes;
    files['selection-manifest.json'] = JSON.stringify({ artifactId: id, revision: num, scope, selectedMembers: v62SelectedIds(v), candidateDecisions: a.candidateDecisions || {}, commercialUseVerified: false }, null, 2);
    download('Lilith_' + a.kind + '_v' + num + (scope === 'all-candidates' ? '_全部候选及历史' : '_所选交付') + '.zip', zipStore(files), 'application/zip');
  } catch (error) { toast(error.message, true); }
}

exportOne = function(id, num) { return v62Export(id, num, 'selected'); };

handle = async function(action, arg = '') {
  if (action === 'v62-member-evidence-open') {
    const [id, n, member] = String(arg).split('|'), a = artifact(id), v = a && revision(a, Number(n));
    if (!v?.data.imageCollection || !v.data.items.includes(member) || !canWrite(a)) return;
    const saved = S.v62MemberEvidenceSavedDraft;
    S.v62MemberEvidenceDraft = saved?.artifactId === id && saved.revision === v.num && saved.member === member ? clone(saved) :
      { artifactId: id, revision: v.num, member, key: v62MemberAssessment(a, v, member).layers.find(x => x.key === 'authenticity')?.status === 'failed' ? 'rights' : 'authenticity', evidence: '', locator: '', reviewer: '', expiresAt: '', confirmed: false };
    render(); document.querySelector('#v62-member-evidence-key')?.focus(); return;
  }
  if (action === 'v62-member-evidence-close') {
    S.v62MemberEvidenceSavedDraft = clone(S.v62MemberEvidenceDraft); S.v62MemberEvidenceDraft = null; render(); persist(); return;
  }
  if (action === 'v62-member-evidence-save') {
    const [id, n, member] = String(arg).split('|'), a = artifact(id), form = document.querySelector('#v62-member-evidence-form');
    if (!form || !S.v62MemberEvidenceDraft) return;
    const fields = Object.fromEntries(new FormData(form));
    Object.assign(S.v62MemberEvidenceDraft, fields, { confirmed: fields.confirmed === 'on' });
    try {
      const v = revision(a, Number(n)), view = clone(demoView(a, v));
      const next = v62RecordMemberEvidence(a, Number(n), member, fields);
      S.v62MemberEvidenceDraft = null; S.v62MemberEvidenceSavedDraft = null;
      S.imageViews[a.id + '|' + next.num] = { ...view, member }; openCanvas(a.id, next.num);
      toast('核对依据已保存为新候选；旧版本与旧审批保持不变。请检查后采用。'); persist();
    } catch (error) { S.v62MemberEvidenceDraft.error = error.message; render(); document.querySelector('#v62-member-evidence-error')?.scrollIntoView({ block: 'nearest' }); }
    return;
  }
  if (action.startsWith('v62-candidate-')) {
    const [id, n] = String(arg).split('|'), a = artifact(id), num = Number(n); if (!a) return;
    const status = ({ 'v62-candidate-decline': 'declined', 'v62-candidate-defer': 'deferred', 'v62-candidate-reopen': 'pending' })[action]; if (!status) return;
    const reason = document.querySelector('#v62-candidate-reason')?.value.trim() || (status === 'pending' ? '重新打开候选，等待新的采用决定。' : status === 'deferred' ? '暂不处理；候选与任务保留。' : a.accepted ? '不采用该候选，保留原采用版 v' + a.accepted + '。' : '不采用此候选；保留历史记录。');
    if (v62RecordCandidate(a, num, status, reason)) openCanvas(a.id, status === 'pending' ? num : a.accepted || num); return;
  }
  if (action === 'demo-member-adopt') {
    const a = artifact(S.canvas?.id), v = selectedRevision(); if (!a || !v?.data.imageCollection || !canWrite(a)) return;
    const view = demoView(a, v), id = demoCurrentMember(a, v), selected = v62SelectedIds(v).includes(id), member = v62MemberAssessment(a, v, id);
    if (!selected && !member.selectable) return toast(member.layers.find(x => x.status === 'failed' || x.key === 'scope' && x.status === 'pending')?.detail || '此候选待返修，尚不可选入交付。', true);
    const data = clone(v.data); data.memberStates ??= {}; data.memberStates[id] = { ...data.memberStates[id], selected: !selected, adopted: false };
    const next = addRevision(a, data, (selected ? '取消选用' : '选用') + '图片成员 ' + id + '；保留其他成员与历史版本。', v.refs);
    if (next) {
      for (const b of S.batches || []) for (const i of b.items.filter(i => i.artifactId === a.id && (!i.taskId || i.taskId === a.taskId) && !['submitted', 'approved', 'internal_reviewed'].includes(i.decision))) i.candidateRevision = next.num;
      S.imageViews[a.id + '|' + next.num] = { ...view }; openCanvas(a.id, next.num); toast(selected ? '已从新版交付选择中取消；原采用版与已提交快照保持不变。' : '已选入集合新候选。采用集合后更新草稿交付。'); persist();
    } return;
  }
  if (action === 'v62-withdraw') return v62Withdraw(arg);
  if (action === 'v62-revise-return') return v62ReviseReturn(arg);
  if (action === 'v62-submission-scope') {
    if (!decisionSubmission || !['formal-use', 'internal-review'].includes(arg)) return;
    decisionSubmission.scope = arg; decisionSubmission.scopeConfirmed = false; decisionSubmission.error = ''; decisionSubmission.targets.forEach(x => { x.check = null; }); renderDecisionSubmission(); return;
  }
  if (action === 'v62-submission-confirm') { if (decisionSubmission) { decisionSubmission.scopeConfirmed = arg === 'confirmed'; renderDecisionSubmission(); } return; }
  if (['decision-submit-check', 'decision-submit-final', 'submit-confirm'].includes(action)) {
    const reason = v62SubmissionBlock(decisionSubmission);
    if (reason) { if (decisionSubmission) { decisionSubmission.error = reason; renderDecisionSubmission(); } return toast(reason, true); }
    if (action !== 'decision-submit-check' && !decisionSubmission.scopeConfirmed) return toast('请先核对并确认本次评审用途与固定成员范围。', true);
  }
  if (['v62-export-selected', 'v62-export-history', 'v62-export-options'].includes(action)) {
    const [id, n] = String(arg).split('|');
    if (action === 'v62-export-options') { const a = artifact(id); if (a) { openCanvas(id, Number(n)); document.querySelector('.v62-delivery-selection')?.scrollIntoView({ block: 'nearest' }); toast('请选择“所选交付”或“全部候选及历史”的下载范围。'); } return; }
    return v62Export(id, Number(n), action === 'v62-export-history' ? 'all-candidates' : 'selected');
  }
  const result = await V62_DECISION_PREVIOUS.handle(action, arg); v62ReviewDecoration(); return result;
};

document.addEventListener('change', event => {
  if (event.target.matches('[name="v62-submission-scope"]')) handle('v62-submission-scope', event.target.value);
  if (event.target.matches('[data-v62-submit-confirm]')) handle('v62-submission-confirm', event.target.checked ? 'confirmed' : '');
});

document.addEventListener('input', event => {
  if (!S.v62MemberEvidenceDraft || !event.target.closest('#v62-member-evidence-form') || !event.target.name) return;
  S.v62MemberEvidenceDraft[event.target.name] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
});

window.V62Decisions = { selectedIds: v62SelectedIds, memberAssessment: v62MemberAssessment,
  assess: v62Assess, scopeReason: v62ScopeReason, deliveryScope: v62Scope,
  withdrawalReason: v62WithdrawalReason, recordCandidate: v62RecordCandidate,
  memberScope: v62MemberScope, recordMemberEvidence: v62RecordMemberEvidence };
