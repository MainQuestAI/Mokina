// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { homeInputIdentity, readStagedInputDraft, saveStagedInputDraft } from '../../src/runtime/mokina/staged-input-draft';
import { resetDurableRecoveryForTests } from '../../src/runtime/persistence/mokina-recovery-store';
afterEach(() => { localStorage.clear(); resetDurableRecoveryForTests(); });
it('keeps distinct, stable input identities for two equal display names', () => {
  const a = new File(['a'], 'same.csv'), b = new File(['b'], 'same.csv');
  expect(homeInputIdentity(a)).toBe(homeInputIdentity(a));
  expect(homeInputIdentity(a)).not.toBe(homeInputIdentity(b));
});
it('persists purposes without pretending browser File bytes can be restored', async () => {
  const file = new File(['SECRET-BYTES-NOT-RESTORED'], 'a.csv');
  const record = await saveStagedInputDraft('workspace', [{ inputId: homeInputIdentity(file), name: file.name, size: file.size,
    plan: { inputId: homeInputIdentity(file), name: file.name, size: file.size, kind: 'material' } }], null);
  expect(readStagedInputDraft('workspace')).toEqual(record);
  expect(readStagedInputDraft('other')).toBeNull();
  expect(JSON.stringify(record)).not.toContain('SECRET-BYTES-NOT-RESTORED');
});
it('rejects stale window edits rather than overwriting newer purposes', async () => {
  const first = await saveStagedInputDraft('w', [], null);
  const second = await saveStagedInputDraft('w', [{ inputId: 'B', name: 'B.csv', size: 1, plan: null }], first);
  await expect(saveStagedInputDraft('w', [], first)).rejects.toThrow('另一窗口');
  expect(readStagedInputDraft('w')).toEqual(second);
});
