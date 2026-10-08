import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Build-time derivation only; no application reads the spec at runtime. */
export async function generateMokinaBrand(source: string, workspace: string) {
  const web = join(workspace, 'apps/web/public/mokina');
  const native = join(workspace, 'tools/pack/resources/mokina');
  await mkdir(web, { recursive: true });
  await mkdir(join(native, 'Mokina.iconset'), { recursive: true });
  const files: Record<string, string> = {};
  for (const name of (await readdir(source)).filter(name => name.endsWith('.svg')).sort()) {
    const bytes = await readFile(join(source, name));
    const svg = bytes.toString();
    if (/<script|<image|<foreignObject|\son\w+=|(?:href|url)\s*[=(]/i.test(svg)) throw new Error(`Non-self-contained brand SVG: ${name}`);
    await writeFile(join(web, name), bytes);
    files[name] = sha256(bytes);
  }
  const markName = 'mokina-icon-black.svg';
  const mark = await readFile(join(source, markName), 'utf8');
  const sourceHash = sha256(mark);
  const geometry = (svg: string) => {
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = document.documentElement;
    if (!root || root.tagName !== 'svg') throw new Error('Invalid SVG root');
    for (const title of Array.from(root.getElementsByTagName('title'))) title.parentNode?.removeChild(title);
    for (const node of Array.from(root.getElementsByTagName('*'))) node.removeAttribute('id');
    const serializer = new XMLSerializer();
    return Array.from(root.childNodes).map(node => serializer.serializeToString(node)).join('').trim()
      .replace(/\sxmlns="[^"]*"/g, '');
  };
  const inner = geometry(mark);
  const carrier = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect x="40" y="40" width="944" height="944" rx="212" fill="white"/><svg x="190" y="167" width="644" height="690" viewBox="0 0 431 462">${inner}</svg></svg>`;
  const derived: Record<string, string> = {};
  const png = async (size: number) => sharp(Buffer.from(carrier)).resize(size, size).png().toBuffer();
  const save = async (root: string, name: string, bytes: Buffer) => {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), bytes); derived[`${root === web ? 'web' : 'native'}/${name}`] = sha256(bytes);
  };
  await save(web, 'apple-touch-icon.png', await png(180));
  await save(web, 'icon.png', await png(1024));
  await save(native, 'icon.png', await png(1024));
  const chunks: Buffer[] = [];
  for (const [type, size] of [['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024],['ic11',32],['ic12',64],['ic13',256],['ic14',512]] as const) {
    const bytes = await png(size); const header = Buffer.alloc(8);
    header.write(type); header.writeUInt32BE(bytes.length + 8, 4); chunks.push(header, bytes);
  }
  const icnsHeader = Buffer.alloc(8); icnsHeader.write('icns');
  icnsHeader.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
  await save(native, 'icon.icns', Buffer.concat([icnsHeader, ...chunks]));
  for (const size of [16,32,128,256,512]) for (const scale of [1,2]) {
    await save(native, `Mokina.iconset/icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`, await png(size * scale));
  }
  for (const size of [16,20,24,32]) for (const scale of [1,2]) {
    const bytes = await sharp(Buffer.from(mark)).resize(size * scale, size * scale, { fit: 'contain' }).png().toBuffer();
    await save(web, `samples/mark-${size}${scale === 2 ? '@2x' : ''}.png`, bytes);
  }
  const entries = await Promise.all([16,32,48,256].map(png));
  const icoHeader = Buffer.alloc(6 + entries.length * 16); icoHeader.writeUInt16LE(1, 2); icoHeader.writeUInt16LE(entries.length, 4);
  let offset = icoHeader.length;
  entries.forEach((bytes, index) => {
    const size = [16,32,48,256][index]!; const at = 6 + index * 16;
    icoHeader[at] = size % 256; icoHeader[at + 1] = size % 256;
    icoHeader.writeUInt16LE(1, at + 4); icoHeader.writeUInt16LE(32, at + 6);
    icoHeader.writeUInt32LE(bytes.length, at + 8); icoHeader.writeUInt32LE(offset, at + 12); offset += bytes.length;
  });
  await save(native, 'icon.ico', Buffer.concat([icoHeader, ...entries]));
  const manifest = { source: 'Mokina-Brand-UI-Spec-2026-10-08/assets/brand-candidate', status: 'candidate_not_finally_approved', sourceHash, files, derived };
  await writeFile(join(web, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(native, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const shapes = await Promise.all(['mark','wordmark','horizontal'].map(async variant => {
    const svg = await readFile(join(source, `mokina-${variant === 'mark' ? 'icon' : variant}-black.svg`), 'utf8');
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
    if (!viewBox) throw new Error(`Missing viewBox: ${variant}`);
    const shape = geometry(svg).replace(/fill="#[0-9a-f]+"/gi, 'fill="currentColor"').replace(/fill-rule=/g, 'fillRule=');
    return `  ${variant}: { viewBox: ${JSON.stringify(viewBox)}, shape: (${shape}) },`;
  }));
  await writeFile(join(workspace, 'apps/web/src/components/mokina/MokinaBrand.tsx'), `// Generated by tools/pack/src/resources/generate-mokina-brand.ts. Source SHA256: ${sourceHash}
export type MokinaBrandVariant = 'mark' | 'wordmark' | 'horizontal';
const artwork = {\n${shapes.join('\n')}\n} as const;
export function MokinaBrand({ variant = 'mark', size = 24, className, decorative = true }: {
  variant?: MokinaBrandVariant; size?: number; className?: string; decorative?: boolean;
}) {
  const { viewBox, shape } = artwork[variant];
  const [, , width, height] = viewBox.split(' ').map(Number);
  return <svg viewBox={viewBox} width={size * (width ?? 1) / (height ?? 1)} height={size} className={className}
    role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : 'Mokina'}
    focusable="false" style={{ flexShrink: 0, verticalAlign: 'middle' }}>{shape}</svg>;
}\n`);
  await writeFile(join(workspace, 'apps/desktop/src/main/mokina-brand.ts'), `// Generated from the same brand source as the web and native resources.\nexport const MOKINA_BRAND_SOURCE_SHA256 = ${JSON.stringify(sourceHash)};\nexport const MOKINA_SPLASH_MARK = ${JSON.stringify(mark.replace('<svg ', '<svg role="img" aria-label="Mokina" '))};\nexport const MOKINA_NATIVE_ICON_DATA_URL = ${JSON.stringify('data:image/png;base64,' + (await readFile(join(native, 'icon.png'))).toString('base64'))};\n`);
  await writeFile(join(workspace, 'apps/web/public/mokina-icon.svg'), mark);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, workspace] = process.argv.slice(2);
  if (!source || !workspace) throw new Error('Usage: generate-mokina-brand.ts <candidate-svg-directory> <open-design-workspace>');
  await generateMokinaBrand(resolve(source), resolve(workspace));
}
