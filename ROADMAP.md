# Study Bible App — Plan & Architecture

*Working title: **Marginalia** (name TBD — see the end of this doc for options)*

A cross-platform, **offline-first** study Bible that recreates the Oxford wide-margin
experience digitally: beautiful reading, cross-references and alternate readings in the
center, and full "pencil-marking" — highlighting, margin notes, underlines, freeform ink,
and inserted diagrams — all owned by you and portable.

Mac first, then Windows and Linux from the same codebase. Free/open-source friendly.

---

## 1. The prototype (Phase 0 — done)

`marginalia-prototype.html` is a single self-contained file (opens in any browser, works
offline). It already demonstrates the core ideas:

- Oxford-style page: cream paper, serif typography, chapter heading, a **wide outer margin**
  for notes and a **center reference column** with cross-references + alternate readings.
- **Highlighting** in six colors and **underlining**, both anchored to *verse + character
  offsets* (so they survive resizing, font changes, and reflow).
- **Margin notes** anchored to verses and aligned vertically beside them; editable in place.
- **Marking layers** ("Study" / "Sermon") you can show/hide independently — a feature paper
  can't offer.
- **Red-letter** toggle (words of Christ), cross-reference popovers, font sizing.
- **Export / Import** your markings as JSON — proof of the data-ownership principle.

Sample text bundled: Psalm 23, John 1:1–14, Matthew 6:9–13 (Lord's Prayer, red-letter),
Genesis 1:1–5, all public-domain KJV. This same UI becomes the reading view of the real app.

---

## 2. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| App shell | **Tauri v2** | Tiny (~10–15 MB), fast, one codebase → Mac/Win/Linux, uses the OS webview. |
| UI | **Web tech** (HTML/CSS/SVG/Canvas) + **Svelte** + **Vite** + **TypeScript** | CSS is ideal for the wide-margin layout; Svelte keeps the code approachable and low-boilerplate. |
| Storage | **SQLite** (via `tauri-plugin-sql`) | Local, fast verse lookup, your notes stored on *your* disk, fully exportable. |
| Backend logic | Minimal **Rust** (Tauri) | Most work is in the UI + SQL; little custom Rust needed. |

*Fallback:* if we ever want zero surprises across platforms, **Electron** is the safe
alternative — heavier, but the same UI code ports over.

Distribution: Tauri produces `.dmg` (Mac), `.msi`/`.exe` (Windows), `.AppImage`/`.deb`
(Linux). For sharing with friends, unsigned builds work (Mac users right-click → Open).
For polished public distribution, Mac notarization needs an Apple Developer account
(~$99/yr); Windows signing is optional but reduces SmartScreen warnings.

---

## 3. Data model (SQLite)

**Content (read-only, bundled):**

- `translations(id, abbrev, name, language, license, is_local)`
- `verses(translation_id, book, chapter, verse, text)` — indexed on (book, chapter, verse)
- `xrefs(from_book, from_ch, from_v, to_ref, weight)` — from the Treasury of Scripture Knowledge
- `alt_readings(book, ch, v, note)` — translators' marginal notes
- *(later)* `strongs`, `morphology`, `commentary`, `dictionary`

**User data (read-write, exportable):**

- `layers(id, name, color, visible, sort)`
- `marks(id, book, ch, v, start_char, end_char, type, color, layer_id, created, updated)`
  — `type` = highlight | underline | box | circle
- `notes(id, book, ch, v, body_md, layer_id, created, updated)`
- `ink_strokes(id, book, ch, v_anchor, svg_path, color, width, layer_id)` — freeform margin drawing
- `inserts(id, book, ch, v_anchor, image_blob, caption, layer_id)` — diagrams/charts/images
- `tags(id, name)`, `note_tags(note_id, tag_id)` — topical study
- `bookmarks`, `reading_progress`, `settings`

**The anchoring principle (the crux):** every marking attaches to a *canonical reference*
(book / chapter / verse / character range) — never to screen coordinates. This is what makes
markings survive reflow, font changes, window resizing, and even (at verse granularity)
switching translations. Freeform ink and inserts live in the **fixed margin**, anchored to a
verse's vertical position — mirroring how a real margin is a fixed strip of paper.

---

## 4. Content sources (all free / public domain)

- **KJV** — public domain (e.g. `scrollmapper/bible_databases`, `aruljohn/Bible-kjv`, STEPBible). Bundled offline.
- **World English Bible (WEB)** — public domain, readable modern English; the best "free NIV alternative." Bundled offline (eBible.org `eng-web` Classic edition).
- **Berean Standard Bible (BSB)** — public domain, modern; bundled offline (eBible.org `engbsb`).
- **Young's Literal Translation (YLT)** — public domain, hyper-literal; bundled offline (eBible.org `engylt`, 1898).
- **ASV, Darby, Geneva, Douay-Rheims** — public domain, also on ebible.org.
- **Cross-references** — Treasury of Scripture Knowledge (public domain) + OpenBible.info topical data (CC).
- **Original languages / interlinear / Strong's** — STEPBible (CC BY) and the Berean resources.
- **Commentaries** — Matthew Henry, JFB, etc. (public domain, ccel.org).

Standard interchange formats are **USFM / USX / OSIS**; we import these into our SQLite schema
once, at build time. (The sandbox this prototype was built in had network locked down, so the
sample text was transcribed by hand — wiring up the full datasets is a Phase 1 task.)

---

## 5. Translations & licensing — the honest picture

The KJV and the free translations above can ship **fully offline**. Modern copyrighted
translations are a *licensing* problem, not a coding one:

- **ESV** — Crossway's `api.esv.org` is the friendliest: free for personal/non-commercial use,
  rate-limited, and its terms forbid bulk-caching the whole text offline. Good first modern
  translation, delivered on demand via API.
- **NIV, NLT, NASB, CSB** — Biblica / Tyndale / Lockman / Holman. Offline licensing for an indie
  app is difficult and often costly; API access is limited. **NIV offline is unlikely without a
  commercial license.**

**Design response:** a *translation-provider* abstraction — a `LocalProvider` (SQLite) and a
`RemoteProvider` (publisher API) behind one interface — so free translations are offline and
licensed ones can be added later wherever terms allow, without touching the rest of the app.

---

## 6. Phased roadmap

**Phase 1 — MVP desktop app.** Tauri shell; bundle KJV + WEB; full navigation (book/chapter
picker, search); the Oxford reading layout (this prototype, productionized); highlights,
underlines, margin notes, layers; export/import; local SQLite. Ship Mac build + basic
Windows/Linux builds.

**Phase 2 — Study tools.** Cross-references (TSK) with popovers; parallel translations
side-by-side; full-text + Strong's search; alternate readings in the center column; a
commentary panel.

**Phase 3 — Rich marking.** Freeform ink drawing in the margins; image/diagram/chart inserts;
custom symbols and stickers; tags and a topical index; searching your own notes.

**Phase 4 — Sync & sharing.** Optional encrypted cloud sync; export a "marked Bible" to share
with a friend; shareable layers; signed installers; **open-source release**.

**Phase 5 — Extras.** Reading plans, audio, original-language interlinear, ESV via API, and a
plugin/module system for translations and study resources.

---

## 7. Open-source setup

- **Code license:** MIT or Apache-2.0 (both permissive, friend/community-friendly).
- **Data licenses:** track separately — KJV/WEB/TSK are public domain; STEPBible is CC BY
  (keep attribution). Maintain a `NOTICES` file.
- **Suggested repo layout:**
  ```
  /src            Svelte UI (reading view, toolbar, marking canvas)
  /src-tauri      Rust shell + SQL plugin config
  /data           import scripts + bundled SQLite (KJV, WEB, xrefs)
  /docs           this roadmap, schema, contributing guide
  ```
- **Continuing in Claude Code:** create the GitHub repo, clone it locally, run `claude` in the
  folder, and point it at this roadmap. We build phase by phase — I scaffold the Tauri project
  and import the KJV/WEB data first, then we grow the prototype's UI into the real reading view.

---

*Next step: pick a name and create the repo; then I'll scaffold Phase 1.*
