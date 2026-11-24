import { load } from 'cheerio';

function isSafeLocalOrDataImageSrc(src: string): boolean {
  const value = src.trim();
  if (!value) return false;
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/iu.test(value)) return true;
  if (value.startsWith('/') || value.startsWith('\\') || value.includes(':') || value.includes('//') || value.includes('\\')) return false;
  return !value.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'));
}

/** Shared read/write boundary, not a sanitizer: unsupported behavior uses chapter revision. */
export function unsupportedControlledContent(html: string, mode: 'document' | 'chapter' = 'document'): string | null {
  const $ = load(html);
  const unsupported = 'This content contains resources or unsupported behavior; use chapter revision instead';
  if ($('script').toArray().some(node => mode === 'chapter' || $(node).attr('type') !== 'application/json')
    || $('video,audio,iframe,object,embed,applet,link,base,form,noscript,meta[http-equiv],[srcset],[srcdoc]').length
    || $('svg script,svg foreignObject,svg iframe,svg image,svg use,svg a').length
    || (mode === 'chapter' && $('style').length)
    || /url\s*\(|@import/i.test($('style').text())
    || $('[style]').toArray().some(node => /url\s*\(|@import/i.test($(node).attr('style') ?? ''))) return unsupported;
  for (const node of $('[src]').toArray()) {
    if (node.type !== 'tag' || node.tagName.toLowerCase() !== 'img') return unsupported;
    if (!isSafeLocalOrDataImageSrc($(node).attr('src') ?? '')) return unsupported;
  }
  for (const node of $('*').toArray()) {
    if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') continue;
    for (const [name, value] of Object.entries(node.attribs)) {
      if (/^on/iu.test(name) || ['action', 'formaction', 'form', 'formtarget', 'formmethod', 'target', 'ping', 'download', 'xlink:href'].includes(name)
        || (name === 'href' && !value.startsWith('#'))) return unsupported;
    }
  }
  return null;
}
function fragment(value: string): string | null {
  if (!value.startsWith('#')) return null;
  try { return decodeURIComponent(value.slice(1)); } catch { return null; }
}
/** Reject new broken links, including surviving navigation outside replaced chapters. */
export function validateCombinedNavigation(base: string, combined: string, selected: string[]) {
  const before = load(base), after = load(combined);
  const count = ($: ReturnType<typeof load>, id: string) => $('[id]').toArray().filter(node => $(node).attr('id') === id).length;
  const owner = ($: ReturnType<typeof load>, node: ReturnType<ReturnType<typeof load>>[number]) => $(node).parents('[data-mokina-id]').last().attr('data-mokina-id') ?? $(node).attr('data-mokina-id');
  const check = (id: string) => { if (count(after, id) !== 1) throw new Error(`Combined chapter link target is missing or ambiguous: ${id}; use chapter revision`); };
  for (const node of before('[href]').toArray()) {
    if (selected.includes(owner(before, node) ?? '')) continue;
    const id = fragment(before(node).attr('href')!);
    if (id && count(before, id) === 1) check(id);
  }
  for (const node of after('[href]').toArray()) {
    if (!selected.includes(owner(after, node) ?? '')) continue;
    const raw = after(node).attr('href')!; const id = fragment(raw);
    if (id === null) throw new Error(`Invalid combined chapter link: ${raw}`);
    if (id) check(id);
  }
}
