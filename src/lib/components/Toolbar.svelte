<script lang="ts">
  import { app } from '../store.svelte';
  import { HIGHLIGHT_COLORS } from '../types';
  import type { ToolMode } from '../types';

  const tools: { id: ToolMode; label: string }[] = [
    { id: 'read', label: 'Read' },
    { id: 'highlight', label: 'Highlight' },
    { id: 'underline', label: 'Underline' },
    { id: 'note', label: 'Note' },
    { id: 'erase', label: 'Erase' },
  ];

  let fileInput: HTMLInputElement;

  const chapterOptions = $derived(
    Array.from({ length: app.book?.chapters ?? 0 }, (_, i) => i + 1)
  );

  function onBookChange(e: Event) {
    app.goTo(Number((e.target as HTMLSelectElement).value), 1);
  }
  function onChapterChange(e: Event) {
    app.goTo(app.bookId, Number((e.target as HTMLSelectElement).value));
  }

  function doExport() {
    const blob = new Blob([app.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marginalia-markings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await app.importJSON(await file.text());
    } catch (err) {
      alert(`Could not import markings: ${(err as Error).message}`);
    }
    input.value = '';
  }
</script>

<header class="toolbar">
  <div class="row brand-row">
    <div class="brand">
      <div class="brand-name">Marginalia</div>
      <div class="brand-sub">Study Bible</div>
    </div>
    <div class="pickers">
      <select aria-label="Translation" disabled>
        <option>King James (KJV)</option>
      </select>
      <div class="nav">
        <button class="btn nav-arrow" aria-label="Previous chapter" disabled={!app.canPrev} onclick={() => app.prevChapter()}>‹</button>
        <select aria-label="Book" value={app.bookId} onchange={onBookChange}>
          {#each app.books as b (b.id)}
            <option value={b.id}>{b.name}</option>
          {/each}
        </select>
        <select aria-label="Chapter" value={app.chapter} onchange={onChapterChange}>
          {#each chapterOptions as c (c)}
            <option value={c}>{c}</option>
          {/each}
        </select>
        <button class="btn nav-arrow" aria-label="Next chapter" disabled={!app.canNext} onclick={() => app.nextChapter()}>›</button>
      </div>
      <button class="btn search-btn" onclick={() => app.openSearch()}>Search</button>
      <button class="btn companion-btn" onclick={() => app.openCompanion()}>Companion</button>
    </div>
  </div>

  <div class="row">
    <span class="row-label">Tools</span>
    <div class="group">
      {#each tools as t (t.id)}
        <button class="btn tool" class:active={app.tool === t.id} onclick={() => app.setTool(t.id)}>
          {t.label}
        </button>
      {/each}
    </div>
    <div class="group swatches">
      {#each HIGHLIGHT_COLORS as c (c.value)}
        <button
          class="swatch"
          class:selected={app.color === c.value}
          style={`background:${c.value}`}
          aria-label={`Highlight ${c.name}`}
          onclick={() => (app.color = c.value)}
        ></button>
      {/each}
    </div>
  </div>

  <div class="row">
    <span class="row-label">Layers</span>
    <div class="group layers">
      {#each app.layers as layer (layer.id)}
        <label class="layer">
          <input type="checkbox" checked={layer.visible} onchange={() => app.toggleLayer(layer.id)} />
          <span class="dot" style={`background:${layer.color}`}></span>
          <span class="layer-name">{layer.name}</span>
        </label>
      {/each}
    </div>

    <div class="group">
      <button class="btn" onclick={() => (app.redLetter = !app.redLetter)}>
        Red letter: {app.redLetter ? 'on' : 'off'}
      </button>
      <button class="btn" class:active={app.strongsOn} onclick={() => app.toggleStrongs()}>
        Strong's: {app.strongsOn ? 'on' : 'off'}
      </button>
    </div>
    <div class="group">
      <button class="btn" aria-label="Decrease font size" onclick={() => app.adjustFont(-0.1)}>A−</button>
      <button class="btn" aria-label="Increase font size" onclick={() => app.adjustFont(0.1)}>A+</button>
    </div>
    <div class="group">
      <button class="btn" onclick={doExport}>Export</button>
      <button class="btn" onclick={() => fileInput.click()}>Import</button>
      <input bind:this={fileInput} type="file" accept="application/json" class="hidden-file" onchange={onImportFile} />
    </div>
  </div>
</header>

<style>
  .toolbar {
    background: #e6ddcb;
    border-bottom: 1px solid #cbbfa8;
    padding: 0.85rem 1.5rem 0.95rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .brand-row {
    gap: 1.75rem;
    margin-bottom: 0.15rem;
  }
  .brand-name {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 1.5rem;
    color: #2b2520;
    line-height: 1.1;
  }
  .brand-sub {
    font-size: 0.66rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #8a7c66;
  }
  .pickers {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .nav {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  select {
    font: inherit;
    font-size: 0.9rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid #c3b69c;
    border-radius: 7px;
    background: #fbf8f0;
    color: #2b2520;
  }
  select[aria-label='Translation'] {
    min-width: 150px;
  }
  select[aria-label='Book'] {
    min-width: 140px;
  }
  select:disabled {
    opacity: 0.75;
  }

  .row-label {
    width: 3.6rem;
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8a7c66;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-right: 0.35rem;
  }

  .btn {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid #c3b69c;
    border-radius: 7px;
    background: #fbf8f0;
    color: #2b2520;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover {
    border-color: #a4906f;
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .nav-arrow {
    padding: 0.4rem 0.6rem;
    font-size: 1rem;
    line-height: 1;
  }
  .search-btn,
  .companion-btn {
    background: #efe7d6;
  }
  .btn.tool.active,
  .btn.active {
    background: #2b2520;
    color: #f4efe2;
    border-color: #2b2520;
  }

  .swatches {
    gap: 0.3rem;
  }
  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid rgba(0, 0, 0, 0.12);
    cursor: pointer;
    padding: 0;
  }
  .swatch.selected {
    border-color: #2b2520;
    box-shadow: 0 0 0 2px #e6ddcb, 0 0 0 3px #2b2520;
  }

  .layers {
    gap: 0.5rem;
  }
  .layer {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.55rem;
    border-radius: 999px;
    cursor: pointer;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .layer-name {
    font-size: 0.85rem;
    color: #2b2520;
  }

  .hidden-file {
    display: none;
  }
</style>
