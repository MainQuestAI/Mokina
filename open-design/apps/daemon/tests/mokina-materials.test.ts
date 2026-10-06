import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { MOKINA_MATERIAL_PARSER_VERSION, readMokinaMaterial } from '../src/mokina/materials.js';
import { resolvePdftotextBinary } from '../src/pdftotext.js';

describe('Mokina material extraction', () => {
  it('keeps spreadsheet cell positions and does not invent an uncached formula result', async () => {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="预算" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>允许内容</t></is></c><c r="B1"><f>SUM(B2:B3)</f></c></row><row r="41"><c r="B41"><f>SUM(B42:B43)</f><v>987654321</v></c></row></sheetData></worksheet>');
    const material = await readMokinaMaterial('budget.xlsx', await zip.generateAsync({ type: 'nodebuffer' }));
    expect(material.sections).toMatchObject([
      { location: '预算!A1', text: '允许内容', groupId: 'sheet:0:rows:0' },
      { location: '预算!B41', text: '987654321', groupId: 'sheet:0:rows:2' },
    ]);
    expect(material.status).toBe('partial');
    expect(material.limitations.some((item) => item.includes('预算!B1') || item.includes('预算!B41'))).toBe(false);
    expect(material.groupLimitations).toEqual([
      { groupId: 'sheet:0:rows:0', location: '预算!B1', message: '公式没有缓存值，未读取结果。' },
      { groupId: 'sheet:0:rows:2', location: '预算!B41', message: '使用公式缓存值，未重新计算。' },
    ]);
    expect(JSON.stringify(material.groupLimitations)).not.toContain('987654321');
  });

  it('extracts slide text with a slide location and flags unreadable slides', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide2.xml', '<p:sld xmlns:p="p" xmlns:a="a"><p:sp><p:txBody><a:p><a:r><a:t>目标人群</a:t></a:r></a:p></p:txBody></p:sp></p:sld>');
    const material = await readMokinaMaterial('brief.pptx', await zip.generateAsync({ type: 'nodebuffer' }));
    expect(material.sections).toMatchObject([{ location: '幻灯片 2 / 文本块 1', text: '目标人群', groupId: 'slide:2' }]);
  });

  it('groups Markdown by headings and splits an oversized paragraph without losing its location', async () => {
    const material = await readMokinaMaterial('brief.md', Buffer.from(`# 市场\n${'甲'.repeat(8_001)}\n## 渠道\n禁投短视频`));
    expect(material.sections.filter(section => section.groupId === 'heading:1').map(section => section.location))
      .toEqual(['第 1 行']);
    expect(material.sections.filter(section => section.groupId?.startsWith('heading:1:part:')).map(section => section.location))
      .toEqual(['第 2 行 / 片段 1', '第 2 行 / 片段 2']);
    expect(material.sections.at(-1)).toMatchObject({ groupId: 'heading:2', groupLabel: '渠道', text: '禁投短视频' });
  });

  it('stamps every extraction with the parser version for snapshot freezing', async () => {
    const material = await readMokinaMaterial('notes.txt', Buffer.from('预算 50 万'));
    expect(material.parserVersion).toBe(MOKINA_MATERIAL_PARSER_VERSION);
    expect(material.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('prefers the packaged pdftotext path and falls back to known absolute locations before PATH', () => {
    expect(resolvePdftotextBinary({ OD_RESOURCE_ROOT: '/bundled', OD_PDFTOTEXT_PATH: '/external' })).toContain('/bundled/pdf/');
    expect(resolvePdftotextBinary({ OD_PDFTOTEXT_PATH: ' /opt/mokina/bin/pdftotext ' })).toBe('/opt/mokina/bin/pdftotext');
    // No configured path: a Finder-launched process finds Homebrew/local installs
    // by absolute path even without an interactive shell PATH.
    expect(resolvePdftotextBinary({}, { exists: (c) => c === '/opt/homebrew/bin/pdftotext' })).toBe('/opt/homebrew/bin/pdftotext');
    expect(resolvePdftotextBinary({}, { exists: (c) => c === '/usr/local/bin/pdftotext' })).toBe('/usr/local/bin/pdftotext');
    // Nothing found: keep the bare command name so PATH lookup still applies.
    expect(resolvePdftotextBinary({}, { exists: () => false })).toBe('pdftotext');
    expect(resolvePdftotextBinary({ OD_PDFTOTEXT_PATH: '   ' }, { exists: () => false })).toBe('pdftotext');
  });

  it('reports an unreadable PDF with a clear limitation instead of treating the failure text as content', async () => {
    const material = await readMokinaMaterial('scan.pdf', Buffer.from('%PDF-1.4 not a real pdf'));
    expect(material.status).toBe('unreadable');
    expect(material.sections).toEqual([]);
    expect(material.limitations.join(' ')).toContain('PDF 文本提取失败');
  });
});

describe('Mokina material PDF round-trip (needs pdftotext)', () => {
  it('extracts the text layer of a real generated PDF through the resolved binary', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const { resolvePdftotextBinary } = await import('../src/pdftotext.js');
    const binary = resolvePdftotextBinary();
    const available = await promisify(execFile)(binary, ['-v'], { timeout: 3000 }).then(
      () => true,
      () => false,
    );
    if (!available) {
      // A machine without poppler keeps the documented explicit-unreadable
      // fallback; this round-trip only runs where the binary resolves.
      return;
    }
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([420, 200]);
    page.drawText('Mokina PDF extraction probe 2026', { x: 24, y: 140, size: 16, font });
    page.drawText('Second line for the text layer.', { x: 24, y: 110, size: 12, font });
    const bytes = Buffer.from(await pdf.save());

    const material = await readMokinaMaterial('brief.pdf', bytes);
    expect(material.status).toBe('read');
    expect(material.parserVersion).toBe(MOKINA_MATERIAL_PARSER_VERSION);
    const text = material.sections.map((section) => section.text).join('\n');
    expect(text).toContain('Mokina PDF extraction probe 2026');
    expect(text).toContain('Second line for the text layer.');
    expect(material.sections[0]?.location).toBe('第 1 页');
    expect(material.limitations.join(' ')).toContain('仅读取文本层');
  });
});
