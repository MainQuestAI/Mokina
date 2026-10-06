// @vitest-environment jsdom
//
// N02: Home-staged files marked as Mokina 资料/素材 freeze into the SAME
// context snapshot pipeline the in-project panel uses. These tests pin the
// pure selection builder: budget accounting, explicit exclusions (never
// silent truncation), and base-group-id normalization.

import { describe, expect, it } from 'vitest';

import type { ProjectMaterialExtraction } from '@open-design/contracts';

import {
  buildHomeMokinaSelections,
  type HomeMokinaFilePlan,
} from '../../src/runtime/mokina/home-material-snapshot';

const PROJECT_ID = 'project-home-1';

function extraction(name: string, sections: Array<{ text: string; groupId?: string }>): ProjectMaterialExtraction {
  return {
    name,
    contentDigest: `digest-${name}`,
    status: 'read',
    limitations: [],
    sections: sections.map((section, index) => ({
      location: `${name}#${index + 1}`,
      text: section.text,
      groupId: section.groupId,
      groupLabel: section.groupId ?? undefined,
    })),
  };
}

function materialPlan(name: string): HomeMokinaFilePlan {
  return { name, size: 1, kind: 'material' };
}

describe('buildHomeMokinaSelections', () => {
  it('freezes every stable group of a readable material as one groups selection', () => {
    const built = buildHomeMokinaSelections({
      projectId: PROJECT_ID,
      plans: [materialPlan('brief.md')],
      materials: [{ name: 'brief.md', extraction: extraction('brief.md', [
        { text: '第一段', groupId: 'intro' },
        { text: '第二段', groupId: 'intro' },
        { text: '结论', groupId: 'outro' },
      ]) }],
      assets: [],
    });
    expect(built).not.toBeNull();
    expect(built!.selections).toHaveLength(1);
    const selection = built!.selections[0]!;
    expect(selection.mode).toBe('groups');
    if (selection.mode !== 'groups') throw new Error('unreachable');
    expect(selection.textKind).toBe('material-excerpt');
    expect(selection.sourceRef).toEqual({ kind: 'project-file', projectId: PROJECT_ID, fileName: 'brief.md' });
    expect(selection.expectedSourceDigest).toBe('digest-brief.md');
    expect(selection.groupIds.sort()).toEqual(['intro', 'outro']);
    expect(built!.excluded).toEqual([]);
  });

  it('normalizes part-split groupIds to their base id', () => {
    const built = buildHomeMokinaSelections({
      projectId: PROJECT_ID,
      plans: [materialPlan('notes.md')],
      materials: [{ name: 'notes.md', extraction: extraction('notes.md', [
        { text: '片段一', groupId: 'g1:part:1' },
        { text: '片段二', groupId: 'g1:part:2' },
      ]) }],
      assets: [],
    });
    const selection = built!.selections[0]!;
    if (selection.mode !== 'groups') throw new Error('unreachable');
    expect(selection.groupIds).toEqual(['g1']);
  });

  it('keeps materials inside the shared 24,000-unit excerpt budget and excludes the overflow with reason budget', () => {
    const big = '字'.repeat(20_000);
    const big2 = '字'.repeat(10_000);
    const built = buildHomeMokinaSelections({
      projectId: PROJECT_ID,
      plans: [materialPlan('big-a.md'), materialPlan('big-b.md')],
      materials: [
        { name: 'big-a.md', extraction: extraction('big-a.md', [{ text: big, groupId: 'a' }]) },
        { name: 'big-b.md', extraction: extraction('big-b.md', [{ text: big2, groupId: 'b' }]) },
      ],
      assets: [],
    });
    expect(built!.selections).toHaveLength(1);
    const selection = built!.selections[0]!;
    if (selection.mode !== 'groups') throw new Error('unreachable');
    expect(selection.groupIds).toEqual(['a']);
    // Whole groups only (panel granularity): the 10,000-unit group no longer
    // fits the 4,000-unit remainder, so the whole file is excluded with the
    // budget reason rather than silently truncated.
    expect(built!.excluded).toHaveLength(1);
    expect(built!.excluded[0]).toMatchObject({ displayName: 'big-b.md', reason: 'budget' });
    expect(built!.excluded[0]!.explanation).toContain('预算');
  });

  it('excludes unreadable materials with reason unreadable and freezes nothing for them', () => {
    const built = buildHomeMokinaSelections({
      projectId: PROJECT_ID,
      plans: [materialPlan('broken.pdf')],
      materials: [{
        name: 'broken.pdf',
        extraction: {
          name: 'broken.pdf',
          contentDigest: '',
          status: 'unreadable',
          limitations: ['损坏文件不可读取'],
          sections: [],
        },
      }],
      assets: [],
    });
    expect(built).toBeNull();
  });

  it('freezes an in-budget asset with its role and usage note', () => {
    const built = buildHomeMokinaSelections({
      projectId: PROJECT_ID,
      plans: [{ name: 'logo.png', size: 2048, kind: 'asset', role: 'logo', usageNote: '页头标识' }],
      materials: [],
      assets: [{ name: 'logo.png', byteLength: 2048, digest: 'asset-digest' }],
    });
    expect(built!.selections).toHaveLength(1);
    const selection = built!.selections[0]!;
    expect(selection.mode).toBe('asset');
    if (selection.mode !== 'asset') throw new Error('unreachable');
    expect(selection.expectedSourceDigest).toBe('asset-digest');
    expect(selection.role).toBe('logo');
    expect(selection.usageNote).toBe('页头标识');
  });

  it('defaults an asset role to supporting and excludes over-30MiB assets with reason budget', () => {
    const built = buildHomeMokinaSelections({
      projectId: PROJECT_ID,
      plans: [
        { name: 'hero.png', size: 1024, kind: 'asset' },
        { name: 'huge.png', size: 31 * 1024 * 1024, kind: 'asset' },
      ],
      materials: [],
      assets: [
        { name: 'hero.png', byteLength: 1024, digest: 'hero-digest' },
        { name: 'huge.png', byteLength: 31 * 1024 * 1024, digest: 'huge-digest' },
      ],
    });
    expect(built!.selections).toHaveLength(1);
    const selection = built!.selections[0]!;
    if (selection.mode !== 'asset') throw new Error('unreachable');
    expect(selection.role).toBe('supporting');
    expect(built!.excluded).toHaveLength(1);
    expect(built!.excluded[0]).toMatchObject({ displayName: 'huge.png', reason: 'budget' });
  });

  it('returns null when nothing can be frozen', () => {
    const built = buildHomeMokinaSelections({
      projectId: PROJECT_ID,
      plans: [materialPlan('empty.md')],
      materials: [{ name: 'empty.md', extraction: extraction('empty.md', []) }],
      assets: [],
    });
    expect(built).toBeNull();
  });
});
