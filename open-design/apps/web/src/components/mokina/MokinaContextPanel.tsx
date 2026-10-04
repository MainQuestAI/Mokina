import { useMemo, useState } from 'react';

import { MOKINA_CONTEXT_BUDGETS, type ProjectMaterialExtraction } from '@open-design/contracts';

import type { ProjectFile } from '../../types';
import { randomUUID } from '../../utils/uuid';
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

/**
 * "资料与背景"面板（T07）：把本项目的资料段落冻结成一次不可变上下文快照，
 * 交给本会话的下一轮发送引用（`context.mokinaSnapshotId`）。服务端重读原件、
 * 校验摘要与预算，客户端只负责选择与展示。界面分三层：原件、可用内容、
 * 本次任务；未纳入项必须给出原因，不用一个对勾混同"上传/解析/选入/已提交"。
 */

const MOKINA_MATERIAL_EXTENSIONS = /\.(?:txt|md|csv|pdf|docx|xlsx|pptx)$/i;

type ReadResult = {
  material: ProjectMaterialExtraction;
  unreadable: boolean;
};

export function MokinaContextPanel({ projectId, files }: {
  projectId: string;
  files: ProjectFile[];
}) {
  const { workspaceContext } = useProjectCollabContext();
  const candidates = useMemo(
    () => files.filter((file) => file.name !== 'MOKINA-CONTINUATION.json' && MOKINA_MATERIAL_EXTENSIONS.test(file.name)),
    [files],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<ReadResult[] | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [frozen, setFrozen] = useState<PendingMokinaContextSnapshot | null>(
    () => readPendingMokinaSnapshot(projectId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readableMaterials = useMemo(
    () => (results ?? []).filter((item) => !item.unreadable).map((item) => item.material),
    [results],
  );
  const groups = useMemo(() => groupMokinaMaterialSections(readableMaterials), [readableMaterials]);
  const chosenGroups = groups.filter((group) => selectedGroups.includes(group.key));
  const chosenChars = chosenGroups.reduce((sum, group) => sum + group.chars, 0);
  const budget = MOKINA_CONTEXT_BUDGETS.maxExcerptCodeUnits;

  async function previewSelected() {
    if (busy) return;
    if (!selected.length) {
      setError('请至少选择一份资料。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const extracted = await Promise.all(
        selected.map((name) => fetchProjectMaterial(projectId, name, workspaceContext)),
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
      setSelectedGroups([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '资料读取失败');
    } finally {
      setBusy(false);
    }
  }

  async function freezeSnapshot() {
    if (busy || !results) return;
    if (chosenGroups.length === 0) {
      setError('请至少勾选一个资料段落。');
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
    const selections = [...byFile.entries()].map(([fileName, entry], index) => ({
      itemId: `S${index + 1}`,
      mode: 'groups' as const,
      textKind: 'material-excerpt' as const,
      sourceRef: { kind: 'project-file' as const, projectId, fileName },
      expectedSourceDigest: entry.digest,
      groupIds: [...entry.groupIds],
    }));
    if (selections.length === 0) {
      setError('所选段落没有稳定的分组标识，无法冻结；请重新预览资料。');
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
          throw new Error('资料在预览后发生变化；请重新预览并选择。');
        }
        if (code === 'MOKINA_CONTEXT_LIMIT') {
          throw new Error(body?.error?.message ?? '所选内容超过本次任务的字数预算；请减少勾选。');
        }
        throw new Error(body?.error?.message ?? `资料冻结失败（${response.status}）`);
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
      writePendingMokinaSnapshot(record);
      setFrozen(record);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '资料冻结失败');
    } finally {
      setBusy(false);
    }
  }

  if (candidates.length === 0) return null;

  return (
    <details className="mokina-material-picker mokina-context-panel">
      <summary>资料与背景（交给本轮对话的下一发）</summary>
      <p>
        选择资料段落并冻结成任务快照后，下一次发送会自动带上它；服务端会重新读取原件并校验摘要与字数预算。
        未勾选内容不会进入请求；已冻结的来源变化不影响这份快照。
      </p>
      {frozen ? (
        <div role="status" className="mokina-context-panel__frozen">
          <p>
            已加入任务快照：{frozen.itemCount} 项、约 {frozen.charCount.toLocaleString()} 字；
            {frozen.frozenAt ? `冻结于 ${new Date(frozen.frozenAt).toLocaleString()}` : ''}。
            下一发发送时随请求提交；此前的运行不受影响。
          </p>
          <ul>
            {frozen.itemLabels.map((label) => <li key={label}>已选择：{label}</li>)}
            {frozen.excluded.map((entry) => (
              <li key={`excluded:${entry.displayName}`}>未纳入（{entry.reason}）：{entry.displayName}</li>
            ))}
          </ul>
          <button type="button" onClick={() => { clearPendingMokinaSnapshot(projectId); setFrozen(null); }}>
            不再使用这份快照
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
                setResults(null);
                setSelectedGroups([]);
              }}
            />
            <span>{file.name}</span>
            <small>已上传 · {(file.size / 1024).toFixed(1)} KB</small>
          </label>
        ))}
      </div>
      {results ? (
        <div className="mokina-material-picker__preview">
          {results.map((item) => (
            <div key={item.material.name}>
              <p>
                {item.material.name}：
                {item.unreadable ? '无法读取（保留原件，不作为依据）' : item.material.status === 'partial' ? '部分可读取' : '可读取'}。
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
            已选 {chosenChars.toLocaleString()} / {budget.toLocaleString()} 字；
            超过预算会明确拒绝，不会静默截断。
          </p>
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
          {busy ? '正在处理资料…' : '预览可读范围'}
        </button>
        <button
          type="button"
          disabled={busy || !results || chosenGroups.length === 0}
          onClick={() => void freezeSnapshot()}
        >
          {busy ? '正在处理资料…' : `冻结为任务快照（${chosenGroups.length} 个段落）`}
        </button>
      </div>
    </details>
  );
}
