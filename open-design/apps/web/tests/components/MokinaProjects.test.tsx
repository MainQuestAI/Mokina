// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../src/i18n';
import { MokinaProjects } from '../../src/components/mokina/MokinaProjects';
vi.mock('../../src/hooks/useProjectRunStatuses', () => ({ useProjectRunStatuses: () => new Map() }));
vi.mock('../../src/components/mokina/MokinaFixedSource', () => ({ MokinaFixedSource: () => <span>No fixed source</span> }));
afterEach(cleanup);
it('does not turn a failed project read into an empty catalog or offer a creation action in its place', () => {
  const start = vi.fn(); const retry = vi.fn();
  const { rerender } = render(<I18nProvider initial="en"><MokinaProjects projects={[]} loading={false} error="Cannot read projects" onStart={start} onRetry={retry} onOpen={vi.fn()} /></I18nProvider>);
  expect(screen.getByRole('alert')).toHaveTextContent('Cannot read projects');
  expect(screen.queryByText('Create a project to start your first task.')).toBeNull();
  fireEvent.click(screen.getByText('Retry')); expect(retry).toHaveBeenCalledOnce(); expect(start).not.toHaveBeenCalled();
  rerender(<I18nProvider initial="en"><MokinaProjects projects={[]} loading={false} onStart={start} onOpen={vi.fn()} /></I18nProvider>);
  expect(screen.getByText('Create a project to start your first task.')).toBeVisible();
});
it('keeps a project with no run evidence unknown and uses the authoritative open callback', () => {
  const open = vi.fn();
  render(<I18nProvider initial="en"><MokinaProjects projects={[{ id: 'p1', name: 'User draft', skillId: null, designSystemId: null, createdAt: 1, updatedAt: 1 }]} loading={false} onStart={vi.fn()} onOpen={open} /></I18nProvider>);
  expect(screen.getByText('Unknown')).toBeVisible();
  expect(screen.getByText('Unclassified')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Open' })); expect(open).toHaveBeenCalledWith('p1');
});
