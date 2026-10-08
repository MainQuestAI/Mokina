import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const desktopRoot = fileURLToPath(new URL('../../', import.meta.url));
const execFileAsync = promisify(execFile);

// Runs the compiled production renderer in Electron, then embeds its actual
// viewport images in a PDF. The caller builds desktop before running this suite.
test('[P1] page PDF hides scrollbar paint without changing layout or losing scroll content', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'mokina-pdf-capture-'));
  const renderer = pathToFileURL(join(desktopRoot, 'dist/main/deck-capture.js')).href;
  const daemonManifest = fileURLToPath(new URL('../../../daemon/package.json', import.meta.url));
  await writeFile(join(scratch, 'package.json'), JSON.stringify({ main: 'main.cjs' }));
  await writeFile(join(scratch, 'main.cjs'), `
const { app, BrowserWindow, nativeImage } = require('electron');
const { createRequire } = require('node:module');
const { writeFile } = require('node:fs/promises');
const { PDFDocument } = createRequire(${JSON.stringify(daemonManifest)})('pdf-lib');
app.on('window-all-closed', () => {});
const html = '<!doctype html><style>html{overflow-y:scroll}body{margin:0;display:flow-root}::-webkit-scrollbar{width:14px;background:rgb(255,0,255)}::-webkit-scrollbar-thumb,::-webkit-scrollbar-track{background:rgb(255,0,255)}main{height:1800px;display:flow-root;background:#e0f0ff}header{position:fixed;top:0}aside{position:sticky;top:20px}.reveal{opacity:0}.seen{opacity:1}</style><main><header>Fixed header</header><aside>Sticky text</aside><p>First page</p><div style="position:absolute;top:100px;left:400px;width:150px;height:150px;overflow-y:scroll"><div style="height:400px">Nested scrollbar</div></div><img loading="lazy" style="position:absolute;top:650px;width:24px;height:24px" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22%3E%3Crect width=%2224%22 height=%2224%22 fill=%22green%22/%3E%3C/svg%3E"><p class="reveal" style="position:absolute;top:1300px">Last page revealed</p></main><script>new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add("seen")})).observe(document.querySelector(".reveal"));</script>';
app.whenReady().then(async () => {
  const { renderDeckSlides } = await import(${JSON.stringify(renderer)});
  let geometry;
  const capture = BrowserWindow.prototype.setContentSize;
  BrowserWindow.prototype.setContentSize = function(w,h) {
    const result = capture.call(this,w,h);
    const wc = this.webContents;
    if (!wc.__probe) {
      wc.__probe = true;
      const run = wc.executeJavaScript.bind(wc);
      wc.executeJavaScript = async (source, ...args) => {
        const result = await run(source, ...args);
        if (source.includes('Math.ceil(Math.max(document.documentElement.scrollHeight')) {
          geometry = await run('({width:document.documentElement.clientWidth,height:document.documentElement.scrollHeight,revealed:document.querySelector(".reveal").classList.contains("seen"),images:Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0),fixed:getComputedStyle(document.querySelector("header")).position,sticky:getComputedStyle(document.querySelector("aside")).position,scrollable:document.documentElement.scrollHeight>innerHeight})');
        }
        return result;
      };
    }
    return result;
  };
  const control = new BrowserWindow({show:false,useContentSize:true,width:800,height:600});
  await control.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  control.setOpacity(0);
  control.showInactive();
  await control.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const before = await control.webContents.executeJavaScript('({width:document.documentElement.clientWidth,height:document.documentElement.scrollHeight})');
  const controlImage = await control.webContents.capturePage();
  await writeFile(${JSON.stringify(join(scratch, 'control.png'))}, controlImage.toPNG());
  const controlBitmap = controlImage.toBitmap();
  let controlScrollbarPixels=0;
  for(let i=0;i<controlBitmap.length;i+=4) if(controlBitmap[i]>200&&controlBitmap[i+1]<100&&controlBitmap[i+2]>200) controlScrollbarPixels++;
  control.destroy();
  const result = await renderDeckSlides({html,deck:false,paginate:true,width:800,height:600,pageImageFormat:'png'});
  if(!result.ok) throw new Error(JSON.stringify(result));
  const pdf = await PDFDocument.create();
  let scrollbarPixels = 0;
  for (const slide of result.slides) {
    const bytes=Buffer.from(slide.split(',')[1],'base64');
    await writeFile(${JSON.stringify(join(scratch, 'capture.png'))},nativeImage.createFromBuffer(bytes).toPNG());
    const bitmap=nativeImage.createFromBuffer(bytes).toBitmap();
    for(let i=0;i<bitmap.length;i+=4) if(bitmap[i]>200&&bitmap[i+1]<100&&bitmap[i+2]>200) scrollbarPixels++;
    const image=slide.startsWith('data:image/jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    pdf.addPage([800,600]).drawImage(image,{x:0,y:0,width:800,height:600});
  }
  const bytes=await pdf.save();
  await writeFile(${JSON.stringify(join(scratch, 'actual.pdf'))},bytes);
  const parsed=await PDFDocument.load(bytes);
  process.stdout.write('MOKINA_PDF:'+JSON.stringify({before,geometry,controlSample:Array.from(controlBitmap.subarray(controlBitmap.length-4)),controlScrollbarPixels,scrollbarPixels,pages:parsed.getPageCount(),signature:Buffer.from(bytes).subarray(0,5).toString()})+'\\n');
  app.quit();
}).catch(error=>{console.error(error);app.exit(1)});
`);
  let passed = false;
  try {
    const relative = (await readFile(join(desktopRoot, 'node_modules/electron/path.txt'), 'utf8')).trim();
    const electron = join(desktopRoot, 'node_modules/electron/dist', relative);
    const args = [scratch, '--no-sandbox', '--disable-gpu'];
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const { stdout } = await execFileAsync(process.platform === 'linux' ? 'xvfb-run' : electron,
      process.platform === 'linux' ? ['-a', electron, ...args] : args, { env, timeout: 60_000 });
    const line = stdout.split('\n').find(value => value.startsWith('MOKINA_PDF:'));
    expect(line, stdout).toBeTruthy();
    const result = JSON.parse(line!.slice('MOKINA_PDF:'.length));
    console.info(result);
    expect(result.controlScrollbarPixels, 'control must actually paint scrollbar chrome').toBeGreaterThan(0);
    expect(result.scrollbarPixels, 'scrollbar chrome must not be embedded in PDF').toBe(0);
    expect(result.geometry).toMatchObject({ ...result.before, revealed: true, images: true, fixed: 'fixed', sticky: 'sticky', scrollable: true });
    expect(result.pages).toBe(3);
    expect(result.signature).toBe('%PDF-');
    passed = true;
  } finally {
    if (passed) await rm(scratch, { recursive: true, force: true });
    else console.error(`PDF probe evidence retained: ${scratch}`);
  }
}, 65_000);
