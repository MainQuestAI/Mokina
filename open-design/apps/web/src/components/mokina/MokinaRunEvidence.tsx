import { useEffect, useState } from 'react';

import type { MokinaContextDeliveryReceipt, MokinaContextSnapshot } from '@open-design/contracts';

import type { WorkspaceCollabContext } from '@open-design/contracts';

import { fetchChatRunStatus } from '../../providers/daemon';
import { workspaceProjectHeaders } from '../../collab/workspace-identity';
import { MOKINA_LOCAL_EDITION } from '../../mokina-edition';
import { useT } from '../../i18n';
import type { Dict } from '../../i18n/types';

import styles from './MokinaRunEvidence.module.css';

/**
 * N03「运行依据」：一轮带快照的 run 结束后，用户能在这里核对实际注入了
 * 什么——选入项、来源位置、限制、未提供原因、inline-text / staged-file
 * 交付方式和运行身份。数据来自 daemon 的两处既有读取：
 * - `GET /api/runs/:id` 上的 delivery receipt（随 run 状态透传）；
 * - `GET /api/projects/:id/mokina/context-snapshots/:snapshotId` 的不可变快照。
 * 组件在没有回执时不渲染任何内容（普通 run 零噪音）。
 */

const KIND_LABEL_KEY: Record<string, keyof Dict> = {
  'material-excerpt': 'mokina.runEvidence.kindMaterial',
  'brand-rule': 'mokina.runEvidence.kindBrandRule',
  'artifact-section': 'mokina.runEvidence.kindArtifactSection',
  'user-note': 'mokina.runEvidence.kindUserNote',
  asset: 'mokina.runEvidence.kindAsset',
};

const MODE_LABEL_KEY: Record<string, keyof Dict> = {
  'inline-text': 'mokina.runEvidence.modeInlineText',
  'staged-file': 'mokina.runEvidence.modeStagedFile',
  multimodal: 'mokina.runEvidence.modeMultimodal',
};

const STATUS_LABEL_KEY: Record<string, keyof Dict> = {
  prepared: 'mokina.runEvidence.statusPrepared',
  submitted: 'mokina.runEvidence.statusSubmitted',
  'not-submitted': 'mokina.runEvidence.statusNotSubmitted',
};

export function MokinaRunEvidence({ projectId, runId, runActive, workspaceContext }: {
  projectId: string;
  runId: string;
  runActive: boolean;
  /** Collab projects need the workspace headers for the snapshot read. */
  workspaceContext?: WorkspaceCollabContext | null;
}) {
  const [receipt, setReceipt] = useState<MokinaContextDeliveryReceipt | null>(null);
  const [agentLabel, setAgentLabel] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MokinaContextSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!MOKINA_LOCAL_EDITION || runActive) return;
    let cancelled = false;
    void fetchChatRunStatus(runId).then((status) => {
      if (cancelled || !status) return;
      setAgentLabel(status.agentId ?? null);
      setReceipt(status.mokinaContext ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [runId, runActive]);

  useEffect(() => {
    if (!open || snapshot || snapshotError || !receipt) return;
    let cancelled = false;
    fetch(
      `/api/projects/${encodeURIComponent(projectId)}/mokina/context-snapshots/${encodeURIComponent(receipt.snapshotId)}`,
      ...(workspaceContext ? [{ headers: workspaceProjectHeaders(workspaceContext) }] : []),
    )
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setSnapshotError(true);
          return;
        }
        const body = await response.json().catch(() => null) as { snapshot?: MokinaContextSnapshot } | null;
        setSnapshot(body?.snapshot ?? null);
      })
      .catch(() => {
        if (!cancelled) setSnapshotError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, snapshot, snapshotError, receipt, projectId, workspaceContext]);

  if (!MOKINA_LOCAL_EDITION || !receipt) return null;

  const itemsById = new Map((snapshot?.items ?? []).map((item) => [item.itemId, item]));
  const deliveryById = new Map((receipt.itemDelivery ?? []).map((delivery) => [delivery.itemId, delivery]));

  return (
    <details
      className={styles.evidence}
      data-testid="mokina-run-evidence"
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary>
        {t('mokina.runEvidence.title')} · {t(STATUS_LABEL_KEY[receipt.status] ?? 'mokina.runEvidence.statusPrepared')}
        {receipt.submittedAt ? t('mokina.runEvidence.time', { time: new Date(receipt.submittedAt).toLocaleString() }) : ''}
        {agentLabel ? t('mokina.runEvidence.agent', { agent: agentLabel }) : ''}
      </summary>
      <ul className={styles.items}>
        {(receipt.includedItemIds ?? []).map((itemId) => {
          const item = itemsById.get(itemId);
          const delivery = deliveryById.get(itemId);
          return (
            <li key={itemId} data-testid={`mokina-run-evidence-item-${itemId}`}>
              <span>{item?.displayName ?? itemId}</span>
              <small>
                {item ? `${t(KIND_LABEL_KEY[item.kind] ?? 'mokina.runEvidence.kindMaterial')} · ` : ''}
                {delivery ? t(MODE_LABEL_KEY[delivery.mode] ?? 'mokina.runEvidence.modeInlineText') : ''}
              </small>
              {item && item.kind !== 'asset' && item.limitations.length > 0 ? (
                <small className={styles.limitations}>
                  {t('mokina.runEvidence.limitations', { limitations: item.limitations.join('；') })}
                </small>
              ) : null}
            </li>
          );
        })}
        {(snapshot?.excluded ?? []).map((entry, index) => (
          <li key={`excluded-${index}`} className={styles.excluded}>
            <span>{t('mokina.runEvidence.excluded', { name: entry.displayName })}</span>
            <small>{entry.explanation || entry.reason}</small>
          </li>
        ))}
      </ul>
      {snapshotError ? <p className={styles.error}>{t('mokina.runEvidence.snapshotReadFailed')}</p> : null}
      {receipt.status === 'not-submitted' && receipt.reason ? (
        <p className={styles.error}>{t('mokina.runEvidence.reason', { reason: receipt.reason })}</p>
      ) : null}
    </details>
  );
}
