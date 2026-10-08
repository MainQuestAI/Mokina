import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const ownerRequire = createRequire(require.resolve('pptxgenjs'));
const parserPath = ownerRequire.resolve('image-size');
const execFileAsync = promisify(execFile);

function malformedContainers() {
  const icns = Buffer.alloc(24);
  icns.write('icns'); icns.writeUInt32BE(24, 4); icns.write('icp4', 8);
  const heif = Buffer.alloc(32);
  heif.writeUInt32BE(16); heif.write('ftyp', 4); heif.write('heic', 8);
  heif.write('free', 20); // zero-sized box must not keep the scan at offset 16
  const jxl = Buffer.alloc(40);
  jxl.writeUInt32BE(12); jxl.write('JXL ', 4);
  jxl.set([13, 10, 135, 10], 8);
  jxl.writeUInt32BE(16, 12); jxl.write('ftyp', 16); jxl.write('jxl ', 20);
  jxl.write('jxlp', 32); // a recognized zero-sized partial stream must advance
  return { icns, heif, jxl };
}

for (const [format, bytes] of Object.entries(malformedContainers())) {
  test(`[P1] owner image parser rejects zero-sized ${format} boxes without hanging`, async () => {
    const script = `const p=require(${JSON.stringify(parserPath)});try{(p.imageSize||p)(Buffer.from(${JSON.stringify(bytes.toString('base64'))},'base64'));process.stdout.write('accepted')}catch(e){process.stdout.write('rejected')}`;
    // A vulnerable parser can hang the event loop. Only the isolated child is
    // terminated at the deadline; the daemon/test runner must remain healthy.
    const result = await execFileAsync(process.execPath, ['-e', script], { timeout: 3_000 });
    expect(result.stdout).toBe('rejected');
  });
}

test('[P1] owner parser and PptxGenJS still export a normal PNG', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const parser = ownerRequire('image-size');
  expect((parser.imageSize ?? parser)(png)).toMatchObject({ width: 1, height: 1, type: 'png' });
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.addSlide().addImage({ data: `image/png;base64,${png.toString('base64')}`, x: 1, y: 1, w: 1, h: 1 });
  const bytes = await pptx.write({ outputType: 'nodebuffer' });
  const zip = await require('jszip').loadAsync(bytes);
  const image = zip.file('ppt/media/image-1-1.png');
  expect(image, 'export must contain the original image').toBeTruthy();
  expect(await image.async('nodebuffer')).toEqual(png);
});
