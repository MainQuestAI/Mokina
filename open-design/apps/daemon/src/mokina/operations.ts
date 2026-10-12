import { load } from 'cheerio';
import type { MokinaEditableField, MokinaOperationRequest } from '@open-design/contracts';
import { decimal, formatDecimal } from './decimal.js';
import { readHtmlSections, replaceHtmlSection } from './sections.js';

type Node = ReturnType<ReturnType<typeof load>>[number];
type Patch = { start: number; end: number; value: string };
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function location(node: Node) {
  const loc = (node as unknown as { sourceCodeLocation?: { startTag?: { endOffset: number }; endTag?: { startOffset: number } } }).sourceCodeLocation;
  if (!loc?.startTag || !loc.endTag) throw new Error('Editable field requires explicit opening and closing tags');
  return { start: loc.startTag.endOffset, end: loc.endTag.startOffset };
}
function readFields(html: string) {
  readHtmlSections(html);
  const $ = load(html, { sourceCodeLocationInfo: true });
  const warnings: string[] = [];
  const idCounts = new Map<string, number>();
  for (const node of $('[data-mokina-field]').toArray()) { const id = $(node).attr('data-mokina-field')!; idCounts.set(id, (idCounts.get(id) ?? 0) + 1); }
  const fields: Array<MokinaEditableField & { node: Node; table?: Node }> = [];
  const add = (node: Node, id: string, kind: MokinaEditableField['kind'], table?: Node) => {
    const sectionId = $(node).closest('[data-mokina-id]').attr('data-mokina-id');
    if (!sectionId || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || fields.some(f => f.id === id) || (idCounts.get(id) ?? 0) > 1
      || $(node).children().length || !['p', 'span', 'td', 'th', 'li', 'dd'].includes(node.type === 'tag' ? node.name : '')) { warnings.push(`Unsupported or ambiguous field: ${id}`); return; }
    try { location(node); } catch { warnings.push(`Field requires explicit tags: ${id}`); return; }
    fields.push({ id, sectionId, kind, label: $(node).attr('data-mokina-label') || `${sectionId} · ${id}`, value: $(node).text(), node, ...(table ? { table } : {}) });
  };
  for (const node of $('[data-mokina-field]').toArray()) {
    const kind = $(node).attr('data-mokina-kind');
    if ($(node).closest('[data-mokina-budget]').length || $(node).is('[data-mokina-budget-total],[data-mokina-budget-remaining],[data-mokina-budget-hours]') || /^budget-\d+-\d+-/.test($(node).attr('data-mokina-field')!)) { warnings.push('Budget values must use numeric controls'); continue; }
    if (kind !== 'strategy' && kind !== 'matrix') { warnings.push('Unsupported semantic field kind'); continue; }
    add(node, $(node).attr('data-mokina-field')!, kind);
  }
  $('[data-mokina-budget]').each((ti, table) => {
    $(table).find('[data-budget-item]').each((ri, row) => {
      for (const kind of ['quantity', 'unit-price', 'hours'] as const) {
        const cells = $(row).find(`[data-${kind}]`);
        if (cells.length !== 1) { warnings.push(`Unsupported budget cell: ${ti}/${ri}/${kind}`); continue; }
        add(cells[0]!, `budget-${ti}-${ri}-${kind}`, kind, table);
      }
    });
  });
  if (fields.length > 100) throw new Error('At most 100 fields can be edited');
  return { $, fields, warnings };
}
export function inspectOperationSupport(html: string) {
  const { fields, warnings } = readFields(html);
  return { warnings, fields: fields.map(({ node: _node, table: _table, ...field }) => field) };
}
export function inspectOperationFields(html: string): MokinaEditableField[] { return inspectOperationSupport(html).fields; }
function patched(html: string, patches: Patch[]): string {
  const ordered = patches.sort((a, b) => b.start - a.start);
  let end = html.length;
  for (const p of ordered) {
    if (p.end > end || p.start > p.end) throw new Error('Overlapping controlled edits');
    html = html.slice(0, p.start) + escape(p.value) + html.slice(p.end); end = p.start;
  }
  return html;
}
export function applyOperationEdits(html: string, edits: MokinaOperationRequest['edits']): string {
  const { $, fields } = readFields(html); const patches: Patch[] = []; const changedTables = new Set<Node>();
  const values = new Map(edits.map(e => [e.id, e.value]));
  if (values.size !== edits.length) throw new Error('Duplicate field edit');
  for (const edit of edits) {
    const field = fields.find(f => f.id === edit.id);
    if (!field || edit.value.length > 8000) throw new Error('Unknown or oversized field');
    if (field.table) { const value = decimal(edit.value); if (value === null || value < 0n) throw new Error('Invalid budget decimal'); changedTables.add(field.table); }
    patches.push({ ...location(field.node), value: field.table ? formatDecimal(decimal(edit.value)!, 8) : edit.value });
  }
  for (const table of changedTables) {
    const limit = decimal($(table).attr('data-budget-limit') ?? '', 2), capacity = decimal($(table).attr('data-capacity-hours') ?? '');
    if (limit === null || capacity === null || limit < 0n || capacity < 0n) throw new Error('Invalid budget limit or capacity');
    let total = 0n, hours = 0n;
    for (const row of $(table).find('[data-budget-item]').toArray()) {
      const read = (kind: string) => {
        const cell = $(row).find(`[data-${kind}]`); const field = fields.find(f => f.node === cell[0]);
        const value = decimal(field && values.has(field.id) ? values.get(field.id)! : cell.text());
        if (cell.length !== 1 || value === null || value < 0n) throw new Error('Invalid budget input'); return value;
      };
      const q = read('quantity'), price = read('unit-price'); hours += read('hours');
      const cents = (q * price + 50_000_000_000_000n) / 100_000_000_000_000n; total += cents;
      const amount = $(row).find('[data-amount]');
      if (amount.length !== 1 || amount.children().length) throw new Error('Ambiguous amount');
      patches.push({ ...location(amount[0]!), value: formatDecimal(cents, 2) });
    }
    if (total > limit) throw new Error(`Budget exceeded: ${formatDecimal(total, 2)} > ${formatDecimal(limit, 2)}`);
    if (hours > capacity) throw new Error('Capacity exceeded');
    const ti = $('[data-mokina-budget]').toArray().findIndex(node => node === table);
    for (const [attr, value] of [['total', formatDecimal(total, 2)], ['remaining', formatDecimal(limit - total, 2)], ['hours', formatDecimal(hours, 8)]] as const) {
      for (const node of $(`[data-mokina-budget-${attr}="${ti}"]`).toArray()) {
        if ($(node).children().length) throw new Error('Budget summary must be plain text');
        patches.push({ ...location(node), value });
      }
    }
  }
  return patched(html, patches);
}
export function combineOperationSections(base: string, donor: string, ids: string[]): string {
  const sections = readHtmlSections(donor);
  for (const id of ids) {
    const source = sections.find(s => s.id === id);
    if (!source) throw new Error(`Missing source chapter: ${id}`);
    base = replaceHtmlSection(base, id, source.html);
  }
  return base;
}

/** Merge declarations only for the explicitly selected chapters, never today's sources. */
export function combineOperationEvidence(base: string, donor: string, ids: string[]): string {
  const read = (html: string) => {
    const $ = load(html, { sourceCodeLocationInfo: true }); const nodes = $('[id="mokina-evidence"]');
    if (!nodes.length) return { sources: [] as Array<Record<string, unknown>>, node: null as Node | null };
    if (nodes.length !== 1 || nodes.attr('type') !== 'application/json') throw new Error('Ambiguous evidence declaration');
    const value = JSON.parse(nodes.text());
    if (value.schema !== 'mokina.evidence.v1' || !Array.isArray(value.sources)) throw new Error('Invalid evidence declaration');
    return { sources: value.sources as Array<Record<string, unknown>>, node: nodes[0]! };
  };
  const a = read(base), b = read(donor);
  // Retain base declarations: another surviving chapter may still cite them.
  const sources = [...a.sources];
  for (const source of b.sources.filter(s => ids.includes(String(s.sectionId)))) {
    const existing = sources.find(s => s.id === source.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(source)) throw new Error('Combined evidence source IDs conflict');
    if (!existing) sources.push(source);
  }
  if (sources.length > 8) throw new Error('Combined evidence exceeds eight sources; revise the evidence selection first');
  if (!a.node && !sources.length) return base;
  const json = JSON.stringify({ schema: 'mokina.evidence.v1', sources }).replaceAll('<', '\\u003c');
  if (a.node) { const p = location(a.node); return base.slice(0, p.start) + json + base.slice(p.end); }
  return base + `<script type="application/json" id="mokina-evidence">${json}</script>`;
}
