import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {productCopy} from './product-copy.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../..');
const marketing=process.argv.includes('--marketing');
const out=path.join(root,'output/demo-spacemaster-v6');
const parts=['data','core','illustrations','engine','render','modals','export','app','auto'];
const data={images:Object.fromEntries(['front','angle','right'].map(k=>[k,'data:image/webp;base64,'+fs.readFileSync(path.join(root,`public/gtm-product/mdrs761mym45a-${k}.webp`)).toString('base64')])),logo:'data:image/webp;base64,'+fs.readFileSync(path.join(root,'public/gtm-product/midea-logo.webp')).toString('base64')};
data.scenarios=Object.fromEntries([['dishwasher','mdwps1401kss-front.webp'],['air-fryer','xpress-chef-pro-front.webp']].map(([id,file])=>[id,'data:image/webp;base64,'+fs.readFileSync(path.join(root,'public/gtm-product',file)).toString('base64')]));
data.actionIcons=Object.fromEntries(fs.readdirSync(path.join(root,'public/gtm-icons')).filter(n=>n.endsWith('.svg')).map(n=>[n.slice(0,-4),fs.readFileSync(path.join(root,'public/gtm-icons',n),'utf8').replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'')]));
data.lilithMark=fs.readFileSync(path.join(root,'public/gtm-brand/lilith-logo-mark.svg'),'utf8');
const imageDir=path.join(root,'public/demo-spacemaster-v6');
data.demoImages=JSON.parse(fs.readFileSync(path.join(imageDir,'manifest.json'),'utf8'));
fs.mkdirSync(path.join(imageDir,'payloads'),{recursive:true});
for(const f of data.demoImages){
  f.previewURL='data:image/jpeg;base64,'+fs.readFileSync(path.join(imageDir,f.preview)).toString('base64');
  f.mime=f.file.endsWith('.png')?'image/png':'image/jpeg';
  fs.writeFileSync(path.join(imageDir,'payloads',f.id+'.js'),'window.DEMO_ORIGINALS??={};window.DEMO_ORIGINALS['+JSON.stringify(f.id)+']='+JSON.stringify('data:'+f.mime+';base64,'+fs.readFileSync(path.join(imageDir,f.file)).toString('base64'))+';');
}
const fonts=[['Light',300],['Book',400],['Medium',500],['Bold',700]].map(([name,weight])=>`@font-face{font-family:"HCo Gotham";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(root,`public/gtm-fonts/Gotham-${name}_Web.woff2`)).toString('base64')}) format("woff2");}`).join('\n');
const vendor=fs.readFileSync(path.join(root,'vendor/pretext.js'),'utf8').replace(/export\{([^}]+)\};?\s*$/,(_,items)=>'window.Pretext={'+items.split(',').map(p=>{const[v,k]=p.trim().split(' as ');return `${k||v}:${v}`}).join(',')+'};');
const css=fonts+'\n'+['base/tokens.css','base/ui.css','merged.css','experience.css','shell.css','navigation.css','visual.css','artifact-workspace.css','demo-images.css','image-production.css','decision-ui.css','workspace-refinement.css','project-input.css','decision-refinement.css','workflow-branches.css'].map(n=>fs.readFileSync(path.join(dir,n),'utf8')).join('\n');
const js='window.MERGED_ASSETS='+JSON.stringify(data)+';\n'+parts.map(n=>productCopy(fs.readFileSync(path.join(dir,`base/${n}.js`),'utf8'))).join('\n')+'\n'+['merged.js','experience.js','yolo.js','scenarios.js','shell.js','demo-input.js','artifact-workspace.js','demo-content.js','demo-images.js','demo-story.js','image-production.js','unified-plan.js','decision-ui.js','workspace-refinement.js','project-input.js','decision-refinement.js','workflow-branches.js','release-policy.js'].map(n=>productCopy(fs.readFileSync(path.join(dir,n),'utf8'))).join('\n')+'\ninitializeConversationEntry();render();persist();';
const extension=marketing?['model.js','scenes.js','contracts.js','workspace.js'].map(n=>fs.readFileSync(path.join(root,'src/marketing-desktop',n),'utf8')).join('\n'):'';
const builtJS=marketing?'window.MARKETING_DESKTOP=true;\n'+js.replace('initializeConversationEntry();render();persist();',extension+'\nMD.boot();render();persist();'):js;
const builtCSS=css+(marketing?'\n'+fs.readFileSync(path.join(root,'src/marketing-desktop/extension.css'),'utf8'):'');
new vm.Script(builtJS);new vm.Script(vendor);
const html=`<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><link rel="icon" href="data:,"><title>Lilith · Midea Workspace v5</title><style>${css}</style></head><body><a class="skip-link" href="#main-work">跳到工作区</a><div id="app"></div><div id="modal-root"></div><div id="toast" class="toast" role="status" aria-live="polite" hidden></div><input id="file-input" type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.docx,image/png,image/jpeg,image/webp" hidden><script>${vendor.replaceAll('</script','<\\/script')}</script><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`;
fs.mkdirSync(out,{recursive:true});
const releaseVersion=marketing?JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version:'6.2.0';
const demoHTML=html.replace('<title>Lilith · Midea Workspace v5</title>',marketing?`<title>Lilith · Marketing Desktop 原型</title><meta name="application-version" content="${releaseVersion}">`:'<title>Lilith SpaceMaster V6.2</title><meta name="application-version" content="6.2.0">').replace(css,builtCSS).replace(js.replaceAll('</script','<\\/script'),builtJS.replaceAll('</script','<\\/script'));
if(marketing){fs.writeFileSync(path.join(root,'Marketing Desktop Demo.html'),demoHTML);console.log('Built Marketing Desktop from V6.2 source');process.exit(0);}
fs.writeFileSync(out+'/finalized.html',demoHTML);
// The copied release HTML is an immutable comparison baseline.
console.log(JSON.stringify({output:out+'/finalized.html',bytes:Buffer.byteLength(html),sourceModules:parts.length+1}));
