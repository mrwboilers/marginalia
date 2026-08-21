// Builds the bundled SQLite database for Marginalia.
//
//   node --experimental-sqlite data/build-db.mjs
//
// Fetches every bundled, public-domain translation listed in ./translations.mjs
// (KJV from aruljohn/Bible-kjv, WEB from getbible.net), and writes the content
// tables + an FTS5 search index + the (empty) user-data tables into
// src-tauri/db/marginalia.db. On first run the app copies this DB into the OS
// app-data dir and works read-write.
//
// The translation flagged `source.reference` defines the shared `books` table
// (canonical order + chapter counts); every other translation maps its verses
// onto those same book ids. Per-translation versification differences (a verse
// present in one text but absent from another) are preserved as-is.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from './translations.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src-tauri', 'db', 'marginalia.db');
const OT_COUNT = 39; // first 39 books are Old Testament

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Run `fn` over `items` with bounded concurrency, preserving input order. */
async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

// --- Source adapters: each returns { books:[{bookId,name,chapterCount}], verses:[{bookId,chapter,verse,text}] } ---

/** aruljohn/Bible-kjv: Books.json (canonical order) + one file per book. */
async function fetchAruljohn({ base }) {
  const bookNames = await fetchJson(`${base}/Books.json`);
  const fetched = await mapPool(bookNames, 8, async (name) => {
    const file = name.replace(/\s+/g, '');
    return { name, data: await fetchJson(`${base}/${file}.json`) };
  });
  const books = [];
  const verses = [];
  fetched.forEach(({ name, data }, idx) => {
    const bookId = idx + 1;
    books.push({ bookId, name, chapterCount: data.chapters.length });
    for (const ch of data.chapters) {
      const chapter = Number(ch.chapter);
      for (const vs of ch.verses) {
        verses.push({ bookId, chapter, verse: Number(vs.verse), text: vs.text });
      }
    }
  });
  return { books, verses };
}

/** getbible.net v2: one file per book number (1..66), canonical order. */
async function fetchGetbible({ base }) {
  const nrs = Array.from({ length: 66 }, (_, i) => i + 1);
  const fetched = await mapPool(nrs, 6, (nr) => fetchJson(`${base}/${nr}.json`));
  const books = [];
  const verses = [];
  fetched.forEach((data, idx) => {
    const bookId = idx + 1; // getbible `nr` follows the same canonical order
    books.push({ bookId, name: data.name, chapterCount: data.chapters.length });
    for (const ch of data.chapters) {
      const chapter = Number(ch.chapter);
      for (const vs of ch.verses) {
        verses.push({ bookId, chapter, verse: Number(vs.verse), text: vs.text });
      }
    }
  });
  return { books, verses };
}

const ADAPTERS = { aruljohn: fetchAruljohn, getbible: fetchGetbible };

async function loadTranslation(t) {
  const adapter = ADAPTERS[t.source?.format];
  if (!adapter) throw new Error(`No source adapter for ${t.abbrev} (format: ${t.source?.format})`);
  console.log(`Fetching ${t.abbrev} (${t.name})…`);
  const { books, verses } = await adapter(t.source);
  // Normalize: trim whitespace, drop any empty verses (defensive; versification-safe).
  const clean = verses
    .map((v) => ({ ...v, text: (v.text ?? '').replace(/\s+/g, ' ').trim() }))
    .filter((v) => v.text.length > 0);
  console.log(`  ${t.abbrev}: ${books.length} books, ${clean.length} verses`);
  return { books, verses: clean };
}

async function main() {
  const bundled = TRANSLATIONS.filter((t) => t.isLocal);
  const reference = bundled.find((t) => t.source?.reference);
  if (!reference) throw new Error('No reference translation (source.reference: true) found.');

  // Fetch every bundled translation.
  const loaded = new Map();
  for (const t of bundled) loaded.set(t.id, await loadTranslation(t));

  const refBooks = loaded.get(reference.id).books;
  if (refBooks.length !== 66) throw new Error(`Reference ${reference.abbrev} has ${refBooks.length} books, expected 66.`);

  mkdirSync(dirname(OUT), { recursive: true });
  rmSync(OUT, { force: true });
  const db = new DatabaseSync(OUT);

  db.exec(`
    CREATE TABLE translations (
      id INTEGER PRIMARY KEY,
      abbrev TEXT NOT NULL,
      name TEXT NOT NULL,
      language TEXT NOT NULL,
      license TEXT NOT NULL,          -- license name, e.g. "Public Domain"
      is_local INTEGER NOT NULL DEFAULT 1,
      public_domain INTEGER NOT NULL DEFAULT 0,
      license_url TEXT,
      copyright TEXT,
      attribution TEXT,
      source_url TEXT,
      text_version TEXT,
      has_strongs INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      testament TEXT NOT NULL,
      chapters INTEGER NOT NULL
    );
    CREATE TABLE verses (
      id INTEGER PRIMARY KEY,
      translation_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX idx_verses_ref ON verses(translation_id, book_id, chapter, verse);
    CREATE VIRTUAL TABLE verses_fts USING fts5(text, content='verses', content_rowid='id');

    -- User data (read-write; seeded with the default marking layers).
    CREATE TABLE layers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE marks (
      id TEXT PRIMARY KEY, translation_id INTEGER NOT NULL, book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
      start_char INTEGER NOT NULL, end_char INTEGER NOT NULL,
      type TEXT NOT NULL, color TEXT NOT NULL, layer_id TEXT NOT NULL,
      created TEXT NOT NULL, updated TEXT NOT NULL
    );
    CREATE TABLE notes (
      id TEXT PRIMARY KEY, book_id INTEGER NOT NULL, chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL, body TEXT NOT NULL, layer_id TEXT NOT NULL,
      format TEXT, tags TEXT, created TEXT NOT NULL, updated TEXT NOT NULL
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    -- Bible Companion reading progress: "done" portion keys ("<month>-<day>:<i>").
    CREATE TABLE reading_progress (key TEXT PRIMARY KEY, done_at TEXT NOT NULL);

    -- Saved places.
    CREATE TABLE bookmarks (
      id TEXT PRIMARY KEY, book_id INTEGER NOT NULL, chapter INTEGER NOT NULL,
      label TEXT NOT NULL, created TEXT NOT NULL
    );
  `);

  const insTranslation = db.prepare(
    `INSERT INTO translations
       (id, abbrev, name, language, license, is_local, public_domain,
        license_url, copyright, attribution, source_url, text_version, has_strongs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of TRANSLATIONS) {
    insTranslation.run(
      t.id, t.abbrev, t.name, t.language, t.licenseName, t.isLocal ? 1 : 0,
      t.publicDomain ? 1 : 0, t.licenseUrl || '', t.copyright || '', t.attribution || '',
      t.sourceUrl || '', t.textVersion || '', t.hasStrongs ? 1 : 0
    );
  }

  db.prepare(
    `INSERT INTO layers (id, name, color, visible, sort) VALUES
       ('study', 'Study', '#d4a017', 1, 0)`
  ).run();

  // Content version = how many bundled translations this DB carries. The app uses
  // it to seed newly-added translations into an existing user's DB on update
  // (see src-tauri/src/lib.rs). Bump this whenever a translation is added below.
  db.prepare(`INSERT INTO settings (key, value) VALUES ('content_version', ?)`).run(
    String(bundled.length)
  );

  // Books table comes from the reference translation's versification.
  const insBook = db.prepare(
    `INSERT INTO books (id, name, testament, chapters) VALUES (?, ?, ?, ?)`
  );
  for (const b of refBooks) {
    insBook.run(b.bookId, b.name, b.bookId <= OT_COUNT ? 'OT' : 'NT', b.chapterCount);
  }

  const insVerse = db.prepare(
    `INSERT INTO verses (translation_id, book_id, chapter, verse, text)
     VALUES (?, ?, ?, ?, ?)`
  );
  db.exec('BEGIN');
  for (const t of bundled) {
    for (const v of loaded.get(t.id).verses) {
      insVerse.run(t.id, v.bookId, v.chapter, v.verse, v.text);
    }
  }
  db.exec('COMMIT');

  // Populate the search index from the finished verse table.
  db.exec(`INSERT INTO verses_fts(rowid, text) SELECT id, text FROM verses;`);

  const { c: books66 } = db.prepare('SELECT COUNT(*) c FROM books').get();
  console.log(`\nWrote ${OUT}`);
  console.log(`  books: ${books66}`);
  for (const t of bundled) {
    const { c } = db.prepare('SELECT COUNT(*) c FROM verses WHERE translation_id = ?').get(t.id);
    console.log(`  ${t.abbrev}: ${c} verses`);
  }
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
