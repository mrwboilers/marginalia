// Browser-dev loader for the eBible.org "verse-per-line" WEB distribution.
// Only used by HttpProvider (npm run dev). The packaged app reads WEB from the
// bundled SQLite DB instead. Keep this in sync with data/build-db.mjs, which does
// the same parse at build time for the shipped DB.

/** A book normalized to numeric chapter/verse (structurally matches HttpProvider's NormBook). */
export interface NormBook {
  chapters: { chapter: number; verses: { verse: number; text: string }[] }[];
}

// eBible/haiola 3-letter book codes → canonical book id (1..66), Protestant order.
// Codes not listed (Deuterocanon) are skipped. Mirror of EBIBLE_BOOK_ID in
// data/translations.mjs.
const EBIBLE_BOOK_ID: Record<string, number> = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8, '1SA': 9, '2SA': 10,
  '1KI': 11, '2KI': 12, '1CH': 13, '2CH': 14, EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19,
  PRO: 20, ECC: 21, SOL: 22, ISA: 23, JER: 24, LAM: 25, EZE: 26, DAN: 27, HOS: 28, JOE: 29,
  AMO: 30, OBA: 31, JON: 32, MIC: 33, NAH: 34, HAB: 35, ZEP: 36, HAG: 37, ZEC: 38, MAL: 39,
  MAT: 40, MAR: 41, LUK: 42, JOH: 43, ACT: 44, ROM: 45, '1CO': 46, '2CO': 47, GAL: 48,
  EPH: 49, PHI: 50, COL: 51, '1TH': 52, '2TH': 53, '1TI': 54, '2TI': 55, TIT: 56, PHM: 57,
  HEB: 58, JAM: 59, '1PE': 60, '2PE': 61, '1JO': 62, '2JO': 63, '3JO': 64, JUD: 65, REV: 66,
};

/** Extract one entry from a ZIP ArrayBuffer (deflate via DecompressionStream, or stored). */
async function unzipEntry(buf: ArrayBuffer, name: string): Promise<string> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const dec = new TextDecoder();
  let eocd = buf.byteLength - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('bad zip: no end-of-central-directory record');
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(off + 10, true);
    const csize = view.getUint32(off + 20, true);
    const nlen = view.getUint16(off + 28, true);
    const elen = view.getUint16(off + 30, true);
    const clen = view.getUint16(off + 32, true);
    const lho = view.getUint32(off + 42, true);
    const entryName = dec.decode(bytes.subarray(off + 46, off + 46 + nlen));
    if (entryName === name) {
      const lnlen = view.getUint16(lho + 26, true);
      const lelen = view.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lelen;
      const comp = bytes.subarray(start, start + csize);
      if (method === 0) return dec.decode(comp);
      const stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }
    off += 46 + nlen + elen + clen;
  }
  throw new Error(`entry not found in zip: ${name}`);
}

/**
 * Fetch + parse an eBible VPL zip (WEB/BSB/YLT) into `bookId → NormBook`. Empty
 * placeholder verses (omitted textual variants, e.g. Acts 8:37) and Deuterocanon
 * are dropped, matching the bundled build exactly.
 */
export async function fetchEbibleVpl(url: string, entry: string): Promise<Map<number, NormBook>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load eBible VPL (${res.status}) from ${url}`);
  const text = await unzipEntry(await res.arrayBuffer(), entry);

  const byBook = new Map<number, Map<number, { verse: number; text: string }[]>>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\S+)\s+(\d+):(\d+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const bookId = EBIBLE_BOOK_ID[m[1]];
    if (!bookId) continue;
    const body = m[4].replace(/\s+/g, ' ').trim();
    if (!body) continue;
    const chapter = Number(m[2]);
    let chapters = byBook.get(bookId);
    if (!chapters) byBook.set(bookId, (chapters = new Map()));
    let verses = chapters.get(chapter);
    if (!verses) chapters.set(chapter, (verses = []));
    verses.push({ verse: Number(m[3]), text: body });
  }

  const out = new Map<number, NormBook>();
  for (const [bookId, chapters] of byBook) {
    out.set(bookId, {
      chapters: [...chapters.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([chapter, verses]) => ({ chapter, verses })),
    });
  }
  return out;
}
