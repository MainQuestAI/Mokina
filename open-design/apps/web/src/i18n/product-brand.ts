import { MOKINA_LOCAL_EDITION } from '../mokina-edition';

/** Apply branding before interpolation so filenames and customer text stay exact. */
export function mokinaProductCopy(key: string, copy: string): string {
  if (!MOKINA_LOCAL_EDITION) return copy;
  // Generation instructions, upstream services and source attribution retain
  // their original identities. Visibility of service entries is edition-gated.
  if (/handoff\.prompt|contextPrompt|mcpBuildHint|cloud|amr|shareTo|community|official|license|sourceCode|openDesignSystem/i.test(key)) return copy;
  return copy.replace(/\bOpenDesign\b|\bOpen Design\b/gi, 'Mokina');
}
