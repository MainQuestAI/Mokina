import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  MOKINA_CONTEXT_BUDGETS,
  MOKINA_CONTEXT_ERROR_CODES,
  type MokinaContextDeliveryReceipt,
  type MokinaContextErrorCode,
  type MokinaContextSelection,
  type MokinaContextSnapshot,
  type MokinaSnapshotItem,
  type PrepareMokinaContextRequest,
} from '@open-design/contracts';

import { MOKINA_MATERIAL_PARSER_VERSION, readMokinaMaterial } from './materials.js';
import { readHtmlSections } from './sections.js';

/**
 * Immutable Mokina context snapshots (T06).
 *
 * Storage lives beside the managed project data under
 * `<PROJECTS_DIR>/<projectId>/.mokina/` — the same protected-metadata pattern
 * as `.file-versions` — and never inside a user-imported folder:
 * - `contexts/<snapshotId>.json`  frozen snapshot documents
 * - `blobs/<sha256>`              frozen asset bytes (content addressed)
 * - `deliveries/<runId>.json`     minimal run delivery receipts
 *
 * Snapshots are immutable: a different selection under an existing snapshotId
 * is a conflict, never an in-place rewrite.
 */

export const MOKINA_CONTEXT_ROOT_NAME = '.mokina';
export const MOKINA_CONTEXT_DIR_NAME = 'contexts';
export const MOKINA_BLOB_DIR_NAME = 'blobs';
export const MOKINA_DELIVERY_DIR_NAME = 'deliveries';

export function mokinaContextDir(projectsRoot: string, projectId: string): string {
  return path.join(projectsRoot, projectId, MOKINA_CONTEXT_ROOT_NAME);
}

export function mokinaContextFilePath(projectsRoot: string, projectId: string, snapshotId: string): string {
  return path.join(mokinaContextDir(projectsRoot, projectId), MOKINA_CONTEXT_DIR_NAME, `${snapshotId}.json`);
}

function mokinaBlobPath(projectsRoot: string, projectId: string, blobId: string): string {
  return path.join(mokinaContextDir(projectsRoot, projectId), MOKINA_BLOB_DIR_NAME, blobId);
}

function mokinaDeliveryPath(projectsRoot: string, projectId: string, runId: string): string {
  return path.join(mokinaContextDir(projectsRoot, projectId), MOKINA_DELIVERY_DIR_NAME, `${runId}.json`);
}

/** Canonical JSON per spec §6.3: recursive key sort, array order kept, no whitespace. */
export function canonicalJson(value: unknown): string {
  const normalize = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(normalize);
    if (node != null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) out[key] = normalize(record[key]);
      return out;
    }
    return node;
  };
  return JSON.stringify(normalize(value));
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function computeSelectionFingerprint(
  selections: readonly MokinaContextSelection[],
  excluded: readonly unknown[],
): string {
  return sha256Hex(canonicalJson({ selections, excluded }));
}

export function computeSnapshotFingerprint(snapshot: Omit<MokinaContextSnapshot, 'fingerprint'>): string {
  return sha256Hex(canonicalJson(snapshot));
}

export function utf16CodeUnits(text: string): number {
  return text.length;
}

const SNAPSHOT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const ASSET_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

export type MokinaContextStoreSource = {
  /** Read the bytes of a project file (optionally a specific frozen version). */
  readProjectFile: (
    fileName: string,
    versionId?: string,
  ) => Promise<{ bytes: Buffer } | { error: 'missing' | 'unavailable' }>;
};

export type PrepareSnapshotInput = {
  projectsRoot: string;
  projectId: string;
  request: PrepareMokinaContextRequest;
  /** Required as soon as a selection references a project file. */
  source?: MokinaContextStoreSource;
  parserVersion?: string;
  now?: Date;
};

export type PrepareSnapshotResult =
  | { ok: true; snapshot: MokinaContextSnapshot; reused: boolean }
  | { ok: false; status: number; code: MokinaContextErrorCode; message: string };

export type ReadSnapshotResult =
  | { ok: true; snapshot: MokinaContextSnapshot }
  | { ok: false; status: number; code: MokinaContextErrorCode; message: string };

function errorResult(status: number, code: MokinaContextErrorCode, message: string) {
  return { ok: false as const, status, code, message };
}

function isValidSnapshotId(value: unknown): value is string {
  return typeof value === 'string' && SNAPSHOT_ID_PATTERN.test(value);
}

async function writeJsonAtomic(target: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, target);
}

async function readSnapshotFile(target: string): Promise<MokinaContextSnapshot | null> {
  try {
    const parsed = JSON.parse(await readFile(target, 'utf8')) as unknown;
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const snapshot = parsed as MokinaContextSnapshot;
    if (snapshot.schemaVersion !== 1 || typeof snapshot.snapshotId !== 'string') return null;
    if (typeof snapshot.fingerprint !== 'string' || !Array.isArray(snapshot.items)) return null;
    return snapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null;
  }
}

/** Distinguishes "absent" from "unreadable" for GET semantics. */
async function snapshotFileState(target: string): Promise<'missing' | 'unreadable' | 'ok' | 'found-unreadable'> {
  try {
    const parsed = JSON.parse(await readFile(target, 'utf8')) as unknown;
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return 'found-unreadable';
    const snapshot = parsed as MokinaContextSnapshot;
    if (snapshot.schemaVersion !== 1 || typeof snapshot.snapshotId !== 'string') return 'found-unreadable';
    if (typeof snapshot.fingerprint !== 'string' || !Array.isArray(snapshot.items)) return 'found-unreadable';
    return 'ok';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    return 'found-unreadable';
  }
}

type FrozenItemResult =
  | { ok: true; item: MokinaSnapshotItem }
  | { ok: false; code: MokinaContextErrorCode; message: string };

async function freezeItem(
  selection: MokinaContextSelection,
  input: PrepareSnapshotInput,
): Promise<FrozenItemResult> {
  if (selection.mode === 'note') {
    const text = selection.text ?? '';
    if (text.trim().length === 0) {
      return { ok: false, code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED, message: '补充说明为空。' };
    }
    return {
      ok: true,
      item: {
        kind: 'user-note',
        itemId: selection.itemId,
        displayName: '用户补充说明',
        sourceRef: { kind: 'user-note' },
        sourceDigest: sha256Hex(Buffer.from(text, 'utf8')),
        limitations: ['用户陈述，不是外部已验证事实。'],
        locators: [],
        text,
        textDigest: sha256Hex(Buffer.from(text, 'utf8')),
      },
    };
  }

  if (selection.sourceRef.kind !== 'project-file') {
    return {
      ok: false,
      code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED,
      message: '本版快照只支持项目文件与用户补充说明；设计系统品牌来源尚未接入。',
    };
  }
  const { fileName, versionId, versionState } = selection.sourceRef;
  if (input.source == null) {
    return {
      ok: false,
      code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED,
      message: '缺少项目文件读取器，无法冻结该选择。',
    };
  }
  const read = await input.source.readProjectFile(fileName, versionId);
  if ('error' in read) {
    return {
      ok: false,
      code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED,
      message: read.error === 'missing' ? `文件不存在：${fileName}` : `文件暂不可读：${fileName}`,
    };
  }
  const sourceDigest = sha256Hex(read.bytes);
  if (sourceDigest !== selection.expectedSourceDigest) {
    return {
      ok: false,
      code: MOKINA_CONTEXT_ERROR_CODES.SOURCE_CHANGED,
      message: `资料在预览后已变化，请重新读取后再使用：${fileName}`,
    };
  }

  if (selection.mode === 'asset') {
    const mimeType = ASSET_MIME_TYPES[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
    const blobId = sourceDigest;
    const blobTarget = mokinaBlobPath(input.projectsRoot, input.projectId, blobId);
    try {
      await stat(blobTarget);
    } catch {
      await mkdir(path.dirname(blobTarget), { recursive: true });
      const temporary = `${blobTarget}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(temporary, read.bytes, { mode: 0o600 });
      await rename(temporary, blobTarget);
    }
    return {
      ok: true,
      item: {
        kind: 'asset',
        itemId: selection.itemId,
        displayName: fileName,
        sourceRef: {
          kind: 'project-file',
          projectId: input.projectId,
          fileName,
          ...(versionId ? { versionId } : {}),
          ...(versionState ? { versionState } : {}),
        },
        sourceDigest,
        limitations: ['保存图片不等于已完成视觉理解；实际提供方式见运行回执。'],
        blobId,
        mimeType,
        byteLength: read.bytes.length,
        role: selection.role ?? 'supporting',
        usageNote: selection.usageNote ?? '',
      },
    };
  }

  if (selection.mode === 'sections') {
    const content = read.bytes.toString('utf8');
    let sections;
    try {
      sections = readHtmlSections(content);
    } catch (error) {
      return {
        ok: false,
        code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED,
        message: `无法读取 HTML 章节：${error instanceof Error ? error.message : String(error)}`,
      };
    }
    const selected = selection.sectionIds
      .map((id) => sections.find((section) => section.id === id))
      .filter((section): section is NonNullable<typeof section> => section != null);
    if (selected.length === 0) {
      return {
        ok: false,
        code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED,
        message: `所选章节不存在：${fileName}`,
      };
    }
    if (versionId == null) {
      return {
        ok: false,
        code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED,
        message: '章节来源未指定 versionId，不能作为冻结身份。',
      };
    }
    const excerpt = selected.map((section) => section.html).join('\n');
    const locators = selected.map((section) => `${fileName}#${section.id}`);
    return {
      ok: true,
      item: {
        kind: 'artifact-section',
        itemId: selection.itemId,
        displayName: `${fileName} · ${selection.sectionIds.join(', ')}`,
        sourceRef: {
          kind: 'project-file',
          projectId: input.projectId,
          fileName,
          versionId,
          ...(versionState ? { versionState } : {}),
        },
        sourceDigest,
        limitations: ['冻结为发送时选定版本的章节正文。'],
        locators,
        text: excerpt,
        textDigest: sha256Hex(Buffer.from(excerpt, 'utf8')),
      },
    };
  }

  // material-excerpt / brand-rule groups
  const material = await readMokinaMaterial(fileName, read.bytes);
  if (material.status === 'unreadable') {
    return {
      ok: false,
      code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED,
      message: `无法读取资料内容，不能作为依据：${fileName}（${material.limitations.join('；')}）`,
    };
  }
  const groupIds = new Set(selection.groupIds ?? []);
  const matched = material.sections.filter((section) => {
    const groupId = section.groupId ?? '';
    if (groupIds.has(groupId)) return true;
    for (const wanted of groupIds) {
      if (groupId.startsWith(`${wanted}:part:`)) return true;
    }
    return false;
  });
  if (matched.length === 0) {
    return {
      ok: false,
      code: MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED,
      message: `所选内容为空或已不存在：${fileName}`,
    };
  }
  const excerpt = matched.map((section) => section.text).join('\n\n');
  const limitations = [...material.limitations];
  for (const limitation of material.groupLimitations ?? []) {
    if (limitations.length >= 8) break;
    limitations.push(`${limitation.location}：${limitation.message}`);
  }
  return {
    ok: true,
    item: {
      kind: selection.textKind === 'brand-rule' ? 'brand-rule' : 'material-excerpt',
      itemId: selection.itemId,
      displayName: `${fileName} · ${matched.length} 个片段`,
      sourceRef: {
        kind: 'project-file',
        projectId: input.projectId,
        fileName,
        ...(versionId ? { versionId } : {}),
        ...(versionState ? { versionState } : {}),
      },
      sourceDigest,
      limitations,
      locators: matched.map((section) => `${fileName} · ${section.location}`),
      text: excerpt,
      textDigest: sha256Hex(Buffer.from(excerpt, 'utf8')),
    },
  };
}

/**
 * Freeze a selection into an immutable snapshot. Server re-reads every source
 * and never trusts client-supplied "verified" text; idempotent for the same
 * snapshotId + selection fingerprint.
 */
export async function prepareMokinaContextSnapshot(input: PrepareSnapshotInput): Promise<PrepareSnapshotResult> {
  const { request, projectsRoot, projectId } = input;
  if (!isValidSnapshotId(request.snapshotId)) {
    return errorResult(400, MOKINA_CONTEXT_ERROR_CODES.SNAPSHOT_CONFLICT, 'snapshotId 不合法。');
  }
  if (!Array.isArray(request.selections) || request.selections.length === 0) {
    return errorResult(400, MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED, '没有可冻结的选择项。');
  }
  if (request.selections.length > MOKINA_CONTEXT_BUDGETS.maxItems) {
    return errorResult(413, MOKINA_CONTEXT_ERROR_CODES.CONTEXT_LIMIT, `最多 ${MOKINA_CONTEXT_BUDGETS.maxItems} 个选择项。`);
  }
  const selectionFingerprint = computeSelectionFingerprint(request.selections, request.excluded ?? []);
  const target = mokinaContextFilePath(projectsRoot, projectId, request.snapshotId);
  const existingState = await snapshotFileState(target);
  if (existingState === 'found-unreadable') {
    return errorResult(409, MOKINA_CONTEXT_ERROR_CODES.SNAPSHOT_UNAVAILABLE, '已存在的快照记录损坏，不能覆盖。');
  }
  if (existingState === 'ok') {
    const existing = await readSnapshotFile(target);
    if (existing && existing.selectionFingerprint === selectionFingerprint) {
      return { ok: true, snapshot: existing, reused: true };
    }
    return errorResult(409, MOKINA_CONTEXT_ERROR_CODES.SNAPSHOT_CONFLICT, '该 snapshotId 已有不同选择，请使用新的 snapshotId。');
  }

  const items: MokinaSnapshotItem[] = [];
  const seenItemIds = new Set<string>();
  let excerptUnits = 0;
  let assetBytes = 0;
  for (const selection of request.selections) {
    if (typeof selection?.itemId !== 'string' || selection.itemId.length === 0 || seenItemIds.has(selection.itemId)) {
      return errorResult(400, MOKINA_CONTEXT_ERROR_CODES.CONTEXT_NOT_SUPPORTED, 'itemId 缺失或重复。');
    }
    seenItemIds.add(selection.itemId);
    const frozen = await freezeItem(selection, input);
    if (!frozen.ok) {
      return errorResult(409, frozen.code, frozen.message);
    }
    if (frozen.item.kind === 'asset') {
      assetBytes += frozen.item.byteLength;
      if (assetBytes > MOKINA_CONTEXT_BUDGETS.maxAssetBytes) {
        return errorResult(413, MOKINA_CONTEXT_ERROR_CODES.CONTEXT_LIMIT, '冻结素材总量超过 30MiB 上限，请减少选择。');
      }
    } else {
      excerptUnits += utf16CodeUnits(frozen.item.text);
      if (excerptUnits > MOKINA_CONTEXT_BUDGETS.maxExcerptCodeUnits) {
        return errorResult(413, MOKINA_CONTEXT_ERROR_CODES.CONTEXT_LIMIT, '摘录文本超过 24,000 字符上限，请缩小选择。');
      }
    }
    items.push(frozen.item);
  }

  const withoutFingerprint: Omit<MokinaContextSnapshot, 'fingerprint'> = {
    schemaVersion: 1,
    snapshotId: request.snapshotId,
    projectId,
    createdAt: (input.now ?? new Date()).toISOString(),
    parserVersion: input.parserVersion ?? MOKINA_MATERIAL_PARSER_VERSION,
    selectionFingerprint,
    items,
    excluded: request.excluded ?? [],
  };
  const snapshot: MokinaContextSnapshot = {
    ...withoutFingerprint,
    fingerprint: computeSnapshotFingerprint(withoutFingerprint),
  };
  await writeJsonAtomic(target, snapshot);
  return { ok: true, snapshot, reused: false };
}

export async function readMokinaContextSnapshot(
  projectsRoot: string,
  projectId: string,
  snapshotId: string,
): Promise<ReadSnapshotResult> {
  if (!isValidSnapshotId(snapshotId)) {
    return errorResult(404, MOKINA_CONTEXT_ERROR_CODES.SNAPSHOT_UNAVAILABLE, '快照不存在。');
  }
  const target = mokinaContextFilePath(projectsRoot, projectId, snapshotId);
  const state = await snapshotFileState(target);
  if (state === 'missing') {
    return errorResult(404, MOKINA_CONTEXT_ERROR_CODES.SNAPSHOT_UNAVAILABLE, '快照不存在。');
  }
  if (state === 'found-unreadable') {
    return errorResult(409, MOKINA_CONTEXT_ERROR_CODES.SNAPSHOT_UNAVAILABLE, '快照记录损坏，不能从当前资料重建。');
  }
  const snapshot = await readSnapshotFile(target);
  if (!snapshot || snapshot.projectId !== projectId) {
    return errorResult(409, MOKINA_CONTEXT_ERROR_CODES.SNAPSHOT_UNAVAILABLE, '快照记录损坏或归属不符。');
  }
  const { fingerprint, ...rest } = snapshot;
  if (computeSnapshotFingerprint(rest) !== fingerprint) {
    return errorResult(409, MOKINA_CONTEXT_ERROR_CODES.SNAPSHOT_UNAVAILABLE, '快照内容校验失败，不能作为依据。');
  }
  return { ok: true, snapshot };
}

/** Compose the delimited material block a run receives for a snapshot. */
export function buildMokinaContextPromptBlock(snapshot: MokinaContextSnapshot): string {
  const lines: string[] = [
    '<mokina-context>',
    `快照 ${snapshot.snapshotId}（frozen ${snapshot.createdAt}）`,
  ];
  for (const item of snapshot.items) {
    if (item.kind === 'asset') {
      lines.push(`- 素材「${item.displayName}」(${item.mimeType}, ${item.byteLength} bytes, role=${item.role})：${item.usageNote || '用户选定素材'}`);
      continue;
    }
    lines.push(`- 资料「${item.displayName}」来源定位：${item.locators.join('；') || '用户补充'}`);
    lines.push(item.text);
    if (item.limitations.length > 0) lines.push(`（限制：${item.limitations.join('；')}）`);
  }
  lines.push('</mokina-context>');
  return lines.join('\n');
}

export function buildDeliveryReceipt(
  snapshot: MokinaContextSnapshot,
  runId: string,
  status: MokinaContextDeliveryReceipt['status'],
  submittedAt?: string,
): MokinaContextDeliveryReceipt {
  return {
    runId,
    snapshotId: snapshot.snapshotId,
    fingerprint: snapshot.fingerprint,
    includedItemIds: snapshot.items.map((item) => item.itemId),
    itemDelivery: snapshot.items.map((item) => ({
      itemId: item.itemId,
      mode: item.kind === 'asset' ? ('staged-file' as const) : ('inline-text' as const),
    })),
    status,
    ...(submittedAt ? { submittedAt } : {}),
  };
}

export async function writeMokinaDeliveryReceipt(
  projectsRoot: string,
  projectId: string,
  receipt: MokinaContextDeliveryReceipt,
): Promise<void> {
  const target = mokinaDeliveryPath(projectsRoot, projectId, receipt.runId);
  await writeJsonAtomic(target, receipt);
  await pruneDeliveries(projectsRoot, projectId).catch(() => undefined);
}

async function pruneDeliveries(projectsRoot: string, projectId: string): Promise<void> {
  const dir = path.join(mokinaContextDir(projectsRoot, projectId), MOKINA_DELIVERY_DIR_NAME);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  const files = names.filter((name) => name.endsWith('.json'));
  if (files.length <= MOKINA_CONTEXT_BUDGETS.maxDeliveryRunsPerProject) return;
  const stats = await Promise.all(files.map(async (name) => {
    try {
      return { name, mtimeMs: (await stat(path.join(dir, name))).mtimeMs };
    } catch {
      return { name, mtimeMs: 0 };
    }
  }));
  stats.sort((a, b) => a.mtimeMs - b.mtimeMs);
  const excess = stats.slice(0, files.length - MOKINA_CONTEXT_BUDGETS.maxDeliveryRunsPerProject);
  await Promise.all(excess.map((entry) => rm(path.join(dir, entry.name), { force: true })));
}

export async function readMokinaDeliveryReceipt(
  projectsRoot: string,
  projectId: string,
  runId: string,
): Promise<MokinaContextDeliveryReceipt | null> {
  try {
    const parsed = JSON.parse(await readFile(mokinaDeliveryPath(projectsRoot, projectId, runId), 'utf8')) as unknown;
    if (parsed == null || typeof parsed !== 'object') return null;
    const receipt = parsed as MokinaContextDeliveryReceipt;
    return typeof receipt.runId === 'string' && typeof receipt.snapshotId === 'string' ? receipt : null;
  } catch {
    return null;
  }
}

export async function markMokinaDeliverySubmitted(
  projectsRoot: string,
  projectId: string,
  runId: string,
): Promise<void> {
  const receipt = await readMokinaDeliveryReceipt(projectsRoot, projectId, runId);
  if (receipt == null || receipt.status === 'submitted') return;
  await writeMokinaDeliveryReceipt(projectsRoot, projectId, {
    ...receipt,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
  });
}
