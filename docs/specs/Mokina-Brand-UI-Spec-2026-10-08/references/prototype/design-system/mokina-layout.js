/* Keep the last message reachable when the floating composer changes height. */
(() => {
  let observer;
  function refresh() {
    observer?.disconnect();
    observer = new ResizeObserver(entries => {
      for (const {target} of entries) {
        const body = target.closest('.collab')?.querySelector('.collab-body');
        if (body) {
          const clearance = `${Math.ceil(target.getBoundingClientRect().height) + 24}px`;
          body.style.paddingBottom = clearance;
          body.style.setProperty('--composer-clearance', clearance);
        }
      }
    });
    document.querySelectorAll('.material-stage-one .collab-compose').forEach(el => observer.observe(el));
  }
  window.MokinaLayout = {refresh};
  addEventListener('pagehide', () => observer?.disconnect());
  addEventListener('pageshow', refresh);
})();
