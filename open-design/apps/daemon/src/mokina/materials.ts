import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import { load } from 'cheerio';
export interface MokinaMaterial {
  name: string;
  contentDigest: string;
  status: 'read' | 'partial' | 'unreadable';
  limitations: string[];
  sections: Array<{ location: string; text: string }>;
}

export async function readMokinaMaterial(name: string, buffer: Buffer): Promise<MokinaMaterial> {
  const result: MokinaMaterial = { name, contentDigest: createHash('sha256').update(buffer).digest('hex'), status: 'read', limitations: [], sections: [] };
  if (buffer.length > 10 * 1024 * 1024) throw new Error('资料超过 10 MB 读取限制');
  const ext = path.extname(name).toLowerCase();
  const add = (location: string, text: string) => { if (text.trim()) result.sections.push({ location, text }); };
  if (['.txt', '.md', '.csv'].includes(ext)) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    text.split(/\r?\n/).forEach((line, i) => add(`第 ${i + 1} 行`, line));
    if (ext === '.csv') result.limitations.push('保留 CSV 原始字段与行号；不自动推断数值单位或日期。');
  } else if (ext === '.pdf') {
    const directory = await mkdtemp(path.join(tmpdir(), 'mokina-material-'));
    try {
      const file = path.join(directory, 'source.pdf'); await writeFile(file, buffer);
      const { stdout } = await promisify(execFile)('pdftotext', ['-layout', file, '-'], { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 });
      const pages = stdout.split('\f'); if (!pages.at(-1)?.trim()) pages.pop();
      pages.forEach((page, i) => { if (!page.trim()) { result.status = 'partial'; result.limitations.push(`第 ${i + 1} 页没有可读文本，未进行 OCR。`); } else add(`第 ${i + 1} 页`, page.trim()); });
      result.limitations.push('仅读取文本层；图片、扫描页和复杂图表未识别。');
    } catch { result.status = 'unreadable'; result.limitations.push('PDF 文本提取失败；请检查 pdftotext，或提供文本版本。'); }
    finally { await rm(directory, { recursive: true, force: true }); }
  } else if (['.docx', '.xlsx', '.pptx'].includes(ext)) {
    const zip = await JSZip.loadAsync(buffer);
    let total = 0;
    for (const entry of Object.values(zip.files)) {
      const size = (entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
      total += size; if (size > 5 * 1024 * 1024 || total > 50 * 1024 * 1024) throw new Error('解压后的资料超过读取限制');
    }
    const xml = async (file: string) => {
      const entry = zip.file(file); if (!entry) throw new Error(`资料缺少 ${file}`);
      const text = await entry.async('text');
      if (text.length > 5 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('不支持的 XML 内容');
      return load(text, { xmlMode: true });
    };
    if (ext === '.docx') {
      const $ = await xml('word/document.xml'); let paragraph = 0; let table = 0;
      $('w\\:body').children().each((_i, element) => {
        if (element.tagName === 'w:p') add(`正文段落 ${++paragraph}`, $(element).find('w\\:t').map((_j, t) => $(t).text()).get().join(''));
        if (element.tagName === 'w:tbl') {
          table++;
          $(element).find('w\\:tr').each((row, tr) => {
            $(tr).children('w\\:tc').each((col, td) => add(`表 ${table} / 行 ${row + 1} / 列 ${col + 1}`, $(td).find('w\\:t').map((_j, t) => $(t).text()).get().join('')));
          });
        }
      });
      result.limitations.push('读取正文与基本表格；未读取页眉页脚、批注、图片及复杂排版。');
    } else if (ext === '.pptx') {
      const slides = Object.keys(zip.files)
        .filter(file => /^ppt\/slides\/slide\d+\.xml$/i.test(file))
        .sort((a, b) => Number(a.match(/slide(\d+)\.xml$/i)?.[1] ?? 0)
          - Number(b.match(/slide(\d+)\.xml$/i)?.[1] ?? 0));
      for (const file of slides) {
        const $ = await xml(file);
        const slide = file.match(/slide(\d+)\.xml$/i)?.[1] ?? '?';
        $('p\\:sp').each((index, shape) => {
          const text = $(shape).find('a\\:t').map((_i, run) => $(run).text()).get().join(' ');
          add(`幻灯片 ${slide} / 文本块 ${index + 1}`, text);
        });
      }
      result.limitations.push('仅读取幻灯片文本块；图片、图表和备注未作为事实读取。');
    } else {
      const workbook = await xml('xl/workbook.xml'); const rels = await xml('xl/_rels/workbook.xml.rels');
      const shared = zip.file('xl/sharedStrings.xml') ? await xml('xl/sharedStrings.xml') : null;
      const styles = zip.file('xl/styles.xml') ? await xml('xl/styles.xml') : null;
      const formats = styles ? styles('cellXfs xf').toArray().map(xf => Number(styles(xf).attr('numFmtId') ?? 0)) : [];
      const strings = shared ? shared('si').map((_i, si) => shared(si).find('t').map((_j, t) => shared(t).text()).get().join('')).get() : [];
      for (const sheet of workbook('sheet').toArray()) {
        const title = workbook(sheet).attr('name') ?? '工作表'; const rid = workbook(sheet).attr('r:id');
        const rel = rels('Relationship').toArray().find(e => rels(e).attr('Id') === rid);
        const target = rel ? rels(rel).attr('Target') : undefined;
        if (!target) throw new Error('工作表引用丢失');
        const file = target.startsWith('/') ? target.slice(1) : path.posix.normalize('xl/' + target);
        const $ = await xml(file);
        $('c').each((_i, cell) => {
          const c = $(cell); const location = `${title}!${c.attr('r') ?? '?'}`; const value = c.find('v').text();
          if (c.find('f').length && (!c.find('v').length || !value.trim())) { result.status = 'partial'; result.limitations.push(`${location} 公式没有缓存值，未读取结果。`); return; }
          const formatId = formats[Number(c.attr('s') ?? 0)] ?? 0;
          const customFormat = styles ? styles('numFmt').toArray().find(f => Number(styles(f).attr('numFmtId')) === formatId) : undefined;
          const code = customFormat && styles ? styles(customFormat).attr('formatCode') ?? '' : '';
          const isDate = (formatId >= 14 && formatId <= 22) || (formatId >= 45 && formatId <= 47) || /[ydh]/i.test(code.replace(/"[^"]*"/g, ''));
          if (isDate && value) { add(location, `日期/时间单元格：Excel 序列值 ${value}（格式 ${code || formatId}；未推断时区）`); return; }
          if (c.find('f').length) result.limitations.push(`${location} 使用公式缓存值 ${value}，未重新计算。`);
          add(location, c.attr('t') === 's' ? (value.trim() ? strings[Number(value)] ?? '' : '') : c.attr('t') === 'inlineStr' ? c.find('t').text() : value);
        });
      }
      result.limitations.push('使用已有单元格缓存值，不重新计算公式；图表、图片、样式不作为数据读取。');
    }
  } else throw new Error('支持 TXT、MD、CSV、文本 PDF、DOCX、XLSX 和 PPTX');
  if (!result.sections.length) { result.status = 'unreadable'; result.limitations.push('未提取到可用文本，不能作为事实依据。'); }
  const limit = 150_000; let chars = 0;
  result.sections = result.sections.filter(section => { chars += section.text.length; return chars <= limit; });
  if (chars > limit) { result.status = 'partial'; result.limitations.push('只读取前 150,000 字符范围内的完整段落或单元格。'); }
  return result;
}
