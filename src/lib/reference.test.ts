import { describe, it, expect } from 'vitest';
import { parseReference } from './reference';

describe('parseReference', () => {
  it('parses a full book name with chapter and verse', () => {
    expect(parseReference('John 3:16')).toEqual({ bookId: 43, chapter: 3, verse: 16 });
  });

  it('parses book + chapter (no verse)', () => {
    expect(parseReference('Psalm 23')).toEqual({ bookId: 19, chapter: 23 });
    expect(parseReference('genesis 1')).toEqual({ bookId: 1, chapter: 1 });
  });

  it('defaults to chapter 1 when only a book is given', () => {
    expect(parseReference('Genesis')).toEqual({ bookId: 1, chapter: 1 });
    expect(parseReference('revelation')).toEqual({ bookId: 66, chapter: 1 });
  });

  it('handles numbered books in several forms', () => {
    expect(parseReference('1 John 2')).toMatchObject({ bookId: 62, chapter: 2 });
    expect(parseReference('1john2')).toMatchObject({ bookId: 62, chapter: 2 });
    expect(parseReference('ii cor 5')).toMatchObject({ bookId: 47, chapter: 5 });
    expect(parseReference('1 Samuel 3')).toMatchObject({ bookId: 9, chapter: 3 });
  });

  it('tolerates missing spaces and common abbreviations', () => {
    expect(parseReference('jn 3')).toMatchObject({ bookId: 43, chapter: 3 });
    expect(parseReference('mk16')).toMatchObject({ bookId: 41, chapter: 16 });
    expect(parseReference('rom8:28')).toEqual({ bookId: 45, chapter: 8, verse: 28 });
    expect(parseReference('ps119')).toMatchObject({ bookId: 19, chapter: 119 });
  });

  it('is case- and whitespace-insensitive', () => {
    expect(parseReference('  MATT  5:9 ')).toEqual({ bookId: 40, chapter: 5, verse: 9 });
  });

  it('resolves multi-word book names', () => {
    expect(parseReference('Song of Solomon 2')).toMatchObject({ bookId: 22, chapter: 2 });
    expect(parseReference('song 1')).toMatchObject({ bookId: 22, chapter: 1 });
  });

  it('returns null for unrecognized or empty input', () => {
    expect(parseReference('')).toBeNull();
    expect(parseReference('   ')).toBeNull();
    expect(parseReference('42')).toBeNull();
    expect(parseReference('zzz 3')).toBeNull();
  });
});
