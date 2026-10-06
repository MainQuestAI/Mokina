import { useEffect, useMemo, useState } from 'react';

import { MOKINA_CONTEXT_BUDGETS, type MokinaContextSelection, type ProjectMaterialExtraction } from '@open-design/contracts';

import type { ProjectFile } from '../../types';
import { randomUUID } from '../../utils/uuid';
import { useT } from '../../i18n';
import { useProjectCollabContext } from '../../collab/collab-context';
import { workspaceProjectHeaders } from '../../collab/workspace-identity';
import { fetchProjectMaterial } from '../../providers/registry';
import { fetchDesignSystems } from '../../providers/registry';
import {
  baseMokinaGroupId,
  groupMokinaMaterialSections,
  MOKINA_ASSET_FILE_PATTERN,
  MOKINA_MATERIAL_FILE_PATTERN,
} from '../../runtime/mokina/material-selection';
import {
  PENDING_MOKINA_SNAPSHOT_CHANGED_EVENT,
  clearPendingMokinaSnapshot,
  readPendingMokinaSnapshot,
  writePendingMokinaSnapshot,
  type PendingMokinaContextSnapshot,
} from '../../runtime/mokina/pending-context-snapshot';

import { mokinaBytesDigest } from '../../runtime/mokina/digest';
import type { DesignSystemSummary } from '@open-design/contracts';

type BrandSelection = {
  id: string;
  title: string;
  digest: string;
  chars: number;
};
/**
 * "资料与背景"面板（T07/N03）：把本项目的资料段落冻结成一次不可变上下文快照，
 * 随本项目的下一次明确发送引用（`context.mokinaSnapshotId`），发送受理后绑定即
 * 交接消费（后续独立任务不静默继承）。服务端重读原件、校验摘要与预算，客户端
 * 只负责选择与展示。界面分三层：原件、可用内容、本次任务；未纳入项必须给出
 * 原因，不用一个对勾混同"上传/解析/选入/已提交"。
 */

const MOKINA_ASSET_EXTENSIONS = MOKINA_ASSET_FILE_PATTERN;
const MOKINA_MATERIAL_EXTENSIONS = MOKINA_MATERIAL_FILE_PATTERN;

type ReadResult = {
  material: ProjectMaterialExtraction;
  unreadable: boolean;
};

export function MokinaContextPanel({ projectId, files, projectDesignSystemId }: {
  projectId: string;
  files: ProjectFile[];
  /** N04: the project's bound brand kit, preselected transparently when offered. */
  projectDesignSystemId?: string | null;
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
  // N03: a send consumes the binding in ProjectView; refresh this surface when
  // the pending record changes underneath us (freeze / consume / clear).
  useEffect(() => {
    function onChanged() {
      setFrozen(readPendingMokinaSnapshot(projectId));
    }
    window.addEventListener(PENDING_MOKINA_SNAPSHOT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PENDING_MOKINA_SNAPSHOT_CHANGED_EVENT, onChanged);
  }, [projectId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // N04: brand-kit source. The same catalog the Home design-system picker
  // uses; selecting one freezes the brand's DESIGN.md as a brand-rule item.
  const [designSystems, setDesignSystems] = useState<DesignSystemSummary[]>([]);
  const [brandCatalogLoaded, setBrandCatalogLoaded] = useState(false);
  const [brand, setBrand] = useState<BrandSelection | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchDesignSystems(workspaceContext)
      .then((systems) => {
        if (cancelled) return;
        setDesignSystems(systems);
        setBrandCatalogLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setBrandError('品牌套件目录读取失败。');
        setBrandCatalogLoaded(true);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // 项目已绑定品牌套件时透明预选；用户可改为不使用品牌。
    if (brand || !projectDesignSystemId) return;
    const match = designSystems.find((system) => system.id === projectDesignSystemId);
    if (match) void selectBrand(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designSystems, projectDesignSystemId]);

  async function selectBrand(id: string) {
    setBrandError(null);
    if (!id) {
      setBrand(null);
      return;
    }
    const summary = designSystems.find((system) => system.id === id);
    try {
      const response = await fetch(`/api/design-systems/${encodeURIComponent(id)}`,
        workspaceContext ? { headers: workspaceProjectHeaders(workspaceContext) } : undefined);
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json() as { body?: string };
      const text = typeof body.body === 'string' ? body.body : '';
      if (!text.trim()) throw new Error('empty');
      const bytes = new TextEncoder().encode(text);
      setBrand({
        id,
        title: summary?.title ?? id,
        digest: await mokinaBytesDigest(bytes.buffer as ArrayBuffer),
        chars: text.length,
      });
    } catch {
      setBrand(null);
      setBrandError(`品牌规则读取失败：${id}`);
    }
  }

  const readableMaterials = useMemo(
    () => (results ?? []).filter((item) => !item.unreadable && !MOKINA_ASSET_EXTENSIONS.test(item.material.name)).map((item) => item.material),
    [results],
  );
  const groups = useMemo(() => groupMokinaMaterialSections(readableMaterials), [readableMaterials]);
  const chosenGroups = groups.filter((group) => selectedGroups.includes(group.key));
  const chosenChars = chosenGroups.reduce((sum, group) => sum + group.chars, 0) + (brand?.chars ?? 0);
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
    if (busy || (!brand && !results)) return;
    if (chosenGroups.length === 0 && assets.length === 0 && !brand) {
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
    if (brand) {
      selections.push({
        itemId: `B${assets.length + 1}`,
        mode: 'groups' as const,
        textKind: 'brand-rule' as const,
        sourceRef: { kind: 'design-system' as const, designSystemId: brand.id },
        expectedSourceDigest: brand.digest,
        groupIds: [],
      });
    }
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

  // 没有资料文件、且品牌目录确认也为空时，这个面板没有可做的事。
  if (candidates.length === 0 && brandCatalogLoaded && designSystems.length === 0) return null;

  return (
    <details className="mokina-material-picker mokina-context-panel">
      <summary>{t('mokina.contextPanel.summary')}</summary>
      <p>{t('mokina.contextPanel.intro')}</p>
      <div className="mokina-context-panel__brand">
        <label>
          品牌来源
          <select
            aria-label="品牌来源"
            value={brand?.id ?? ''}
            disabled={busy}
            onChange={(event) => void selectBrand(event.target.value)}
          >
            <option value="">不使用品牌规则</option>
            {designSystems.map((system) => (
              <option key={system.id} value={system.id}>{system.title}</option>
            ))}
          </select>
        </label>
        {brand ? (
          <small>已选品牌：{brand.title} · 约 {brand.chars.toLocaleString()} 字（冻结后原品牌套件更新不影响本快照）</small>
        ) : null}
        {brandError ? <p role="alert">{brandError}</p> : null}
      </div>
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
          <button type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              if (await clearPendingMokinaSnapshot(projectId)) setFrozen(null);
              else setError('资料绑定清理失败，请重试；原绑定仍然保留。');
            } finally { setBusy(false); }
          }}>
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
          disabled={busy || (!brand && (!results || (chosenGroups.length === 0 && assets.length === 0)))}
          onClick={() => void freezeSnapshot()}
        >
          {busy ? t('mokina.contextPanel.busy') : t('mokina.contextPanel.freezeAction', { count: chosenGroups.length + assets.length + (brand ? 1 : 0) })}
        </button>
      </div>
    </details>
  );
}
