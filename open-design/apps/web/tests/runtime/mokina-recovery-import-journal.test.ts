// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareMokinaImport, persistMokinaImport } from '../../src/runtime/mokina/recovery-import-journal';
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
describe('Mokina recovery import identity', () => {
  it('reuses lost-response and imported identities across refresh, and mints only explicit copies', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const file = { name: 'recovery.zip', size: 3, arrayBuffer: async () => new TextEncoder().encode('zip').buffer } as File;
    const first = await prepareMokinaImport(file, 'workspace');
    expect(await prepareMokinaImport(file, 'workspace')).toEqual(first);
    await persistMokinaImport({ ...first, state: 'imported' });
    const recovered = await prepareMokinaImport(file, 'workspace');
    expect(recovered.operationId).toBe(first.operationId);
    expect(recovered.state).toBe('imported');
    const copy = await prepareMokinaImport(file, 'workspace', true);
    expect(copy.targetProjectId).not.toBe(first.targetProjectId);
    const other = await prepareMokinaImport(file, 'other-workspace');
    expect(other.operationId).not.toBe(copy.operationId);
  });
});
