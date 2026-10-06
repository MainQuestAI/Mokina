import {
  MOKINA_CONTEXT_BUDGETS,
  type MokinaAssetRole,
  type MokinaContextSelection,
  type MokinaExcludedContextItem,
  type ProjectMaterialExtraction,
  type WorkspaceCollabContext,
} from '@open-design/contracts';

import { fetchProjectMaterial } from '../../providers/registry';
import { workspaceProjectHeaders } from '../../collab/workspace-identity';
import { randomUUID } from '../../utils/uuid';
import { baseMokinaGroupId, groupMokinaMaterialSections } from './material-selection';
import { mokinaBytesDigest } from './digest';
import { writePendingMokinaSnapshot } from './pending-context-snapshot';

/**
 * N02 — Home 到首个真实任务：把首页暂存附件中标为 Mokina 资料/素材的文件，
 * 在项目创建后冻结成与项目内「资料与背景」面板完全同一套的上下文快照
 * （同一个 daemon API、同一条 pending-context-snapshot 绑定、同一种
 * context.mokinaSnapshotId 发送引用）。首页因此没有第二套存储或发送路径：
 * 选择发生在首页，冻结与引用复用项目内机制。
 *
 * 首页没有 projectId，所以选择本身只记为 plan（文件名 + 种类 + 素材角色），
 * 延迟到 `POST /api/projects` 成功、附件上传完成之后才真正冻结——这与
 * 「项目上下文需要 ID 时复用现有创建机制延迟准备」的产品语义一致。
 */

export type HomeMokinaFileKind = 'material' | 'asset';

export interface HomeMokinaFilePlan {
  name: string;
  size: number;
  kind: HomeMokinaFileKind;
  role?: MokinaAssetRole;
  usageNote?: string;
}

export interface HomeMokinaMaterialRead {
  name: string;
  extraction: ProjectMaterialExtraction;
}

export interface HomeMokinaAssetBytes {
  name: string;
  byteLength: number;
  digest: string;
}

/**
 * Build the selection payload for the shared snapshot API from post-upload
 * reads. Pure so the budget/exclusion behaviour is unit-testable:
 * - 资料文件：纳入全部稳定段落组，按 24,000 UTF-16 预算顺序累计，超出的组
 *   以 budget 原因显式排除（绝不静默截断）；
 * - 不可读资料：以 unreadable 原因排除（保留原件，不作为依据）；
 * - 素材：冻结原始字节摘要，单素材超过 30 MiB 预算时以 budget 原因排除。
 * 没有任何可选入项时返回 null（调用方退回纯附件发送）。
 */
export function buildHomeMokinaSelections(input: {
  projectId: string;
  plans: HomeMokinaFilePlan[];
  materials: HomeMokinaMaterialRead[];
  assets: HomeMokinaAssetBytes[];
  /**
   * N02 review: files whose upload failed never reached the project, so a
   * selection referencing one makes the daemon reject the WHOLE snapshot with
   * a 409 (freeze reads the project file and finds nothing). The caller passes
   * their names; each is dropped from the selections and reported as excluded
   * with an explicit reason, matching the 绝不静默丢弃 semantics of the other
   * exclusion paths.
   */
  failedUploadNames?: ReadonlySet<string> | null;
}): { selections: MokinaContextSelection[]; excluded: MokinaExcludedContextItem[] } | null {
  const { projectId, plans, materials, assets, failedUploadNames } = input;
  const selections: MokinaContextSelection[] = [];
  const excluded: MokinaExcludedContextItem[] = [];
  let excerptBudget = MOKINA_CONTEXT_BUDGETS.maxExcerptCodeUnits;
  let materialIndex = 0;
  let assetIndex = 0;

  for (const plan of plans) {
    if (failedUploadNames?.has(plan.name)) {
      excluded.push({
        displayName: plan.name,
        reason: 'unavailable',
        explanation: '文件上传失败，未纳入本次任务；文件已退回首页暂存，可重新上传',
      });
      continue;
    }
    if (plan.kind === 'material') {
      const read = materials.find((item) => item.name === plan.name);
      const extraction = read?.extraction;
      if (!extraction || extraction.status === 'unreadable') {
        excluded.push({
          displayName: plan.name,
          reason: 'unreadable',
          explanation: !extraction
            ? '资料读取失败'
            : extraction.limitations.join('；') || '无法读取',
        });
        continue;
      }
      const groups = groupMokinaMaterialSections([extraction]);
      const chosenGroupIds = new Set<string>();
      const chosenLabels: string[] = [];
      const overflowLabels: string[] = [];
      let chosenChars = 0;
      for (const group of groups) {
        if (chosenChars + group.chars <= excerptBudget) {
          for (const section of group.sections) {
            const baseId = section.groupId ? baseMokinaGroupId(section.groupId) : '';
            // 与面板同一规则：无 groupId 的段落（理论上仅 location）不进服务端
            // 选择，避免用位置冒充稳定标识。
            if (baseId) chosenGroupIds.add(baseId);
          }
          chosenChars += group.chars;
          chosenLabels.push(group.label);
        } else {
          overflowLabels.push(group.label);
        }
      }
      excerptBudget -= chosenChars;
      if (chosenGroupIds.size === 0) {
        excluded.push({
          displayName: plan.name,
          reason: 'budget',
          explanation: overflowLabels.length > 0
            ? `可用段落均超出本次摘录预算（${MOKINA_CONTEXT_BUDGETS.maxExcerptCodeUnits.toLocaleString()} 字），未纳入本次任务`
            : '没有可冻结的稳定段落',
        });
        continue;
      }
      materialIndex += 1;
      selections.push({
        itemId: `S${materialIndex}`,
        mode: 'groups',
        textKind: 'material-excerpt',
        sourceRef: { kind: 'project-file', projectId, fileName: plan.name },
        expectedSourceDigest: extraction.contentDigest,
        groupIds: [...chosenGroupIds],
      });
      for (const label of overflowLabels) {
        excluded.push({
          displayName: `${plan.name} · ${label}`,
          reason: 'budget',
          explanation: '超出本次摘录预算，未纳入本次任务；可在项目内「资料与背景」重新精选',
        });
      }
      continue;
    }

    const asset = assets.find((item) => item.name === plan.name && item.byteLength === plan.size);
    if (!asset || !asset.digest) {
      excluded.push({
        displayName: plan.name,
        reason: 'unavailable',
        explanation: '素材字节缺失，未纳入本次任务',
      });
      continue;
    }
    if (asset.byteLength > MOKINA_CONTEXT_BUDGETS.maxAssetBytes) {
      excluded.push({
        displayName: plan.name,
        reason: 'budget',
        explanation: `素材超过单次 ${Math.round(MOKINA_CONTEXT_BUDGETS.maxAssetBytes / 1024 / 1024)} MiB 预算，未纳入本次任务`,
      });
      continue;
    }
    assetIndex += 1;
    selections.push({
      itemId: `A${assetIndex}`,
      mode: 'asset',
      sourceRef: { kind: 'project-file', projectId, fileName: plan.name },
      expectedSourceDigest: asset.digest,
      role: plan.role ?? 'supporting',
      usageNote: plan.usageNote ?? '',
    });
  }

  return selections.length > 0 ? { selections, excluded } : null;
}

export interface HomeMokinaSnapshotPreparation {
  snapshotId: string | null;
  /** Planned files dropped from the snapshot because their upload failed. */
  uploadFailedNames: string[];
}

/**
 * Freeze the home-marked files into the shared context snapshot and bind it as
 * this project's pending snapshot. Returns the snapshotId on success, or null
 * when nothing could be frozen or the API rejected the request — the caller
 * then sends the plain attachments without a snapshot (the user can still
 * freeze a curated selection inside the project). Plans whose upload failed
 * are excluded explicitly instead of poisoning the whole freeze.
 */
export async function prepareHomeMokinaSnapshot(input: {
  projectId: string;
  plans: HomeMokinaFilePlan[];
  stagedFiles: File[];
  workspaceContext?: WorkspaceCollabContext | null;
  /** Names of staged files whose upload to the project failed. */
  failedUploadNames?: ReadonlySet<string> | null;
}): Promise<HomeMokinaSnapshotPreparation> {
  const { projectId, plans, stagedFiles, failedUploadNames } = input;
  const uploadFailedNames = failedUploadNames
    ? plans.filter((plan) => failedUploadNames.has(plan.name)).map((plan) => plan.name)
    : [];
  const materialPlans = plans.filter((plan) => plan.kind === 'material' && !failedUploadNames?.has(plan.name));
  const assetPlans = plans.filter((plan) => plan.kind === 'asset' && !failedUploadNames?.has(plan.name));

  const materials: HomeMokinaMaterialRead[] = await Promise.all(
    materialPlans.map(async (plan) => {
      const result = await fetchProjectMaterial(projectId, plan.name, input.workspaceContext);
      if ('error' in result) {
        // 读取失败不是资料正文：保留原件并显式排除（与面板同一语义）。
        return {
          name: plan.name,
          extraction: {
            name: plan.name,
            contentDigest: '',
            status: 'unreadable',
            limitations: [result.error],
            sections: [],
          } satisfies ProjectMaterialExtraction,
        };
      }
      return { name: plan.name, extraction: result };
    }),
  );
  const assets: HomeMokinaAssetBytes[] = await Promise.all(
    assetPlans.map(async (plan) => {
      const file = stagedFiles.find((item) => item.name === plan.name && item.size === plan.size);
      if (!file) return { name: plan.name, byteLength: 0, digest: '' };
      return {
        name: plan.name,
        byteLength: file.size,
        digest: await mokinaBytesDigest(await file.arrayBuffer()),
      };
    }),
  );

  const built = buildHomeMokinaSelections({ projectId, plans, materials, assets, failedUploadNames });
  if (!built) return { snapshotId: null, uploadFailedNames };

  const snapshotId = randomUUID();
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/mokina/context-snapshots`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.workspaceContext ? workspaceProjectHeaders(input.workspaceContext) : {}),
      },
      body: JSON.stringify({
        snapshotId,
        selections: built.selections,
        excluded: built.excluded,
      }),
    },
  );
  const body = await response.json().catch(() => null) as {
    snapshot?: { items: Array<{ displayName: string; kind: string; text?: string }> };
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok || !body?.snapshot) return { snapshotId: null, uploadFailedNames };

  const items = body.snapshot.items ?? [];
  await writePendingMokinaSnapshot({
    snapshotId,
    projectId,
    itemCount: items.length,
    charCount: items.reduce((sum, item) => sum + (item.text?.length ?? 0), 0),
    frozenAt: new Date().toISOString(),
    itemLabels: items.map((item) => item.displayName).slice(0, 20),
    excluded: built.excluded.map((entry) => ({
      displayName: entry.displayName,
      reason: entry.explanation || entry.reason,
    })),
  });
  return { snapshotId, uploadFailedNames };
}
