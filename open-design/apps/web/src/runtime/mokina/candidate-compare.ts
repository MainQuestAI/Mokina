/**
 * Candidate comparison helpers (T12).
 *
 * The comparison the reviewer sees must not rest on "looks the same": outside
 * the selected chapter the base and candidate strings are compared BYTE-wise,
 * and numeric literals are surfaced as review prompts, not as truth.
 */

export type MokinaChapterCompare = {
  sectionId: string;
  baseHtml: string | null;
  candidateHtml: string | null;
  /** Byte equality of everything outside the selected chapter. */
  restIdentical: boolean;
  baseRestLength: number;
  candidateRestLength: number;
  numbersOnlyInBase: string[];
  numbersOnlyInCandidate: string[];
};

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function findSectionElement(doc: Document, sectionId: string): Element | null {
  const nodes = Array.from(doc.querySelectorAll('[data-mokina-id]'));
  return nodes.find((node) => (
    node.id === sectionId && node.getAttribute('data-mokina-id') === sectionId
  )) ?? null;
}

export function extractSectionHtml(html: string, sectionId: string): string | null {
  const element = findSectionElement(parseDocument(html), sectionId);
  return element ? element.outerHTML : null;
}

/** Everything outside the selected chapter, with the chapter blanked. */
export function blankOutSection(html: string, sectionId: string): string {
  const element = findSectionElement(parseDocument(html), sectionId);
  if (!element) return html;
  return html.replace(element.outerHTML, `<!--mokina-compare:${sectionId}-->`);
}

const NUMBER_PATTERN = /\d[\d,]*(?:\.\d+)?%?/gu;

export function extractNumericTokens(html: string): string[] {
  const text = parseDocument(html).body?.textContent ?? '';
  const unique = new Set<string>();
  for (const match of text.match(NUMBER_PATTERN) ?? []) {
    const normalized = match.replace(/,/gu, '');
    if (normalized.length <= 12) unique.add(normalized);
  }
  return [...unique].sort();
}

export function compareMokinaChapter(input: {
  sectionId: string;
  baseHtml: string;
  candidateHtml: string;
}): MokinaChapterCompare {
  const baseSection = extractSectionHtml(input.baseHtml, input.sectionId);
  const candidateSection = extractSectionHtml(input.candidateHtml, input.sectionId);
  const baseRest = blankOutSection(input.baseHtml, input.sectionId);
  const candidateRest = blankOutSection(input.candidateHtml, input.sectionId);
  const baseNumbers = new Set(extractNumericTokens(baseSection ?? ''));
  const candidateNumbers = new Set(extractNumericTokens(candidateSection ?? ''));
  return {
    sectionId: input.sectionId,
    baseHtml: baseSection,
    candidateHtml: candidateSection,
    restIdentical: baseRest === candidateRest,
    baseRestLength: baseRest.length,
    candidateRestLength: candidateRest.length,
    numbersOnlyInBase: [...baseNumbers].filter((value) => !candidateNumbers.has(value)),
    numbersOnlyInCandidate: [...candidateNumbers].filter((value) => !baseNumbers.has(value)),
  };
}

export function listSectionIds(html: string): string[] {
  const nodes = Array.from(parseDocument(html).querySelectorAll('[data-mokina-id]'));
  const ids: string[] = [];
  for (const node of nodes) {
    const id = node.getAttribute('data-mokina-id') ?? '';
    if (id && node.id === id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * The candidate version does not persist its target section id, so the
 * comparison derives it: the id whose frozen HTML differs between base and
 * candidate. More than one changed section is itself a finding.
 */
export function detectChangedSections(baseHtml: string, candidateHtml: string): string[] {
  const ids = [...new Set([...listSectionIds(baseHtml), ...listSectionIds(candidateHtml)])];
  return ids.filter((id) => extractSectionHtml(baseHtml, id) !== extractSectionHtml(candidateHtml, id));
}
