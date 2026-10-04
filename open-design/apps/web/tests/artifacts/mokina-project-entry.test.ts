import { describe, expect, it } from 'vitest';
import type { ProjectFileVersion } from '@open-design/contracts';

import {
  determineFormalEntries,
  resolveMokinaProjectEntry,
  summarizeMokinaProjectEntries,
  type MokinaEntryMetadata,
  type MokinaProjectEntryInput,
} from '../../src/artifacts/mokina-project-entry';

let seq = 0;
function version(overrides: Partial<ProjectFileVersion> = {}): ProjectFileVersion {
  seq += 1;
  return {
    id: `v-${seq}`,
    fileName: 'report.html',
    version: 1,
    label: `Version ${seq}`,
    createdAt: seq,
    source: 'ai',
    prompt: null,
    size: 1,
    mime: 'text/html; charset=utf-8',
    kind: 'html',
    current: false,
    ...overrides,
  };
}

function entry(
  entryName: string,
  versions: ProjectFileVersion[],
  readState: MokinaEntryMetadata['readState'] = 'ok',
): MokinaEntryMetadata {
  return { entry: entryName, readState, ...(readState === 'ok' ? { versions } : {}) };
}

function input(overrides: Partial<MokinaProjectEntryInput> = {}): MokinaProjectEntryInput {
  return {
    projectId: 'p1',
    entries: [],
    entriesReadState: 'ok',
    ...overrides,
  };
}

const formalA = entry('a.html', [version({ current: true, version: 2, createdAt: 5 })]);
const formalB = entry('b.html', [version({ current: true, createdAt: 9 })]);

describe('mokina-project-entry 正式成果判定', () => {
  it('current 且非 candidate 计为正式；candidate 与历史都不计', () => {
    const entries = [
      entry('a.html', [version({ current: true, version: 3 })]),
      entry('b.html', [version({ candidate: true }), version({ current: false, version: 1 })]),
    ];
    const formals = determineFormalEntries(entries);
    expect(formals).toHaveLength(1);
    expect(formals[0]).toMatchObject({ entry: 'a.html', versionNumber: 3 });
  });

  it('candidate:true 同时 current:true 不算正式（候选未采用）', () => {
    const formals = determineFormalEntries([
      entry('a.html', [version({ current: true, candidate: true })]),
    ]);
    expect(formals).toHaveLength(0);
  });

  it('按 entry 去重：同 entry 多个 current 保守排除，不虚判正式', () => {
    const formals = determineFormalEntries([
      entry('a.html', [version({ current: true }), version({ current: true, version: 2 })]),
    ]);
    expect(formals).toHaveLength(0);
  });

  it('显式采用版本携带 adoptionOperationId，缺失时 adoptedAt/adoptionOperationId 不虚构', () => {
    const adopted = version({ current: true, adoptionOperationId: 'op-1', createdAt: 42 });
    const formals = determineFormalEntries([entry('a.html', [adopted])]);
    expect(formals[0]).toMatchObject({ adoptionOperationId: 'op-1', adoptedAt: null, createdAt: 42 });
    const noTime = version({ current: true, createdAt: undefined as unknown as number });
    expect(determineFormalEntries([entry('b.html', [noTime])])[0]?.adoptedAt).toBeNull();
  });
});

describe('mokina-project-entry 打开优先级', () => {
  it('显式目标有效 → 直接打开（含指定版本）', () => {
    const intent = resolveMokinaProjectEntry(input({
      entries: [formalA],
      explicitTarget: { entry: 'a.html', versionId: 'v-1' },
    }));
    expect(intent).toEqual({
      kind: 'open',
      source: 'explicit',
      entry: 'a.html',
      versionId: 'v-1',
      formal: { entry: 'a.html', versionId: 'v-1', versionNumber: 2, adoptedAt: null, createdAt: 5, adoptionOperationId: null },
    });
  });

  it('显式目标 entry 缺失 → invalid-target + 恢复链落到正式成果', () => {
    const intent = resolveMokinaProjectEntry(input({
      entries: [formalA],
      explicitTarget: { entry: 'gone.html' },
    }));
    expect(intent).toMatchObject({ kind: 'invalid-target', reason: 'entry-missing' });
    if (intent.kind === 'invalid-target') {
      expect(intent.recovery).toMatchObject({ kind: 'open', source: 'single-formal', entry: 'a.html' });
    }
  });

  it('显式目标版本缺失 → invalid-target + 恢复链', () => {
    const intent = resolveMokinaProjectEntry(input({
      entries: [formalA],
      explicitTarget: { entry: 'a.html', versionId: 'nope' },
    }));
    expect(intent).toMatchObject({ kind: 'invalid-target', reason: 'version-missing' });
  });

  it('有效 tabs → 恢复 tabs 打开；候选 tab 不改正式身份', () => {
    const entries = [
      formalA,
      entry('draft.html', [version({ candidate: true })]),
    ];
    const intent = resolveMokinaProjectEntry(input({
      entries,
      tabs: { tabs: ['draft.html', 'a.html'], active: 'draft.html', hasSavedState: true },
    }));
    expect(intent).toMatchObject({ kind: 'open', source: 'tabs', entry: 'draft.html', formal: null });
  });

  it('tabs 指向已删除文件且 entries 已知 → 跳过失效 tab 落到正式成果', () => {
    const intent = resolveMokinaProjectEntry(input({
      entries: [formalA],
      tabs: { tabs: ['gone.html'], active: 'gone.html', hasSavedState: true },
    }));
    expect(intent).toMatchObject({ kind: 'open', source: 'single-formal', entry: 'a.html' });
  });

  it('entries 读取未知/失败/无权限 → unresolvable，不当零', () => {
    expect(resolveMokinaProjectEntry(input({ entries: null, entriesReadState: 'loading' })))
      .toEqual({ kind: 'unresolvable', reason: 'entries-loading' });
    expect(resolveMokinaProjectEntry(input({ entries: [], entriesReadState: 'failed' })))
      .toEqual({ kind: 'unresolvable', reason: 'entries-failed' });
    expect(resolveMokinaProjectEntry(input({ entries: [], entriesReadState: 'unauthorized' })))
      .toEqual({ kind: 'unresolvable', reason: 'entries-unauthorized' });
  });

  it('唯一正式 → 按准确 entry/version 打开', () => {
    const intent = resolveMokinaProjectEntry(input({ entries: [formalA] }));
    expect(intent).toMatchObject({ kind: 'open', source: 'single-formal', entry: 'a.html', versionId: 'v-1' });
  });

  it('多个正式（跨 entry）→ 项目内紧凑选择器', () => {
    const intent = resolveMokinaProjectEntry(input({ entries: [formalA, formalB] }));
    expect(intent).toMatchObject({ kind: 'chooser' });
    if (intent.kind === 'chooser') expect(intent.formals).toHaveLength(2);
  });

  it('零正式 + legacy 提示 → workspace 且 legacy 不计正式', () => {
    const intent = resolveMokinaProjectEntry(input({
      entries: [entry('data.csv', [])],
      legacyEntryHint: 'old-entry.html',
    }));
    expect(intent).toEqual({ kind: 'workspace', legacy: { entry: 'old-entry.html' } });
  });

  it('零正式无 legacy → workspace（真实状态/文件入口）', () => {
    const intent = resolveMokinaProjectEntry(input({ entries: [entry('notes.md', [])] }));
    expect(intent).toEqual({ kind: 'workspace', legacy: null });
  });

  it('entries 未知时显式目标仍交给打开路径（由服务端校验并给原因）', () => {
    const intent = resolveMokinaProjectEntry(input({
      entries: null,
      entriesReadState: 'loading',
      explicitTarget: { entry: 'a.html' },
    }));
    expect(intent).toMatchObject({ kind: 'open', source: 'explicit', entry: 'a.html' });
  });
});

describe('mokina-project-entry 行摘要', () => {
  it('五态：loading/failed/unauthorized/empty/artifacts', () => {
    expect(summarizeMokinaProjectEntries(input({ entries: null, entriesReadState: 'loading' })).state).toBe('loading');
    expect(summarizeMokinaProjectEntries(input({ entries: [], entriesReadState: 'failed' })).state).toBe('failed');
    expect(summarizeMokinaProjectEntries(input({ entries: [], entriesReadState: 'unauthorized' })).state).toBe('unauthorized');
    const empty = summarizeMokinaProjectEntries(input({ entries: [entry('notes.md', [])] }));
    expect(empty).toMatchObject({ state: 'empty', formalCount: 0 });
    const artifacts = summarizeMokinaProjectEntries(input({ entries: [formalA, formalB] }));
    expect(artifacts).toMatchObject({ state: 'artifacts', formalCount: 2 });
  });

  it('主成果取 current 版本时间最新者；候选数按 entry 计', () => {
    const summary = summarizeMokinaProjectEntries(input({
      entries: [formalA, formalB, entry('draft.html', [version({ candidate: true })])],
    }));
    expect(summary.primary?.entry).toBe('b.html');
    expect(summary.candidateCount).toBe(1);
  });

  it('empty 且有 legacy 提示时保留 legacy（未确认采用）', () => {
    const summary = summarizeMokinaProjectEntries(input({
      entries: [entry('data.csv', [])],
      legacyEntryHint: 'old.html',
    }));
    expect(summary).toMatchObject({ state: 'empty', legacy: { entry: 'old.html' } });
  });
});
