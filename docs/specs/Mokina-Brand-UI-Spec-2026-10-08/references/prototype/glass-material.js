/* Geometry-bound Web glass: the bitmap is a displacement field, never a backdrop snapshot. */
(() => {
  'use strict';
  const variants = Object.freeze({
    sidebar: { band: 11, lens: 3.3, blur: .4 },
    toolbar: { band: 8, lens: 3.5, blur: .26 },
    menu: { band: 10, lens: 4.4, blur: .42 }
  });
  const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mediaTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const cache = new Map();
  const applied = new Map();
  const pendingResize = new Set();
  let observer, resizeTimer = 0, pointerFrame = 0, pendingPointer = null, active = null;
  let serial = 0;
  const stats = { generated: 0, cacheHits: 0, pointerFrames: 0, cancelledFrames: 0 };

  function reducedMotion() { return mediaMotion.matches || document.body.classList.contains('reduce-motion'); }
  function reducedTransparency() { return mediaTransparency.matches || document.body.classList.contains('reduce-transparency'); }
  function eligible(el) { return el && (document.body.classList.contains('material-stage-one') && el.closest('.shell') || document.body.classList.contains('material-lab') && el.closest('.new') || el.matches('.task-more .popover')); }
  function clearLight(el) { if (el) { el.style.removeProperty('--light-x'); el.style.removeProperty('--light-y'); } }
  function cancelPointer() {
    if (pointerFrame) { cancelAnimationFrame(pointerFrame); pointerFrame = 0; stats.cancelledFrames++; }
    pendingPointer = null;
    clearLight(active);
    active = null;
    document.querySelectorAll('[data-glass]').forEach(clearLight);
  }
  function roundedPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return `M${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h-r}Q${x+w},${y+h} ${x+w-r},${y+h}H${x+r}Q${x},${y+h} ${x},${y+h-r}V${y+r}Q${x},${y} ${x+r},${y}Z`;
  }
  function maskUrl(w, h, radius, band) {
    const inset = .35, inner = band + .35;
    const path = roundedPath(inset, inset, w - 2*inset, h - 2*inset, radius - inset) + roundedPath(inner, inner, w - 2*inner, h - 2*inner, radius - inner);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="soft" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation=".65"/></filter></defs><path d="${path}" fill="white" fill-rule="evenodd" filter="url(#soft)"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  function signedDistance(x, y, w, h, r) {
    const qx = Math.abs(x - w/2) - (w/2-r), qy = Math.abs(y - h/2) - (h/2-r);
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx,0), Math.max(qy,0)) - r;
  }
  function fieldUrl(w, h, r, config) {
    const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:false});
    const image=ctx.createImageData(w,h), data=image.data, scale=12;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const i=(y*w+x)*4, d=-signedDistance(x+.5,y+.5,w,h,r);
      let vx=0,vy=0;
      if(d>=-.5 && d<config.band+2) {
        const gx=signedDistance(x+1.5,y+.5,w,h,r)-signedDistance(x-.5,y+.5,w,h,r);
        const gy=signedDistance(x+.5,y+1.5,w,h,r)-signedDistance(x+.5,y-.5,w,h,r);
        const length=Math.hypot(gx,gy)||1;
        const falloff=Math.max(0,1-Math.max(0,d)/config.band);
        const amount=config.lens*falloff*falloff;
        vx=gx/length*amount; vy=gy/length*amount;
      }
      data[i]=Math.max(0,Math.min(255,Math.round(128+vx*255/scale)));
      data[i+1]=Math.max(0,Math.min(255,Math.round(128+vy*255/scale)));
      data[i+2]=128; data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    return canvas.toDataURL('image/png');
  }
  function defs() {
    let svg=document.querySelector('.glass-filter-defs, .lab-filter-defs');
    if(!svg) { svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.classList.add('glass-filter-defs'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('width','0'); svg.setAttribute('height','0'); svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg','defs')); document.body.prepend(svg); }
    return svg.querySelector('defs');
  }
  function resource(type,w,h,r) {
    const key=`${type}:${w}:${h}:${r}`;
    if(cache.has(key)){stats.cacheHits++;return cache.get(key);}
    const config=variants[type], id=`glass-geometry-${++serial}`;
    const filter=document.createElementNS('http://www.w3.org/2000/svg','filter');
    filter.setAttribute('id',id); filter.setAttribute('x','0');filter.setAttribute('y','0');filter.setAttribute('width','100%');filter.setAttribute('height','100%');filter.setAttribute('color-interpolation-filters','sRGB');
    const image=document.createElementNS('http://www.w3.org/2000/svg','feImage');
    image.setAttribute('href',fieldUrl(w,h,r,config));image.setAttribute('x','0');image.setAttribute('y','0');image.setAttribute('width',String(w));image.setAttribute('height',String(h));image.setAttribute('preserveAspectRatio','none');image.setAttribute('result','field');
    const blur=document.createElementNS('http://www.w3.org/2000/svg','feGaussianBlur');blur.setAttribute('in','SourceGraphic');blur.setAttribute('stdDeviation',String(config.blur));blur.setAttribute('edgeMode','duplicate');blur.setAttribute('result','base');
    const displacement=document.createElementNS('http://www.w3.org/2000/svg','feDisplacementMap');displacement.setAttribute('in','base');displacement.setAttribute('in2','field');displacement.setAttribute('scale','12');displacement.setAttribute('xChannelSelector','R');displacement.setAttribute('yChannelSelector','G');
    filter.append(image,blur,displacement);defs().appendChild(filter);
    const value={id,mask:maskUrl(w,h,r,config.band),filter};cache.set(key,value);stats.generated++;
    if(cache.size>48) for(const [oldKey,old] of cache) { if(cache.size<=40)break; if(![...applied].some(([el,id])=>id===old.id&&el.isConnected)){old.filter.remove();cache.delete(oldKey);} }
    return value;
  }
  function apply(el) {
    if(!eligible(el))return;
    const rect=el.getBoundingClientRect(), w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
    const type=variants[el.dataset.glass]?el.dataset.glass:'toolbar';
    const radius=Math.max(0,Math.min(Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius)||0),Math.floor(w/2),Math.floor(h/2)));
    if(w<30||h<30)return;
    const value=resource(type,w,h,radius);
    el.style.setProperty('--rim-mask',value.mask);
    el.style.setProperty('--glass-filter',`url(#${value.id})`);
    applied.set(el,value.id);
    el.dataset.glassReady='true';
    el.dataset.glassOutput=(CSS.supports('backdrop-filter','url(#glass-geometry-probe)')||CSS.supports('-webkit-backdrop-filter','url(#glass-geometry-probe)'))?'refractive-declared':'blur-fallback';
  }
  function refresh() {
    if(observer) observer.disconnect();
    if(resizeTimer) {clearTimeout(resizeTimer);resizeTimer=0;}
    cancelPointer();
    pendingResize.clear();
    applied.clear();
    const elements=[...document.querySelectorAll('.glass-plane[data-glass]')].filter(eligible);
    elements.forEach(apply);
    observer=new ResizeObserver(entries=>{
      entries.forEach(entry=>pendingResize.add(entry.target));
      if(resizeTimer)clearTimeout(resizeTimer);
      resizeTimer=setTimeout(()=>{
        pendingResize.forEach(el=>{if(el.isConnected)apply(el);});
        pendingResize.clear();resizeTimer=0;
      },80);
    });
    elements.forEach(el=>observer.observe(el));
    document.body.classList.toggle('glass-motion-off',reducedMotion());
    document.body.classList.toggle('glass-opacity-off',reducedTransparency());
  }
  document.addEventListener('pointermove',e=>{
    if(reducedMotion()||reducedTransparency())return;
    const el=e.target.closest('.glass-plane[data-glass]');
    if(!el){if(active)cancelPointer();return;}
    if(active!==el){clearLight(active);active=el;}
    pendingPointer={el,x:e.clientX,y:e.clientY};
    if(pointerFrame)return;
    pointerFrame=requestAnimationFrame(()=>{
      pointerFrame=0;const point=pendingPointer;pendingPointer=null;
      if(!point||!point.el.isConnected||reducedMotion()||reducedTransparency()){cancelPointer();return;}
      const rect=point.el.getBoundingClientRect();
      point.el.style.setProperty('--light-x',`${Math.round((point.x-rect.left)/rect.width*100)}%`);
      point.el.style.setProperty('--light-y',`${Math.round((point.y-rect.top)/rect.height*100)}%`);
      stats.pointerFrames++;
    });
  },{passive:true});
  document.addEventListener('pointerout',e=>{const el=e.target.closest('.glass-plane[data-glass]');if(el&&!el.contains(e.relatedTarget)&&active===el)cancelPointer();});
  const preferenceChanged=()=>{cancelPointer();document.body.classList.toggle('glass-motion-off',reducedMotion());document.body.classList.toggle('glass-opacity-off',reducedTransparency());};
  mediaMotion.addEventListener('change',preferenceChanged);
  mediaTransparency.addEventListener('change',preferenceChanged);
  addEventListener('pagehide',()=>{cancelPointer();if(observer)observer.disconnect();if(resizeTimer)clearTimeout(resizeTimer);pendingResize.clear();});
  window.MokinaGlass={refresh,preferenceChanged,debug:()=>({...stats,cacheEntries:cache.size,pendingFrame:!!pointerFrame,active:active?.dataset.glass||null})};
})();
