// Builds the Bible Companion reading schedule for Marginalia.
//
//   node data/build-companion.mjs
//
// Robert Roberts' "Bible Companion" — three daily portions that take you through
// the Old Testament once and the New Testament twice in a year. We scrape the
// public monthly tables at dawnchristadelphians.ca (a plain HTML transcription of
// the printed plan) and emit static/companion.json:
//
//   { "1-1": [ portion, portion, portion ], ... }   // keyed "month-day"
//   portion = { bookId, book, label, start, chapters:[...] }
//
// `start` (+ bookId) is what a click navigates to; `label` is the printed range;
// `chapters` is the fully-expanded chapter list. Read by src/lib/provider/companion.ts.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'static', 'companion.json');
const BASE = 'https://dawnchristadelphians.ca/companion';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Canonical KJV books: name -> { id, chapters }. Also used to validate every
// reference the scrape produces (a typo or unexpected book name is a hard error).
const BOOKS = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34],
  ['Joshua', 24], ['Judges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24],
  ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10],
  ['Nehemiah', 13], ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31],
  ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52], ['Lamentations', 5],
  ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9],
  ['Obadiah', 1], ['Jonah', 4], ['Micah', 7], ['Nahum', 3], ['Habakkuk', 3],
  ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4], ['Matthew', 28],
  ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16],
  ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4],
  ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6], ['2 Timothy', 4],
  ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5],
  ['2 Peter', 3], ['1 John', 5], ['2 John', 1], ['3 John', 1], ['Jude', 1],
  ['Revelation', 22],
];

const BOOK_INFO = new Map();
BOOKS.forEach(([name, chapters], i) => BOOK_INFO.set(name, { id: i + 1, chapters }));

// Known typos in the source transcription, keyed "month-day-col" (col 0=OT,1=poetry,2=NT).
// The value replaces the cell's chapter spec (book name is still carried/peeled normally).
//   Feb 14 OT prints "Exodus 24,24" (chapter 25 dropped, 24 duplicated) -> should be 24,25.
// (Sep 28's "28 28" day-number typo is handled by day parsing, not here.)
const CORRECTIONS = new Map([
  ['2-14-0', '24,25'],
]);

// Source spellings that differ from our canonical names.
const ALIASES = new Map([
  ['Psalm', 'Psalms'],
  ['Song of Songs', 'Song of Solomon'],
  ['Songs', 'Song of Solomon'],
  ['Canticles', 'Song of Solomon'],
  ['Revelations', 'Revelation'],
]);

/** Resolve a combined one-chapter reading like "II & III John" -> [2 John, 3 John]. */
function resolveCombined(decoded) {
  const parts = decoded.replace(/&/g, ' and ').split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  const last = resolveBook(parts[parts.length - 1]); // "III John" -> 3 John
  const sharedName = last.book.replace(/^\d+\s*/, ''); // "John"
  // A bare numeral part ("II") borrows the shared book word; "III John" stands alone.
  return parts.map((p) => {
    const bare = p.replace(/^(III|II|I|\d+)\b\s*/i, '').trim();
    return resolveBook(bare ? p : `${p} ${sharedName}`);
  });
}

function resolveBook(name) {
  // The source numbers books with Roman numerals ("I Corinthians", "II Kings").
  const clean = name
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^III\s+/, '3 ')
    .replace(/^II\s+/, '2 ')
    .replace(/^I\s+/, '1 ');
  const canonical = ALIASES.get(clean) ?? clean;
  const info = BOOK_INFO.get(canonical);
  if (!info) throw new Error(`Unknown book name from source: "${name}"`);
  return { book: canonical, ...info };
}

function tryResolve(name) {
  try { return resolveBook(name); } catch { return null; }
}

/**
 * Peel a leading book name off a cell's text. Book names appear both bold and as
 * plain text in the source ("Genesis 1,2", "Joel 1"), and some are multi-word
 * ("Song of Solomon 1") — so match the longest leading run of words that resolves.
 * Returns { info, rest } or null when the cell is a bare chapter/verse continuation.
 */
function peelBook(text) {
  const words = text.split(/\s+/).filter(Boolean);
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const info = tryResolve(words.slice(0, n).join(' '));
    if (info) return { info, rest: words.slice(n).join(' ').trim() };
  }
  return null;
}

const stripTags = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Expand a printed chapter spec ("1,2" | "3-5" | "17" | "1,3-5") into a chapter list. */
function expandChapters(spec) {
  const chapters = [];
  for (const part of spec.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      for (let c = a; c <= b; c++) chapters.push(c);
    } else if (/^\d+$/.test(p)) {
      chapters.push(Number(p));
    } else {
      throw new Error(`Unparseable chapter spec: "${spec}"`);
    }
  }
  return chapters;
}

/**
 * Parse one reading cell's chapter spec into portion data. Long chapters (Psalm
 * 119) are split across days by verse: "119 to v40", then continuation rows
 * "v41-80" that carry the chapter forward from the previous Psalms row.
 * Returns { chapters, start, label, lastChapter, verseStart?, verseEnd? }.
 */
function parseSpec(spec, book, carryChapter) {
  if (/v/i.test(spec) || /\bto\b/i.test(spec)) {
    const chMatch = spec.match(/^(\d+)/);
    const chapter = chMatch ? Number(chMatch[1]) : carryChapter;
    if (!chapter) throw new Error(`Verse spec "${spec}" with no chapter to continue`);
    let vStart, vEnd;
    let m;
    if ((m = spec.match(/to\s*v?\.?\s*(\d+)/i)) && !/v\.?\s*\d+\s*[-–]/i.test(spec)) {
      vStart = 1; vEnd = Number(m[1]);            // "119 to v40"
    } else if ((m = spec.match(/v?\.?\s*(\d+)\s*[-–]\s*(\d+)/i))) {
      vStart = Number(m[1]); vEnd = Number(m[2]); // "v41-80"
    } else if ((m = spec.match(/v\.?\s*(\d+)/i))) {
      vStart = Number(m[1]); vEnd = vStart;       // "v81"
    } else {
      throw new Error(`Unparseable verse spec: "${spec}"`);
    }
    return {
      chapters: [chapter], start: chapter, lastChapter: chapter, verseStart: vStart, verseEnd: vEnd,
      label: `${book} ${chapter}:${vStart}–${vEnd}`,
    };
  }
  const chapters = expandChapters(spec);
  const printed = spec.replace(/\s*-\s*/g, '–').replace(/,/g, ', ');
  return { chapters, start: chapters[0], lastChapter: chapters[chapters.length - 1], label: `${book} ${printed}` };
}

async function fetchMonth(slug) {
  const res = await fetch(`${BASE}/${slug}.html`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${slug}.html`);
  // The pages are windows-1252 but the reading tables are pure ASCII, so utf-8 is fine.
  return res.text();
}

/**
 * Parse one month's table. Book names appear (bold) only when the book changes;
 * an empty/plain cell continues the previous book in that column — so we carry a
 * running "current book" per column across days, exactly like reading the chart.
 */
function parseMonth(html, monthIndex, coverage) {
  const cover = (bookId, chapters) => {
    const set = coverage.get(bookId) ?? coverage.set(bookId, new Set()).get(bookId);
    for (const ch of chapters) set.add(ch);
  };
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const current = [null, null, null];        // running book per reading column
  const currentChapter = [null, null, null]; // running chapter (for verse-split continuations)
  const days = [];

  for (const row of rows) {
    const cells = (row.match(/<td[\s\S]*?<\/td>/gi) ?? []).map((c) => c.replace(/^<td[^>]*>/i, '').replace(/<\/td>$/i, ''));
    if (cells.length < 4) continue; // header / spacer rows
    const dayMatch = stripTags(cells[0]).match(/\d+/); // some day cells have source typos ("28 28")
    const day = dayMatch ? Number(dayMatch[0]) : NaN;
    if (!Number.isInteger(day) || day < 1 || day > 31) continue; // "Day" / month-title header

    const readings = [];
    for (let col = 0; col < 3; col++) {
      const text = stripTags(cells[col + 1]).replace(/&amp;/gi, '&');
      if (!text) throw new Error(`Month ${monthIndex + 1} day ${day} col ${col}: empty cell`);

      // Combined one-chapter reading (only "II & III John" occurs): one portion, two books.
      if (/&|\band\b/i.test(text)) {
        const combo = resolveCombined(text);
        current[col] = combo[0];
        currentChapter[col] = 1;
        for (const b of combo) cover(b.id, [1]);
        readings.push({
          bookId: combo[0].id, book: combo[0].book, start: 1, chapters: [1],
          label: combo.map((b) => b.book).join(' & '),
        });
        continue;
      }

      // Book names appear bold or plain; a bare cell continues the running book/chapter.
      const peeled = peelBook(text);
      let spec = text;
      if (peeled) { current[col] = peeled.info; currentChapter[col] = null; spec = peeled.rest; }
      const fix = CORRECTIONS.get(`${monthIndex + 1}-${day}-${col}`);
      if (fix !== undefined) spec = fix;
      const info = current[col];
      if (!info) throw new Error(`Month ${monthIndex + 1} day ${day} col ${col}: chapters "${spec}" with no book yet`);
      // One-chapter books (Philemon, Obadiah, Jude, ...) are printed as just the name.
      if (!spec && info.chapters === 1) spec = '1';
      if (!spec) throw new Error(`Month ${monthIndex + 1} day ${day} col ${col}: no chapters for ${info.book}`);

      const parsed = parseSpec(spec, info.book, currentChapter[col]);
      for (const c of parsed.chapters) {
        if (c < 1 || c > info.chapters) {
          throw new Error(`${info.book} ${c} out of range (1-${info.chapters}) at month ${monthIndex + 1} day ${day}`);
        }
      }
      currentChapter[col] = parsed.lastChapter;
      cover(info.id, parsed.chapters);
      const portion = { bookId: info.id, book: info.book, label: parsed.label, start: parsed.start, chapters: parsed.chapters };
      if (parsed.verseStart) { portion.verseStart = parsed.verseStart; portion.verseEnd = parsed.verseEnd; }
      readings.push(portion);
    }
    days.push({ day, readings });
  }
  return days;
}

async function main() {
  const schedule = {};
  const coverage = new Map(); // bookId -> Set of chapters read
  let portionCount = 0;

  for (let m = 0; m < MONTHS.length; m++) {
    const html = await fetchMonth(MONTHS[m]);
    const days = parseMonth(html, m, coverage);
    for (const { day, readings } of days) {
      schedule[`${m + 1}-${day}`] = readings;
      portionCount += readings.length;
    }
    console.log(`  ${MONTHS[m]}: ${days.length} days`);
  }

  const dayCount = Object.keys(schedule).length;
  if (dayCount < 365) throw new Error(`Expected >=365 days, got ${dayCount}`);

  // Every chapter of every book must be scheduled at least once (the plan's whole point).
  const missing = [];
  BOOKS.forEach(([name, chapters], i) => {
    const read = coverage.get(i + 1) ?? new Set();
    for (let ch = 1; ch <= chapters; ch++) if (!read.has(ch)) missing.push(`${name} ${ch}`);
  });
  if (missing.length) throw new Error(`Chapters never scheduled: ${missing.join(', ')}`);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(schedule));
  console.log(`\nWrote ${OUT}`);
  console.log(`  days:     ${dayCount}`);
  console.log(`  portions: ${portionCount}`);
  console.log(`  coverage: all 66 books fully scheduled ✓`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
