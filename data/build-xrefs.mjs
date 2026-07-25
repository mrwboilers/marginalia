// Builds cross-reference data for the center column from the Treasury of
// Scripture Knowledge (OpenBible.info, CC-BY).
//
//   1. curl -L -o /tmp/tsk.zip https://a.openbible.info/data/cross-references.zip
//   2. unzip -o /tmp/tsk.zip -d /tmp/tsk
//   3. node data/build-xrefs.mjs /tmp/tsk/cross_references.txt
//
// Emits static/xrefs/<bookId>.json — a map of chapter -> [{ v, refs[] }] with the
// top cross-references per verse (by vote), formatted like a printed reference Bible.
// These static assets are fetched by both providers (bundled into the app, so offline).

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'static', 'xrefs');
const INPUT = process.argv[2];
const MAX_PER_VERSE = 5;

if (!INPUT) {
  console.error('Usage: node data/build-xrefs.mjs <path-to-cross_references.txt>');
  process.exit(1);
}

// Canonical order: [OSIS code, display abbreviation]. Index + 1 = book_id.
const BOOKS = [
  ['Gen', 'Ge'], ['Exod', 'Ex'], ['Lev', 'Le'], ['Num', 'Nu'], ['Deut', 'De'],
  ['Josh', 'Jos'], ['Judg', 'Jud'], ['Ruth', 'Ru'], ['1Sam', '1Sa'], ['2Sam', '2Sa'],
  ['1Kgs', '1Ki'], ['2Kgs', '2Ki'], ['1Chr', '1Ch'], ['2Chr', '2Ch'], ['Ezra', 'Ezr'],
  ['Neh', 'Ne'], ['Esth', 'Es'], ['Job', 'Job'], ['Ps', 'Ps'], ['Prov', 'Pr'],
  ['Eccl', 'Ec'], ['Song', 'So'], ['Isa', 'Isa'], ['Jer', 'Jer'], ['Lam', 'La'],
  ['Ezek', 'Eze'], ['Dan', 'Da'], ['Hos', 'Ho'], ['Joel', 'Joe'], ['Amos', 'Am'],
  ['Obad', 'Ob'], ['Jonah', 'Jon'], ['Mic', 'Mic'], ['Nah', 'Na'], ['Hab', 'Hab'],
  ['Zeph', 'Zep'], ['Hag', 'Hag'], ['Zech', 'Zec'], ['Mal', 'Mal'], ['Matt', 'Mt'],
  ['Mark', 'Mr'], ['Luke', 'Lu'], ['John', 'Joh'], ['Acts', 'Ac'], ['Rom', 'Ro'],
  ['1Cor', '1Co'], ['2Cor', '2Co'], ['Gal', 'Ga'], ['Eph', 'Eph'], ['Phil', 'Php'],
  ['Col', 'Col'], ['1Thess', '1Th'], ['2Thess', '2Th'], ['1Tim', '1Ti'], ['2Tim', '2Ti'],
  ['Titus', 'Tit'], ['Phlm', 'Phm'], ['Heb', 'Heb'], ['Jas', 'Jas'], ['1Pet', '1Pe'],
  ['2Pet', '2Pe'], ['1John', '1Jo'], ['2John', '2Jo'], ['3John', '3Jo'], ['Jude', 'Jude'],
  ['Rev', 'Re'],
];

const OSIS = new Map(BOOKS.map(([code], i) => [code, { id: i + 1, abbr: BOOKS[i][1] }]));

/** "John.1.1" -> {id, c, v} */
function parseOsis(s) {
  const [book, c, v] = s.split('.');
  const meta = OSIS.get(book);
  if (!meta) return null;
  return { id: meta.id, abbr: meta.abbr, c: Number(c), v: Number(v) };
}

/** Format a to-reference (single or range) as "Joh 1:1-3". */
function formatRef(range) {
  const [aStr, zStr] = range.split('-');
  const a = parseOsis(aStr);
  if (!a) return null;
  if (!zStr) return `${a.abbr} ${a.c}:${a.v}`;
  const z = parseOsis(zStr);
  if (!z) return `${a.abbr} ${a.c}:${a.v}`;
  if (a.id === z.id && a.c === z.c) return `${a.abbr} ${a.c}:${a.v}-${z.v}`;
  if (a.id === z.id) return `${a.abbr} ${a.c}:${a.v}-${z.c}:${z.v}`;
  return `${a.abbr} ${a.c}:${a.v}-${z.abbr} ${z.c}:${z.v}`;
}

console.log(`Reading ${INPUT}…`);
const lines = readFileSync(INPUT, 'utf8').split('\n');

// from-verse key -> array of { ref, votes }
const byVerse = new Map();
let parsed = 0;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line || line[0] === '#') continue;
  const [from, to, votesStr] = line.split('\t');
  if (!from || !to) continue;
  const f = parseOsis(from);
  if (!f) continue;
  const ref = formatRef(to);
  if (!ref) continue;
  const votes = Number(votesStr) || 0;
  const key = `${f.id}.${f.c}.${f.v}`;
  if (!byVerse.has(key)) byVerse.set(key, []);
  byVerse.get(key).push({ ref, votes });
  parsed++;
}
console.log(`  parsed ${parsed} references across ${byVerse.size} verses`);

// Group into per-book { chapter: [{v, refs}] }, keeping the top refs by vote.
const perBook = new Map(); // bookId -> Map(chapter -> Map(verse -> refs[]))
for (const [key, refs] of byVerse) {
  const [id, c, v] = key.split('.').map(Number);
  refs.sort((a, b) => b.votes - a.votes);
  const top = refs.slice(0, MAX_PER_VERSE).map((r) => r.ref);
  if (!perBook.has(id)) perBook.set(id, new Map());
  const chapters = perBook.get(id);
  if (!chapters.has(c)) chapters.set(c, []);
  chapters.get(c).push({ v, refs: top });
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let files = 0;
for (let id = 1; id <= 66; id++) {
  const chapters = perBook.get(id) ?? new Map();
  const obj = {};
  for (const [c, entries] of [...chapters.entries()].sort((a, b) => a[0] - b[0])) {
    obj[c] = entries.sort((a, b) => a.v - b.v);
  }
  writeFileSync(join(OUT_DIR, `${id}.json`), JSON.stringify(obj));
  files++;
}
console.log(`Wrote ${files} files to ${OUT_DIR}`);
