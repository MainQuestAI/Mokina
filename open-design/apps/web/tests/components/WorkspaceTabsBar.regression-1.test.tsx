// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveTabIdentityScope, UNSET_ACCOUNT_BUCKET } from '../../src/collab/tab-scope';
import { WorkspaceTabsBar } from '../../src/components/WorkspaceTabsBar';
import { setWorkspaceTabsDock } from '../../src/components/workspaceTabsDock';
import { projectsForWorkspaceChrome } from '../../src/runtime/workspace-chrome-projects';
import { navigate, type Route } from '../../src/router';
import type { Project } from '../../src/types';

vi.mock('../../src/i18n', () => ({
  useI18n: () => ({ locale: 'en', setLocale: () => undefined, t: (key: string) => key }),
  useT: () => (key: string) => key === 'common.untitled' ? 'Untitled' : key,
}));

vi.mock('../../src/router', async () => ({
  ...(await vi.importActual<typeof import('../../src/router')>('../../src/router')),
  navigate: vi.fn(),
}));

const source: Project = {
  id: 'source-project', name: 'V0.0.2 工作区验收', skillId: null, designSystemId: null,
  createdAt: 1, updatedAt: 1,
};
const continuation: Project = {
  ...source, id: 'continuation-project', name: 'plan · 接续', createdAt: 2, updatedAt: 2,
};

function routeFor(project: Project): Route {
  return { kind: 'project', projectId: project.id, conversationId: null, fileName: null };
}

function scopeFor(localEdition: boolean) {
  return deriveTabIdentityScope({
    localEdition,
    amrLoginStatus: null,
    workspaceContext: null,
    workspaceContextLoading: true,
    previousWorkspaceBucket: 'none',
    previousAccountBucket: UNSET_ACCOUNT_BUCKET,
  }).scopeKey;
}

function activeTab() {
  return screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true');
}

// Regression: ISSUE-002 — a continuation opened under the source project's title until refresh.
// Found by /qa on 2026-10-03
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-10-03.md
describe('Mokina local project navigation identity', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    setWorkspaceTabsDock(null);
  });

  it('switches to a newly created project before the initial list contains it', () => {
    const { rerender } = render(
      <WorkspaceTabsBar route={routeFor(source)} projects={[source]} identityScopeKey={scopeFor(true)} />,
    );
    expect(activeTab()?.textContent).toContain(source.name);

    rerender(
      <WorkspaceTabsBar route={routeFor(continuation)} projects={[source]} identityScopeKey={scopeFor(true)} />,
    );
    expect(activeTab()?.textContent).toContain('Untitled');
    expect(activeTab()?.textContent).not.toContain(source.name);

    rerender(
      <WorkspaceTabsBar
        route={routeFor(continuation)}
        projects={projectsForWorkspaceChrome({
          projects: [source], activeProject: continuation,
          activeProjectId: continuation.id, authoritativeProjectName: undefined,
        })}
        identityScopeKey={scopeFor(true)}
      />,
    );
    expect(activeTab()?.textContent).toContain(continuation.name);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the route-owned title when an old project-list response arrives late', async () => {
    let resolveOldList!: (projects: Project[]) => void;
    const oldList = new Promise<Project[]>((resolve) => { resolveOldList = resolve; });
    function Shell({ project }: { project: Project }) {
      const [projects, setProjects] = useState<Project[]>([source]);
      useEffect(() => { void oldList.then(setProjects); }, []);
      return <WorkspaceTabsBar
        route={routeFor(project)}
        projects={projectsForWorkspaceChrome({
          projects, activeProject: project, activeProjectId: project.id,
          authoritativeProjectName: undefined,
        })}
        identityScopeKey={scopeFor(true)}
      />;
    }
    const { rerender } = render(<Shell project={source} />);
    rerender(<Shell project={continuation} />);
    expect(activeTab()?.textContent).toContain(continuation.name);

    await act(async () => { resolveOldList([{ ...source, name: '旧请求返回的来源标题' }]); });
    expect(activeTab()?.textContent).toContain(continuation.name);
    expect(activeTab()?.textContent).not.toContain('旧请求返回的来源标题');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps upstream identity unresolved until its account status is known', () => {
    expect(scopeFor(false)).toBeNull();
  });
});
