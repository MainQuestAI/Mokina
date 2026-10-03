import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSrcdoc } from '../../src/runtime/srcdoc';

// Regression: ISSUE-003 — offscreen PDF capture waited forever for animation frames.
// Found by /qa on 2026-10-03
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-10-03.md
describe('export capture settling in an offscreen iframe', () => {
  let dom: JSDOM;
  let frames: Map<number, FrameRequestCallback>;
  let snapshot: ReturnType<typeof vi.fn>;
  let messages: Array<{ type: string; [key: string]: unknown }>;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = new JSDOM(buildSrcdoc('<main>Proposal text</main>'), { runScripts: 'outside-only' });
    frames = new Map();
    let nextFrame = 0;
    dom.window.requestAnimationFrame = vi.fn((callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    dom.window.cancelAnimationFrame = vi.fn((id) => { frames.delete(id); });
    snapshot = vi.fn().mockResolvedValue({ dataUrl: 'data:image/png;base64,fixture', w: 1440, h: 900 });
    Object.assign(dom.window, { __odCaptureSnapshot: snapshot });
    messages = [];
    vi.spyOn(dom.window.parent, 'postMessage').mockImplementation((message) => { messages.push(message); });
    const script = dom.window.document.querySelector('script[data-od-export-capture-bridge]');
    expect(script).not.toBeNull();
    dom.window.eval(script!.textContent!);
  });

  afterEach(() => {
    dom.window.close();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function startCapture() {
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
      data: { type: 'od:export-capture', id: 'qa-capture', mode: 'image', deck: false },
    }));
  }

  function expectCompletedOnce() {
    expect(snapshot).toHaveBeenCalledExactlyOnceWith({ full: true });
    expect(messages.filter((message) => message.type === 'od:export-capture:slide'))
      .toEqual([{
        type: 'od:export-capture:slide', id: 'qa-capture', index: 0, total: 1,
        dataUrl: 'data:image/png;base64,fixture', w: 1440, h: 900, notes: '',
      }]);
    expect(messages).toContainEqual({ type: 'od:export-capture:done', id: 'qa-capture', total: 1 });
  }

  it('captures even when the browser never runs the offscreen frame callbacks', async () => {
    startCapture();
    await vi.advanceTimersByTimeAsync(199);
    expect(snapshot).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expectCompletedOnce();
    expect(frames.size).toBe(0);
  });

  it('keeps the two rendered frames when available without capturing twice later', async () => {
    startCapture();
    await vi.advanceTimersByTimeAsync(0);
    const firstFrame = [...frames.values()][0]!;
    firstFrame(16);
    await vi.advanceTimersByTimeAsync(0);
    expect(snapshot).not.toHaveBeenCalled();
    const secondFrame = [...frames.values()].at(-1)!;
    secondFrame(32);
    await vi.advanceTimersByTimeAsync(0);
    expectCompletedOnce();
    // A late frame or timeout must not produce another slide / download.
    firstFrame(300);
    secondFrame(300);
    await vi.advanceTimersByTimeAsync(500);
    expectCompletedOnce();
  });

  it('does not bypass font readiness to escape frame throttling', async () => {
    let resolveFonts!: () => void;
    const ready = new Promise<void>((resolve) => { resolveFonts = resolve; });
    Object.defineProperty(dom.window.document, 'fonts', { value: { ready }, configurable: true });
    startCapture();
    await vi.advanceTimersByTimeAsync(500);
    expect(snapshot).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    resolveFonts();
    await vi.advanceTimersByTimeAsync(201);
    expectCompletedOnce();
  });
});
