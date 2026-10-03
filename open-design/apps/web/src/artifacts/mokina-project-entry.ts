import type { ProjectFileVersion } from '@open-design/contracts';

/**
 * Mokina 成果身份与打开优先级的纯解析（Spec B1 §5）。
 *
 * 只计算 navigation intent：不发起请求、不校验权限、不读文件系统。
 * 授权与路径安全仍由 App 既有守卫与 daemon `authorizeProjectRequest` /
 * `sanitizePath` 负责；本模块的产出只是「打开什么」的决定与原因。
 *
 * 正式成果判定（§5.1）：唯一证据是既有版本 `current: true` 且非
 * candidate。manifest.primary、artifactManifest、最新写入的 HTML 都不是
 * 采用证据；legacy 提示只能标「未确认采用」入口。读取未知不当作零。
 */

export type MokinaEntryReadState = 'ok' | 'loading' | 'failed' | 'unauthorized';

export interface MokinaEntryMetadata {
  /** 相对文件名，与 route fileName / tabs 字符串同域。 */
  entry: string;
  readState: MokinaEntryReadState;
  /** 版本列表；仅在 readState === 'ok' 时提供。 */
  versions?: readonly ProjectFileVersion[];
}

export interface MokinaTabsSnapshot {
  readonly tabs: readonly string[];
  readonly active: string | null;
  /** 该项目是否曾保存过 tabs 状态；缺省视为从未保存。 */
  readonly hasSavedState?: boolean;
}

export interface MokinaProjectEntryInput {
  readonly projectId: string;
  /** 项目文件条目元数据；null 表示列表本身读取未知（不是空）。 */
  readonly entries: readonly MokinaEntryMetadata[] | null;
  readonly entriesReadState: MokinaEntryReadState;
  readonly tabs?: MokinaTabsSnapshot | null;
  /** 深链/用户明确指定的目标。 */
  readonly explicitTarget?: { readonly entry: string; readonly versionId?: string } | null;
  /** legacy manifest.primary / metadata.entryFile 提示；永远不是采用证据。 */
  readonly legacyEntryHint?: string | null;
}

export interface MokinaFormalEntry {
  readonly entry: string;
  readonly versionId: string;
  readonly versionNumber: number;
  /** 采用/创建时间缺失时不虚构，返回 null。 */
  readonly adoptedAt: number | null;
  /** 显式采用过的版本携带 adoptionOperationId；正常首稿为 null。 */
  readonly adoptionOperationId: string | null;
}

export type MokinaEntryIntent =
  | {
      kind: 'open';
      source: 'explicit' | 'tabs' | 'single-formal';
      entry: string;
      versionId: string | null;
      /** 命中的正式成果；tabs 恢复候选/历史时不改变项目摘要的正式身份。 */
      formal: MokinaFormalEntry | null;
    }
  | { kind: 'chooser'; formals: readonly MokinaFormalEntry[] }
  | {
      kind: 'workspace';
      /** 0 个正式成果时的项目真实状态入口；legacy 仅作「未确认采用」提示。 */
      legacy: { readonly entry: string } | null;
    }
  | { kind: 'unresolvable'; reason: 'entries-loading' | 'entries-failed' | 'entries-unauthorized' }
  | {
      kind: 'invalid-target';
      target: { readonly entry: string; readonly versionId?: string };
      reason: 'entry-missing' | 'version-missing';
      /** 去掉显式目标后的恢复 intent（tabs/选择器/工作区），供「选择其他成果」。 */
      recovery: MokinaEntryIntent;
    };

export interface MokinaProjectSummary {
  readonly state: 'loading' | 'failed' | 'unauthorized' | 'empty' | 'artifacts';
  /** 正式成果数；按 entry 去重。读取未知时不代表 0。 */
  readonly formalCount: number;
  /** 行摘要用的主要正式成果：current 版本 createdAt 最新者。 */
  readonly primary: MokinaFormalEntry | null;
  readonly candidateCount: number;
  readonly legacy: { readonly entry: string } | null;
}

interface EntryVerdict {
  readonly formal: MokinaFormalEntry | null;
  readonly isCandidate: boolean;
  /** 同一 entry 出现多个 current 版本等异常：保守排除正式判定。 */
  readonly anomalous: boolean;
}

function verdictOf(metadata: MokinaEntryMetadata): EntryVerdict {
  const versions = metadata.versions ?? [];
  const currents = versions.filter((v) => v.current && !v.candidate);
  const isCandidate = versions.some((v) => v.candidate);
  if (currents.length > 1) return { formal: null, isCandidate, anomalous: true };
  if (currents.length === 1) {
    const v = currents[0]!;
    return {
      formal: {
        entry: metadata.entry,
        versionId: v.id,
        versionNumber: v.version,
        adoptedAt: typeof v.createdAt === 'number' ? v.createdAt : null,
        adoptionOperationId: v.adoptionOperationId ?? null,
      },
      isCandidate,
      anomalous: false,
    };
  }
  return { formal: null, isCandidate, anomalous: false };
}

function verdictsByEntry(
  entries: readonly MokinaEntryMetadata[],
): Map<string, EntryVerdict> {
  const byEntry = new Map<string, EntryVerdict>();
  for (const metadata of entries) {
    if (metadata.readState !== 'ok') continue;
    byEntry.set(metadata.entry, verdictOf(metadata));
  }
  return byEntry;
}

export function determineFormalEntries(
  entries: readonly MokinaEntryMetadata[],
): MokinaFormalEntry[] {
  const formals: MokinaFormalEntry[] = [];
  for (const verdict of verdictsByEntry(entries).values()) {
    if (verdict.formal) formals.push(verdict.formal);
  }
  return formals;
}

/** 去 explicit target 后的恢复链（§5.2）：tabs → 读取已知 → 1 正式/多选择器/零。 */
function resolveImplicitIntent(
  input: MokinaProjectEntryInput,
): MokinaEntryIntent {
  const entries = input.entries;
  const tabs = input.tabs ?? null;

  // tabs 恢复：entries 未知时 tabs 自身即可决定打开目标（打开后由
  // ProjectView/服务端对缺失文件给出原因）；entries 已知时跳过指向已删除
  // 文件的失效 tabs。
  const knownEntries =
    entries !== null && input.entriesReadState === 'ok'
      ? new Set(entries.map((e) => e.entry))
      : null;
  const tabCandidates: string[] = [];
  if (tabs && Array.isArray(tabs.tabs)) {
    for (const tab of tabs.tabs) {
      if (typeof tab !== 'string' || tab.length === 0) continue;
      if (knownEntries && !knownEntries.has(tab)) continue;
      tabCandidates.push(tab);
    }
  }
  const activeValid =
    tabs?.active != null
    && tabCandidates.includes(tabs.active);
  const restoredTab = activeValid ? tabs!.active! : tabCandidates[0];
  if (restoredTab) {
    const byEntry = entries !== null ? verdictsByEntry(entries) : null;
    const formal = byEntry?.get(restoredTab)?.formal ?? null;
    return { kind: 'open', source: 'tabs', entry: restoredTab, versionId: null, formal };
  }

  if (entries === null || input.entriesReadState === 'loading') {
    return { kind: 'unresolvable', reason: 'entries-loading' };
  }
  if (input.entriesReadState === 'failed') {
    return { kind: 'unresolvable', reason: 'entries-failed' };
  }
  if (input.entriesReadState === 'unauthorized') {
    return { kind: 'unresolvable', reason: 'entries-unauthorized' };
  }

  const formals = determineFormalEntries(entries);
  if (formals.length === 1) {
    const formal = formals[0]!;
    return { kind: 'open', source: 'single-formal', entry: formal.entry, versionId: formal.versionId, formal };
  }
  if (formals.length > 1) {
    return { kind: 'chooser', formals };
  }
  return { kind: 'workspace', legacy: input.legacyEntryHint ? { entry: input.legacyEntryHint } : null };
}

export function resolveMokinaProjectEntry(
  input: MokinaProjectEntryInput,
): MokinaEntryIntent {
  const target = input.explicitTarget;
  if (target && target.entry) {
    const entries = input.entries;
    if (entries !== null && input.entriesReadState === 'ok') {
      const hit = entries.find((e) => e.entry === target.entry);
      if (!hit || hit.readState !== 'ok') {
        return {
          kind: 'invalid-target',
          target,
          reason: 'entry-missing',
          recovery: resolveImplicitIntent(input),
        };
      }
      if (target.versionId) {
        const versions = hit.versions ?? [];
        if (!versions.some((v) => v.id === target.versionId)) {
          return {
            kind: 'invalid-target',
            target,
            reason: 'version-missing',
            recovery: resolveImplicitIntent(input),
          };
        }
      }
    }
    const byEntry = entries !== null ? verdictsByEntry(entries) : null;
    const formal = byEntry?.get(target.entry)?.formal ?? null;
    return {
      kind: 'open',
      source: 'explicit',
      entry: target.entry,
      versionId: target.versionId ?? null,
      formal,
    };
  }
  return resolveImplicitIntent(input);
}

export function summarizeMokinaProjectEntries(
  input: MokinaProjectEntryInput,
): MokinaProjectSummary {
  if (input.entries === null || input.entriesReadState === 'loading') {
    return { state: 'loading', formalCount: 0, primary: null, candidateCount: 0, legacy: null };
  }
  if (input.entriesReadState === 'failed') {
    return { state: 'failed', formalCount: 0, primary: null, candidateCount: 0, legacy: null };
  }
  if (input.entriesReadState === 'unauthorized') {
    return { state: 'unauthorized', formalCount: 0, primary: null, candidateCount: 0, legacy: null };
  }
  const entries = input.entries;
  const legacy = input.legacyEntryHint ? { entry: input.legacyEntryHint } : null;
  let candidateCount = 0;
  const formals: MokinaFormalEntry[] = [];
  for (const verdict of verdictsByEntry(entries).values()) {
    if (verdict.formal) formals.push(verdict.formal);
    if (verdict.isCandidate) candidateCount += 1;
  }
  if (formals.length === 0) {
    return { state: 'empty', formalCount: 0, primary: null, candidateCount, legacy };
  }
  const primary = formals.reduce((best, current) =>
    (current.adoptedAt ?? 0) > (best.adoptedAt ?? 0) ? current : best,
  );
  return { state: 'artifacts', formalCount: formals.length, primary, candidateCount, legacy };
}
