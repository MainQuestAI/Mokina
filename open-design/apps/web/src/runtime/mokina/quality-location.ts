/** Preview-only bridge. Never persisted to the artifact or included in an export. */
export function qualityLocationBridge(versionId: string, token: string): string {
  const identity = JSON.stringify({ versionId, token }).replaceAll('<', '\\u003c');
  return `<script>(()=>{const identity=${identity};let previous=null;let outline='';let offset='';
addEventListener('message',event=>{
 const m=event.data;if(event.source!==parent||!m||m.type!=='mokina:locate'||m.versionId!==identity.versionId||m.token!==identity.token||typeof m.requestId!=='string'||typeof m.sectionId!=='string')return;
 const matches=Array.from(document.querySelectorAll('[data-mokina-id]')).filter(node=>node.id===m.sectionId&&node.getAttribute('data-mokina-id')===m.sectionId);
 if(previous){previous.style.outline=outline;previous.style.outlineOffset=offset;previous.removeAttribute('data-mokina-located');previous=null;}
 if(matches.length===1){const node=matches[0];previous=node;outline=node.style.outline;offset=node.style.outlineOffset;node.style.outline='3px solid #2563eb';node.style.outlineOffset='3px';node.setAttribute('data-mokina-located','true');node.scrollIntoView({block:'center'});}
 parent.postMessage({type:'mokina:located',...identity,requestId:m.requestId,sectionId:m.sectionId,found:matches.length===1},'*');
});})();</script>`;
}
