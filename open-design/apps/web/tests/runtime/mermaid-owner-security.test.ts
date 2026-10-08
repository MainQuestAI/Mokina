// @vitest-environment jsdom
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const excalidrawRequire = createRequire(require.resolve('@excalidraw/excalidraw'));
const converterPath = excalidrawRequire.resolve('@excalidraw/mermaid-to-excalidraw');
const originalBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox');
afterEach(() => {
  vi.restoreAllMocks();
  if (originalBBox) Object.defineProperty(SVGElement.prototype, 'getBBox', originalBBox);
  else Reflect.deleteProperty(SVGElement.prototype, 'getBBox');
});

test('[P1] real Mermaid owner preserves generated IDs and bindings through scene serialization', async () => {
  // jsdom has no SVG layout. Only supply geometry; parser, Mermaid, converter
  // and the owner's installed nanoid module are all real.
  Object.defineProperty(SVGElement.prototype, 'getBBox', { configurable: true, value() { return { x: 0, y: 0, width: 100, height: 40 }; } });
  const { parseMermaidToExcalidraw } = await import(pathToFileURL(converterPath).href);
  const source = 'sequenceDiagram\nparticipant A as Brief\nparticipant B as Plan\nA->>B: Create\nB-->>A: Review';
  for (let run = 0; run < 2; run++) {
    const scene = await parseMermaidToExcalidraw(source);
    const reopened = JSON.parse(JSON.stringify(scene));
    expect(reopened).toEqual(scene);
    expect(scene.elements.length).toBeGreaterThan(2);
    expect(scene.elements.some((element: { type: string }) => element.type === 'arrow')).toBe(true);
    // Excalidraw fills IDs omitted by element skeletons on scene import. IDs
    // explicitly emitted by this converter must already be unique and valid.
    const emitted = scene.elements.filter((element: { id?: string }) => element.id !== undefined);
    const ids = new Set(emitted.map((element: { id: string }) => element.id));
    expect(ids.size).toBe(emitted.length);
    for (const element of scene.elements) {
      if (element.id !== undefined) expect(typeof element.id).toBe('string');
      for (const id of element.groupIds ?? []) expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/u);
      for (const binding of [element.start, element.end]) {
        if (binding?.id) expect(ids.has(binding.id)).toBe(true);
      }
    }
  }
}, 15_000);
