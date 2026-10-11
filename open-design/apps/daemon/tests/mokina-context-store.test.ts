import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  stageMokinaSnapshotAssets,
  buildDeliveryReceipt,
  buildMokinaContextPromptBlock,
  canonicalJson,
  computeSnapshotFingerprint,
  markMokinaDeliverySubmitted,
  prepareMokinaContextSnapshot,
  readMokinaContextSnapshot,
  readMokinaDeliveryReceipt,
  sha256Hex,
  writeMokinaDeliveryReceipt,
  type MokinaContextStoreSource,
} from '../src/mokina/context-store.js';

function makeSource(files: Record<string, Buffer>): MokinaContextStoreSource {
  return {
    readProjectFile: async (fileName) => {
      const bytes = files[fileName];
      return bytes ? { bytes } : { error: 'missing' };
    },
  };
}

describe('Mokina context store', () => {
  let projectsRoot: string;

  beforeEach(async () => {
    projectsRoot = await mkdtemp(path.join(tmpdir(), 'mokina-context-'));
  });

  afterEach(async () => {
    await rm(projectsRoot, { force: true, recursive: true });
  });

  it('provides frozen A bytes after its source is removed and never reports a missing asset as staged', async () => {
    const bytes = Buffer.from('<svg>A</svg>');
    const prepared = await prepareMokinaContextSnapshot({ projectsRoot, projectId: 'p1', source: makeSource({ 'logo.svg': bytes }),
      request: { snapshotId: 'asset-proof', excluded: [], selections: [{ itemId: 'A', mode: 'asset',
        sourceRef: { kind: 'project-file', projectId: 'p1', fileName: 'logo.svg' }, expectedSourceDigest: sha256Hex(bytes), role: 'logo', usageNote: '品牌' }] } });
    if (!prepared.ok) throw new Error(prepared.message);
    const staged = await stageMokinaSnapshotAssets(projectsRoot, 'p1', prepared.snapshot);
    expect(await readFile(staged.A!.path)).toEqual(bytes);
    expect(buildMokinaContextPromptBlock(prepared.snapshot, staged)).toContain(staged.A!.path);
    expect(buildDeliveryReceipt(prepared.snapshot, 'run', 'submitted', 'now', staged).itemDelivery).toEqual([{ itemId: 'A', mode: 'staged-file' }]);
    await rm(path.join(projectsRoot, 'p1', '.mokina', 'blobs', sha256Hex(bytes)));
    await expect(stageMokinaSnapshotAssets(projectsRoot, 'p1', prepared.snapshot)).rejects.toThrow();
    expect(buildDeliveryReceipt(prepared.snapshot, 'run', 'not-submitted').itemDelivery).toEqual([]);
    expect(() => buildMokinaContextPromptBlock(prepared.snapshot)).toThrow();
  });

  it('canonicalizes JSON with sorted keys and stable arrays', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe('{"a":[2,{"c":3,"d":4}],"b":1}');
  });

  it('freezes the same asset concurrently without colliding temporary files', async () => {
    const bytes = Buffer.from('<svg>shared logo</svg>');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
    try {
      const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) =>
        prepareMokinaContextSnapshot({ projectsRoot, projectId: 'p1', source: makeSource({ 'logo.svg': bytes }),
          request: { snapshotId: `asset-concurrent-${index}`, excluded: [], selections: [{ itemId: 'A', mode: 'asset',
            sourceRef: { kind: 'project-file', projectId: 'p1', fileName: 'logo.svg' },
            expectedSourceDigest: sha256Hex(bytes), role: 'logo', usageNote: '品牌' }] } })));
      for (const settled of results) {
        expect(settled.status).toBe('fulfilled');
        if (settled.status !== 'fulfilled') throw settled.reason;
        const result = settled.value;
        if (!result.ok) throw new Error(result.message);
        const staged = await stageMokinaSnapshotAssets(projectsRoot, 'p1', result.snapshot);
        expect(await readFile(staged.A!.path)).toEqual(bytes);
      }
    } finally { clock.mockRestore(); }
  });

  it('freezes continuation candidate provenance without re-reading a deleted source', async () => {
    const origin = { source: { projectId: 'deleted-source', fileName: 'plan.html', versionId: 'candidate-1',
      versionState: 'candidate' as const, contentDigest: sha256Hex('original source') }, sectionId: 'budget' };
    const result = await prepareMokinaContextSnapshot({ projectsRoot, projectId: 'target',
      request: { snapshotId: 'continuation-origin', excluded: [], selections: [{ itemId: 'section-1', mode: 'note',
        sourceRef: { kind: 'user-note' }, text: '【budget】\n预算 100', continuationOrigin: origin }] } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.snapshot.items[0]).toMatchObject({ text: '【budget】\n预算 100', continuationOrigin: origin,
      locators: ['plan.html · candidate · candidate-1 · budget'] });
    expect(result.snapshot.items[0]!.limitations.join('')).toContain('未重新读取或批准');
    const read = await readMokinaContextSnapshot(projectsRoot, 'target', 'continuation-origin');
    expect(read.ok && read.snapshot.fingerprint).toBe(result.snapshot.fingerprint);
    const invalid = await prepareMokinaContextSnapshot({ projectsRoot, projectId: 'target',
      request: { snapshotId: 'invalid-origin', excluded: [], selections: [{ itemId: 'section-1', mode: 'note',
        sourceRef: { kind: 'user-note' }, text: 'fixed', continuationOrigin: { ...origin, source: { ...origin.source, contentDigest: 'invalid' } } }] } });
    expect(invalid.ok).toBe(false);
  });

  it('freezes a note-only snapshot with a verifiable fingerprint', async () => {
    const result = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      request: {
        snapshotId: 'snap-1',
        selections: [{ itemId: 'S1', mode: 'note', sourceRef: { kind: 'user-note' }, text: '预算改为 30 万' }],
        excluded: [{ displayName: 'old.pdf', reason: 'user-excluded', explanation: '口径过期' }],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(false);
    const { fingerprint, ...rest } = result.snapshot;
    expect(computeSnapshotFingerprint(rest)).toBe(fingerprint);
    expect(result.snapshot.items[0]).toMatchObject({ kind: 'user-note', text: '预算改为 30 万' });

    const readBack = await readMokinaContextSnapshot(projectsRoot, 'p1', 'snap-1');
    expect(readBack.ok && readBack.snapshot.fingerprint).toBe(fingerprint);
  });

  it('reuses an identical preparation and conflicts on a different selection', async () => {
    const request = {
      snapshotId: 'snap-2',
      selections: [{ itemId: 'S1', mode: 'note' as const, sourceRef: { kind: 'user-note' as const }, text: ' A ' }],
      excluded: [],
    };
    const first = await prepareMokinaContextSnapshot({ projectsRoot, projectId: 'p1', request });
    const again = await prepareMokinaContextSnapshot({ projectsRoot, projectId: 'p1', request });
    expect(first.ok && again.ok && again.reused).toBe(true);
    if (first.ok && again.ok) expect(again.snapshot.fingerprint).toBe(first.snapshot.fingerprint);

    const conflicting = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      request: { ...request, selections: [{ ...request.selections[0]!, text: 'B' }] },
    });
    expect(conflicting.ok).toBe(false);
    if (!conflicting.ok) {
      expect(conflicting.code).toBe('MOKINA_SNAPSHOT_CONFLICT');
      expect(conflicting.status).toBe(409);
    }
  });

  it('detects a source change between preview and freeze', async () => {
    const bytes = Buffer.from('旧预算 50 万');
    const result = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: makeSource({ 'brief.md': Buffer.from('新预算 30 万') }),
      request: {
        snapshotId: 'snap-3',
        selections: [{
          itemId: 'S1',
          mode: 'groups',
          textKind: 'material-excerpt',
          sourceRef: { kind: 'project-file', projectId: 'p1', fileName: 'brief.md' },
          expectedSourceDigest: sha256Hex(bytes),
          groupIds: ['heading:1'],
        }],
        excluded: [],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('MOKINA_SOURCE_CHANGED');
  });

  it.each([false, true])('preserves the first committed snapshot when overlapping preparation differs=%s', async (differentSelection) => {
    const bytes = Buffer.from('# 品牌\n原品牌\n\n# 预算\n50 万');
    const request = {
      snapshotId: 'overlap',
      selections: [{ itemId: 'S1', mode: 'groups' as const, textKind: 'material-excerpt' as const,
        sourceRef: { kind: 'project-file' as const, projectId: 'p1', fileName: 'brief.md' },
        expectedSourceDigest: sha256Hex(bytes), groupIds: ['heading:1'] }],
      excluded: [],
    };
    let entered!: () => void;
    const reading = new Promise<void>((resolve) => { entered = resolve; });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const slower = prepareMokinaContextSnapshot({ projectsRoot, projectId: 'p1', request,
      now: new Date('2026-10-11T00:00:00Z'),
      source: { readProjectFile: async () => { entered(); await held; return { bytes }; } } });
    await reading;
    const committed = await prepareMokinaContextSnapshot({ projectsRoot, projectId: 'p1',
      request: differentSelection ? { ...request, selections: [{ ...request.selections[0]!, groupIds: ['heading:2'] }] } : request,
      now: new Date('2026-10-11T00:00:01Z'), source: makeSource({ 'brief.md': bytes }) });
    release();
    const delayed = await slower;
    expect(committed.ok).toBe(true);
    if (!committed.ok) throw new Error(committed.message);
    if (differentSelection) {
      expect(delayed).toMatchObject({ ok: false, status: 409, code: 'MOKINA_SNAPSHOT_CONFLICT' });
    } else {
      expect(delayed).toMatchObject({ ok: true, reused: true, snapshot: committed.snapshot });
    }
    expect(await readMokinaContextSnapshot(projectsRoot, 'p1', request.snapshotId))
      .toMatchObject({ ok: true, snapshot: committed.snapshot });
  });

  it('freezes selected material groups with locators and limitations', async () => {
    const text = ['# 品牌', '晨光茶饮禁止投放短视频', '', '# 预算', '总预算 50 万'].join('\n');
    const result = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: makeSource({ 'brief.md': Buffer.from(text) }),
      request: {
        snapshotId: 'snap-4',
        selections: [{
          itemId: 'S1',
          mode: 'groups',
          textKind: 'material-excerpt',
          sourceRef: { kind: 'project-file', projectId: 'p1', fileName: 'brief.md' },
          expectedSourceDigest: sha256Hex(Buffer.from(text)),
          groupIds: ['heading:1'],
        }],
        excluded: [],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const item = result.snapshot.items[0]!;
    if (item.kind === 'asset') throw new Error('unexpected asset');
    expect(item.text).toContain('禁止投放短视频');
    expect(item.text).not.toContain('总预算 50 万');
    expect(item.locators[0]).toContain('brief.md');
    expect(item.textDigest).toBe(sha256Hex(Buffer.from(item.text, 'utf8')));
    expect(item.textDigest).not.toBe(item.sourceDigest);
  });

  it('requires a versionId for artifact sections and freezes the selected html', async () => {
    const html = '<html><body><section id="strategy" data-mokina-id="strategy"><h2>策略</h2><p>聚焦门店</p></section><section id="budget" data-mokina-id="budget"><p>50 万</p></section></body></html>';
    const base = {
      itemId: 'S1',
      mode: 'sections' as const,
      sourceRef: { kind: 'project-file' as const, projectId: 'p1', fileName: 'plan.html' },
      expectedSourceDigest: sha256Hex(Buffer.from(html)),
      sectionIds: ['strategy'],
    };
    const missingVersion = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: makeSource({ 'plan.html': Buffer.from(html) }),
      request: { snapshotId: 'snap-5', selections: [base], excluded: [] },
    });
    expect(missingVersion.ok).toBe(false);
    if (!missingVersion.ok) expect(missingVersion.code).toBe('MOKINA_CONTEXT_NOT_SUPPORTED');

    const withVersion = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: makeSource({ 'plan.html': Buffer.from(html) }),
      request: {
        snapshotId: 'snap-6',
        selections: [{ ...base, sourceRef: { ...base.sourceRef, versionId: 'v3', versionState: 'historical' } }],
        excluded: [],
      },
    });
    expect(withVersion.ok).toBe(true);
    if (!withVersion.ok) return;
    const item = withVersion.snapshot.items[0]!;
    if (item.kind === 'asset') throw new Error('unexpected asset');
    expect(item.text).toContain('聚焦门店');
    expect(item.text).not.toContain('50 万');
    expect(item.sourceRef).toMatchObject({ versionId: 'v3', versionState: 'historical' });
  });

  it('freezes asset bytes into a content-addressed blob', async () => {
    const logo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const result = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: makeSource({ 'logo.svg': logo }),
      request: {
        snapshotId: 'snap-7',
        selections: [{
          itemId: 'A1',
          mode: 'asset',
          sourceRef: { kind: 'project-file', projectId: 'p1', fileName: 'logo.svg' },
          expectedSourceDigest: sha256Hex(logo),
          role: 'logo',
          usageNote: '活动页页眉',
        }],
        excluded: [],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const item = result.snapshot.items[0]!;
    if (item.kind !== 'asset') throw new Error('expected asset');
    expect(item.blobId).toBe(sha256Hex(logo));
    expect(item.mimeType).toBe('image/svg+xml');
    const onDisk = await readFile(path.join(projectsRoot, 'p1', '.mokina', 'blobs', item.blobId));
    expect(onDisk.equals(logo)).toBe(true);
  });

  it('enforces the excerpt budget instead of truncating silently', async () => {
    const big = '甲'.repeat(24_001);
    const result = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      request: {
        snapshotId: 'snap-8',
        selections: [{ itemId: 'S1', mode: 'note', sourceRef: { kind: 'user-note' }, text: big }],
        excluded: [],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('MOKINA_CONTEXT_LIMIT');
      expect(result.status).toBe(413);
    }
  });

  it('reports missing and corrupted snapshots distinctly', async () => {
    const missing = await readMokinaContextSnapshot(projectsRoot, 'p1', 'nope');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(404);

    await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      request: {
        snapshotId: 'snap-9',
        selections: [{ itemId: 'S1', mode: 'note', sourceRef: { kind: 'user-note' }, text: 'x' }],
        excluded: [],
      },
    });
    const target = path.join(projectsRoot, 'p1', '.mokina', 'contexts', 'snap-9.json');
    await writeFile(target, '{ broken json', 'utf8');
    const corrupted = await readMokinaContextSnapshot(projectsRoot, 'p1', 'snap-9');
    expect(corrupted.ok).toBe(false);
    if (!corrupted.ok) expect(corrupted.code).toBe('MOKINA_SNAPSHOT_UNAVAILABLE');
  });

  it('refuses a tampered snapshot whose fingerprint no longer matches', async () => {
    await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      request: {
        snapshotId: 'snap-10',
        selections: [{ itemId: 'S1', mode: 'note', sourceRef: { kind: 'user-note' }, text: '原始' }],
        excluded: [],
      },
    });
    const target = path.join(projectsRoot, 'p1', '.mokina', 'contexts', 'snap-10.json');
    const parsed = JSON.parse(await readFile(target, 'utf8')) as Record<string, unknown>;
    parsed.items = [{ kind: 'user-note', itemId: 'S1', text: '被篡改' }];
    await writeFile(target, JSON.stringify(parsed), 'utf8');
    const result = await readMokinaContextSnapshot(projectsRoot, 'p1', 'snap-10');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('MOKINA_SNAPSHOT_UNAVAILABLE');
  });

  it('builds a delimited prompt block and a prepared→submitted receipt', async () => {
    const prepared = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      request: {
        snapshotId: 'snap-11',
        selections: [{ itemId: 'S1', mode: 'note', sourceRef: { kind: 'user-note' }, text: '门店容量 20 家' }],
        excluded: [],
      },
    });
    if (!prepared.ok) throw new Error('prepare failed');
    const block = buildMokinaContextPromptBlock(prepared.snapshot);
    expect(block).toContain('<mokina-context>');
    expect(block).toContain('门店容量 20 家');
    expect(block).toContain('</mokina-context>');

    const receipt = buildDeliveryReceipt(prepared.snapshot, 'run-1', 'prepared');
    await writeMokinaDeliveryReceipt(projectsRoot, 'p1', receipt);
    expect((await readMokinaDeliveryReceipt(projectsRoot, 'p1', 'run-1'))?.status).toBe('prepared');
    await markMokinaDeliverySubmitted(projectsRoot, 'p1', 'run-1');
    const submitted = await readMokinaDeliveryReceipt(projectsRoot, 'p1', 'run-1');
    expect(submitted?.status).toBe('submitted');
    expect(submitted?.submittedAt).toBeTruthy();
    expect(submitted?.includedItemIds).toEqual(['S1']);
  });
});

describe('Mokina context store — design-system brand sources (N04)', () => {
  let projectsRoot: string;

  beforeEach(async () => {
    projectsRoot = await mkdtemp(path.join(tmpdir(), 'mokina-brand-'));
  });

  afterEach(async () => {
    await rm(projectsRoot, { force: true, recursive: true });
  });

  const BRAND_MD = '# 山茶品牌规范\n\n主色 #B3392E，辅色米白。';

  function brandSource(brand: Record<string, { bytes: Buffer; displayName: string }>): MokinaContextStoreSource {
    return {
      readProjectFile: async () => ({ error: 'missing' }),
      readDesignSystem: async (designSystemId) => {
        const entry = brand[designSystemId];
        return entry ? { bytes: entry.bytes, displayName: entry.displayName } : { error: 'missing' };
      },
    };
  }

  function brandSelection(designSystemId: string, digest: string) {
    return {
      itemId: 'B1',
      mode: 'groups' as const,
      textKind: 'brand-rule' as const,
      sourceRef: { kind: 'design-system' as const, designSystemId },
      expectedSourceDigest: digest,
      groupIds: [],
    };
  }

  it('freezes a brand kit as an immutable brand-rule item with content digest and locators', async () => {
    const bytes = Buffer.from(BRAND_MD, 'utf8');
    const prepared = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: brandSource({ shancha: { bytes, displayName: '山茶咖啡' } }),
      request: {
        snapshotId: 'brand-snap-1',
        selections: [brandSelection('shancha', sha256Hex(bytes))],
        excluded: [],
      },
    });
    if (!prepared.ok) throw new Error(prepared.message);
    const item = prepared.snapshot.items[0]!;
    expect(item).toMatchObject({
      kind: 'brand-rule',
      displayName: '山茶咖啡 · 品牌规则',
      sourceDigest: sha256Hex(bytes),
      sourceRef: { kind: 'design-system', designSystemId: 'shancha' },
      locators: ['design-system:shancha'],
    });
    expect(item.kind === 'brand-rule' && item.textDigest).toBe(sha256Hex(bytes));
    expect(item.limitations.join('')).toContain('冻结');
    const readBack = await readMokinaContextSnapshot(projectsRoot, 'p1', 'brand-snap-1');
    expect(readBack.ok && readBack.snapshot.items[0]!.kind).toBe('brand-rule');
  });

  it('rejects with SOURCE_CHANGED when the brand kit changed after preview', async () => {
    const previewBytes = Buffer.from(BRAND_MD, 'utf8');
    const prepared = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: brandSource({ shancha: { bytes: Buffer.from('# 已更新的规范\n主色 #000000。', 'utf8'), displayName: '山茶咖啡' } }),
      request: {
        snapshotId: 'brand-snap-2',
        selections: [brandSelection('shancha', sha256Hex(previewBytes))],
        excluded: [],
      },
    });
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.code).toBe('MOKINA_SOURCE_CHANGED');
  });

  it('rejects a missing brand kit without freezing anything', async () => {
    const bytes = Buffer.from(BRAND_MD, 'utf8');
    const prepared = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: brandSource({}),
      request: {
        snapshotId: 'brand-snap-3',
        selections: [brandSelection('ghost', sha256Hex(bytes))],
        excluded: [],
      },
    });
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.code).toBe('MOKINA_CONTEXT_NOT_SUPPORTED');
    expect(prepared.message).toContain('ghost');
  });

  it('enforces the shared excerpt budget on brand-rule text', async () => {
    const big = Buffer.from(`# 巨大规范\n\n${'规则 '.repeat(20_000)}`, 'utf8');
    const prepared = await prepareMokinaContextSnapshot({
      projectsRoot,
      projectId: 'p1',
      source: brandSource({ huge: { bytes: big, displayName: '巨型品牌' } }),
      request: {
        snapshotId: 'brand-snap-4',
        selections: [brandSelection('huge', sha256Hex(big))],
        excluded: [],
      },
    });
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.code).toBe('MOKINA_CONTEXT_LIMIT');
  });
});

describe('Mokina context store — design-system input guards (review)', () => {
  it('rejects a design-system selection in a non-brand-rule shape instead of silently freezing', async () => {
    const projectsRoot = await mkdtemp(path.join(tmpdir(), 'mokina-brand-guard-'));
    try {
      const bytes = Buffer.from('# 规范\n', 'utf8');
      const source: MokinaContextStoreSource = {
        readProjectFile: async () => ({ error: 'missing' }),
        readDesignSystem: async () => ({ bytes, displayName: '山茶' }),
      };
      const prepared = await prepareMokinaContextSnapshot({
        projectsRoot,
        projectId: 'p1',
        source,
        request: {
          snapshotId: 'brand-guard-1',
          selections: [{
            itemId: 'B1',
            mode: 'asset',
            sourceRef: { kind: 'design-system', designSystemId: 'shancha' },
            expectedSourceDigest: sha256Hex(bytes),
            role: 'logo',
            usageNote: '',
          } as never],
          excluded: [],
        },
      });
      expect(prepared.ok).toBe(false);
      if (prepared.ok) return;
      expect(prepared.code).toBe('MOKINA_CONTEXT_NOT_SUPPORTED');
    } finally {
      await rm(projectsRoot, { force: true, recursive: true });
    }
  });
});
