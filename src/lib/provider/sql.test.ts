// @vitest-environment node
// This suite exercises Node's built-in SQLite. It must run in the `node`
// environment (not the project-wide happy-dom one), otherwise Vite refuses to
// bundle the `node:sqlite` builtin for the client environment.
import { describe, it, expect, beforeAll } from 'vitest';
// @ts-expect-error — Node's built-in SQLite; no @types/node in this project.
import { DatabaseSync } from 'node:sqlite';
import { toTranslation } from './translation-map';

/**
 * Exercises the real multi-translation SQL against a throwaway SQLite DB.
 * tauri-plugin-sql isn't available under vitest, so we build a two-translation
 * fixture with the same schema shape and run the same query logic the SqlProvider
 * runs — using `?` placeholders (node:sqlite) in place of the plugin's `$1`.
 * This proves chapter/search scoping, the abbrev join, "search all", and
 * compareVerse without needing a Tauri runtime.
 */

const KJV = 1;
const WEB = 2;
let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE translations (
      id INTEGER PRIMARY KEY, abbrev TEXT, name TEXT, language TEXT,
      license TEXT, is_local INTEGER, public_domain INTEGER, license_url TEXT,
      copyright TEXT, attribution TEXT, source_url TEXT, text_version TEXT, has_strongs INTEGER
    );
    CREATE TABLE books (id INTEGER PRIMARY KEY, name TEXT, testament TEXT, chapters INTEGER);
    CREATE TABLE verses (
      id INTEGER PRIMARY KEY, translation_id INTEGER, book_id INTEGER,
      chapter INTEGER, verse INTEGER, text TEXT
    );
    CREATE VIRTUAL TABLE verses_fts USING fts5(text, content='verses', content_rowid='id');
  `);

  db.prepare(
    `INSERT INTO translations
       (id, abbrev, name, language, license, is_local, public_domain, source_url, text_version, has_strongs)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(KJV, 'KJV', 'King James Version', 'en', 'Public Domain', 1, 1, 'https://example/kjv', 'kjv-1', 1);
  db.prepare(
    `INSERT INTO translations
       (id, abbrev, name, language, license, is_local, public_domain, has_strongs)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(WEB, 'WEB', 'World English Bible', 'en', 'Public Domain', 1, 1, 0);

  db.prepare(`INSERT INTO books (id, name, testament, chapters) VALUES (?,?,?,?)`).run(
    43, 'John', 'NT', 21
  );

  // John 3:16 in two wordings, plus a neighbor verse in each translation.
  const v = db.prepare(
    `INSERT INTO verses (id, translation_id, book_id, chapter, verse, text) VALUES (?,?,?,?,?,?)`
  );
  v.run(1001, KJV, 43, 3, 16, 'For God so loved the world, that he gave his only begotten Son');
  v.run(1002, KJV, 43, 3, 17, 'For God sent not his Son into the world to condemn the world');
  v.run(1003, WEB, 43, 3, 16, 'For God so loved the world, that he gave his one and only Son');
  v.run(1004, WEB, 43, 3, 17, 'For God didn’t send his Son into the world to judge the world');

  // A real versification difference: John 5:4 (the angel troubling the water)
  // is present in the KJV/TR but omitted from modern critical texts like the WEB.
  // KJV John 5 has verses 3,4,5; WEB has 3 and 5 with a GAP at 4 (not renumbered).
  // We defer full per-translation versification, but retrieval must tolerate this.
  v.run(1005, KJV, 43, 5, 3, 'In these lay a great multitude of impotent folk, of blind, halt, withered');
  v.run(1006, KJV, 43, 5, 4, 'For an angel went down at a certain season into the pool, and troubled the water');
  v.run(1007, KJV, 43, 5, 5, 'And a certain man was there, which had an infirmity thirty and eight years');
  v.run(1008, WEB, 43, 5, 3, 'In these lay a great multitude of those who were sick, blind, lame, or paralyzed');
  v.run(1009, WEB, 43, 5, 5, 'A certain man was there who had been sick for thirty-eight years');

  db.exec(`INSERT INTO verses_fts(rowid, text) SELECT id, text FROM verses`);
});

/** chapter(translationId, bookId, chapter) — mirrors SqlProvider.chapter. */
function chapter(translationId: number, bookId: number, ch: number) {
  return db
    .prepare(
      `SELECT verse AS v, text FROM verses
       WHERE translation_id = ? AND book_id = ? AND chapter = ? ORDER BY verse`
    )
    .all(translationId, bookId, ch) as { v: number; text: string }[];
}

/** search(translationId | 'all', query) — mirrors SqlProvider.search. */
function search(translationId: number | 'all', query: string, limit = 100) {
  const match = query
    .trim()
    .split(/\s+/)
    .map((t) => `"${t.replace(/"/g, '')}"`)
    .join(' ');
  const all = translationId === 'all';
  const sql = `SELECT v.translation_id AS translationId, t.abbrev AS translationAbbrev,
                      b.id AS bookId, b.name AS bookName, v.chapter, v.verse, v.text
               FROM verses_fts f
               JOIN verses v ON v.id = f.rowid
               JOIN books b ON b.id = v.book_id
               JOIN translations t ON t.id = v.translation_id
               WHERE f.text MATCH ? ${all ? '' : 'AND v.translation_id = ?'}
               ORDER BY v.translation_id, v.book_id, v.chapter, v.verse
               LIMIT ?`;
  const args = all ? [match, limit] : [match, translationId, limit];
  return db.prepare(sql).all(...args) as {
    translationId: number; translationAbbrev: string; bookId: number;
    bookName: string; chapter: number; verse: number; text: string;
  }[];
}

/** compareVerse(bookId, chapter, verse) — mirrors SqlProvider.compareVerse. */
function compareVerse(bookId: number, ch: number, verse: number) {
  return db
    .prepare(
      `SELECT v.translation_id AS translationId, t.abbrev, v.text
       FROM verses v JOIN translations t ON t.id = v.translation_id
       WHERE v.book_id = ? AND v.chapter = ? AND v.verse = ? ORDER BY t.id`
    )
    .all(bookId, ch, verse) as { translationId: number; abbrev: string; text: string }[];
}

describe('chapter retrieval by translation', () => {
  it('returns only the requested translation’s verses', () => {
    const kjv = chapter(KJV, 43, 3);
    expect(kjv.map((r) => r.v)).toEqual([16, 17]);
    expect(kjv[0].text).toContain('only begotten Son');

    const web = chapter(WEB, 43, 3);
    expect(web[0].text).toContain('one and only Son');
  });
});

describe('search scoped to a translation', () => {
  it('matches only the selected translation and carries its abbrev', () => {
    const kjv = search(KJV, 'begotten');
    expect(kjv).toHaveLength(1);
    expect(kjv[0].translationAbbrev).toBe('KJV');
    expect(kjv[0].translationId).toBe(KJV);

    // "begotten" doesn't exist in WEB's wording.
    expect(search(WEB, 'begotten')).toHaveLength(0);
  });

  it('scopes a shared phrase to just the selected translation', () => {
    expect(search(KJV, 'loved the world').map((h) => h.translationId)).toEqual([KJV]);
    expect(search(WEB, 'loved the world').map((h) => h.translationId)).toEqual([WEB]);
  });

  it('search "all" spans every translation, ordered by translation', () => {
    const hits = search('all', 'loved the world');
    expect(hits.map((h) => h.translationAbbrev)).toEqual(['KJV', 'WEB']);
  });
});

describe('compareVerse', () => {
  it('returns the same canonical verse across all translations', () => {
    const rows = compareVerse(43, 3, 16);
    expect(rows.map((r) => r.abbrev)).toEqual(['KJV', 'WEB']);
    expect(rows[0].text).toContain('begotten');
    expect(rows[1].text).toContain('one and only');
  });
});

// A canonical verse may be absent from a particular translation (e.g. John 5:4).
// Full per-translation versification is deferred, but retrieval must fail safely:
// a missing verse is simply absent — it must never shift or misalign other verses.
describe('a verse missing from a translation', () => {
  it('chapter() returns each translation’s own verse numbers, gaps preserved and not renumbered', () => {
    // KJV keeps 3,4,5; WEB has a genuine GAP at 4 — it must stay [3,5], not collapse to [3,4].
    expect(chapter(KJV, 43, 5).map((r) => r.v)).toEqual([3, 4, 5]);
    expect(chapter(WEB, 43, 5).map((r) => r.v)).toEqual([3, 5]);

    // Each verse still carries its true number, so verse 5 is verse 5 in both texts
    // even though WEB is missing verse 4 above it (no positional drift).
    const web = chapter(WEB, 43, 5);
    expect(web.find((r) => r.v === 5)?.text).toContain('thirty-eight');
    expect(web.find((r) => r.v === 4)).toBeUndefined();
  });

  it('compareVerse() returns only the translations that actually have the verse', () => {
    // Verse 4 exists only in KJV → compare shows just KJV, not an empty/placeholder WEB row.
    const v4 = compareVerse(43, 5, 4);
    expect(v4.map((r) => r.abbrev)).toEqual(['KJV']);
    expect(v4[0].text).toContain('angel');

    // Verse 5 exists in both → both returned, correctly paired by verse number.
    expect(compareVerse(43, 5, 5).map((r) => r.abbrev)).toEqual(['KJV', 'WEB']);
  });

  it('search stays anchored to true verse numbers when a translation omits a verse', () => {
    // A word unique to the KJV-only verse 4 matches in KJV and nowhere in WEB.
    const kjv = search(KJV, 'angel');
    expect(kjv).toHaveLength(1);
    expect(kjv[0].verse).toBe(4);
    expect(search(WEB, 'angel')).toHaveLength(0);

    // A word in WEB's verse 5 reports verse 5 — not verse 4 — despite the gap above it.
    const web = search(WEB, 'thirty-eight');
    expect(web).toHaveLength(1);
    expect(web[0].verse).toBe(5);
  });
});

describe('toTranslation mapping', () => {
  it('coerces integer flag columns to booleans', () => {
    const row = db
      .prepare(`SELECT id, abbrev, name, language, license, is_local, public_domain,
                       license_url, copyright, attribution, source_url, text_version, has_strongs
                FROM translations WHERE id = ?`)
      .get(KJV) as Record<string, unknown>;
    const t = toTranslation(row);
    expect(t).toMatchObject({
      id: 1, abbrev: 'KJV', name: 'King James Version', language: 'en',
      publicDomain: true, hasStrongs: true, isLocal: true,
      sourceUrl: 'https://example/kjv', textVersion: 'kjv-1',
    });
    // Empty/absent text columns normalize to undefined.
    expect(t.copyright).toBeUndefined();
  });

  it('reflects a translation without Strong’s', () => {
    const row = db
      .prepare(`SELECT id, abbrev, name, language, license, is_local, public_domain, has_strongs
                FROM translations WHERE id = ?`)
      .get(WEB) as Record<string, unknown>;
    expect(toTranslation(row).hasStrongs).toBe(false);
  });
});
