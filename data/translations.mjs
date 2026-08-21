// Canonical translation registry — the single source of truth for which Bible
// texts exist and their licensing/provenance. `data/build-db.mjs` seeds the
// `translations` table from this list, and the app surfaces it (an eventual
// "About → Bible Texts & Licenses" view) via `provider.translations()`.
//
// IMPORTANT: only add a translation here once its text is actually bundled AND
// it is legally redistributable. Public-domain status is explicit (`publicDomain`).
// Do NOT add copyrighted texts (e.g. NEV) without written redistribution permission.
//
// The build-only `source` field tells `build-db.mjs` where/how to fetch the text.
// It is not part of the app-facing metadata (the app reads translations from the
// DB, never this file). `source.reference: true` marks the translation whose book
// order + chapter counts define the shared `books` table; every other translation
// maps its verses onto those same canonical book ids.

export const TRANSLATIONS = [
  {
    id: 1,
    abbrev: 'KJV',
    name: 'King James Version',
    language: 'en',
    publicDomain: true,
    licenseName: 'Public Domain',
    licenseUrl: '',
    copyright: '',
    attribution: '',
    sourceUrl: 'https://github.com/aruljohn/Bible-kjv',
    textVersion: 'aruljohn/Bible-kjv',
    hasStrongs: true,
    isLocal: true,
    source: {
      format: 'aruljohn',
      base: 'https://raw.githubusercontent.com/aruljohn/Bible-kjv/master',
      reference: true, // defines the shared books table (canonical order + chapter counts)
    },
  },
  {
    id: 2,
    abbrev: 'WEB',
    name: 'World English Bible',
    language: 'en',
    publicDomain: true,
    licenseName: 'Public Domain',
    licenseUrl: 'https://worldenglish.bible/',
    copyright: '',
    attribution: 'World English Bible Classic (eBible.org) — dedicated to the public domain.',
    sourceUrl: 'https://ebible.org/eng-web/',
    textVersion: 'eng-web / engweb2025eb (eBible.org)',
    hasStrongs: false, // Strong's numbering is reconciled to the KJV wording only.
    isLocal: true,
    source: {
      // Authoritative eBible.org "World English Bible Classic" (American English,
      // uses "Yahweh" in the OT) — machine-readable verse-per-line distribution.
      format: 'ebible-vpl',
      url: 'https://ebible.org/Scriptures/eng-web_vpl.zip',
      entry: 'eng-web_vpl.txt',
    },
  },
  // Future (not yet bundled — do not uncomment until the text is imported):
  //   BSB (Berean Standard Bible) — public domain
  //   YLT (Young's Literal Translation) — public domain
  //   ASV (American Standard Version) — public domain
  //   NEV (New European Version) — COPYRIGHTED; requires permission from Duncan Heaster
];

// eBible/haiola three-letter book codes → canonical book id (1..66), Protestant
// order (matches the reference `books` table). Used by the `ebible-vpl` importer;
// any code NOT listed (Deuterocanon/Apocrypha: TOB, WIS, SIR, BAR, JDT, 1MA, …) is
// skipped, so only the 66 canonical books are imported.
export const EBIBLE_BOOK_ID = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8, '1SA': 9, '2SA': 10,
  '1KI': 11, '2KI': 12, '1CH': 13, '2CH': 14, EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19,
  PRO: 20, ECC: 21, SOL: 22, ISA: 23, JER: 24, LAM: 25, EZE: 26, DAN: 27, HOS: 28, JOE: 29,
  AMO: 30, OBA: 31, JON: 32, MIC: 33, NAH: 34, HAB: 35, ZEP: 36, HAG: 37, ZEC: 38, MAL: 39,
  MAT: 40, MAR: 41, LUK: 42, JOH: 43, ACT: 44, ROM: 45, '1CO': 46, '2CO': 47, GAL: 48,
  EPH: 49, PHI: 50, COL: 51, '1TH': 52, '2TH': 53, '1TI': 54, '2TI': 55, TIT: 56, PHM: 57,
  HEB: 58, JAM: 59, '1PE': 60, '2PE': 61, '1JO': 62, '2JO': 63, '3JO': 64, JUD: 65, REV: 66,
};
