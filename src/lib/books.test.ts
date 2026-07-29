import { describe, it, expect } from 'vitest';
import { parseRef, BOOKS } from './books';

describe('BOOKS table', () => {
  it('has all 66 books with unique ids 1..66 and unique abbreviations', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.map((b) => b.id)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
    expect(new Set(BOOKS.map((b) => b.abbr)).size).toBe(66);
  });
});

describe('parseRef', () => {
  it('parses a single verse', () => {
    expect(parseRef('Ge 1:1')).toEqual({
      bookId: 1, name: 'Genesis', chapter: 1, verse: 1, endChapter: 1, endVerse: 1,
    });
  });

  it('parses a same-chapter verse range', () => {
    expect(parseRef('Joh 1:1-3')).toMatchObject({
      bookId: 43, name: 'John', chapter: 1, verse: 1, endChapter: 1, endVerse: 3,
    });
  });

  it('parses a cross-chapter range within a book', () => {
    expect(parseRef('Ge 1:1-2:4')).toMatchObject({
      chapter: 1, verse: 1, endChapter: 2, endVerse: 4,
    });
  });

  it('handles numbered books (abbr starting with a digit)', () => {
    expect(parseRef('1Jo 5:11-13')).toMatchObject({
      bookId: 62, name: '1 John', chapter: 5, verse: 11, endVerse: 13,
    });
  });

  it('falls back to the start reference for a cross-book range it cannot express', () => {
    // The end token "Ex 1:1" is neither a bare verse nor a chapter:verse — start only.
    expect(parseRef('Ge 50:26-Ex 1:1')).toMatchObject({
      bookId: 1, chapter: 50, verse: 26, endChapter: 50, endVerse: 26,
    });
  });

  it('returns null for an unknown abbreviation', () => {
    expect(parseRef('Xyz 1:1')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseRef('')).toBeNull();
    expect(parseRef('Genesis')).toBeNull();
    expect(parseRef('Ge 1')).toBeNull();
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseRef('  Ps 23:1  ')).toMatchObject({ bookId: 19, chapter: 23, verse: 1 });
  });
});
