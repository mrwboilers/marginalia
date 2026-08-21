# Marginalia

An offline study Bible for the Mac that recreates the classic Oxford wide-margin
experience: beautiful reading, cross-references down the middle, and full
"pencil marking" — highlights, underlines, and rich notes — all saved on **your**
computer and fully yours.

Built with [Tauri](https://tauri.app/) + SvelteKit. Fully offline; nothing you read
or write leaves your machine.

---

## Download & install

Grab the latest build from the
[**Releases**](https://github.com/mrwboilers/marginalia/releases/latest) page. The
app isn't code-signed yet, so each OS shows a one-time "unknown developer" warning —
the steps below clear it.

### macOS

1. Download **`Marginalia_<version>_universal.dmg`** (a *universal* binary — runs
   natively on both Apple Silicon and Intel Macs).
2. Open the `.dmg` and drag **Marginalia** into your **Applications** folder.
3. macOS blocks the unsigned first launch with a *"Marginalia is damaged / can't be
   opened"* warning. Clear it with one command in **Terminal**:
   ```bash
   xattr -dr com.apple.quarantine /Applications/Marginalia.app
   ```
   Then open Marginalia normally. *(Alternative: try to open it once, then go to
   **System Settings → Privacy & Security** and click **Open Anyway**.)*

### Windows (x64)

1. Download **`Marginalia_<version>_x64-setup.exe`** (or the `.msi`) and run it.
2. Windows SmartScreen shows *"Windows protected your PC"* because the installer is
   unsigned. Click **More info → Run anyway**.
3. Windows 10/11 already include the required WebView2 runtime; if it's missing the
   installer fetches it automatically.

## Features

- **Oxford wide-margin reading view** — two justified columns with a center
  cross-reference column (Treasury of Scripture Knowledge, 344k references).
- **Marking** — highlight and underline anchored to verse + character offsets, so
  markings survive reflow, resizing, and font changes.
- **Rich notes** — margin notes with bold, headings, lists, links, and embedded
  images; hover to read, click to edit.
- **Search** — full-text search across all 66 books.
- **Strong's numbers** — inline Hebrew/Greek numbers with hover definitions.
- **Bible Companion** — Robert Roberts' daily reading plan (the whole Bible in a
  year), keyed to today's date, with check-off progress.
- **Your data is yours** — everything is stored locally and exportable/importable as
  JSON.

The bundled text is the **King James Version** (public domain). See
[NOTICES.md](NOTICES.md) for all data sources and attributions.

## Build from source

Requires [Node.js](https://nodejs.org/) (v20+) and the
[Rust toolchain](https://rustup.rs/) (for Tauri).

```bash
git clone https://github.com/mrwboilers/marginalia.git
cd marginalia
npm install

# Run in development (native app with live reload)
npm run tauri dev

# Build a distributable universal macOS bundle (.app + .dmg)
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
# → src-tauri/target/universal-apple-darwin/release/bundle/dmg/
```

The reading data is bundled (see `data/` for the import scripts and `static/` +
`src-tauri/db/` for the generated data).

## Project docs

- [ROADMAP.md](ROADMAP.md) — plan, architecture, and phased feature roadmap.
- [SHARING.md](SHARING.md) — a friendly walkthrough for people trying the app.
- [NOTICES.md](NOTICES.md) — third-party data sources and licenses.
- [RELEASING.md](RELEASING.md) — how releases are built, and the macOS/Windows code-signing setup.
