// @vitest-environment jsdom
//
// T12：候选比较界面——变化章节、字节一致性、数值提示、采用/取消入口。

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProjectFileVersion } from '@open-design/contracts';

import { MokinaCandidateCompare } from '../../src/components/mokina/MokinaCandidateCompare';

function version(overrides: Partial<ProjectFileVersion>): ProjectFileVersion {
  return {
    id: 'v1',
    fileName: 'plan.html',
    version: 1,
    label: 'checkpoint',
    createdAt: 1,
    source: 'manual',
    prompt: null,
    size: 100,
    mime: 'text/html',
    kind: 'html',
    current: false,
    ...overrides,
  };
}

const baseHtml = [
  '<html><body>',
  '<section id="objectives" data-mokina-id="objectives"><p>新增 30 家门店</p></section>',
  '<section id="budget" data-mokina-id="budget"><p>预算 50 万</p></section>',
  '</body></html>',
].join('');
const candidateHtml = baseHtml.replace('<p>预算 50 万</p>', '<p>预算 30 万</p>');

describe('MokinaCandidateCompare', () => {
  afterEach(cleanup);

  it('shows the changed chapter, the byte-identical rest and numeric deltas', () => {
    render(
      <MokinaCandidateCompare
        baseVersion={version({ id: 'v1', version: 1, current: true })}
        candidateVersion={version({ id: 'v2', version: 2, candidate: true, prompt: '只改渠道章节', baseVersionId: 'v1' })}
        baseHtml={baseHtml}
        candidateHtml={candidateHtml}
        adopting={false}
        onClose={() => undefined}
        onAdopt={() => undefined}
      />,
    );
    expect(screen.getByText('budget')).toBeTruthy();
    expect(screen.getByText(/字节完全一致/)).toBeTruthy();
    expect(screen.getByText(/只改渠道章节/)).toBeTruthy();
    expect(screen.getByText(/原文出现、候选未出现：50/)).toBeTruthy();
    expect(screen.getByText(/候选出现、原文未出现：30/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '采用候选' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy();
  });

  it('disables adopt once the base is no longer the current version', () => {
    render(
      <MokinaCandidateCompare
        baseVersion={version({ id: 'v1', version: 1, current: false })}
        candidateVersion={version({ id: 'v2', version: 2, candidate: true, baseVersionId: 'v1' })}
        baseHtml={baseHtml}
        candidateHtml={candidateHtml}
        adopting={false}
        onClose={() => undefined}
        onAdopt={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: '采用候选' })).toBeDisabled();
  });

  it('toggles the narrow-screen pane selection and reports a foreign change', () => {
    const tampered = candidateHtml.replace('<p>新增 30 家门店</p>', '<p>新增 31 家门店</p>');
    render(
      <MokinaCandidateCompare
        baseVersion={version({ id: 'v1', version: 1, current: true })}
        candidateVersion={version({ id: 'v2', version: 2, candidate: true, baseVersionId: 'v1' })}
        baseHtml={baseHtml}
        candidateHtml={tampered}
        adopting={false}
        onClose={() => undefined}
        onAdopt={() => undefined}
      />,
    );
    expect(screen.getByText(/检测到所选章节之外的变化/)).toBeTruthy();
    const basePaneRadio = screen.getAllByRole('radio', { name: '原文' })[0]!;
    fireEvent.click(basePaneRadio);
    expect((basePaneRadio as HTMLInputElement).checked).toBe(true);
  });

  it('forwards adopt and close actions', () => {
    const onAdopt = vi.fn();
    const onClose = vi.fn();
    render(
      <MokinaCandidateCompare
        baseVersion={version({ id: 'v1', version: 1, current: true })}
        candidateVersion={version({ id: 'v2', version: 2, candidate: true, baseVersionId: 'v1' })}
        baseHtml={baseHtml}
        candidateHtml={candidateHtml}
        adopting={false}
        onClose={onClose}
        onAdopt={onAdopt}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '采用候选' }));
    expect(onAdopt).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalled();
  });
});
