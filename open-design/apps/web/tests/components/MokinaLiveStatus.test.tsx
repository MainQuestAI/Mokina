// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MokinaLiveStatus } from '../../src/components/mokina/MokinaLiveStatus';

afterEach(cleanup);
it('announces state changes once, leaves details updates silent and resets at identity boundaries', () => {
  const { rerender } = render(<MokinaLiveStatus identity="project:a" summary="preparing" label="Preparing materials" />);
  expect(screen.getByRole('status')).toHaveTextContent('Preparing materials');
  rerender(<MokinaLiveStatus identity="project:a" summary="preparing" label="Different storage detail" />);
  expect(screen.getByRole('status')).toHaveTextContent('Preparing materials');
  rerender(<MokinaLiveStatus identity="project:a" summary="ready" label="Materials ready" />);
  expect(screen.getByRole('status')).toHaveTextContent('Materials ready');
  rerender(<MokinaLiveStatus identity="project:b" summary="ready" label="Other project" />);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  rerender(<MokinaLiveStatus identity="project:b" summary="operation:2:ready" label="Materials ready" />);
  expect(screen.getByRole('status')).toHaveTextContent('Materials ready');
});
