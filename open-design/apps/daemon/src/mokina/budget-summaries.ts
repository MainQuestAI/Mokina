import type { CheerioAPI } from 'cheerio';
type Node = ReturnType<CheerioAPI>[number];
export const budgetSummaryKinds = ['total', 'remaining', 'hours'] as const;
export function budgetSummaryIndex(value: string | undefined, count: number): number | null {
  if (!value || !/^(0|[1-9]\d*)$/u.test(value)) return null;
  const index = Number(value);
  return Number.isSafeInteger(index) && index < count ? index : null;
}
/** One binding policy for inspection, composition, rewriting and quality capture. */
export function inspectBudgetSummaries($: CheerioAPI) {
  const count = $('[data-mokina-budget]').length;
  const summaries: Array<{ node: Node; index: number; kind: typeof budgetSummaryKinds[number] }> = [];
  const warnings: string[] = [];
  for (const node of $('[data-mokina-budget-total],[data-mokina-budget-remaining],[data-mokina-budget-hours]').toArray()) {
    const kinds = budgetSummaryKinds.filter(kind => $(node).attr(`data-mokina-budget-${kind}`) !== undefined);
    const kind = kinds[0]!; const raw = $(node).attr(`data-mokina-budget-${kind}`);
    const index = budgetSummaryIndex(raw, count);
    const location = (node as unknown as { sourceCodeLocation?: { endTag?: unknown } }).sourceCodeLocation;
    if ((location && !location.endTag) || kinds.length !== 1 || index === null || $(node).children().length) {
      warnings.push(`Invalid budget summary ${kind}="${raw}": expected one plain-text marker bound to an existing canonical table index`);
    } else summaries.push({ node, index, kind });
  }
  return { summaries, warnings };
}
