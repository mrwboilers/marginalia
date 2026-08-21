// Canonical translation registry — the single source of truth for which Bible
// texts exist and their licensing/provenance. `data/build-db.mjs` seeds the
// `translations` table from this list, and the app surfaces it (an eventual
// "About → Bible Texts & Licenses" view) via `provider.translations()`.
//
// IMPORTANT: only add a translation here once its text is actually bundled AND
// it is legally redistributable. Public-domain status is explicit (`publicDomain`).
// Do NOT add copyrighted texts (e.g. NEV) without written redistribution permission.

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
  },
  // Future (not yet bundled — do not uncomment until the text is imported):
  //   WEB (World English Bible) — public domain — ebible.org
  //   BSB (Berean Standard Bible) — public domain
  //   YLT (Young's Literal Translation) — public domain
  //   ASV (American Standard Version) — public domain
  //   NEV (New European Version) — COPYRIGHTED; requires permission from Duncan Heaster
];
