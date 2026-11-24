/**
 * Session-scoped handoff of a prompt that ProjectView should auto-send once
 * when a conversation mounts. Shared so other surfaces (e.g. the material
 * picker) can stage an analysis prompt without creating a second project.
 */
export function autoSendPromptKey(projectId: string): string {
  return `od:auto-send-prompt:${projectId}`;
}

/** Best effort: a blocked sessionStorage must not abort the caller's flow. */
export function stageAutoSendPrompt(projectId: string, prompt: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(autoSendPromptKey(projectId), prompt);
  } catch {
    // The conversation still opens; the user can send the visible draft.
  }
}
