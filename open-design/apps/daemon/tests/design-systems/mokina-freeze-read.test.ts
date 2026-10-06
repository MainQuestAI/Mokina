// N04 review: the Mokina context-snapshot freeze must read brand sources
// through the SAME path as GET /api/design-systems/:id — storage resolution
// (incl. the team-scoped root + exactTeam) and workspace project mirror first.
// These tests pin readDesignSystemForFreeze so the two call chains can never
// drift apart again (previously the freeze side re-implemented a narrower
// fallback that missed the team-scoped root entirely).

import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { workspaceContextFromDirectoryItem } from '../../src/collab/vela-workspace-context.js';
import {
  closeDatabase,
  ensureWorkspaceResource,
  getWorkspaceResource,
  getWorkspaceResourceByResourceId,
  openDatabase,
} from '../../src/db.js';
import { workspaceTeamDesignSystemBindingResourceId } from '../../src/design-systems/workspace-team-binding.js';
import { registerDesignSystemRoutes } from '../../src/routes/design-systems.js';

let root: string | null = null;

afterEach(() => {
  closeDatabase();
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

const workspaceId = 'workspace-freeze';
const memberId = 'owner-freeze';
const designSystemId = 'user:freeze-brand';

function fakeReq(headers: Record<string, string> = {}) {
  return { get: (name: string) => headers[name.toLowerCase()] ?? headers[name] };
}

function workspaceHeaders(): Record<string, string> {
  return {
    'x-od-workspace-id': workspaceId,
    'x-od-workspace-member-id': memberId,
    'x-od-workspace-type': 'team',
    'x-od-workspace-role': 'owner',
    'x-od-workspace-member-status': 'active',
    'x-od-workspace-lifecycle-state': 'active',
  };
}

function registerServices(options: {
  mirrorBody?: string | null;
  canonicalBody?: string | null;
  withTeamBinding?: boolean;
}) {
  root = mkdtempSync(path.join(os.tmpdir(), 'od-ds-mokina-freeze-'));
  const db = openDatabase(root, { dataDir: path.join(root, 'data') });
  if (options.withTeamBinding) {
    ensureWorkspaceResource(
      db,
      'design_system',
      workspaceId,
      workspaceTeamDesignSystemBindingResourceId(workspaceId, designSystemId),
      {
        visibility: 'team',
        resourceState: 'active',
        createdByWorkspaceMemberId: memberId,
      },
    );
  }
  const summary = {
    id: designSystemId,
    title: 'Freeze Brand',
    category: 'Custom',
    summary: '',
    swatches: [],
    surface: 'web' as const,
    body: '# Canonical body',
    source: 'user' as const,
    status: 'published' as const,
    isEditable: false,
  };
  const listAllDesignSystems = vi.fn(async () => [summary]);
  const readDesignSystemWorkspaceTextFile = vi.fn(async () => options.mirrorBody ?? null);
  const readAvailableDesignSystem = vi.fn(async () => options.canonicalBody ?? null);

  const app = express();
  app.use(express.json());
  const services = registerDesignSystemRoutes(app, {
    db,
    paths: {
      CRAFT_DIR: path.join(root, 'craft'),
      USER_DESIGN_SYSTEMS_DIR: path.join(root, 'design-systems'),
    } as never,
    projectFiles: {} as never,
    projectStore: {} as never,
    verifyWorkspaceRequestAuthority: async (req: any) => ({
      ok: true as const,
      context: workspaceContextFromDirectoryItem({
        workspaceId: req.get('x-od-workspace-id'),
        workspaceName: 'Workspace Freeze',
        workspaceType: 'team',
        workspaceMemberId: req.get('x-od-workspace-member-id'),
        role: 'owner',
        memberStatus: 'active',
        lifecycleState: 'active',
      }),
    }),
    workspaceResources: { getWorkspaceResource, getWorkspaceResourceByResourceId },
    designSystems: {
      buildUserDesignSystemArchive: async () => null as never,
      canMutateUserDesignSystem: async () => true,
      createUserDesignSystem: async () => ({}) as never,
      deleteUserDesignSystem: async () => true,
      ensureUserDesignSystemWorkspaceProject: async () => ({}) as never,
      listAllDesignSystems: listAllDesignSystems as never,
      listUserDesignSystemFiles: async () => null,
      listUserDesignSystemRevisions: async () => null,
      prepareDesignTokenContractRebuild: async () => ({}) as never,
      readAvailableDesignSystem: readAvailableDesignSystem as never,
      readAvailableDesignSystemPackageInfo: async () => null,
      readAvailableDesignSystemStaticFile: async () => null as never,
      readDesignSystemWorkspaceTextFile: readDesignSystemWorkspaceTextFile as never,
      readUserDesignSystemFile: async () => null,
      renderDesignSystemPreview: () => '',
      renderDesignSystemShowcase: () => '',
      syncUserDesignSystemAssetsFromWorkspace: async () => ({ ok: true as const, synced: [] }),
      unshareTeamDesignSystemIfShared: async () => false,
      updateUserDesignSystem: async () => null,
      updateUserDesignSystemRevisionStatus: async () => null,
    },
    generationJobs: {
      get: () => null,
      rebuildTokenContract: (() => ({})) as never,
      revise: (() => ({})) as never,
      start: (() => ({})) as never,
    },
  });
  return { services, listAllDesignSystems, readDesignSystemWorkspaceTextFile, readAvailableDesignSystem };
}

describe('readDesignSystemForFreeze', () => {
  it('prefers the workspace project mirror, same as the detail route', async () => {
    const { services, readAvailableDesignSystem } = registerServices({ mirrorBody: '# Mirror body' });
    const result = await services.readDesignSystemForFreeze(fakeReq(workspaceHeaders()), designSystemId);
    expect(result).toEqual({ body: '# Mirror body', displayName: 'Freeze Brand' });
    expect(readAvailableDesignSystem).not.toHaveBeenCalled();
  });

  it('resolves team-scoped storage with exactTeam so the team root is covered', async () => {
    const { services, listAllDesignSystems, readAvailableDesignSystem } = registerServices({
      canonicalBody: '# Team body',
      withTeamBinding: true,
    });
    const result = await services.readDesignSystemForFreeze(fakeReq(workspaceHeaders()), designSystemId);
    expect(result?.body).toBe('# Team body');
    // The team binding flips storage to the team-scoped root: the listing and
    // the canonical read must both run under exactTeam so a personal same-id
    // copy can never leak into a Team freeze.
    expect(listAllDesignSystems).toHaveBeenCalledWith(expect.objectContaining({ exactTeam: true }));
    expect(readAvailableDesignSystem).toHaveBeenCalledWith(designSystemId, expect.objectContaining({
      workspaceId,
      workspaceMemberId: memberId,
      exactTeam: true,
    }));
  });

  it('passes a personal (non-team) binding through with exactTeam false', async () => {
    const { services, readAvailableDesignSystem } = registerServices({ canonicalBody: '# Personal body' });
    const result = await services.readDesignSystemForFreeze(fakeReq(workspaceHeaders()), designSystemId);
    expect(result?.body).toBe('# Personal body');
    expect(readAvailableDesignSystem).toHaveBeenCalledWith(designSystemId, expect.objectContaining({
      exactTeam: false,
    }));
  });

  it('returns null when the brand is not visible in this scope', async () => {
    const { services, listAllDesignSystems } = registerServices({ canonicalBody: '# Hidden' });
    listAllDesignSystems.mockResolvedValue([]);
    const result = await services.readDesignSystemForFreeze(fakeReq(workspaceHeaders()), designSystemId);
    expect(result).toBeNull();
  });
});
