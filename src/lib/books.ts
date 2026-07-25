// Canonical book list with the display abbreviations used in the cross-reference
// data (must match data/build-xrefs.mjs). Lets us parse a printed ref such as
// "Ge 1:1" or "1Jo 5:11-13" back into a lookup.

export interface BookRef {
  id: number;
  name: string;
  abbr: string;
}

export const BOOKS: BookRef[] = [
  { id: 1, name: 'Genesis', abbr: 'Ge' },
  { id: 2, name: 'Exodus', abbr: 'Ex' },
  { id: 3, name: 'Leviticus', abbr: 'Le' },
  { id: 4, name: 'Numbers', abbr: 'Nu' },
  { id: 5, name: 'Deuteronomy', abbr: 'De' },
  { id: 6, name: 'Joshua', abbr: 'Jos' },
  { id: 7, name: 'Judges', abbr: 'Jud' },
  { id: 8, name: 'Ruth', abbr: 'Ru' },
  { id: 9, name: '1 Samuel', abbr: '1Sa' },
  { id: 10, name: '2 Samuel', abbr: '2Sa' },
  { id: 11, name: '1 Kings', abbr: '1Ki' },
  { id: 12, name: '2 Kings', abbr: '2Ki' },
  { id: 13, name: '1 Chronicles', abbr: '1Ch' },
  { id: 14, name: '2 Chronicles', abbr: '2Ch' },
  { id: 15, name: 'Ezra', abbr: 'Ezr' },
  { id: 16, name: 'Nehemiah', abbr: 'Ne' },
  { id: 17, name: 'Esther', abbr: 'Es' },
  { id: 18, name: 'Job', abbr: 'Job' },
  { id: 19, name: 'Psalms', abbr: 'Ps' },
  { id: 20, name: 'Proverbs', abbr: 'Pr' },
  { id: 21, name: 'Ecclesiastes', abbr: 'Ec' },
  { id: 22, name: 'Song of Solomon', abbr: 'So' },
  { id: 23, name: 'Isaiah', abbr: 'Isa' },
  { id: 24, name: 'Jeremiah', abbr: 'Jer' },
  { id: 25, name: 'Lamentations', abbr: 'La' },
  { id: 26, name: 'Ezekiel', abbr: 'Eze' },
  { id: 27, name: 'Daniel', abbr: 'Da' },
  { id: 28, name: 'Hosea', abbr: 'Ho' },
  { id: 29, name: 'Joel', abbr: 'Joe' },
  { id: 30, name: 'Amos', abbr: 'Am' },
  { id: 31, name: 'Obadiah', abbr: 'Ob' },
  { id: 32, name: 'Jonah', abbr: 'Jon' },
  { id: 33, name: 'Micah', abbr: 'Mic' },
  { id: 34, name: 'Nahum', abbr: 'Na' },
  { id: 35, name: 'Habakkuk', abbr: 'Hab' },
  { id: 36, name: 'Zephaniah', abbr: 'Zep' },
  { id: 37, name: 'Haggai', abbr: 'Hag' },
  { id: 38, name: 'Zechariah', abbr: 'Zec' },
  { id: 39, name: 'Malachi', abbr: 'Mal' },
  { id: 40, name: 'Matthew', abbr: 'Mt' },
  { id: 41, name: 'Mark', abbr: 'Mr' },
  { id: 42, name: 'Luke', abbr: 'Lu' },
  { id: 43, name: 'John', abbr: 'Joh' },
  { id: 44, name: 'Acts', abbr: 'Ac' },
  { id: 45, name: 'Romans', abbr: 'Ro' },
  { id: 46, name: '1 Corinthians', abbr: '1Co' },
  { id: 47, name: '2 Corinthians', abbr: '2Co' },
  { id: 48, name: 'Galatians', abbr: 'Ga' },
  { id: 49, name: 'Ephesians', abbr: 'Eph' },
  { id: 50, name: 'Philippians', abbr: 'Php' },
  { id: 51, name: 'Colossians', abbr: 'Col' },
  { id: 52, name: '1 Thessalonians', abbr: '1Th' },
  { id: 53, name: '2 Thessalonians', abbr: '2Th' },
  { id: 54, name: '1 Timothy', abbr: '1Ti' },
  { id: 55, name: '2 Timothy', abbr: '2Ti' },
  { id: 56, name: 'Titus', abbr: 'Tit' },
  { id: 57, name: 'Philemon', abbr: 'Phm' },
  { id: 58, name: 'Hebrews', abbr: 'Heb' },
  { id: 59, name: 'James', abbr: 'Jas' },
  { id: 60, name: '1 Peter', abbr: '1Pe' },
  { id: 61, name: '2 Peter', abbr: '2Pe' },
  { id: 62, name: '1 John', abbr: '1Jo' },
  { id: 63, name: '2 John', abbr: '2Jo' },
  { id: 64, name: '3 John', abbr: '3Jo' },
  { id: 65, name: 'Jude', abbr: 'Jude' },
  { id: 66, name: 'Revelation', abbr: 'Re' },
];

const ABBR_TO_BOOK = new Map(BOOKS.map((b) => [b.abbr, b]));

export interface ParsedRef {
  bookId: number;
  name: string;
  chapter: number;
  verse: number;
  endChapter: number;
  endVerse: number;
}

/** Parse a printed reference ("Ge 1:1", "Joh 1:1-3", "Ge 1:1-2:4"). */
export function parseRef(ref: string): ParsedRef | null {
  const m = ref.trim().match(/^(\S+)\s+(\d+):(\d+)(?:-(.+))?$/);
  if (!m) return null;
  const book = ABBR_TO_BOOK.get(m[1]);
  if (!book) return null;

  const chapter = Number(m[2]);
  const verse = Number(m[3]);
  let endChapter = chapter;
  let endVerse = verse;

  const end = m[4];
  if (end) {
    if (/^\d+$/.test(end)) {
      endVerse = Number(end); // "-3" same chapter
    } else {
      const cv = end.match(/^(\d+):(\d+)$/);
      if (cv) {
        endChapter = Number(cv[1]); // "-2:4" same book, later chapter
        endVerse = Number(cv[2]);
      }
      // else cross-book range — fall back to the start reference only.
    }
  }
  return { bookId: book.id, name: book.name, chapter, verse, endChapter, endVerse };
}
