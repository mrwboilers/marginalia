# Marginalia — trying it out

Thanks for taking a look! **Marginalia** is a study Bible for the Mac that recreates
the classic Oxford wide-margin experience: beautiful reading, cross-references down
the middle, and full "pencil marking" — highlights, underlines, and notes — all saved
on *your* computer and fully yours.

This is an early build shared for feedback, so expect a rough edge or two.

## Install (macOS)

1. Open **Marginalia.dmg** and drag **Marginalia** into your **Applications** folder.
2. The app isn't signed with an Apple Developer certificate yet, so the first launch
   is blocked. Clear that with one command in **Terminal**:
   ```bash
   xattr -dr com.apple.quarantine /Applications/Marginalia.app
   ```
   Then open Marginalia normally (double-click).

   *Alternative:* if you'd rather not use Terminal, try to open it once, then go to
   **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.

> The scary "damaged / can't be opened" message just means it's unsigned — it's safe.
> Nothing in the app talks to the internet; it runs entirely offline on your Mac.

## What to try

- **Read & navigate** — pick any book/chapter (top bar), or use the ‹ › arrows.
- **Search** — full-text search across all 66 books.
- **Cross-references** — the center column. *Hover* a reference to preview the passage;
  *click* it to jump there.
- **Highlight / Underline** — pick the tool, then drag across text (or click a word).
- **Notes** — pick the **Note** tool, click a verse, and write a **rich-text** note:
  bold, headings, lists, links, even pasted/dropped **images**. Notes live in the margin
  next to their verse; hover to read, click to edit.
- **Strong's numbers** — toggle to see the original Hebrew/Greek word behind each word
  (hover a number for the definition).
- **Bible Companion** — the "Companion" button opens Robert Roberts' daily reading plan,
  on today's date. Check off portions as you read; browse other days.
- **Font size** and **Export / Import** your markings are in the top bar.

## Your notes are yours

Everything you mark is saved locally and automatically. Use **Export** to save a backup
file of all your markings — and if you hit a bug, sending me that file helps me
reproduce it.

## Known rough edges (no need to report these)

- **KJV only** for now — more translations are planned.
- The note editor is a panel in the margin; for a note near the **bottom** of a long
  chapter it can open partly off-screen — scroll up a little and it'll fit.
- It's an early build, so if something feels off, that's exactly what I want to hear.

## What I'd love feedback on

- Does the **reading** experience feel good — typography, layout, navigation?
- Is **note-taking** intuitive? Anything you wanted to do and couldn't?
- The **Bible Companion** — useful? Would you actually read along?
- Anything confusing, broken, or missing.

Just message me — and attach an Export file if it's about a specific bug. Thank you!
