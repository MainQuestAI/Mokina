import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { readMokinaMaterial } from '../src/mokina/materials.js';

describe('Mokina material extraction', () => {
  it('keeps spreadsheet cell positions and does not invent an uncached formula result', async () => {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="预算" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>渠道</t></is></c><c r="B1"><f>SUM(B2:B3)</f></c><c r="C1"><v>100</v></c></row></sheetData></worksheet>');
    const material = await readMokinaMaterial('budget.xlsx', await zip.generateAsync({ type: 'nodebuffer' }));
    expect(material.sections).toMatchObject([
      { location: '预算!A1', text: '渠道', groupId: 'sheet:0:rows:0' },
      { location: '预算!C1', text: '100', groupId: 'sheet:0:rows:0' },
    ]);
    expect(material.status).toBe('partial');
    expect(material.limitations.some((item) => item.includes('预算!B1'))).toBe(true);
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
});
