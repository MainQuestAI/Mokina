// @vitest-environment jsdom
//
// T14：最近项目行菜单中的"导出恢复包"入口。

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RailRecentRow } from '../../src/components/entry-nav-rail/RailRecentRow';
import type { Project } from '../../src/types';

function project(): Project {
  return {
    id: 'p1',
    name: '茶饮方案',
    createdAt: 1,
    updatedAt: 2,
  } as Project;
}

describe('RailRecentRow recovery export entry', () => {
  afterEach(cleanup);

  it('offers 导出恢复包 in the row menu and forwards the project', () => {
    const onExportRecovery = vi.fn();
    render(
      <RailRecentRow
        project={project()}
        onOpen={vi.fn()}
        onExportRecovery={onExportRecovery}
      />,
    );

    fireEvent.click(screen.getByTestId('entry-nav-recent-more'));
    const menu = screen.getByTestId('entry-nav-recent-menu');
    const item = within(menu).getByTestId('entry-nav-recent-export-recovery');
    expect(within(item).getByText('Export recovery package')).toBeTruthy();

    fireEvent.click(item);
    expect(onExportRecovery).toHaveBeenCalledTimes(1);
    expect(onExportRecovery.mock.calls[0]?.[0]).toMatchObject({ id: 'p1' });
  });

  it('keeps the item hidden when no handler is wired', () => {
    // A menu can exist for other actions while the recovery export stays absent.
    render(<RailRecentRow project={project()} onOpen={vi.fn()} onRename={vi.fn()} />);
    fireEvent.click(screen.getByTestId('entry-nav-recent-more'));
    const menu = screen.getByTestId('entry-nav-recent-menu');
    expect(within(menu).queryByTestId('entry-nav-recent-export-recovery')).toBeNull();
  });
});
