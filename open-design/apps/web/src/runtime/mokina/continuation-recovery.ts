import type { MokinaContextSelection, MokinaContextSnapshot, MokinaContinuationV2, WorkspaceCollabContext } from '@open-design/contracts';
import { MOKINA_CONTEXT_BUDGETS } from '@open-design/contracts';
import { createProject } from '../../state/projects';
import { fetchProjectFiles, uploadProjectFiles, writeProjectTextFile, projectFileUrl } from '../../providers/registry';
import { workspaceIdentityCacheKey, workspaceProjectHeaders } from '../../collab/workspace-identity';
import { mutateDurableRecord } from '../persistence/mokina-recovery-store';
import { mokinaBytesDigest } from './digest';
import { mokinaResponseError } from './home-material-snapshot';
import { readPendingMokinaSnapshot, writePendingMokinaSnapshot } from './pending-context-snapshot';

export type ContinuationIntent = {
  source: MokinaContinuationV2['source']; sections: MokinaContinuationV2['sections']; background: string;
  productionIntent: 'discuss' | 'landing-page'; pluginId: string; promptLead: string; workspaceKey: string;
  brand?: { id: string; digest: string };
  assets: Array<{ inputId: string; name: string; digest?: string; byteLength?: number; role: 'logo' | 'hero' | 'supporting'; usageNote: string }>;
};
export type MokinaContinuationJournal = {
  schemaVersion: 2 | 3; operationId: string; targetProjectId: string; contextSnapshotId?: string;
  checkpoint: 'prepared' | 'project-created' | 'snapshot-saved' | 'draft-ready'; updatedAt: string;
  revision?: number; intentDigest?: string; intent?: ContinuationIntent; conversationId?: string;
  snapshotFingerprint?: string; lastError?: string;
  copiedAssets?: Record<string, { path: string; digest: string; byteLength: number; uploaded?: boolean }>;
};
export const MOKINA_CONTINUATION_CHANGED = 'mokina:continuation-changed';
export function readMokinaContinuationJournal(raw: string | null): MokinaContinuationJournal | null {
  try {
    const row = JSON.parse(raw ?? 'null');
    if (![2, 3].includes(row?.schemaVersion) || typeof row.operationId !== 'string' || !row.operationId
      || typeof row.targetProjectId !== 'string' || !row.targetProjectId
      || !['prepared', 'project-created', 'snapshot-saved', 'draft-ready'].includes(row.checkpoint)) return null;
    if (row.schemaVersion === 3 && (!row.intent?.source || !Array.isArray(row.intent.sections)
      || !row.intent.sections.every((section: { id: string; text: string }) => typeof section?.id === 'string' && typeof section.text === 'string')
      || typeof row.intent.workspaceKey !== 'string' || typeof row.intent.background !== 'string'
      || !Array.isArray(row.intent.assets) || !row.intent.assets.every((asset: { inputId: string; name: string }) => typeof asset?.inputId === 'string' && typeof asset.name === 'string')
      || typeof row.contextSnapshotId !== 'string' || typeof row.intentDigest !== 'string' || !Number.isInteger(row.revision))) return null;
    return row;
  } catch { return null; }
}
export async function continuationIntentDigest(intent: ContinuationIntent) {
  return mokinaBytesDigest(new TextEncoder().encode(JSON.stringify(intent)).buffer as ArrayBuffer);
}
export async function persistContinuationJournal(key: string, journal: MokinaContinuationJournal, expectedRevision?: number) {
  const stored = await mutateDurableRecord(key, raw => {
    const current = readMokinaContinuationJournal(raw);
    if (raw && !current) return undefined;
    if (current && (current.operationId !== journal.operationId || current.intentDigest !== journal.intentDigest
      || current.revision !== expectedRevision)) return undefined;
    if (!current && expectedRevision !== undefined) return undefined;
    return JSON.stringify(journal);
  });
  if (!stored) throw new Error('接续恢复记录发生冲突或无法保存，原稿已保留。');
  window.dispatchEvent(new Event(MOKINA_CONTINUATION_CHANGED));
}

export function readMokinaContinuationForKey(key: string): MokinaContinuationJournal | null {
  const active = readMokinaContinuationJournal(window.localStorage.getItem(key));
  if (active || window.localStorage.getItem(key)) return active;
  return Object.keys(window.localStorage).filter(candidate => candidate.startsWith(`${key}:completed:`))
    .map(candidate => readMokinaContinuationJournal(window.localStorage.getItem(candidate)))
    .filter((row): row is MokinaContinuationJournal => row?.checkpoint === 'draft-ready')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

async function completeContinuationJournal(key: string, journal: MokinaContinuationJournal) {
  if (key.endsWith(`:completed:${journal.operationId}`)) return;
  const completionKey = `${key}:completed:${journal.operationId}`;
  const archived = await mutateDurableRecord(completionKey, raw => {
    const current = readMokinaContinuationJournal(raw);
    if (raw && (!current || current.operationId !== journal.operationId || current.intentDigest !== journal.intentDigest
      || (current.revision ?? 0) > (journal.revision ?? 0))) return undefined;
    return JSON.stringify(journal);
  });
  if (!archived) throw new Error('接续稿已保存，完成记录待同步；原操作已保留。');
  const consumed = await mutateDurableRecord(key, raw => {
    if (raw === null) return null;
    const current = readMokinaContinuationJournal(raw);
    return current?.operationId === journal.operationId && current.intentDigest === journal.intentDigest
      && current.revision === journal.revision ? null : undefined;
  });
  if (!consumed) throw new Error('接续稿已保存，活动记录待同步；不会重新创建目标。');
  window.dispatchEvent(new Event(MOKINA_CONTINUATION_CHANGED));
}

/** Resume from target-owned data first; each network side effect keeps the same identities. */
export async function resumeMokinaContinuation(key: string, initial: MokinaContinuationJournal, workspaceContext: WorkspaceCollabContext | null) {
  if (!initial.intent || initial.schemaVersion !== 3) throw new Error('旧接续记录缺少完整意图，请保留原稿并重新确认。');
  const intent = initial.intent;
  if (intent.workspaceKey !== workspaceIdentityCacheKey(workspaceContext)) throw new Error('接续所属工作区不匹配。');
  if (!initial.contextSnapshotId || await continuationIntentDigest(intent) !== initial.intentDigest) throw new Error('接续意图或快照身份已损坏，原记录已保留。');
  let journal = initial;
  const update = async (changes: Partial<MokinaContinuationJournal>) => {
    const next = { ...journal, ...changes, revision: (journal.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
    await persistContinuationJournal(key, next, journal.revision);
    journal = next;
  };
  const headers = workspaceContext ? workspaceProjectHeaders(workspaceContext) : {};
  const targetId = journal.targetProjectId;
  try {
    const existing = await fetch(`/api/projects/${encodeURIComponent(targetId)}`, { headers, cache: 'no-store' });
    if (existing.status === 404) {
      if (journal.checkpoint !== 'prepared') throw new Error('接续目标已不存在，不能自动创建替代项目。');
      const prompt = [intent.promptLead, '只使用选定摘录和补充背景；其他原项目资料不作为输入。',
        ...intent.sections.map(section => `【${section.id}】\n${section.text}`), intent.background].filter(Boolean).join('\n\n');
      const created = await createProject({ id: targetId, name: `${intent.source.fileName} · 接续`, skillId: null, designSystemId: null,
        metadata: { kind: 'other', intent: 'marketing' }, pluginId: intent.pluginId, pendingPrompt: prompt, workspaceContext });
      await update({ checkpoint: 'project-created', conversationId: created.conversationId });
    } else {
      if (!existing.ok) throw new Error(`目标项目读取失败（${existing.status}）`);
      if (!journal.conversationId) {
        const response = await fetch(`/api/projects/${encodeURIComponent(targetId)}/conversations`, { headers, cache: 'no-store' });
        if (!response.ok) throw new Error('目标会话读取失败。');
        const body = await response.json();
        const conversations = body.conversations;
        if (!Array.isArray(conversations) || conversations.length !== 1) throw new Error('目标会话归属无法确认，请保留原稿。');
        await update({ checkpoint: 'project-created', conversationId: conversations[0].id });
      }
    }
    const snapshotId = journal.contextSnapshotId!;
    const snapshotUrl = `/api/projects/${encodeURIComponent(targetId)}/mokina/context-snapshots/${encodeURIComponent(snapshotId)}`;
    const snapshotRead = await fetch(snapshotUrl, { headers, cache: 'no-store' });
    let snapshot: MokinaContextSnapshot;
    if (snapshotRead.ok) {
      snapshot = (await snapshotRead.json()).snapshot;
      if (snapshot?.snapshotId !== snapshotId || snapshot.projectId !== targetId
        || (journal.snapshotFingerprint && journal.snapshotFingerprint !== snapshot.fingerprint)) throw new Error('目标快照身份不匹配。');
      for (const [index, section] of intent.sections.entries()) {
        const item = snapshot.items.find(item => item.itemId === `section-${index + 1}`);
        if (!item || item.kind === 'asset' || item.text !== `【${section.id}】\n${section.text}`) throw new Error('目标固定章节与原接续意图不符。');
        if (item.continuationOrigin && (JSON.stringify(item.continuationOrigin.source) !== JSON.stringify(intent.source)
          || item.continuationOrigin.sectionId !== section.id)) throw new Error('目标固定章节来源与原接续意图不符。');
      }
      const background = snapshot.items.find(item => item.itemId === 'background');
      if (intent.background.trim() && (!background || background.kind === 'asset' || background.text !== intent.background)) throw new Error('目标补充要求与原接续意图不符。');
      if (snapshot.items.length !== intent.sections.length + intent.assets.length + (intent.brand ? 1 : 0) + (intent.background.trim() ? 1 : 0)) throw new Error('目标快照包含原接续意图之外的输入。');
      if (intent.brand && !snapshot.items.some(item => item.kind === 'brand-rule' && item.sourceRef.kind === 'design-system'
        && item.sourceRef.designSystemId === intent.brand!.id && item.sourceDigest === intent.brand!.digest)) throw new Error('目标品牌与原接续意图不符。');
      for (const asset of intent.assets) {
        if (!snapshot.items.some(item => item.itemId === asset.inputId && item.kind === 'asset'
          && (!asset.digest || item.sourceDigest === asset.digest) && item.role === asset.role && item.usageNote === asset.usageNote)) throw new Error('目标素材与原接续意图不符。');
      }
    } else {
      if (snapshotRead.status !== 404) throw new Error(`目标快照读取失败（${snapshotRead.status}）`);
      if (journal.snapshotFingerprint) throw new Error('已固定的快照丢失，不能重新读取源替代。');
      const selections: MokinaContextSelection[] = intent.sections.map((section, index) => ({
        itemId: `section-${index + 1}`, mode: 'note', sourceRef: { kind: 'user-note' }, text: `【${section.id}】\n${section.text}`,
        continuationOrigin: { source: intent.source, sectionId: section.id },
      }));
      if (intent.background.trim()) selections.push({ itemId: 'background', mode: 'note', sourceRef: { kind: 'user-note' }, text: intent.background });
      // A failed listing is not an empty directory. It must never authorize re-upload.
      const targetFiles = await fetchProjectFiles(targetId, { workspaceContext, fresh: true, requireAuthoritative: true });
      for (const asset of intent.assets) {
        let mapping = journal.copiedAssets?.[asset.inputId];
        const targetName = mapping?.path ?? `${asset.inputId}${asset.name.match(/\.[a-z0-9]+$/iu)?.[0] ?? '.bin'}`;
        let bytes: ArrayBuffer | undefined;
        if (mapping || targetFiles.some(file => file.name === targetName)) {
          const raw = await fetch(projectFileUrl(targetId, targetName, workspaceContext), { cache: 'no-store' });
          if (raw.ok) {
            bytes = await raw.arrayBuffer();
            if (!mapping || await mokinaBytesDigest(bytes) !== mapping.digest) throw new Error(`目标素材身份不匹配：${asset.name}`);
          } else if (raw.status !== 404 || mapping?.uploaded !== false) {
            throw new Error(`目标素材读取失败：${asset.name}`);
          }
        }
        if (!bytes) {
          const raw = await fetch(projectFileUrl(intent.source.projectId, asset.name, workspaceContext), { cache: 'no-store' });
          if (!raw.ok) throw new Error(`素材读取失败：${asset.name}；请补齐或明确新建排除该素材的副本。`);
          bytes = await raw.arrayBuffer();
          const digest = await mokinaBytesDigest(bytes);
          if ((mapping && mapping.digest !== digest) || (asset.digest && asset.digest !== digest)) throw new Error(`源素材已变化：${asset.name}`);
          mapping = { path: targetName, digest, byteLength: bytes.byteLength, uploaded: false };
          await update({ copiedAssets: { ...journal.copiedAssets, [asset.inputId]: mapping } });
          const uploaded = await uploadProjectFiles(targetId, [new File([bytes], targetName)], undefined, workspaceContext);
          if (uploaded.failed.length || !uploaded.uploaded[0]?.path) throw new Error(`素材上传失败：${asset.name}`);
          mapping = { ...mapping, path: uploaded.uploaded[0].path, uploaded: true };
        } else {
          mapping = { ...mapping!, uploaded: true };
        }
        await update({ copiedAssets: { ...journal.copiedAssets, [asset.inputId]: mapping } });
        selections.push({ itemId: asset.inputId, mode: 'asset', sourceRef: { kind: 'project-file', projectId: targetId, fileName: mapping.path },
          expectedSourceDigest: mapping.digest, role: asset.role, usageNote: asset.usageNote });
      }
      if (intent.brand) selections.push({ itemId: 'brand', mode: 'groups', textKind: 'brand-rule',
        sourceRef: { kind: 'design-system', designSystemId: intent.brand.id }, expectedSourceDigest: intent.brand.digest, groupIds: [] });
      if (!selections.length || selections.length > MOKINA_CONTEXT_BUDGETS.maxItems) throw new Error('接续选择数量超出预算。');
      const response = await fetch(`/api/projects/${encodeURIComponent(targetId)}/mokina/context-snapshots`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshotId, selections, excluded: [] }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.snapshot) throw new Error(mokinaResponseError(body, `接续冻结失败（${response.status}），原稿已保留。`).message);
      snapshot = body.snapshot;
    }
    if (initial.checkpoint !== 'draft-ready') await update({ checkpoint: 'snapshot-saved', snapshotFingerprint: snapshot.fingerprint });
    const fixed: MokinaContinuationV2 = { schemaVersion: 2, operationId: journal.operationId, targetProjectId: targetId,
      source: intent.source, sections: intent.sections, background: intent.background,
      productionIntent: intent.productionIntent, contextSnapshotId: snapshotId };
    const files = await fetchProjectFiles(targetId, { workspaceContext, fresh: true, requireAuthoritative: true });
    if (files.some(file => file.name === 'MOKINA-CONTINUATION.json')) {
      const read = await fetch(projectFileUrl(targetId, 'MOKINA-CONTINUATION.json', workspaceContext), { cache: 'no-store' });
      if (!read.ok || JSON.stringify(await read.json()) !== JSON.stringify(fixed)) throw new Error('目标接续稿已被修改，保留原稿并停止覆盖。');
    } else if (!await writeProjectTextFile(targetId, 'MOKINA-CONTINUATION.json', JSON.stringify(fixed, null, 2), undefined, workspaceContext)) {
      throw new Error('接续稿保存失败，可恢复至同一目标。');
    }
    // Successful writes alone do not prove that the draft can be read back.
    const draftRead = await fetch(projectFileUrl(targetId, 'MOKINA-CONTINUATION.json', workspaceContext), { cache: 'no-store' });
    if (!draftRead.ok || JSON.stringify(await draftRead.json()) !== JSON.stringify(fixed)) throw new Error('接续稿读回失败或内容不符，保留原恢复记录。');
    if (initial.checkpoint === 'draft-ready') {
      await completeContinuationJournal(key, journal);
      return journal;
    }
    const pendingScope = { conversationId: journal.conversationId!, workspaceKey: intent.workspaceKey };
    const pending = readPendingMokinaSnapshot(targetId, pendingScope);
    if (pending && pending.snapshotId !== snapshotId) throw new Error('目标已有其他待发送资料，停止覆盖；原接续记录已保留。');
    if (!pending) await writePendingMokinaSnapshot({ projectId: targetId, snapshotId, conversationId: journal.conversationId,
      workspaceKey: intent.workspaceKey, itemCount: snapshot.items.length,
      charCount: snapshot.items.reduce((sum, item) => sum + (item.kind === 'asset' ? 0 : item.text.length), 0),
      frozenAt: snapshot.createdAt, itemLabels: snapshot.items.map(item => item.displayName), excluded: [] }, { generation: null });
    const verifiedBinding = readPendingMokinaSnapshot(targetId, pendingScope);
    if (!verifiedBinding || verifiedBinding.snapshotId !== snapshotId) throw new Error('接续资料绑定读回失败，原恢复记录已保留。');
    await update({ checkpoint: 'draft-ready', lastError: undefined });
    await completeContinuationJournal(key, journal);
    return journal;
  } catch (cause) {
    try { await update({ lastError: cause instanceof Error ? cause.message : '接续失败' }); }
    catch (saveError) { throw new Error(`${cause instanceof Error ? cause.message : '接续失败'}；${saveError instanceof Error ? saveError.message : '恢复记录保存失败'}`); }
    throw cause;
  }
}

export function continuationTextUnits(intent: ContinuationIntent) {
  return intent.sections.reduce((sum, section) => sum + `【${section.id}】\n${section.text}`.length, 0) + intent.background.length;
}

/** Old journals can only reopen an already saved, matching target; never reconstruct missing intent. */
export async function resumeLegacyMokinaContinuation(journal: MokinaContinuationJournal, workspaceContext: WorkspaceCollabContext | null) {
  const headers = workspaceContext ? workspaceProjectHeaders(workspaceContext) : {};
  const targetId = journal.targetProjectId;
  const files = await fetchProjectFiles(targetId, { workspaceContext, fresh: true, requireAuthoritative: true });
  if (!files.some(file => file.name === 'MOKINA-CONTINUATION.json')) throw new Error('旧接续记录缺少完整意图及目标接续稿，请保留记录并重新确认。');
  const response = await fetch(projectFileUrl(targetId, 'MOKINA-CONTINUATION.json', workspaceContext), { cache: 'no-store' });
  const draft = response.ok ? await response.json().catch(() => null) as MokinaContinuationV2 | null : null;
  if (!draft || draft.operationId !== journal.operationId || draft.targetProjectId !== targetId || !draft.contextSnapshotId) throw new Error('旧目标接续稿身份无法核对，停止恢复。');
  if (journal.contextSnapshotId && journal.contextSnapshotId !== draft.contextSnapshotId) throw new Error('旧目标快照与恢复记录不符。');
  const snapshotRead = await fetch(`/api/projects/${encodeURIComponent(targetId)}/mokina/context-snapshots/${encodeURIComponent(draft.contextSnapshotId)}`, { headers, cache: 'no-store' });
  const snapshot = snapshotRead.ok ? (await snapshotRead.json().catch(() => null))?.snapshot as MokinaContextSnapshot | undefined : undefined;
  if (!snapshot || snapshot.projectId !== targetId || snapshot.snapshotId !== draft.contextSnapshotId) throw new Error('旧目标固定快照无法核对，停止恢复。');
  return journal;
}
