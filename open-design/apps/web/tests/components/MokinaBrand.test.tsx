// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MokinaBrand } from '../../src/components/mokina/MokinaBrand';

afterEach(cleanup);
it('names independent identities and makes adjacent decoration silent', () => {
  const { rerender, container } = render(<MokinaBrand decorative={false} size={20} />);
  expect(screen.getByRole('img', { name: 'Mokina' })).toHaveAttribute('height', '20');
  expect(container.querySelector('path')).toHaveAttribute('d', expect.stringContaining('M264 0'));
  rerender(<MokinaBrand variant="horizontal" />);
  expect(screen.queryByRole('img')).toBeNull();
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelector('g')).toHaveAttribute('fill', 'currentColor');
});
