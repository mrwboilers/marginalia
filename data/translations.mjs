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
    attribution: 'World English Bible (eBible.org) — dedicated to the public domain.',
    sourceUrl: 'https://ebible.org/web/',
    textVersion: 'getbible.net v2 / eng-web',
    hasStrongs: false, // Strong's numbering is reconciled to the KJV wording only.
    isLocal: true,
    source: {
      format: 'getbible',
      base: 'https://api.getbible.net/v2/web',
    },
  },
  // Future (not yet bundled — do not uncomment until the text is imported):
  //   BSB (Berean Standard Bible) — public domain
  //   YLT (Young's Literal Translation) — public domain
  //   ASV (American Standard Version) — public domain
  //   NEV (New European Version) — COPYRIGHTED; requires permission from Duncan Heaster
];
