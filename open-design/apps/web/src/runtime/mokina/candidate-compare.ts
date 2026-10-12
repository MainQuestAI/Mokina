import { parseMokinaOperationRequest, type ProjectFileVersion } from '@open-design/contracts';

/**
 * Candidate comparison helpers (T12).
 *
 * The comparison the reviewer sees must not rest on "looks the same": outside
 * the selected chapter business strings are compared BYTE-wise after excluding
 * only system receipts verified against the same file version catalog,
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

/** Comparison-only projection. Original artifact bytes remain authoritative and unchanged. */
export function comparisonBusinessContent(html: string, versionId?: string, versions: readonly ProjectFileVersion[] = []): string {
  let current = versions.find(version => version.id === versionId);
  if (!current?.contentDigest) return html;
  let result = html;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) return html;
    seen.add(current.id);
    if (!current.operationId && current.restoreFromVersionId) {
      const source = versions.find(version => version.id === current!.restoreFromVersionId);
      if (!source || source.contentDigest !== current.contentDigest || source.fileName !== current.fileName) return html;
      current = source; continue;
    }
    const match = /\n<!-- mokina-operation ([A-Za-z0-9+/=]+) -->$/u.exec(result);
    if (!match) return result;
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(match[1]!), char => char.charCodeAt(0)));
      const operation = parseMokinaOperationRequest(JSON.parse(decoded));
      const parent = versions.find(version => version.id === operation.baseVersionId);
      if (operation.operationId !== current.operationId || !parent || parent.id === current.id
        || parent.contentDigest !== operation.contentDigest || parent.fileName !== current.fileName) return html;
      result = result.slice(0, match.index);
      current = parent;
    } catch { return html; }
  }
  return html;
}

export function compareMokinaChapter(input: {
  sectionId: string;
  baseHtml: string;
  candidateHtml: string;
  baseVersionId?: string;
  candidateVersionId?: string;
  versions?: readonly ProjectFileVersion[];
}): MokinaChapterCompare {
  const baseSection = extractSectionHtml(input.baseHtml, input.sectionId);
  const candidateSection = extractSectionHtml(input.candidateHtml, input.sectionId);
  const baseRest = blankOutSection(comparisonBusinessContent(input.baseHtml, input.baseVersionId, input.versions), input.sectionId);
  const candidateRest = blankOutSection(comparisonBusinessContent(input.candidateHtml, input.candidateVersionId, input.versions), input.sectionId);
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

/** Readable comparison; parse inertly and omit executable/style text. Never inject artifact HTML into the host. */
export function readableChapter(html: string): string {
  const doc = parseDocument(html);
  doc.querySelectorAll('script,style').forEach(node => node.remove());
  doc.querySelectorAll('p,li,tr,h1,h2,h3,section').forEach(node => node.append('\n'));
  doc.querySelectorAll('td,th').forEach(node => node.append(' · '));
  return (doc.body.textContent ?? '').trim();
}
