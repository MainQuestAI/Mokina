import { inspectBudgetSummaries } from './budget-summaries.js';
import { decimal, formatDecimal } from './decimal.js';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import type { MokinaEvidenceSource, MokinaQualityIssue, MokinaQualitySnapshot } from '@open-design/contracts';

const declarationId = 'mokina-evidence';
const snapshotId = 'mokina-quality-snapshot';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const MAX_BYTES = 512 * 1024;
function fail(message: string): never { throw new Error(message); }
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('Expected object');
}
function string(value: unknown, max = 4000): string {
  return typeof value === 'string' && value.length <= max ? value : fail('Invalid text field');
}
function parseSource(value: unknown): MokinaEvidenceSource {
  const v = object(value);
  const id = string(v.id, 128); const sectionId = string(v.sectionId, 128);
  if (!identifier.test(id) || !identifier.test(sectionId)) fail('Invalid source/chapter identity');
  const path = string(v.path, 1024);
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(p => !p || p === '..' || p === '.' || p.startsWith('.'))) fail('Source must be a visible project-relative file');
  const digest = string(v.sha256, 64);
  if (!/^[a-f0-9]{64}$/u.test(digest)) fail('Expected SHA-256 of selected bytes');
  if (!['full-text', 'summary', 'data', 'method'].includes(String(v.kind))) fail('Invalid source kind');
  const source: MokinaEvidenceSource = { id, path, sha256: digest, kind: v.kind as MokinaEvidenceSource['kind'], sectionId,
    locator: string(v.locator), limitation: string(v.limitation) };
  for (const key of ['url', 'accessedAt', 'methodVersion', 'excerpt'] as const) if (v[key] !== undefined) source[key] = string(v[key]);
  if (source.url && !/^https?:\/\//u.test(source.url)) fail('Source URL must be HTTP(S); it will not be fetched');
  if (!source.locator.trim() || (source.kind === 'summary' && !source.limitation.trim())) fail('Reading range and summary limitations must be explicit');
  if (source.url && (!source.accessedAt || !Number.isFinite(Date.parse(source.accessedAt)))) fail('Web evidence requires a declared access time');
  if (['full-text', 'summary'].includes(source.kind) && !source.excerpt?.trim()) fail('Research evidence requires a supporting excerpt');
  if (source.kind === 'method' && !source.methodVersion) fail('Method version is required');
  if (v.csv !== undefined) {
    if (source.kind !== 'data') fail('CSV mapping requires data source');
    const c = object(v.csv); source.csv = { id: string(c.id, 100), amount: string(c.amount, 100), unit: string(c.unit, 100) };
    if (new Set(Object.values(source.csv)).size !== 3 || Object.values(source.csv).some(s => !s)) fail('CSV columns must be distinct');
  }
  return source;
}

/** RFC-style quoted cells; reject ambiguous malformed rows instead of dropping them. */
function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += ch;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (ch !== ',') { rows.push(row); row = []; if (ch === '\r' && text[i + 1] === '\n') i++; }
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else if (closed || ch === '"') fail('Malformed CSV quoting');
    else cell += ch;
  }
  if (quoted) fail('Unclosed CSV quote');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  if (!rows.length || rows.some(r => r.length !== rows[0]!.length)) fail('CSV row widths differ');
  return rows;
}
const number = (value: string): number | null => /^-?\d+(?:\.\d+)?$/u.test(value.trim()) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 1e12 ? Number(value) : null;
function inspectCsv(source: MokinaEvidenceSource, text: string, issues: MokinaQualityIssue[], calculations: MokinaQualitySnapshot['calculations']) {
  const rows = csvRows(text.replace(/^\uFEFF/u, '')); const header = rows.shift()!;
  const fields = source.csv!; const indexes = [fields.id, fields.amount, fields.unit].map(k => header.indexOf(k));
  if (indexes.some(i => i < 0) || new Set(header).size !== header.length) fail('CSV mapping missing or duplicate headers');
  const [idIndex, amountIndex, unitIndex] = indexes as [number, number, number];
  const seen = new Set<string>(); const totals = new Map<string, bigint>(); let invalid = false;
  const issue = (code: string, message: string) => { invalid = true; issues.push({ code, sourceId: source.id, sectionId: source.sectionId, message }); };
  if (!rows.length) issue('CSV_EMPTY', 'CSV has headers but no data rows; no calculation completed.');
  for (const [index, row] of rows.entries()) {
    const id = row[idIndex]!.trim(); const amountText = row[amountIndex]!.trim();
    const amount = decimal(amountText);
    const supportedPrecision = /^-?\d+(?:\.\d{1,8})?$/u.test(amountText); const unit = row[unitIndex]!.trim();
    if (!id || amount === null || !unit || !supportedPrecision) issue('CSV_MISSING', `Row ${index + 2}: missing identity/unit or invalid amount; no zero-fill.${amount !== null && !supportedPrecision ? ' At most 8 decimals are supported.' : ''}`);
    if (seen.has(id)) issue('CSV_DUPLICATE', `Row ${index + 2}: duplicate ${id}; no automatic deduplication.`);
    seen.add(id);
    if (amount !== null && unit && supportedPrecision) {
      totals.set(unit, (totals.get(unit) ?? 0n) + amount);
    }
  }
  if (totals.size > 1) issues.push({ code: 'CSV_MIXED_UNITS', sectionId: source.sectionId, sourceId: source.id, message: 'Multiple units; cross-unit total is undefined.' });
  if (!invalid) for (const [unit, sum] of totals) {
    const result = formatDecimal(sum, 8);
    calculations.push({ sectionId: source.sectionId, expression: `${source.id}: sum(${fields.amount}) grouped by ${fields.unit}=${unit}; all ${rows.length} rows retained`, result });
  }
}

export function hasVersionEvidence(content: string): boolean {
  return content.includes(declarationId) && load(content)(`[id="${declarationId}"]`).length > 0;
}

export async function freezeVersionEvidence(html: string, versionId: string, contentDigest: string,
  readSource: (path: string, expectedDigest: string) => Promise<Buffer>, resources?: MokinaQualitySnapshot['resources']): Promise<string> {
  if (!hasVersionEvidence(html)) return html;
  const $ = load(html, { sourceCodeLocationInfo: true }); const declarations = $(`[id="${declarationId}"]`);
  if (!declarations.length) return html;
  $(`[id="${snapshotId}"], [data-mokina-evidence-appendix]`).remove();
  const frozenBodyDigest = sha($.html());
  const record: Omit<MokinaQualitySnapshot, 'fingerprint'> = { schema: 'mokina.quality.v1', versionId, contentDigest, frozenBodyDigest,
    status: 'rules-clear', sources: [], issues: [], calculations: [], ...(resources ? { resources } : {}) };
  try {
    if (declarations.length !== 1 || declarations.attr('type') !== 'application/json') fail('Exactly one JSON evidence declaration required');
    const raw = declarations.text(); if (Buffer.byteLength(raw) > 64 * 1024) fail('Declaration too large');
    const declaration = object(JSON.parse(raw));
    if (declaration.schema !== 'mokina.evidence.v1' || !Array.isArray(declaration.sources) || !declaration.sources.length || declaration.sources.length > 8) fail('Expected 1–8 evidence sources');
    const sources = declaration.sources.map(parseSource);
    if (new Set(sources.map(s => s.id)).size !== sources.length) fail('Duplicate source identity');
    let total = 0;
    for (const source of sources) {
      const entry: MokinaQualitySnapshot['sources'][number] = { ...source }; record.sources.push(entry);
      try {
        const bytes = await readSource(source.path, source.sha256); total += bytes.length;
        if (bytes.length > MAX_BYTES || total > 2 * 1024 * 1024) fail('Evidence exceeds capture size limit');
        const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
        if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) fail('Source SHA-256 changed');
        entry.text = text;
        const chapters = $('[data-mokina-id]').toArray().filter(el => $(el).attr('data-mokina-id') === source.sectionId);
        if (chapters.length !== 1 || $(chapters[0]!).attr('id') !== source.sectionId) fail('Referenced chapter is missing or ambiguous');
        if (source.excerpt && !text.includes(source.excerpt)) fail('Supporting excerpt is not in captured text');
        if (source.csv) inspectCsv(source, text, record.issues, record.calculations);
      } catch (error) {
        entry.error = error instanceof Error ? error.message : String(error);
        record.status = 'incomplete'; record.issues.push({ code: 'SOURCE_UNAVAILABLE', sourceId: source.id, sectionId: source.sectionId, message: entry.error });
      }
    }
    const summaryBindings = inspectBudgetSummaries($);
    for (const message of summaryBindings.warnings) record.issues.push({ code: 'BUDGET_SUMMARY', message });
    for (const [tableIndex, table] of $('[data-mokina-budget]').toArray().entries()) {
      const sectionId = $(table).closest('[data-mokina-id]').attr('data-mokina-id');
      const issue = (code: string, message: string) => record.issues.push({ code, ...(sectionId ? { sectionId } : {}), message });
      const limit = decimal($(table).attr('data-budget-limit') ?? '', 2); const capacity = decimal($(table).attr('data-capacity-hours') ?? '');
      let sum = 0n; let hours = 0n; let valid = true;
      const rows = $(table).find('[data-budget-item]').toArray();
      if (!sectionId || !rows.length || limit === null || capacity === null || limit < 0 || capacity < 0) { issue('BUDGET_INPUT', 'Missing chapter, budget limit, capacity or action rows.'); valid = false; }
      for (const [index, row] of rows.entries()) {
        const cells = ['quantity', 'unit-price', 'amount', 'hours'].map(k => $(row).find(`[data-${k}]`));
        const values = cells.map((c, index) => c.length === 1 ? decimal(c.text(), index === 2 ? 2 : 8) : null);
        if (values.some(v => v === null || v < 0)) { issue('BUDGET_INPUT', `Row ${index + 1}: numbers must be non-negative decimals up to 1e12, at most 8 decimal places (displayed amounts: 2), in one unit.`); valid = false; continue; }
        const [quantity, price, amount, work] = values as [bigint, bigint, bigint, bigint];
        // Both factors have 8 decimals. Round each nonnegative product once to cents.
        const divisor = 100_000_000_000_000n;
        const cents = (quantity * price + divisor / 2n) / divisor;
        const computed = formatDecimal(cents, 2);
        if (cents !== amount) issue('BUDGET_LINE', `Row ${index + 1}: ${formatDecimal(quantity, 8)} × ${formatDecimal(price, 8)} = ${computed}, displayed ${formatDecimal(amount, 2)}.`);
        sum += cents; hours += work;
        record.calculations.push({ sectionId: sectionId ?? '', expression: `Row ${index + 1}: ${formatDecimal(quantity, 8)} × ${formatDecimal(price, 8)}`, result: computed });
      }
      if (valid) {
        for (const summary of summaryBindings.summaries.filter(item => item.index === tableIndex)) {
          const expected = summary.kind === 'total' ? sum : summary.kind === 'remaining' ? limit! - sum : hours;
          const actual = decimal($(summary.node).text(), summary.kind === 'hours' ? 8 : 2);
          if (actual !== expected) issue('BUDGET_SUMMARY', `Budget summary ${summary.kind} for table ${tableIndex} disagrees with calculated value ${formatDecimal(expected, summary.kind === 'hours' ? 8 : 2)}.`);
        }
        if (sum > limit!) issue('BUDGET_EXCEEDED', `Computed ${formatDecimal(sum, 2)} exceeds ${formatDecimal(limit!, 2)}.`);
        if (hours > capacity!) issue('CAPACITY_EXCEEDED', `${formatDecimal(hours, 8)} hours exceeds ${formatDecimal(capacity!, 8)}.`);
        record.calculations.push({ sectionId: sectionId!, expression: 'Computed total / unused budget / internal hours', result: `${formatDecimal(sum, 2)} / ${formatDecimal(limit! - sum, 2)} / ${formatDecimal(hours, 8)}` });
      }
    }

    for (const ratio of $('[data-mokina-ratio]').toArray()) {
      const sectionId = $(ratio).closest('[data-mokina-id]').attr('data-mokina-id');
      const values = ['numerator', 'denominator', 'ratio-result'].map(key => {
        const cell = $(ratio).find(`[data-${key}]`); return cell.length === 1 ? number(cell.text()) : null;
      });
      const [numerator, denominator, claimed] = values;
      if (!sectionId || numerator == null || denominator == null) record.issues.push({ code: 'RATIO_INPUT', ...(sectionId ? { sectionId } : {}), message: 'Ratio inputs or chapter missing.' });
      else if (denominator === 0) record.issues.push({ code: 'ZERO_DENOMINATOR', sectionId, message: 'Zero denominator: ratio is undefined, never zero or infinity.' });
      else {
        const result = Number((numerator / denominator).toFixed(8));
        record.calculations.push({ sectionId, expression: `${numerator} / ${denominator} (decimal, not percent)`, result: String(result) });
        if (claimed == null || Math.abs(result - claimed) > 0.00000001) record.issues.push({ code: 'RATIO_RESULT', sectionId, message: `Expected decimal ratio ${result}; percentage display is a separate presentation.` });
      }
    }
    if (!record.calculations.length) record.issues.push({ code: 'NO_CALCULATION', message: 'No valid budget, CSV or ratio calculation completed. Numerical claims remain unchecked.' });
  } catch (error) { record.status = 'incomplete'; record.issues.push({ code: 'DECLARATION_INVALID', message: error instanceof Error ? error.message : String(error) }); }
  if (record.status !== 'incomplete' && record.issues.length) record.status = 'issues';
  const snapshot: MokinaQualitySnapshot = { ...record, fingerprint: sha(JSON.stringify(record)) };
  // Reserved records are daemon-owned; never trust an agent-authored inspection.
  $(`[id="${snapshotId}"], [data-mokina-evidence-appendix]`).remove();
  const json = JSON.stringify(snapshot).replaceAll('<', '\\u003c');
  $('body').append(`<script type="application/json" id="${snapshotId}">${json}</script><details data-mokina-evidence-appendix><summary>Evidence / calculations · ${escape(record.status)}</summary><p>Version ${escape(versionId)} · ${escape(contentDigest)}. Rule checks only; not professional approval. URLs and method usage are declared, not independently verified.</p>${record.issues.map(i => `<p>${escape(i.code)}: ${escape(i.message)}</p>`).join('')}${record.calculations.map(c => `<p>${escape(c.expression)} = ${escape(c.result)}</p>`).join('')}${record.sources.map(s => `<details><summary>${escape(s.id)} · ${escape(s.kind)} · ${escape(s.path)}</summary><p>${escape(s.locator)} · ${escape(s.limitation)} · SHA-256 ${s.sha256}</p><pre>${escape(s.text ?? s.error ?? '')}</pre></details>`).join('')}</details>`);
  return $.html();
}

export function readVersionEvidence(content: string, frozen: string | undefined, versionId: string, contentDigest: string, options: { neverCaptured?: boolean } = {}): MokinaQualitySnapshot {
  const empty = { schema: 'mokina.quality.v1' as const, versionId, contentDigest, status: 'unreviewed' as const, sources: [], issues: [], calculations: [], fingerprint: '' };
  if (!hasVersionEvidence(content)) return empty;
  if (!frozen && options.neverCaptured) return { ...empty, status: 'incomplete', issues: [{ code: 'EVIDENCE_NOT_CAPTURED', message: 'This version did not capture evidence. Original content is readable; current sources will not be substituted.' }] };
  if (!frozen) fail('Version evidence snapshot unavailable; current sources will not be substituted');
  const $ = load(frozen);
  const nodes = $(`[id="${snapshotId}"]`);
  if (nodes.length !== 1) fail('Version evidence snapshot missing or duplicated');
  const { fingerprint, ...record } = object(JSON.parse(nodes.text()));
  if (record.schema !== 'mokina.quality.v1' || record.versionId !== versionId || record.contentDigest !== contentDigest
    || fingerprint !== sha(JSON.stringify(record)) || !Array.isArray(record.sources) || !Array.isArray(record.issues) || !Array.isArray(record.calculations)) fail('Version evidence integrity mismatch');
  if (!['incomplete', 'issues', 'rules-clear'].includes(String(record.status))) fail('Invalid inspection status');
  if (record.resources !== undefined) {
    const resources = object(record.resources);
    if (!['complete', 'incomplete'].includes(String(resources.status)) || !Array.isArray(resources.reasons) || resources.reasons.some(reason => typeof reason !== 'string')) fail('Invalid resource capture state');
  }
  for (const value of record.sources) {
    const source = parseSource(value); const entry = object(value);
    if (typeof entry.text === 'string' && sha(entry.text) !== source.sha256) fail('Evidence source bytes disagree with digest');
    if (entry.text === undefined && typeof entry.error !== 'string') fail('Evidence source closure missing');
  }
  $(`[id="${snapshotId}"], [data-mokina-evidence-appendix]`).remove();
  if (record.frozenBodyDigest !== sha($.html())) fail('Frozen evidence body integrity mismatch');
  return { ...record, fingerprint } as unknown as MokinaQualitySnapshot;
}
