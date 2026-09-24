import { describe, expect, it } from 'vitest';
import { readHtmlSections, replaceHtmlSection } from '../src/mokina/sections.js';

describe('Mokina editable chapters', () => {
  const base = '<main><section id="summary" data-mokina-id="summary"><h2 id="title" data-mokina-id="title">Old</h2></section><section id="sources" data-mokina-id="sources">Source</section></main>';

  it('edits an outer chapter while retaining nested anchors and untouched bytes', () => {
    expect(readHtmlSections(base).map(section => section.id)).toEqual(['summary', 'sources']);
    const replacement = '<section id="summary" data-mokina-id="summary"><h2 id="title" data-mokina-id="title">New</h2></section>';
    expect(replaceHtmlSection(base, 'summary', replacement)).toBe(base.replace('Old', 'New'));
  });

  it('rejects an internal anchor that duplicates another chapter', () => {
    const replacement = '<section id="summary" data-mokina-id="summary"><h2 id="sources" data-mokina-id="sources">New</h2></section>';
    expect(() => replaceHtmlSection(base, 'summary', replacement)).toThrow('duplicate chapter id: sources');
  });
});
