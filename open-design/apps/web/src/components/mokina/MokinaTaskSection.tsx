import type { ReactNode } from 'react';
/** Task selection changes presentation only; form controllers remain mounted
 * so switching views cannot discard an unsent revision or continuation. */
export function MokinaTaskSection({ active, name, children }: {
  active: boolean; name: 'versions' | 'revision' | 'continue'; children: ReactNode;
}) {
  return <div className={`mokina-task-section mokina-task-section--${name}`} hidden={!active} data-task={name}>{children}</div>;
}
