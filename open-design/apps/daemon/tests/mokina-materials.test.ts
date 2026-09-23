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
    expect(material.sections).toEqual([
      { location: '预算!A1', text: '渠道' },
      { location: '预算!C1', text: '100' },
    ]);
    expect(material.status).toBe('partial');
    expect(material.limitations.some((item) => item.includes('预算!B1'))).toBe(true);
  });

  it('extracts slide text with a slide location and flags unreadable slides', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide2.xml', '<p:sld xmlns:p="p" xmlns:a="a"><p:sp><p:txBody><a:p><a:r><a:t>目标人群</a:t></a:r></a:p></p:txBody></p:sp></p:sld>');
    const material = await readMokinaMaterial('brief.pptx', await zip.generateAsync({ type: 'nodebuffer' }));
    expect(material.sections).toEqual([{ location: '幻灯片 2 / 文本块 1', text: '目标人群' }]);
  });
});
