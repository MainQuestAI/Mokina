import { useMemo, useState } from 'react';

import { MOKINA_CONTEXT_BUDGETS, type MokinaContextSelection, type ProjectMaterialExtraction } from '@open-design/contracts';

import type { ProjectFile } from '../../types';
import { randomUUID } from '../../utils/uuid';
import { useT } from '../../i18n';
import { useProjectCollabContext } from '../../collab/collab-context';
import { workspaceProjectHeaders } from '../../collab/workspace-identity';
import { fetchProjectMaterial } from '../../providers/registry';
import {
  baseMokinaGroupId,
  groupMokinaMaterialSections,
} from '../../runtime/mokina/material-selection';
import {
  clearPendingMokinaSnapshot,
  readPendingMokinaSnapshot,
  writePendingMokinaSnapshot,
  type PendingMokinaContextSnapshot,
} from '../../runtime/mokina/pending-context-snapshot';

import { mokinaBytesDigest } from '../../runtime/mokina/digest';
/**
 * "资料与背景"面板（T07）：把本项目的资料段落冻结成一次不可变上下文快照，
 * 交给本会话的下一轮发送引用（`context.mokinaSnapshotId`）。服务端重读原件、
 * 校验摘要与预算，客户端只负责选择与展示。界面分三层：原件、可用内容、
 * 本次任务；未纳入项必须给出原因，不用一个对勾混同"上传/解析/选入/已提交"。
 */

const MOKINA_ASSET_EXTENSIONS = /\.(?:png|jpe?g|webp|gif|svg)$/i;
const MOKINA_MATERIAL_EXTENSIONS = /\.(?:txt|md|csv|pdf|docx|xlsx|pptx)$/i;

type ReadResult = {
  material: ProjectMaterialExtraction;
  unreadable: boolean;
};

export function MokinaContextPanel({ projectId, files }: {
  projectId: string;
  files: ProjectFile[];
}) {
  const t = useT();
  const { workspaceContext } = useProjectCollabContext();
  const candidates = useMemo(
    () => files.filter((file) => file.name !== 'MOKINA-CONTINUATION.json' && (MOKINA_MATERIAL_EXTENSIONS.test(file.name) || MOKINA_ASSET_EXTENSIONS.test(file.name))),
    [files],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<ReadResult[] | null>(null);
  const [assets, setAssets] = useState<Array<{ name: string; digest: string; role: 'logo' | 'hero' | 'supporting'; usageNote: string }>>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [frozen, setFrozen] = useState<PendingMokinaContextSnapshot | null>(
    () => readPendingMokinaSnapshot(projectId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readableMaterials = useMemo(
    () => (results ?? []).filter((item) => !item.unreadable && !MOKINA_ASSET_EXTENSIONS.test(item.material.name)).map((item) => item.material),
    [results],
  );
  const groups = useMemo(() => groupMokinaMaterialSections(readableMaterials), [readableMaterials]);
  const chosenGroups = groups.filter((group) => selectedGroups.includes(group.key));
  const chosenChars = chosenGroups.reduce((sum, group) => sum + group.chars, 0);
  const budget = MOKINA_CONTEXT_BUDGETS.maxExcerptCodeUnits;

  async function previewSelected() {
    if (busy) return;
    if (!selected.length) {
      setError(t('mokina.contextPanel.selectFile'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const extracted = await Promise.all(
        selected.map(async name => {
          if (!MOKINA_ASSET_EXTENSIONS.test(name)) return fetchProjectMaterial(projectId, name, workspaceContext);
          const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/raw/${name.split('/').map(encodeURIComponent).join('/')}`,
            workspaceContext ? { headers: workspaceProjectHeaders(workspaceContext) } : undefined);
          if (!response.ok) return { error: '素材读取失败' };
          return { name, contentDigest: await mokinaBytesDigest(await response.arrayBuffer()), status: 'read' as const,
            limitations: ['仅冻结素材字节；实际提供方式以运行回执为准。'], sections: [] };
        }),
      );
      const next: ReadResult[] = extracted.map((result, index) => {
        const name = selected[index]!;
        if (!result || 'error' in result) {
          // 保留原件但不作为依据：读取失败不是资料正文。
          return {
            material: {
              name,
              contentDigest: '',
              status: 'unreadable',
              limitations: [result && 'error' in result ? result.error : '资料读取失败'],
              sections: [],
            },
            unreadable: true,
          };
        }
        return { material: result, unreadable: result.status === 'unreadable' };
      });
      setResults(next);
      setAssets(next.filter(item => !item.unreadable && MOKINA_ASSET_EXTENSIONS.test(item.material.name)).map(item => ({
        name: item.material.name, digest: item.material.contentDigest, role: 'supporting', usageNote: '' })));
      setSelectedGroups([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('mokina.contextPanel.readFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function freezeSnapshot() {
    if (busy || !results) return;
    if (chosenGroups.length === 0 && assets.length === 0) {
      setError(t('mokina.contextPanel.selectGroup'));
      return;
    }
    const snapshotId = randomUUID();
    const byFile = new Map<string, { digest: string; groupIds: Set<string> }>();
    for (const group of chosenGroups) {
      const material = readableMaterials.find((item) => item.name === group.name);
      if (!material) continue;
      const entry = byFile.get(group.name) ?? { digest: material.contentDigest, groupIds: new Set<string>() };
      for (const section of group.sections) {
        const baseId = section.groupId ? baseMokinaGroupId(section.groupId) : '';
        // 无 groupId 的段落（理论上仅 location）不进入服务端选择，避免用位置冒充稳定标识。
        if (baseId) entry.groupIds.add(baseId);
      }
      byFile.set(group.name, entry);
    }
    const selections: MokinaContextSelection[] = [...byFile.entries()].map(([fileName, entry], index) => ({
      itemId: `S${index + 1}`,
      mode: 'groups' as const,
      textKind: 'material-excerpt' as const,
      sourceRef: { kind: 'project-file' as const, projectId, fileName },
      expectedSourceDigest: entry.digest,
      groupIds: [...entry.groupIds],
    }));
    selections.push(...assets.map((asset, index) => ({ itemId: `A${index + 1}`, mode: 'asset' as const,
      sourceRef: { kind: 'project-file' as const, projectId, fileName: asset.name }, expectedSourceDigest: asset.digest,
      role: asset.role, usageNote: asset.usageNote })));
    if (selections.length === 0) {
      setError(t('mokina.contextPanel.noStableGroup'));
      return;
    }
    const excluded = (results ?? [])
      .filter((item) => item.unreadable)
      .map((item) => ({ displayName: item.material.name, reason: 'unreadable', explanation: item.material.limitations.join('；') || '无法读取' }));
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/mokina/context-snapshots`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(workspaceContext ? workspaceProjectHeaders(workspaceContext) : {}),
          },
          body: JSON.stringify({ snapshotId, selections, excluded }),
        },
      );
      const body = await response.json().catch(() => null) as {
        snapshot?: { items: Array<{ displayName: string; kind: string; text?: string }> };
        error?: { code?: string; message?: string };
      } | null;
      if (!response.ok || !body?.snapshot) {
        const code = body?.error?.code ?? '';
        if (code === 'MOKINA_SOURCE_CHANGED') {
          setResults(null);
          setSelectedGroups([]);
          throw new Error(t('mokina.contextPanel.sourceChanged'));
        }
        if (code === 'MOKINA_CONTEXT_LIMIT') {
          throw new Error(body?.error?.message ?? t('mokina.contextPanel.budgetExceeded'));
        }
        throw new Error(body?.error?.message ?? t('mokina.contextPanel.freezeFailedStatus', { status: response.status }));
      }
      const items = body.snapshot.items ?? [];
      const record: PendingMokinaContextSnapshot = {
        snapshotId,
        projectId,
        itemCount: items.length,
        charCount: items.reduce((sum, item) => sum + (item.text?.length ?? 0), 0),
        frozenAt: new Date().toISOString(),
        itemLabels: items.map((item) => item.displayName).slice(0, 20),
        excluded: excluded.map((entry) => ({ displayName: entry.displayName, reason: '无法读取' })),
      };
      await writePendingMokinaSnapshot(record);
      setFrozen(record);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('mokina.contextPanel.freezeFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (candidates.length === 0) return null;

  return (
    <details className="mokina-material-picker mokina-context-panel">
      <summary>{t('mokina.contextPanel.summary')}</summary>
      <p>{t('mokina.contextPanel.intro')}</p>
      {frozen ? (
        <div role="status" className="mokina-context-panel__frozen">
          <p>
            {t('mokina.contextPanel.frozenTitle')}：
            {t('mokina.contextPanel.frozenDetail', {
              count: frozen.itemCount,
              chars: frozen.charCount.toLocaleString(),
              time: frozen.frozenAt ? t('mokina.contextPanel.frozenTime', { time: new Date(frozen.frozenAt).toLocaleString() }) : '',
            })}
            {t('mokina.contextPanel.frozenNextSend')}
          </p>
          <ul>
            {frozen.itemLabels.map((label) => <li key={label}>{t('mokina.contextPanel.selectedItem', { name: label })}</li>)}
            {frozen.excluded.map((entry) => (
              <li key={`excluded:${entry.displayName}`}>{t('mokina.contextPanel.excludedItem', { reason: entry.reason, name: entry.displayName })}</li>
            ))}
          </ul>
          <button type="button" onClick={() => { clearPendingMokinaSnapshot(projectId); setFrozen(null); }}>
            {t('mokina.contextPanel.clearSnapshot')}
          </button>
        </div>
      ) : null}
      <div className="mokina-material-picker__files">
        {candidates.map((file) => (
          <label key={file.name}>
            <input
              type="checkbox"
              checked={selected.includes(file.name)}
              disabled={busy}
              onChange={(event) => {
                setSelected((current) => (event.target.checked
                  ? [...current, file.name]
                  : current.filter((name) => name !== file.name)));
                setResults(null); setAssets([]);
                setSelectedGroups([]);
              }}
            />
            <span>{file.name}</span>
            <small>{t('mokina.contextPanel.uploaded')} · {(file.size / 1024).toFixed(1)} KB</small>
          </label>
        ))}
      </div>
      {results ? (
        <div className="mokina-material-picker__preview">
          {results.map((item) => (
            <div key={item.material.name}>
              <p>
                {item.material.name}：
                {item.unreadable
                  ? t('mokina.contextPanel.unreadable')
                  : item.material.status === 'partial'
                    ? t('mokina.contextPanel.partialRead')
                    : t('mokina.contextPanel.readable')}。
                {' '}{item.material.limitations.join(' ')}
              </p>
              {(item.material.groupLimitations ?? []).map((limitation) => (
                <p key={`${limitation.groupId}:${limitation.location}`}>
                  {limitation.location}：{limitation.message}
                </p>
              ))}
            </div>
          ))}
          <p role="status">
            {t('mokina.contextPanel.budgetStatus', { chars: chosenChars.toLocaleString(), budget: budget.toLocaleString() })}
          </p>
          {assets.map(asset => <div key={asset.name}>
            <label>{asset.name} · 素材角色<select aria-label={`${asset.name} 素材角色`} value={asset.role}
              onChange={event => setAssets(current => current.map(item => item.name === asset.name
                ? { ...item, role: event.target.value as typeof asset.role } : item))}>
              <option value="logo">品牌标识</option><option value="hero">主视觉</option><option value="supporting">辅助素材</option>
            </select></label>
            <input aria-label={`${asset.name} 使用说明`} value={asset.usageNote} placeholder="使用说明"
              onChange={event => setAssets(current => current.map(item => item.name === asset.name ? { ...item, usageNote: event.target.value } : item))} />
          </div>)}
          {groups.map((group) => (
            <label key={group.key}>
              <input
                type="checkbox"
                checked={selectedGroups.includes(group.key)}
                disabled={busy}
                onChange={(event) => setSelectedGroups((current) => (event.target.checked
                  ? [...current, group.key]
                  : current.filter((key) => key !== group.key)))}
              />
              <span>{group.name} · {group.label} · {group.chars.toLocaleString()} 字</span>
              <small>{group.sections[0]?.location}：{group.sections[0]?.text.slice(0, 100)}</small>
            </label>
          ))}
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="mokina-context-panel__actions">
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={() => void previewSelected()}
        >
          {busy ? t('mokina.contextPanel.busy') : t('mokina.contextPanel.previewAction')}
        </button>
        <button
          type="button"
          disabled={busy || !results || (chosenGroups.length === 0 && assets.length === 0)}
          onClick={() => void freezeSnapshot()}
        >
          {busy ? t('mokina.contextPanel.busy') : t('mokina.contextPanel.freezeAction', { count: chosenGroups.length + assets.length })}
        </button>
      </div>
    </details>
  );
}
