import { MOKINA_SPLASH_MARK } from './mokina-brand.js';

export function mokinaPendingHtml(): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html><head><meta charset="utf-8"><title>Mokina</title><style>
html,body{margin:0;height:100%;background:#f5f5f5;color:#111;color-scheme:light}
body{display:flex;align-items:center;justify-content:center;font:14px/22px system-ui,-apple-system,sans-serif}
.brand svg{width:88px;height:94px;display:block}.stage{position:fixed;bottom:56px;left:24px;right:24px;text-align:center;color:#595959}
</style></head><body><div class="brand">${MOKINA_SPLASH_MARK}</div>
<div class="stage" role="status" aria-live="polite" aria-atomic="true" id="boot-stage-text">Starting Mokina</div>
<script>window.__odSplashSetStage=function(info){var label=typeof info==='string'?info:info&&info.label;var node=document.getElementById('boot-stage-text');if(node&&label&&node.textContent!==label)node.textContent=label;};</script>
</body></html>`)}`;
}

/** Local recovery keeps diagnostics export; no upstream report/login links. */
export function mokinaCrashHtml(): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><title>Mokina</title><style>
body{background:#f5f5f5;color:#111;font:15px/1.9 system-ui;margin:0;padding:48px;color-scheme:light}h1{font-size:28px;line-height:36px}button{background:#0071e3;color:white;border:0;border-radius:10px;min-height:44px;padding:8px 16px;font:14px/22px system-ui}button:focus-visible{outline:2px solid #0071e3;outline-offset:2px}
</style></head><body><h1>Mokina keeps closing on this device</h1><p>The app paused after repeated crashes. It will try to recover automatically. You can save local diagnostic logs or quit and restart Mokina.</p><button id="logs">Save logs…</button><p role="status" id="status"></p><script>
var logs=document.getElementById('logs'),status=document.getElementById('status'),diag=window.openDesignDesktop;
if(diag&&typeof diag.exportDiagnostics==='function'){logs.onclick=function(){logs.disabled=true;status.textContent='Saving logs…';Promise.resolve(diag.exportDiagnostics()).then(function(r){status.textContent=r&&r.ok?'Logs saved.':r&&r.cancelled?'':'Could not save logs.';}).catch(function(){status.textContent='Could not save logs.';}).finally(function(){logs.disabled=false;});};}else{logs.hidden=true;}
</script></body></html>`)}`;
}
