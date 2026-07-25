<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { app } from '../store.svelte';
  import Verse from './Verse.svelte';
  import MarginNote from './MarginNote.svelte';

  let contentEl: HTMLElement | undefined = $state();
  let marginEl: HTMLElement | undefined = $state();

  let tops = $state<Record<string, number>>({});
  let justCreated = $state<string | null>(null);

  const verses = $derived(app.verses);
  const notes = $derived(app.currentNotes);
  // Split the chapter across two text columns; references run down the middle.
  const mid = $derived(Math.ceil(verses.length / 2));
  const leftVerses = $derived(verses.slice(0, mid));
  const rightVerses = $derived(verses.slice(mid));

  // --- Marking (selection → verse+offset) ----------------------------------
  function offsetWithin(container: HTMLElement, node: Node, nodeOffset: number): number {
    const range = document.createRange();
    range.setStart(container, 0);
    range.setEnd(node, nodeOffset);
    return range.toString().length;
  }
  function vtextOf(node: Node | null): HTMLElement | null {
    const el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
    return el?.closest<HTMLElement>('.vtext') ?? null;
  }
  const WORD_CHAR = /[A-Za-z0-9'’-]/;
  function wordRange(text: string, offset: number): [number, number] | null {
    let start = Math.min(offset, text.length);
    let end = start;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    return end > start ? [start, end] : null;
  }

  function onMouseUp() {
    if (app.tool !== 'highlight' && app.tool !== 'underline') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !contentEl) return;
    const range = sel.getRangeAt(0);
    if (sel.isCollapsed) {
      const el = vtextOf(range.startContainer);
      if (!el) return;
      const caret = offsetWithin(el, range.startContainer, range.startOffset);
      const word = wordRange(el.textContent ?? '', caret);
      if (word) app.addMark(Number(el.dataset.v), word[0], word[1]);
      return;
    }
    for (const el of contentEl.querySelectorAll<HTMLElement>('.vtext')) {
      if (!range.intersectsNode(el)) continue;
      const len = (el.textContent ?? '').length;
      const start = el.contains(range.startContainer)
        ? offsetWithin(el, range.startContainer, range.startOffset)
        : 0;
      const end = el.contains(range.endContainer)
        ? offsetWithin(el, range.endContainer, range.endOffset)
        : len;
      app.addMark(Number(el.dataset.v), start, end);
    }
    sel.removeAllRanges();
  }

  function onContentClick(e: MouseEvent) {
    if (app.tool !== 'note') return;
    const el = vtextOf(e.target as Node);
    if (!el) return;
    justCreated = app.ensureNote(Number(el.dataset.v)).id;
  }

  // --- Position notes in the margin, aligned to their verse ----------------
  function recompute() {
    if (!contentEl || !marginEl) return;
    const marginTop = marginEl.getBoundingClientRect().top;
    const measured = app.currentNotes
      .map((n) => {
        const el = contentEl!.querySelector<HTMLElement>(`.vtext[data-v="${n.verse}"]`);
        const t = el ? el.getBoundingClientRect().top - marginTop : 0;
        return { id: n.id, top: Math.max(0, t) };
      })
      .sort((a, b) => a.top - b.top);

    const GAP = 8;
    const APPROX_H = 46;
    let prevBottom = -Infinity;
    const next: Record<string, number> = {};
    for (const m of measured) {
      const t = Math.max(m.top, prevBottom + GAP);
      next[m.id] = t;
      prevBottom = t + APPROX_H;
    }
    tops = next;
  }

  $effect(() => {
    app.verses;
    app.currentNotes;
    app.fontScale;
    app.chapter;
    app.bookId;
    tick().then(recompute);
  });

  onMount(() => {
    const ro = new ResizeObserver(() => recompute());
    if (contentEl) ro.observe(contentEl);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  });
</script>

<div class="desk">
  <article
    class="sheet"
    class:tool-highlight={app.tool === 'highlight'}
    class:tool-underline={app.tool === 'underline'}
    class:tool-note={app.tool === 'note'}
    style={`--font-scale:${app.fontScale}`}
  >
    <div class="running-head">
      <span>{app.book?.name ?? ''}</span>
      <span>King James Version</span>
    </div>

    <header class="chapter-head">
      <div class="book">{app.book?.name ?? ''}</div>
      <div class="chapter-num">{app.chapter}</div>
    </header>

    {#if verses.length === 0}
      <p class="empty">{app.loadingChapter ? 'Loading…' : 'No text.'}</p>
    {:else}
      <div class="content" bind:this={contentEl} onmouseup={onMouseUp} onclick={onContentClick} role="presentation">
        <div class="side-margin" aria-hidden="true"></div>

        <div class="text-col left">
          {#each leftVerses as verse (verse.v)}
            <Verse {verse} />
          {/each}
        </div>

        <div class="center-col" aria-label="Cross references">
          {#each app.xrefs as entry (entry.v)}
            <div class="ref-entry">
              <span class="ref-v">{entry.v}</span>
              <span class="ref-list">{entry.refs.join(' · ')}</span>
            </div>
          {/each}
        </div>

        <div class="text-col right">
          {#each rightVerses as verse (verse.v)}
            <Verse {verse} />
          {/each}
        </div>

        <div class="note-margin" bind:this={marginEl}>
          {#each notes as note (note.id)}
            <MarginNote {note} top={tops[note.id] ?? 0} open={justCreated === note.id} />
          {/each}
        </div>
      </div>
    {/if}
  </article>
</div>

<style>
  .desk {
    flex: 1;
    overflow-y: auto;
    padding: 2.5rem 1.5rem 5rem;
    background: #cdc0a9;
  }
  .sheet {
    position: relative;
    margin: 0 auto;
    background: #f6f1e5;
    width: min(1320px, 100%);
    padding: 2rem 2.5rem 3.5rem;
    border-radius: 2px;
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 12px 40px rgba(0, 0, 0, 0.18);
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
    color: #2b2520;
  }
  .sheet.tool-highlight .text-col,
  .sheet.tool-underline .text-col {
    cursor: text;
  }
  .sheet.tool-note .text-col {
    cursor: cell;
  }

  .running-head {
    display: flex;
    justify-content: space-between;
    font-variant: small-caps;
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    color: #a2937a;
    padding-bottom: 0.75rem;
    margin-bottom: 1.4rem;
    border-bottom: 1px solid #e2d8c4;
  }
  .chapter-head {
    text-align: center;
    margin-bottom: 1.5rem;
  }
  .book {
    font-variant: small-caps;
    letter-spacing: 0.28em;
    font-size: 0.82rem;
    color: #6b5d4b;
    text-transform: lowercase;
  }
  .chapter-num {
    font-size: 3.2rem;
    color: #7a5230;
    line-height: 1.05;
  }
  .empty {
    text-align: center;
    color: #8a7c66;
    font-style: italic;
  }

  .content {
    display: grid;
    grid-template-columns:
      minmax(140px, 180px) 1fr minmax(104px, 128px) 1fr minmax(210px, 290px);
    column-gap: 1.5rem;
    align-items: stretch;
  }
  .side-margin {
    border-right: 1px solid #e2d8c4;
  }
  .text-col {
    text-align: justify;
    hyphens: auto;
    -webkit-hyphens: auto;
    font-size: calc(1.12rem * var(--font-scale, 1));
    line-height: 1.72;
  }

  .center-col {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: calc(0.7rem * var(--font-scale, 1));
    line-height: 1.5;
    color: #6b5d4b;
    padding: 0.1rem 0.85rem;
    border-left: 1px solid #ddd2bd;
    border-right: 1px solid #ddd2bd;
  }
  .ref-entry {
    margin-bottom: 0.5em;
    text-indent: -0.6em;
    padding-left: 0.6em;
  }
  .ref-v {
    font-weight: 700;
    color: #2b2520;
    margin-right: 0.3em;
  }
  .ref-list {
    color: #6b5d4b;
  }

  .note-margin {
    position: relative;
    border-left: 1px solid #e2d8c4;
    padding-left: 0.6rem;
  }
</style>
