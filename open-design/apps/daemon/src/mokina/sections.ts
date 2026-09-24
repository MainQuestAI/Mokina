import { load } from 'cheerio';

export interface HtmlSection {
  id: string;
  html: string;
  text: string;
  start: number;
  end: number;
}

/** Source offsets let us preserve every byte outside the selected chapter. */
export function readHtmlSections(content: string): HtmlSection[] {
  const $ = load(content, { sourceCodeLocationInfo: true });
  const seen = new Set<string>();
  const chapters: HtmlSection[] = [];
  for (const node of $('[data-mokina-id]').toArray()) {
    const id = $(node).attr('data-mokina-id') ?? '';
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(id) || seen.has(id)) {
      throw new Error(`missing, invalid or duplicate chapter id: ${id}`);
    }
    if ($(node).attr('id') !== id) throw new Error(`chapter id attributes disagree: ${id}`);
    seen.add(id);
    // Internal anchors can also carry data-mokina-id. Validate them, but only
    // expose outermost elements as replaceable chapters.
    if ($(node).parents('[data-mokina-id]').length > 0) continue;
    const location = (node as unknown as { sourceCodeLocation?: { startOffset: number; endOffset: number } }).sourceCodeLocation;
    if (!location || !Number.isInteger(location.startOffset) || !Number.isInteger(location.endOffset)) {
      throw new Error(`chapter location missing: ${id}`);
    }
    chapters.push({
      id,
      html: content.slice(location.startOffset, location.endOffset),
      text: $(node).text(),
      start: location.startOffset,
      end: location.endOffset,
    });
  }
  return chapters;
}

/** Accept a complete replacement element; the caller never trusts full-document model output. */
export function replaceHtmlSection(base: string, id: string, replacement: string): string {
  const original = readHtmlSections(base).find((section) => section.id === id);
  if (!original) throw new Error(`chapter not found: ${id}`);
  const trimmed = replacement.trim();
  const parsed = readHtmlSections(trimmed);
  if (parsed.length !== 1 || parsed[0]?.id !== id || parsed[0].start !== 0 || parsed[0].end !== trimmed.length) {
    throw new Error(`replacement must contain exactly one complete chapter: ${id}`);
  }
  const candidate = base.slice(0, original.start) + trimmed + base.slice(original.end);
  readHtmlSections(candidate);
  return candidate;
}
