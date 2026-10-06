// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../src/i18n';
import { MokinaEntryChooserDialog } from '../../src/components/MokinaEntryChooserDialog';
const formal = { entry: 'plan.html', versionId: 'version', versionNumber: 3, adoptedAt: null, createdAt: 1000, adoptionOperationId: null };
afterEach(cleanup);
it('uses the native dialog portal, traps focus, closes with Esc and restores the trigger', () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus();
  const close = vi.fn(); const view = render(<I18nProvider initial="en"><MokinaEntryChooserDialog formals={[formal]} onPick={vi.fn()} onClose={close} /></I18nProvider>);
  const dialog = screen.getByRole('dialog'); expect(dialog.parentElement?.parentElement).toBe(document.body);
  const buttons = Array.from(dialog.querySelectorAll('button')); const first = buttons[0]!; const last = buttons.at(-1)!;
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(last);
  fireEvent.keyDown(document, { key: 'Tab' }); expect(document.activeElement).toBe(first);
  expect(dialog.textContent).toContain('Version time'); expect(dialog.textContent).not.toContain('Adopted');
  fireEvent.keyDown(document, { key: 'Escape' }); expect(close).toHaveBeenCalledOnce();
  view.unmount(); expect(document.activeElement).toBe(opener); opener.remove();
});
it('keeps exact entry/version on pick and does not steal another project focus during route cleanup', () => {
  const pick = vi.fn(); const view = render(<I18nProvider initial="en"><MokinaEntryChooserDialog formals={[{ ...formal, createdAt: null }]} onPick={pick} onClose={vi.fn()} /></I18nProvider>);
  expect(screen.getByRole('dialog').textContent).not.toContain('Version time');
  fireEvent.click(screen.getByRole('button', { name: /plan.html/ })); expect(pick).toHaveBeenCalledWith({ ...formal, createdAt: null });
  view.unmount();
  const next = document.createElement('input'); document.body.append(next);
  const stale = render(<I18nProvider initial="en"><MokinaEntryChooserDialog formals={[formal]} onPick={pick} onClose={vi.fn()} /></I18nProvider>);
  next.focus(); stale.unmount(); expect(document.activeElement).toBe(next); next.remove();
});
