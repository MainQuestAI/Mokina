/**
 * In-iframe bridge for direct canvas editing of Mokina fields and budget cells.
 * The host appends this script to the version preview srcDoc; it stays dormant
 * until the host posts `mokina:canvas-edit-mode` with enabled=true.
 */
export const mokinaCanvasEditBridgeScript = `(function () {
  var active = false;
  var BUDGET_KINDS = ['quantity', 'unit-price', 'hours'];
  function cellId(el) {
    var field = el.getAttribute('data-mokina-field');
    if (field) return field;
    var table = el.closest('[data-mokina-budget]');
    var row = el.closest('[data-budget-item]');
    if (!table || !row) return null;
    var tables = Array.prototype.slice.call(document.querySelectorAll('[data-mokina-budget]'));
    var ti = tables.indexOf(table);
    var rows = Array.prototype.slice.call(table.querySelectorAll('[data-budget-item]'));
    var ri = rows.indexOf(row);
    var kind = BUDGET_KINDS.filter(function (name) { return el.hasAttribute('data-' + name); })[0];
    return kind ? 'budget-' + ti + '-' + ri + '-' + kind : null;
  }
  function commit(event) {
    var el = event.target;
    var id = cellId(el);
    if (!id) return;
    window.parent.postMessage({ type: 'mokina:canvas-edit', id: id, value: el.textContent || '' }, '*');
  }
  function keydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.target.blur(); }
    if (event.key === 'Escape') { event.target.blur(); }
  }
  function setEditable(editable) {
    var selector = '[data-mokina-field], [data-mokina-budget] [data-quantity], [data-mokina-budget] [data-unit-price], [data-mokina-budget] [data-hours]';
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
      if (editable) {
        el.setAttribute('contenteditable', 'plaintext-only');
        el.style.outline = '2px dashed #2563eb';
        el.style.outlineOffset = '2px';
        el.style.borderRadius = '4px';
        el.addEventListener('blur', commit);
        el.addEventListener('keydown', keydown);
      } else {
        el.removeAttribute('contenteditable');
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.borderRadius = '';
        el.removeEventListener('blur', commit);
        el.removeEventListener('keydown', keydown);
      }
    });
  }
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'mokina:canvas-edit-mode') return;
    active = Boolean(event.data.enabled);
    setEditable(active);
    window.parent.postMessage({ type: 'mokina:canvas-edit-state', enabled: active }, '*');
  });
  window.parent.postMessage({ type: 'mokina:canvas-edit-ready' }, '*');
})();`;
