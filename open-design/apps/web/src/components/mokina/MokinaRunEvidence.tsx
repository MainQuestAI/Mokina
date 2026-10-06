import { useEffect, useState } from 'react';

import type { MokinaContextDeliveryReceipt, MokinaContextSnapshot } from '@open-design/contracts';

import { fetchChatRunStatus } from '../../providers/daemon';
import { MOKINA_LOCAL_EDITION } from '../../mokina-edition';

import styles from './MokinaRunEvidence.module.css';

/**
 * N03「运行依据」：一轮带快照的 run 结束后，用户能在这里核对实际注入了
 * 什么——选入项、来源位置、限制、未提供原因、inline-text / staged-file
 * 交付方式和运行身份。数据来自 daemon 的两处既有读取：
 * - `GET /api/runs/:id` 上的 delivery receipt（随 run 状态透传）；
 * - `GET /api/projects/:id/mokina/context-snapshots/:snapshotId` 的不可变快照。
 * 组件在没有回执时不渲染任何内容（普通 run 零噪音）。
 */

const KIND_LABEL: Record<string, string> = {
  'material-excerpt': '资料摘录',
  'brand-rule': '品牌规则',
  'artifact-section': '成果选段',
  'user-note': '补充说明',
  asset: '素材',
};

const MODE_LABEL: Record<string, string> = {
  'inline-text': '摘录内联',
  'staged-file': '字节随附',
  multimodal: '多模态',
};

const STATUS_LABEL: Record<string, string> = {
  prepared: '已准备',
  submitted: '已提交',
  'not-submitted': '未提交',
};

export function MokinaRunEvidence({ projectId, runId, runActive }: {
  projectId: string;
  runId: string;
  runActive: boolean;
}) {
  const [receipt, setReceipt] = useState<MokinaContextDeliveryReceipt | null>(null);
  const [agentLabel, setAgentLabel] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MokinaContextSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState(false);
  const [open, setOpen] = useState(false);

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
  }, [open, snapshot, snapshotError, receipt, projectId]);

  if (!MOKINA_LOCAL_EDITION || !receipt) return null;

  const itemsById = new Map((snapshot?.items ?? []).map((item) => [item.itemId, item]));
  const deliveryById = new Map(receipt.itemDelivery.map((delivery) => [delivery.itemId, delivery]));

  return (
    <details
      className={styles.evidence}
      data-testid="mokina-run-evidence"
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary>
        本次运行依据 · {STATUS_LABEL[receipt.status] ?? receipt.status}
        {receipt.submittedAt ? ` · ${new Date(receipt.submittedAt).toLocaleString()}` : ''}
        {agentLabel ? ` · ${agentLabel}` : ''}
      </summary>
      <ul className={styles.items}>
        {receipt.includedItemIds.map((itemId) => {
          const item = itemsById.get(itemId);
          const delivery = deliveryById.get(itemId);
          return (
            <li key={itemId} data-testid={`mokina-run-evidence-item-${itemId}`}>
              <span>{item?.displayName ?? itemId}</span>
              <small>
                {item ? `${KIND_LABEL[item.kind] ?? item.kind} · ` : ''}
                {delivery ? (MODE_LABEL[delivery.mode] ?? delivery.mode) : ''}
              </small>
              {item && item.kind !== 'asset' && item.limitations.length > 0 ? (
                <small className={styles.limitations}>限制：{item.limitations.join('；')}</small>
              ) : null}
            </li>
          );
        })}
        {(snapshot?.excluded ?? []).map((entry, index) => (
          <li key={`excluded-${index}`} className={styles.excluded}>
            <span>未提供：{entry.displayName}</span>
            <small>{entry.explanation || entry.reason}</small>
          </li>
        ))}
      </ul>
      {snapshotError ? <p className={styles.error}>快照原文读取失败；以上提交状态仍来自运行回执。</p> : null}
      {receipt.status === 'not-submitted' && receipt.reason ? (
        <p className={styles.error}>未提交原因：{receipt.reason}</p>
      ) : null}
    </details>
  );
}
