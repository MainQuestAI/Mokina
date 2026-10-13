// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../src/i18n';
import { MokinaRecoveryCapacity } from '../../src/components/mokina/MokinaRecoveryCapacity';
const state = vi.hoisted(() => ({ host: null as unknown }));
vi.mock('@open-design/host', () => ({ getOpenDesignHost: () => state.host }));
afterEach(() => { cleanup(); state.host = null; });
const draw = () => render(<I18nProvider initial="en"><MokinaRecoveryCapacity /></I18nProvider>);
const counts = { active: 10, reclaimable: 502, archived: 0, limit: 512, archiveBytes: 0 };
describe('recovery capacity', () => {
  it('requires explicit confirmation, then displays persisted capacity', async () => {
    const compact = vi.fn(async () => ({ ok: true, result: { ...counts, reclaimable: 0, archived: 502 } }));
    state.host = { recoveryStore: { status: async () => ({ ok: true, result: counts }), compact } };
    draw();
    await screen.findByText(/Active 10 \/ 512/);
    fireEvent.click(screen.getByRole('button', { name: 'Compact deleted records' }));
    expect(compact).not.toHaveBeenCalled();
    expect(screen.getByText(/older hosts refuse/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm compaction' }));
    await screen.findByText(/Archived witnesses 502/);
    expect(compact).toHaveBeenCalledTimes(1);
  });
  it('exposes read failure and recovers without any compaction', async () => {
    const status = vi.fn().mockResolvedValueOnce({ ok: false, reason: 'disk unavailable' }).mockResolvedValue({ ok: true, result: counts });
    const compact = vi.fn();
    state.host = { recoveryStore: { status, compact } }; draw();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }));
    await screen.findByText(/Active 10 \/ 512/);
    expect(screen.queryByRole('alert')).toBeNull(); expect(compact).not.toHaveBeenCalled();
  });
  it('shows older host limitation without pretending storage is empty', () => {
    state.host = { recoveryStore: {} }; draw();
    expect(screen.getByText(/requires a supported Mokina desktop/)).toBeTruthy();
    expect(screen.queryByText(/Active 0/)).toBeNull();
  });
  it('keeps compaction failure visible and only rereads on explicit refresh', async () => {
    const status = vi.fn(async () => ({ ok: true, result: counts }));
    const compact = vi.fn(async () => ({ ok: false, reason: 'compaction-failed' }));
    state.host = { recoveryStore: { status, compact } }; draw();
    await screen.findByText(/Active 10 \/ 512/);
    fireEvent.click(screen.getByRole('button', { name: 'Compact deleted records' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm compaction' }));
    expect((await screen.findByRole('alert')).textContent).toContain('compaction-failed');
    expect(screen.queryByText(/Compaction completed/)).toBeNull();
    expect(screen.getByText(/Active 10 \/ 512/)).toBeTruthy();
    expect(compact).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }));
    await screen.findByRole('button', { name: 'Compact deleted records' });
    expect(status).toHaveBeenCalledTimes(2);
    expect(compact).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Compaction completed/)).toBeNull();
  });
});
