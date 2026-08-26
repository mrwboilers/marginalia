// Builds Strong's data (KJV+) from kaiserlik/kjv (public domain).
//
//   node --experimental-sqlite data/build-strongs.mjs
//
// Emits:
//   static/strongs/lexicon.json     — trimmed Strong's dictionary (definitions)
//   static/strongs/<bookId>.json    — per-verse word tokens: [{ t, s? }]
//                                     t = text run, s = Strong's numbers on its last word
// Also verifies the stripped tokens reproduce the KJV text already in the DB, so
// highlight/note character offsets stay valid.

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize, plainOf, reconcile } from './strongs-tokenize.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'static', 'strongs');
const DB = join(ROOT, 'src-tauri', 'db', 'marginalia.db');
const BASE = 'https://raw.githubusercontent.com/kaiserlik/kjv/master';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function main() {
  const books = await fetchJson(`${BASE}/books.json`);
  // books.json: [{ "Genesis": "Gen" }, ...] in canonical order → bookId = index+1.
  const list = books.books.map((o) => {
    const [name, abbr] = Object.entries(o)[0];
    return { name, abbr };
  });
  console.log(`${list.length} books`);

  mkdirSync(OUT, { recursive: true });

  // --- Lexicon (OpenScriptures Strong's dictionaries, CC-BY-SA) -----------
  if (existsSync(join(OUT, 'lexicon.json'))) {
    console.log('Lexicon already built, skipping.');
  } else {
    console.log('Fetching lexicon (OpenScriptures)…');
    const DICTS = [
      'https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js',
      'https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js',
    ];
    const trimmed = {};
    for (const url of DICTS) {
      const text = await (await fetch(url)).text();
      // Strip the `var X = {…}; module.exports = X;` wrapper to get the object.
      const start = text.indexOf('{', text.indexOf('='));
      const end = text.lastIndexOf('}');
      const dict = JSON.parse(text.slice(start, end + 1));
      for (const [num, e] of Object.entries(dict)) {
        trimmed[num] = {
          w: e.lemma || '',
          t: e.translit || e.xlit || '',
          d: (e.strongs_def || '').replace(/\s+/g, ' ').trim(),
          u: (e.kjv_def || '').replace(/\s+/g, ' ').trim(),
        };
      }
    }
    writeFileSync(join(OUT, 'lexicon.json'), JSON.stringify(trimmed));
    console.log(`  lexicon entries: ${Object.keys(trimmed).length}`);
  }

  // --- Per-book word tokens ---------------------------------------------
  const db = new DatabaseSync(DB);
  // Strong's tagging is reconciled to the KJV wording only, so read KJV verses
  // (translation_id = 1). Without this filter the DB now also holds WEB/BSB/YLT,
  // and the map would keep whichever translation sorts last — aligning the KJV
  // tags against the wrong text.
  const dbText = db.prepare(
    `SELECT chapter, verse, text FROM verses WHERE book_id = ? AND translation_id = 1 ORDER BY chapter, verse`
  );

  // Some source files have malformed JSON in the non-English fields, so pull the
  // English ("en") value per verse by regex from the raw text instead of parsing.
  const VERSE_RE = /"[^"|]+\|(\d+)\|(\d+)"\s*:\s*\{\s*"en"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

  let mismatches = 0;
  let verses = 0;
  for (let i = 0; i < list.length; i++) {
    const bookId = i + 1;
    if (existsSync(join(OUT, `${bookId}.json`))) continue; // already built
    const { abbr } = list[i];
    const res = await fetch(`${BASE}/${abbr}.json`);
    const text = await res.text();

    const dbMap = new Map();
    for (const row of dbText.all(bookId)) dbMap.set(`${row.chapter}|${row.verse}`, row.text);

    const out = {};
    const seen = new Set(); // some source files duplicate verses — keep the first
    VERSE_RE.lastIndex = 0;
    let m;
    while ((m = VERSE_RE.exec(text))) {
      const ch = Number(m[1]);
      const v = Number(m[2]);
      if (seen.has(`${ch}:${v}`)) continue;
      seen.add(`${ch}:${v}`);
      let en;
      try {
        en = JSON.parse(`"${m[3]}"`);
      } catch {
        en = m[3];
      }
      // Re-tile tokens over the authoritative DB text so the Strong's rendering
      // shows the full, correct verse and character offsets line up with normal
      // rendering (letting marks be created/shown with Strong's on).
      const dbt = dbMap.get(`${ch}|${v}`);
      const segs = dbt ? reconcile(tokenize(en), dbt) : tokenize(en);
      if (dbt && plainOf(segs) !== dbt) mismatches++;
      (out[ch] ??= []).push([v, segs]);
      verses++;
    }
    writeFileSync(join(OUT, `${bookId}.json`), JSON.stringify(out));
    if (bookId % 10 === 0) console.log(`  ${bookId}/66 books`);
  }
  db.close();

  console.log(`\nDone. verses=${verses}, text mismatches vs DB=${mismatches}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
