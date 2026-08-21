import { describe, it, expect } from 'vitest';
import { renderPieces, marksForVerse, normalizeImportedMarks, type MarkContext } from './marks';
import { KJV_TRANSLATION_ID } from './types';
import type { Mark } from './types';

const mark = (start: number, end: number, extra: Partial<Mark> = {}): Mark => ({
  id: `${start}-${end}`,
  translationId: KJV_TRANSLATION_ID,
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

const WEB_TRANSLATION_ID = 2;
const ctx = (extra: Partial<MarkContext> = {}): MarkContext => ({
  translationId: KJV_TRANSLATION_ID,
  bookId: 1,
  chapter: 1,
  verse: 1,
  isLayerVisible: () => true,
  ...extra,
});

describe('marksForVerse', () => {
  it('returns marks for the matching book/chapter/verse', () => {
    const marks = [mark(0, 2), mark(0, 2, { verse: 2, id: 'v2' })];
    expect(marksForVerse(marks, ctx()).map((m) => m.id)).toEqual(['0-2']);
  });

  it('shows a mark only under its own translation', () => {
    const kjv = mark(0, 2, { translationId: KJV_TRANSLATION_ID, id: 'kjv' });
    const web = mark(0, 2, { translationId: WEB_TRANSLATION_ID, id: 'web' });
    const marks = [kjv, web];
    expect(marksForVerse(marks, ctx({ translationId: KJV_TRANSLATION_ID })).map((m) => m.id)).toEqual(['kjv']);
    expect(marksForVerse(marks, ctx({ translationId: WEB_TRANSLATION_ID })).map((m) => m.id)).toEqual(['web']);
  });

  it('treats a mark with no translationId as KJV (back-compat)', () => {
    // Pre-multi-translation data: a missed migration backfill must not hide the highlight.
    const legacy = { ...mark(0, 2, { id: 'legacy' }), translationId: undefined } as unknown as Mark;
    expect(marksForVerse([legacy], ctx({ translationId: KJV_TRANSLATION_ID })).map((m) => m.id)).toEqual(['legacy']);
    expect(marksForVerse([legacy], ctx({ translationId: WEB_TRANSLATION_ID }))).toEqual([]);
  });

  it('hides marks on invisible layers', () => {
    const marks = [mark(0, 2, { layerId: 'hidden' })];
    expect(marksForVerse(marks, ctx({ isLayerVisible: (l) => l !== 'hidden' }))).toEqual([]);
  });
});

describe('normalizeImportedMarks', () => {
  it('backfills a missing translationId to KJV', () => {
    const legacy = { ...mark(0, 2, { id: 'legacy' }), translationId: undefined } as unknown as Mark;
    const [out] = normalizeImportedMarks([legacy]);
    expect(out.translationId).toBe(KJV_TRANSLATION_ID);
  });

  it('leaves an existing translationId untouched', () => {
    const web = mark(0, 2, { translationId: WEB_TRANSLATION_ID });
    expect(normalizeImportedMarks([web])[0].translationId).toBe(WEB_TRANSLATION_ID);
  });
});

describe('translation-independence of verse notes vs marks', () => {
  // A note is anchored to a canonical reference (book/chapter/verse) with no
  // wording dependency, so it must show under every translation. A mark is
  // anchored to character offsets, so it must show only under its own translation.
  // This mirrors the filter the store applies to notes for the current chapter.
  type CanonicalNote = { id: string; bookId: number; chapter: number; verse: number };
  const notesForVerse = (notes: CanonicalNote[], bookId: number, chapter: number, verse: number) =>
    notes.filter((n) => n.bookId === bookId && n.chapter === chapter && n.verse === verse);

  it('keeps a verse note attached across translations while its highlight does not follow', () => {
    const note: CanonicalNote = { id: 'n1', bookId: 1, chapter: 1, verse: 1 };
    const kjvMark = mark(0, 4, { translationId: KJV_TRANSLATION_ID, id: 'kjvmark' });

    // KJV context: both the note and the KJV highlight are present.
    expect(notesForVerse([note], 1, 1, 1).map((n) => n.id)).toEqual(['n1']);
    expect(marksForVerse([kjvMark], ctx({ translationId: KJV_TRANSLATION_ID })).map((m) => m.id)).toEqual(['kjvmark']);

    // WEB context: the note stays; the KJV highlight is gone (offsets differ).
    expect(notesForVerse([note], 1, 1, 1).map((n) => n.id)).toEqual(['n1']);
    expect(marksForVerse([kjvMark], ctx({ translationId: WEB_TRANSLATION_ID }))).toEqual([]);
  });
});
