import { describe, it, expect } from 'vitest';
import { renderPieces } from './marks';
import type { Mark } from './types';

const mark = (start: number, end: number, extra: Partial<Mark> = {}): Mark => ({
  id: `${start}-${end}`,
  bookId: 1,
  chapter: 1,
  verse: 1,
  start,
  end,
  type: 'highlight',
  color: '#ff0',
  layerId: 'study',
  ...extra,
});

const TEXT = 'In the beginning'; // length 16

describe('renderPieces', () => {
  it('returns a single unstyled piece when no marks apply', () => {
    expect(renderPieces(0, TEXT, [])).toEqual([{ text: TEXT, markIds: [] }]);
  });

  it('highlights the covered span and leaves the rest plain', () => {
    const pieces = renderPieces(0, TEXT, [mark(3, 6, { color: '#0f0' })]); // "the"
    expect(pieces.map((p) => p.text)).toEqual(['In ', 'the', ' beginning']);
    expect(pieces[1]).toMatchObject({ text: 'the', highlight: '#0f0', markIds: ['3-6'] });
    expect(pieces[0].highlight).toBeUndefined();
    expect(pieces[2].highlight).toBeUndefined();
  });

  it('reassembles to the original text', () => {
    const pieces = renderPieces(0, TEXT, [mark(0, 2), mark(7, 16, { type: 'underline' })]);
    expect(pieces.map((p) => p.text).join('')).toBe(TEXT);
  });

  it('layers underline over highlight where they overlap', () => {
    const pieces = renderPieces(0, TEXT, [
      mark(3, 10, { type: 'highlight', color: '#ff0' }),
      mark(6, 12, { type: 'underline', id: 'u' }),
    ]);
    const overlap = pieces.find((p) => p.highlight === '#ff0' && p.underline);
    expect(overlap).toBeTruthy();
    expect(overlap?.markIds).toEqual(expect.arrayContaining(['3-10', 'u']));
  });

  it('lets the last highlight win on overlap', () => {
    const pieces = renderPieces(0, TEXT, [
      mark(0, 8, { color: '#aaa', id: 'a' }),
      mark(4, 12, { color: '#bbb', id: 'b' }),
    ]);
    const mid = pieces.find((p) => p.markIds.includes('a') && p.markIds.includes('b'));
    expect(mid?.highlight).toBe('#bbb'); // later mark's color
  });

  it('clips marks that extend past the slice and honors baseOffset', () => {
    // Slice "beginning" starts at absolute offset 7; a mark at [10,13) hits "inn".
    const slice = TEXT.slice(7); // "beginning"
    const pieces = renderPieces(7, slice, [mark(10, 13, { color: '#0ff' })]);
    expect(pieces.map((p) => p.text).join('')).toBe(slice);
    expect(pieces.find((p) => p.highlight === '#0ff')?.text).toBe('inn');
  });

  it('ignores marks entirely outside the slice', () => {
    const slice = TEXT.slice(0, 3); // "In "
    expect(renderPieces(0, slice, [mark(7, 16)])).toEqual([{ text: 'In ', markIds: [] }]);
  });
});
