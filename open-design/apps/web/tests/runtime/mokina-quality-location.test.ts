// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { qualityLocationBridge } from '../../src/runtime/mokina/quality-location';
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });
it('locates only the matching preview identity and refuses duplicate chapters', () => {
  document.body.innerHTML = '<section id="budget" data-mokina-id="budget">Budget</section>';
  const chapter = document.querySelector<HTMLElement>('section')!;
  chapter.scrollIntoView = vi.fn();
  const script = qualityLocationBridge('v1', 'token').replace(/^<script>|<\/script>$/g, '');
  let receive: ((event: MessageEvent) => void) | undefined;
  const reply = vi.fn(); const parent = { postMessage: reply };
  new Function('addEventListener', 'document', 'parent', script)(
    (_event: string, callback: (event: MessageEvent) => void) => { receive = callback; }, document, parent);
  const send = (versionId: string) => receive!({ source: parent, data: { type: 'mokina:locate', token: 'token', versionId, requestId: 'r', sectionId: 'budget' } } as unknown as MessageEvent);
  send('old'); expect(chapter.scrollIntoView).not.toHaveBeenCalled();
  send('v1'); expect(chapter.getAttribute('data-mokina-located')).toBe('true');
  expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ found: true, versionId: 'v1' }), '*');
  document.body.insertAdjacentHTML('beforeend', '<section id="budget" data-mokina-id="budget">Duplicate</section>');
  send('v1'); expect(chapter.hasAttribute('data-mokina-located')).toBe(false);
  expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ found: false }), '*');
});
