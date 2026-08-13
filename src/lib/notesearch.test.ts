import { describe, it, expect } from 'vitest';
import { matchNotes, makeSnippet, noteText } from './notesearch';
import type { Note } from './types';

const bookName = (id: number) => ({ 1: 'Genesis', 43: 'John', 19: 'Psalms' })[id] ?? '?';

function note(partial: Partial<Note> & Pick<Note, 'id' | 'bookId' | 'chapter' | 'verse'>): Note {
  return { body: '', layerId: 'study', ...partial };
}

describe('noteText', () => {
  it('returns plain text as-is for legacy notes', () => {
    expect(noteText(note({ id: '1', bookId: 1, chapter: 1, verse: 1, body: 'plain <not html>' }))).toBe(
      'plain <not html>'
    );
  });
  it('strips HTML for rich notes', () => {
    expect(
      noteText(note({ id: '1', bookId: 1, chapter: 1, verse: 1, format: 'html', body: '<p>rich <b>text</b></p>' }))
    ).toBe('rich text');
  });
});

describe('matchNotes', () => {
  const notes: Note[] = [
    note({ id: 'a', bookId: 43, chapter: 1, verse: 1, format: 'html', body: '<p>The Word was <b>God</b></p>' }),
    note({ id: 'b', bookId: 1, chapter: 1, verse: 1, body: 'In the beginning God created' }),
    note({ id: 'c', bookId: 19, chapter: 23, verse: 1, format: 'html', body: '<p>The Lord is my shepherd</p>' }),
    note({ id: 'd', bookId: 1, chapter: 2, verse: 3, body: '' }), // empty — never matches
  ];

  it('matches by note text, case-insensitively', () => {
    const hits = matchNotes(notes, 'god', bookName);
    expect(hits.map((h) => h.noteId)).toEqual(['b', 'a']); // sorted by book/chapter/verse
  });

  it('requires all terms (AND)', () => {
    expect(matchNotes(notes, 'word god', bookName).map((h) => h.noteId)).toEqual(['a']);
    expect(matchNotes(notes, 'word shepherd', bookName)).toHaveLength(0);
  });

  it('returns canonical reference metadata', () => {
    const [hit] = matchNotes(notes, 'shepherd', bookName);
    expect(hit).toMatchObject({ noteId: 'c', bookId: 19, bookName: 'Psalms', chapter: 23, verse: 1 });
    expect(hit.snippet).toContain('shepherd');
  });

  it('ignores empty notes and empty queries', () => {
    expect(matchNotes(notes, '   ', bookName)).toEqual([]);
    expect(matchNotes(notes, 'zzz', bookName)).toEqual([]);
  });

  it('matches a query against tags as well as text', () => {
    const tagged: Note[] = [note({ id: 't', bookId: 1, chapter: 1, verse: 1, body: 'plain body', tags: ['grace', 'mercy'] })];
    expect(matchNotes(tagged, 'mercy', bookName).map((h) => h.noteId)).toEqual(['t']);
  });

  it('filters by a tag (with no query returns all notes carrying it)', () => {
    const tagged: Note[] = [
      note({ id: 'a', bookId: 1, chapter: 1, verse: 1, body: 'x', tags: ['faith'] }),
      note({ id: 'b', bookId: 2, chapter: 1, verse: 1, body: 'y', tags: ['hope'] }),
      note({ id: 'c', bookId: 3, chapter: 1, verse: 1, body: 'z', tags: ['faith', 'hope'] }),
    ];
    expect(matchNotes(tagged, '', bookName, 'faith').map((h) => h.noteId)).toEqual(['a', 'c']);
  });

  it('combines a tag filter with a text query', () => {
    const tagged: Note[] = [
      note({ id: 'a', bookId: 1, chapter: 1, verse: 1, body: 'love one another', tags: ['faith'] }),
      note({ id: 'b', bookId: 2, chapter: 1, verse: 1, body: 'love the Lord', tags: ['hope'] }),
    ];
    expect(matchNotes(tagged, 'love', bookName, 'faith').map((h) => h.noteId)).toEqual(['a']);
  });

  it('carries a note’s tags on each hit', () => {
    const tagged: Note[] = [note({ id: 'a', bookId: 1, chapter: 1, verse: 1, body: 'x', tags: ['faith'] })];
    expect(matchNotes(tagged, 'x', bookName)[0].tags).toEqual(['faith']);
  });

  it('sorts results in canonical book/chapter/verse order', () => {
    const many: Note[] = [
      note({ id: 'x', bookId: 43, chapter: 3, verse: 16, body: 'love' }),
      note({ id: 'y', bookId: 1, chapter: 1, verse: 1, body: 'love' }),
      note({ id: 'z', bookId: 1, chapter: 1, verse: 5, body: 'love' }),
    ];
    expect(matchNotes(many, 'love', bookName).map((h) => h.noteId)).toEqual(['y', 'z', 'x']);
  });
});

describe('makeSnippet', () => {
  it('returns the whole text when short', () => {
    expect(makeSnippet('a short note', ['short'])).toBe('a short note');
  });

  it('centers on the first matching term with ellipses', () => {
    const long = 'x'.repeat(200) + ' grace ' + 'y'.repeat(200);
    const snip = makeSnippet(long, ['grace'], 60);
    expect(snip).toContain('grace');
    expect(snip.length).toBeLessThanOrEqual(64); // max + a couple ellipsis chars
    expect(snip.startsWith('…')).toBe(true);
    expect(snip.endsWith('…')).toBe(true);
  });

  it('collapses whitespace', () => {
    expect(makeSnippet('one\n\n  two', ['one'])).toBe('one two');
  });
});
