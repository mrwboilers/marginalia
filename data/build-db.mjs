// Builds the bundled SQLite database for Marginalia.
//
//   node --experimental-sqlite data/build-db.mjs
//
// Fetches the full public-domain KJV (aruljohn/Bible-kjv), writes content tables
// + an FTS5 search index + the (empty) user-data tables into src-tauri/db/marginalia.db.
// On first run the app copies this DB into the OS app-data dir and works read-write.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src-tauri', 'db', 'marginalia.db');
const BASE = 'https://raw.githubusercontent.com/aruljohn/Bible-kjv/master';
const OT_COUNT = 39; // first 39 books are Old Testament

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function main() {
  console.log('Fetching book list…');
  const bookNames = await fetchJson(`${BASE}/Books.json`);
  console.log(`  ${bookNames.length} books`);

  // Fetch all books (small files; modest concurrency keeps GitHub happy).
  const books = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < bookNames.length; i += CONCURRENCY) {
    const batch = bookNames.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(
      batch.map(async (name) => {
        const file = name.replace(/\s+/g, '');
        const data = await fetchJson(`${BASE}/${file}.json`);
        return { name, data };
      })
    );
    books.push(...fetched);
    console.log(`  fetched ${books.length}/${bookNames.length}`);
  }
  // Preserve canonical order.
  books.sort((a, b) => bookNames.indexOf(a.name) - bookNames.indexOf(b.name));

  mkdirSync(dirname(OUT), { recursive: true });
  rmSync(OUT, { force: true });
  const db = new DatabaseSync(OUT);

  db.exec(`
    CREATE TABLE translations (
      id INTEGER PRIMARY KEY,
      abbrev TEXT NOT NULL,
      name TEXT NOT NULL,
      language TEXT NOT NULL,
      license TEXT NOT NULL,
      is_local INTEGER NOT NULL DEFAULT 1
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
      id TEXT PRIMARY KEY, book_id INTEGER NOT NULL, chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL, start_char INTEGER NOT NULL, end_char INTEGER NOT NULL,
      type TEXT NOT NULL, color TEXT NOT NULL, layer_id TEXT NOT NULL,
      created TEXT NOT NULL, updated TEXT NOT NULL
    );
    CREATE TABLE notes (
      id TEXT PRIMARY KEY, book_id INTEGER NOT NULL, chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL, body TEXT NOT NULL, layer_id TEXT NOT NULL,
      created TEXT NOT NULL, updated TEXT NOT NULL
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  db.prepare(
    `INSERT INTO translations (id, abbrev, name, language, license, is_local)
     VALUES (1, 'KJV', 'King James Version', 'en', 'Public Domain', 1)`
  ).run();

  db.prepare(
    `INSERT INTO layers (id, name, color, visible, sort) VALUES
       ('study', 'Study', '#d4a017', 1, 0)`
  ).run();

  const insBook = db.prepare(
    `INSERT INTO books (id, name, testament, chapters) VALUES (?, ?, ?, ?)`
  );
  const insVerse = db.prepare(
    `INSERT INTO verses (translation_id, book_id, chapter, verse, text)
     VALUES (1, ?, ?, ?, ?)`
  );

  db.exec('BEGIN');
  let verseCount = 0;
  books.forEach((book, idx) => {
    const bookId = idx + 1;
    const chapters = book.data.chapters.length;
    insBook.run(bookId, book.name, bookId <= OT_COUNT ? 'OT' : 'NT', chapters);
    for (const ch of book.data.chapters) {
      const chapter = Number(ch.chapter);
      for (const vs of ch.verses) {
        insVerse.run(bookId, chapter, Number(vs.verse), vs.text);
        verseCount++;
      }
    }
  });
  db.exec('COMMIT');

  // Populate the search index from the finished verse table.
  db.exec(`INSERT INTO verses_fts(rowid, text) SELECT id, text FROM verses;`);

  const { c: books66 } = db.prepare('SELECT COUNT(*) c FROM books').get();
  const { c: verses } = db.prepare('SELECT COUNT(*) c FROM verses').get();
  db.close();

  console.log(`\nWrote ${OUT}`);
  console.log(`  books:  ${books66}`);
  console.log(`  verses: ${verses}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
