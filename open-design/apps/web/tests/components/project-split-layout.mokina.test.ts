// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/mokina-edition', () => ({ MOKINA_LOCAL_EDITION: true }));

import {
  CHAT_PANEL_WIDTH_STORAGE_KEY,
  readSavedChatPanelWidth,
  resolveProjectSplitLayout,
  saveChatPanelWidth,
  SPLIT_RESIZE_HANDLE_WIDTH,
} from '../../src/components/project-split-layout';

afterEach(() => window.localStorage.clear());

describe('Mokina artifact-first workspace', () => {
  it('keeps the same collaboration width through creation and window resizing', () => {
    const saved = readSavedChatPanelWidth();
    for (const width of [0, 1040, 1200, 1800]) {
      expect(resolveProjectSplitLayout(width, saved).chatPanelWidth).toBe(360);
    }
  });

  it('restores the chosen width without overwriting an older wider preference', () => {
    saveChatPanelWidth(416);
    expect(resolveProjectSplitLayout(1040, readSavedChatPanelWidth()).chatPanelWidth).toBe(416);
    window.localStorage.setItem(CHAT_PANEL_WIDTH_STORAGE_KEY, '680');
    expect(resolveProjectSplitLayout(1040, readSavedChatPanelWidth()).chatPanelWidth).toBe(470);
    expect(window.localStorage.getItem(CHAT_PANEL_WIDTH_STORAGE_KEY)).toBe('680');
  });

  it('keeps all three tracks within narrow containers and restores the preference on expansion', () => {
    const saved = { width: 450, customized: true };
    for (const width of [740, 731, 600, 400]) {
      const layout = resolveProjectSplitLayout(width, saved);
      expect(layout.chatPanelWidth + SPLIT_RESIZE_HANDLE_WIDTH + layout.workspacePanelMinWidth)
        .toBeLessThanOrEqual(width);
    }
    expect(resolveProjectSplitLayout(1200, saved).chatPanelWidth).toBe(450);
  });
});
