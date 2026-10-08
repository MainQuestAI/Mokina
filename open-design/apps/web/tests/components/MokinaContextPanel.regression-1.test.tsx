// @vitest-environment jsdom
// Regression: P1/T07 — interleaved DOCX paragraphs must not share a selection.
// Found by /qa on 2026-10-07.
// Report: output/repair-closeout-4517bd67-2026-10-07/review.md

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectMaterialExtraction } from '@open-design/contracts';

const { readMaterial } = vi.hoisted(() => ({ readMaterial: vi.fn() }));
vi.mock('../../src/providers/registry', async () => ({
  ...await vi.importActual<typeof import('../../src/providers/registry')>('../../src/providers/registry'),
  fetchProjectMaterial: readMaterial,
}));
vi.mock('../../src/collab/collab-context', () => ({ useProjectCollabContext: () => ({ workspaceContext: null }) }));

import { MokinaContextPanel } from '../../src/components/mokina/MokinaContextPanel';
import { groupMokinaMaterialSections, buildMokinaMaterialSnapshot } from '../../src/runtime/mokina/material-selection';
import type { ProjectFile } from '../../src/types';

const extraction: ProjectMaterialExtraction = {
  name: 'sample.docx', contentDigest: 'a'.repeat(64), parserVersion: 'mokina-material/2',
  status: 'read', limitations: [], sections: [
    { fragmentId: 'fragment:1', location: '正文段落 1', text: '前段唯一内容', groupId: 'heading:0:paragraphs:0', groupLabel: '正文' },
    { fragmentId: 'fragment:2', location: '表 1 / 行 1 / 列 1', text: '未选表格内容', groupId: 'table:1:rows:0', groupLabel: '表格' },
    { fragmentId: 'fragment:3', location: '正文段落 2', text: '后段唯一内容', groupId: 'heading:0:paragraphs:0', groupLabel: '正文' },
  ],
};

beforeEach(() => {
  localStorage.clear(); readMaterial.mockReset(); readMaterial.mockResolvedValue(structuredClone(extraction));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('DOCX precise selection across tables', () => {
  it.each([
    { name: 'front', selected: [0], expected: ['fragment:1'] },
    { name: 'back', selected: [1], expected: ['fragment:3'] },
    { name: 'both', selected: [0, 1], expected: ['fragment:1', 'fragment:3'] },
  ])('freezes only the $name paragraph selection from the actual panel', async ({ selected, expected }) => {
    let request: { selections: Array<{ mode: string; fragmentIds: string[] }> } | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method !== 'POST') return new Response(JSON.stringify([]));
      request = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ snapshot: { items: [{ kind: 'material-excerpt', displayName: 'sample.docx' }] } }), { status: 201 });
    }));
    const file = { name: 'sample.docx', path: 'sample.docx', type: 'file', size: 2048, kind: 'document', mtime: 1 } as ProjectFile;
    render(<MokinaContextPanel projectId="docx-selection" files={[file]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /^sample\.docx/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview readable range' }));
    const front = await screen.findByRole('checkbox', { name: /sample\.docx.*正文段落 1/ });
    const back = screen.getByRole('checkbox', { name: /sample\.docx.*正文段落 2/ });
    const boxes = [front, back];
    for (const index of selected) fireEvent.click(boxes[index]!);
    fireEvent.click(screen.getByRole('button', { name: /Freeze as task snapshot/ }));
    await waitFor(() => expect(request).toBeDefined());
    expect(request!.selections).toEqual([expect.objectContaining({ mode: 'fragments', fragmentIds: expected })]);
    expect(screen.getByRole('checkbox', { name: /未选表格内容/ })).not.toBeChecked();
  });

  it('keeps repeated titles, multiple tables and long split groups independently selectable after reread', () => {
    const material: ProjectMaterialExtraction = { ...extraction, sections: [
      ...extraction.sections,
      { fragmentId: 'fragment:4', location: '表 2', text: '第二表格', groupId: 'table:2', groupLabel: '表格' },
      { fragmentId: 'fragment:5', location: '正文段落 3', text: '甲'.repeat(5000), groupId: 'heading:0:paragraphs:0', groupLabel: '正文' },
      { fragmentId: 'fragment:6', location: '正文段落 4', text: '乙'.repeat(5000), groupId: 'heading:0:paragraphs:0', groupLabel: '正文' },
    ] };
    const groups = groupMokinaMaterialSections([material]);
    expect(new Set(groups.map(group => group.key)).size).toBe(groups.length);
    expect(groupMokinaMaterialSections([structuredClone(material)]).map(group => group.key)).toEqual(groups.map(group => group.key));
    const last = groups.at(-1)!;
    expect(last.sections.map(section => section.fragmentId)).toEqual(['fragment:6']);
    const text = buildMokinaMaterialSnapshot([material], groups, [last.key]);
    expect(text).toContain('乙'.repeat(5000));
    expect(text).not.toContain('甲'); expect(text).not.toContain('前段唯一内容'); expect(text).not.toContain('第二表格');
    // Old display keys are ambiguous. Do not silently recognize/re-expand them.
    const legacyKey = `${material.name}:${material.contentDigest}:heading:0:paragraphs:0:0`;
    expect(groups.some(group => group.key === legacyKey)).toBe(false);
  });

  it('requires fresh confirmation after rereading rather than retaining an old selection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]))));
    render(<MokinaContextPanel projectId="docx-reread" files={[{ name: 'sample.docx', path: 'sample.docx', type: 'file', size: 2048, kind: 'document' } as ProjectFile]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /^sample\.docx/ }));
    const preview = screen.getByRole('button', { name: 'Preview readable range' });
    fireEvent.click(preview);
    fireEvent.click(await screen.findByRole('checkbox', { name: /sample\.docx.*正文段落 1/ }));
    fireEvent.click(preview);
    await waitFor(() => expect(readMaterial).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /sample\.docx.*正文段落 1/ })).not.toBeChecked());
    expect(screen.getByRole('button', { name: /Freeze as task snapshot/ })).toBeDisabled();
  });
});
