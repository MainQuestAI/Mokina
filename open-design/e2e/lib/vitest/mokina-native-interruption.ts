/** Test-side observer only: every side effect goes to the real daemon. A gate
 * withholds a request or an already-completed response until the host stops.
 * No product API, recovery record, response body or IPC permission is added.
 */
export function installMokinaInterruptionExpression(point: number, sourceProjectId: string, storageFaultUrl?: string): string {
  return `(() => {
    const point = ${JSON.stringify(point)};
    const sourceId = ${JSON.stringify(sourceProjectId)};
    const storageFaultUrl = ${JSON.stringify(storageFaultUrl ?? null)};
    const originalFetch = window.fetch.bind(window);
    const originalSet = Storage.prototype.setItem;
    const state = window.__mokinaFault = {point, hit: null, effects: [], requests: [], cacheFailure: false};
    const journals = () => Object.keys(localStorage).filter(k => k.startsWith('od:continuation:') && !k.includes(':completed:') && !k.includes(':operation:'))
      .map(key => {try{return {key, journal: JSON.parse(localStorage.getItem(key))}}catch{return null}})
      .filter(row => row?.journal.intent?.source.projectId === sourceId);
    const hold = async (phase, path, method, response) => {
      state.hit = {phase,path,method,status:response?.status,journals:journals()};
      await new Promise(() => {});
    };
    window.fetch = async (input, options) => {
      const path = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
      const method = (options?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      state.requests.push({path,method});
      const journal = journals()[0]?.journal;
      const target = journal?.targetProjectId;
      if (!state.hit && point === 1 && target && path === '/api/projects/'+target && method === 'GET') await hold('before-create',path,method);
      if (!state.hit && point === 3 && target && path === '/api/projects/'+target+'/upload' && method === 'POST') await hold('before-copy',path,method);
      const response = await originalFetch(input,options);
      if (method === 'POST' && response.ok) {
        const body = await response.clone().text();
        state.effects.push({path,method,status:response.status,body,requestBody:typeof options?.body === 'string' ? options.body : null});
        if (!state.hit && point === 2 && path === '/api/projects') await hold('project-created-response-lost',path,method,response);
        if (!state.hit && point === 4 && target && path === '/api/projects/'+target+'/upload') await hold('asset-copied-response-lost',path,method,response);
        if (!state.hit && point === 5 && target && path === '/api/projects/'+target+'/mokina/context-snapshots') await hold('snapshot-fixed-response-lost',path,method,response);
        if (!state.hit && point === 6 && target && path === '/api/projects/'+target+'/files') {
          let body; try {body=JSON.parse(options?.body??'null')} catch {}
          if(body?.name === 'MOKINA-CONTINUATION.json') await hold('draft-written-before-readback',path,method,response);
        }
        if (!state.hit && point === 9 && path === '/api/runs') await hold('run-accepted-response-lost',path,method,response);
        if (!state.hit && point === 10 && path === '/api/runs') {
          const targetId = location.pathname.split('/')[2];
          const key = Object.keys(localStorage).find(key => key.startsWith('mokina:context-snapshot:') && JSON.parse(localStorage.getItem(key)??'null')?.projectId === targetId);
          if (!key) throw new Error('actual pending binding missing before cleanup fault');
          const request = new XMLHttpRequest();
          request.open('GET',storageFaultUrl+'?key='+encodeURIComponent(key),false);request.send();
          if(request.status !== 200) throw new Error('pending cleanup fault was not armed: '+request.responseText);
          state.hit={phase:'run-accepted-pending-locked',key};
        }
      }
      return response;
    };
    if (point === 7 || point === 8) Storage.prototype.setItem = function(key,value) {
      if (point === 7 && !state.cacheFailure && key.startsWith('mokina:context-snapshot:') && value.includes(sourceId) === false) {
        state.cacheFailure = true;
        state.hit = {phase:'binding-durable-before-cache',key,value,journals:journals()};
        throw new DOMException('test-only cache publication interrupted','QuotaExceededError');
      }
      if (point === 8 && !state.hit && key.startsWith('od:continuation:') && key.includes(':completed:') && value.includes(sourceId)) {
        originalSet.call(this,key,value);
        const activeKey = key.slice(0,key.lastIndexOf(':completed:'));
        const request = new XMLHttpRequest();
        request.open('GET', storageFaultUrl+'?key='+encodeURIComponent(activeKey), false);
        request.send();
        if(request.status !== 200) throw new Error('storage fault was not armed: '+request.responseText);
        state.hit = {phase:'completed-durable-cleanup-locked',key:activeKey,value,journals:journals()};
        return;
      }
      return originalSet.call(this,key,value);
    };
    return true;
  })()`;
}

export const mokinaInterruptionStateExpression = `(() => ({
  hit:window.__mokinaFault?.hit ?? null,
  effects:window.__mokinaFault?.effects ?? [],
  requests:window.__mokinaFault?.requests ?? [],
  href:location.href,
  text:document.querySelector('.artifact-version-panel')?.textContent ?? '',
}))()`;
