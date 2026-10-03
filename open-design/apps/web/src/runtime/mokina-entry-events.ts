/**
 * Mokina 成果元数据缓存失效事件（Spec B1 §7「采用/删除/权限变化失效」）。
 *
 * 独立成无依赖模块：providers/registry（删除/重命名）与 components
 * （采用/恢复成功）都从这里派发，hooks/useMokinaProjectSummaries 监听，
 * 避免 providers ↔ hooks 循环导入。
 */

export const MOKINA_ENTRY_SUMMARIES_CHANGED = 'od:mokina-entry-summaries-changed';

export function notifyMokinaEntriesChanged(projectId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(MOKINA_ENTRY_SUMMARIES_CHANGED, { detail: { projectId } }),
  );
}
