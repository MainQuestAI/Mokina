import { MOKINA_LOCAL_EDITION } from '../mokina-edition';

/** Apply branding before interpolation so filenames and customer text stay exact. */
export function mokinaProductCopy(key: string, copy: string): string {
  if (!MOKINA_LOCAL_EDITION) return copy;
  // Generation instructions, upstream services and source attribution retain
  // their original identities. Visibility of service entries is edition-gated.
  if (/handoff\.prompt|contextPrompt|mcpBuildHint|cloud|amr|shareTo|community|official|license|sourceCode|openDesignSystem/i.test(key)) return copy;
  // Hungarian attaches case endings directly to the product name. Preserve
  // the meaning and use Mokina's accented stem rather than leaving the old
  // name behind or rewriting source handles such as OpenDesignHQ.
  const endings: Record<string, string> = { ba: 'ba', ban: 'ban', 'ból': 'ból', gal: 'val', hoz: 'hoz', nak: 'nak', nal: 'val', nek: 'nak', ra: 'ra', t: 't' };
  return copy.replace(/\baz (?=Open ?Design\b|OpenDesign(?:ba|ban|ból|gal|hoz|nak|nal|nek|ra|t)\b)/g, 'a ')
    .replace(/\bOpenDesign(ba|ban|ból|gal|hoz|nak|nal|nek|ra|t)\b/gi, (_match, ending: string) => `Mokiná${endings[ending.toLowerCase()]}`)
    .replace(/\bOpen-Design(?=-(?:App|Daemon|Extras)\b)/g, 'Mokina')
    .replace(/\bOpenDesign\b|\bOpen Design\b/gi, 'Mokina');
}
