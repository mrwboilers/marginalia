<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../store.svelte';

  let gridEl = $state<HTMLElement | undefined>();

  const columns = $derived(app.compare.columns);
  // Union of verse numbers across all columns, ascending — so a verse missing from
  // one translation just leaves that cell blank while the others line up.
  const verseNums = $derived(
    [...new Set(columns.flatMap((c) => c.verses.map((v) => v.v)))].sort((a, b) => a - b)
  );
  const maps = $derived(columns.map((c) => new Map(c.verses.map((v) => [v.v, v.text]))));
  // `auto` verse-number column, then one equal column per translation.
  const template = $derived(`auto ${columns.map(() => 'minmax(200px, 1fr)').join(' ')}`);

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') app.compare.closePanel();
  }

  // When the panel opens (or the chapter changes) scroll the reading anchor into view.
  let lastScrolled = '';
  $effect(() => {
    const key = `${app.compare.bookId}:${app.compare.chapter}:${app.compare.focusVerse}`;
    const focus = app.compare.focusVerse;
    if (!columns.length || key === lastScrolled) return;
    lastScrolled = key;
    tick().then(() => {
      if (!gridEl) return;
      const target = focus
        ? gridEl.querySelector<HTMLElement>(`.vnum[data-v="${focus}"]`)
        : null;
      if (target) target.scrollIntoView({ block: 'center' });
      else gridEl.scrollTo({ top: 0 });
    });
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" onclick={() => app.compare.closePanel()} role="presentation">
  <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Compare translations">
    <header class="head">
      <div class="nav">
        <button class="btn" aria-label="Previous chapter" disabled={!app.compare.canPrev} onclick={() => app.compare.step(-1)}>‹</button>
        <span class="ref">{app.compare.label}</span>
        <button class="btn" aria-label="Next chapter" disabled={!app.compare.canNext} onclick={() => app.compare.step(1)}>›</button>
      </div>
      <div class="picker" role="group" aria-label="Translations to compare">
        {#each app.compare.available as t (t.id)}
          <button
            class="chip"
            class:on={app.compare.isSelected(t.id)}
            title={t.name}
            onclick={() => app.compare.toggleTranslation(t.id)}
          >{t.abbrev}</button>
        {/each}
      </div>
      <button class="close" aria-label="Close comparison" onclick={() => app.compare.closePanel()}>×</button>
    </header>

    {#if columns.length === 0}
      <p class="status">{app.compare.loading ? 'Loading…' : 'Pick at least one translation.'}</p>
    {:else}
      <div class="grid" bind:this={gridEl} style={`grid-template-columns: ${template}`}>
        <div class="corner hcell"></div>
        {#each columns as col (col.translation.id)}
          <div class="hcell" title={col.translation.name}>{col.translation.abbrev}</div>
        {/each}

        {#each verseNums as n (n)}
          <div class="vnum" data-v={n}>{n}</div>
          {#each columns as col, i (col.translation.id)}
            <div class="cell">{maps[i].get(n) ?? ''}</div>
          {/each}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(43, 37, 32, 0.4);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 4vh 3vw;
    z-index: 60;
  }
  .panel {
    width: min(1500px, 100%);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    background: #f4efe2;
    border: 1px solid #cbbfa8;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.7rem 0.9rem;
    border-bottom: 1px solid #ddd2bd;
    flex-wrap: wrap;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .ref {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 1.1rem;
    color: #2b2520;
    min-width: 8ch;
    text-align: center;
  }
  .btn {
    font: inherit;
    border: 1px solid #c3b69c;
    background: #fffdf8;
    color: #2b2520;
    border-radius: 6px;
    padding: 0.15rem 0.55rem;
    cursor: pointer;
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    flex: 1;
  }
  .chip {
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border: 1px solid #d8ccb4;
    border-radius: 999px;
    background: #fffdf8;
    color: #8a7c66;
    cursor: pointer;
  }
  .chip:hover {
    border-color: #a4906f;
  }
  .chip.on {
    background: #7a5230;
    border-color: #7a5230;
    color: #f4efe2;
  }
  .close {
    border: none;
    background: none;
    font-size: 1.6rem;
    line-height: 1;
    color: #8a7c66;
    cursor: pointer;
    padding: 0 0.3rem;
  }
  .status {
    padding: 2rem;
    text-align: center;
    color: #8a7c66;
    font-style: italic;
  }

  .grid {
    display: grid;
    overflow: auto;
    align-content: start;
  }
  .hcell {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #ece3d0;
    border-bottom: 1px solid #cbbfa8;
    padding: 0.5rem 0.8rem;
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    color: #6b5d4b;
  }
  .corner {
    left: 0;
    z-index: 3;
  }
  /* Verse-number column stays visible while scrolling sideways. */
  .vnum,
  .corner {
    position: sticky;
    left: 0;
  }
  .vnum {
    background: #f4efe2;
    z-index: 1;
    padding: 0.35rem 0.6rem;
    text-align: right;
    font-size: 0.72rem;
    font-weight: 700;
    color: #9a6a3a;
    border-bottom: 1px solid #eee3ce;
  }
  .cell {
    padding: 0.35rem 0.85rem;
    border-bottom: 1px solid #eee3ce;
    border-left: 1px solid #eee3ce;
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: calc(1rem * var(--font-scale, 1));
    line-height: 1.55;
    color: #2b2520;
  }
</style>
