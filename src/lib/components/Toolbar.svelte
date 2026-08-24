<script lang="ts">
  import { app } from '../store.svelte';
  import { HIGHLIGHT_COLORS } from '../types';
  import { nativeApp } from '../backup';
  import type { ToolMode } from '../types';

  const tools: { id: ToolMode; label: string }[] = [
    { id: 'read', label: 'Read' },
    { id: 'highlight', label: 'Highlight' },
    { id: 'underline', label: 'Underline' },
    { id: 'note', label: 'Note' },
    { id: 'erase', label: 'Erase' },
  ];

  let fileInput: HTMLInputElement;
  let importError = $state(''); // shown in-app; alert() is a no-op in the Tauri webview
  let backupMsg = $state('');

  async function doBackup() {
    importError = '';
    try {
      const where = await app.backupNow();
      backupMsg = where === 'saved' ? 'Backed up ✓' : 'Saved a copy ✓';
    } catch (err) {
      backupMsg = `Backup failed: ${(err as Error).message}`;
    }
    setTimeout(() => (backupMsg = ''), 2500);
  }

  const chapterOptions = $derived(
    Array.from({ length: app.book?.chapters ?? 0 }, (_, i) => i + 1)
  );

  let jumpValue = $state('');
  let jumpBad = $state(false);
  function onJump(e: KeyboardEvent) {
    if (e.key !== 'Enter') {
      jumpBad = false;
      return;
    }
    if (app.jumpToReference(jumpValue)) {
      jumpValue = '';
      jumpBad = false;
    } else {
      jumpBad = true;
    }
  }

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
    importError = '';
    try {
      await app.importJSON(await file.text());
    } catch (err) {
      importError = `Could not import: ${(err as Error).message}`;
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
      <select
        aria-label="Translation"
        value={app.translationId}
        disabled={app.translations.length <= 1}
        onchange={(e) => app.setTranslation(Number((e.target as HTMLSelectElement).value))}
      >
        {#each app.translations as t (t.id)}
          <option value={t.id}>{t.name}</option>
        {/each}
      </select>
      <div class="nav">
        <button class="btn nav-arrow hist" aria-label="Back" title="Back" disabled={!app.canBack} onclick={() => app.back()}>↶</button>
        <button class="btn nav-arrow hist" aria-label="Forward" title="Forward" disabled={!app.canForward} onclick={() => app.forward()}>↷</button>
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
        <button
          class="btn nav-arrow star"
          class:active={app.isBookmarked}
          aria-label={app.isBookmarked ? 'Remove bookmark' : 'Bookmark this chapter'}
          title={app.isBookmarked ? 'Remove bookmark' : 'Bookmark this chapter'}
          onclick={() => app.toggleBookmark()}
        >{app.isBookmarked ? '★' : '☆'}</button>
      </div>
      <input
        class="jump"
        class:bad={jumpBad}
        placeholder="Go to… (e.g. Jn 3)"
        aria-label="Go to reference"
        bind:value={jumpValue}
        onkeydown={onJump}
      />
      <button class="btn search-btn" onclick={() => app.search.openPanel()}>Search</button>
      <button class="btn companion-btn" onclick={() => app.companion.openPanel()}>Companion</button>
      {#if app.translations.length > 1}
        <button class="btn" onclick={() => app.compare.openAt(app.bookId, app.chapter)}>Compare</button>
      {/if}
      <button class="btn" onclick={() => app.openBookmarks()}>Bookmarks</button>
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
        <div class="layer" class:active={layer.id === app.activeLayerId}>
          <input
            type="checkbox"
            checked={layer.visible}
            aria-label={`Show ${layer.name}`}
            onchange={() => app.toggleLayer(layer.id)}
          />
          <button
            class="layer-pick"
            title={layer.id === app.activeLayerId ? 'Active layer (new marks go here)' : `Mark on ${layer.name}`}
            onclick={() => app.setActiveLayer(layer.id)}
          >
            <span class="dot" style={`background:${layer.color}`}></span>
            <span class="layer-name">{layer.name}</span>
          </button>
        </div>
      {/each}
      <button class="btn layer-add" title="New layer" onclick={() => app.addLayer()}>+</button>
      <button class="btn" onclick={() => app.openLayers()}>Manage</button>
    </div>

    <div class="group">
      <!-- Red-letter toggle hidden until a words-of-Christ dataset is bundled (it was inert). -->
      <!-- Strong's is tied to KJV wording, so only shown for translations that have it. -->
      {#if app.strongsAvailable}
        <button class="btn" class:active={app.strongsOn} onclick={() => app.toggleStrongs()}>
          Strong's: {app.strongsOn ? 'on' : 'off'}
        </button>
      {/if}
    </div>
    <div class="group">
      <button class="btn" aria-label="Decrease font size" onclick={() => app.adjustFont(-0.1)}>A−</button>
      <button class="btn" aria-label="Increase font size" onclick={() => app.adjustFont(0.1)}>A+</button>
    </div>
    <div class="group">
      <button class="btn" onclick={doBackup}>Back up</button>
      {#if nativeApp}
        <button class="btn" onclick={() => app.showBackups()}>Show backups</button>
      {/if}
      <button class="btn" onclick={doExport}>Export</button>
      <button class="btn" onclick={() => fileInput.click()}>Import</button>
      <input bind:this={fileInput} type="file" accept="application/json" class="hidden-file" onchange={onImportFile} />
      {#if backupMsg}
        <span class="backup-msg">{backupMsg}</span>
      {/if}
      {#if importError}
        <span class="import-error" role="alert">{importError}</span>
      {/if}
    </div>
  </div>
</header>

<style>
  .toolbar {
    background: #e6ddcb;
    border-bottom: 1px solid #cbbfa8;
    padding: 0.4rem 1rem 0.45rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .brand-row {
    gap: 1rem;
    margin-bottom: 0;
  }
  .brand-name {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 1.1rem;
    color: #2b2520;
    line-height: 1.05;
  }
  .brand-sub {
    font-size: 0.6rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8a7c66;
  }
  .pickers {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .nav {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  select {
    font: inherit;
    font-size: 0.82rem;
    padding: 0.28rem 0.45rem;
    border: 1px solid #c3b69c;
    border-radius: 6px;
    background: #fbf8f0;
    color: #2b2520;
  }
  select[aria-label='Translation'] {
    min-width: 130px;
  }
  select[aria-label='Book'] {
    min-width: 128px;
  }
  select:disabled {
    opacity: 0.75;
  }

  .row-label {
    width: 3.2rem;
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8a7c66;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding-right: 0.25rem;
  }

  .btn {
    font: inherit;
    font-size: 0.8rem;
    padding: 0.26rem 0.55rem;
    border: 1px solid #c3b69c;
    border-radius: 6px;
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
    padding: 0.26rem 0.45rem;
    font-size: 0.95rem;
    line-height: 1;
  }
  .search-btn,
  .companion-btn {
    background: #efe7d6;
  }
  .hist {
    font-size: 0.9rem;
  }
  .jump {
    font: inherit;
    font-size: 0.8rem;
    width: 7.5rem;
    padding: 0.26rem 0.5rem;
    border: 1px solid #c3b69c;
    border-radius: 6px;
    background: #fbf8f0;
    color: #2b2520;
  }
  .jump:focus {
    outline: 2px solid #c9b892;
    border-color: transparent;
  }
  .jump.bad {
    border-color: #b03a2e;
    background: #fbeeec;
  }
  .star {
    font-size: 1rem;
  }
  /* Keep the bookmarked star gold rather than the default dark "active" look. */
  .btn.star.active {
    background: #fbf8f0;
    color: #d4a017;
    border-color: #c3b69c;
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
    gap: 0.3rem;
    padding: 0.15rem 0.3rem 0.15rem 0.4rem;
    border-radius: 999px;
    border: 1px solid transparent;
  }
  /* The active layer (where new marks/notes land) gets a subtle ring. */
  .layer.active {
    border-color: #a4906f;
    background: #efe7d6;
  }
  .layer-pick {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.15rem 0.1rem;
    font: inherit;
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
  .layer-add {
    font-size: 1rem;
    line-height: 1;
    padding: 0.3rem 0.55rem;
  }

  .hidden-file {
    display: none;
  }
  .import-error {
    font-size: 0.75rem;
    color: #b03a2e;
    max-width: 18rem;
  }
  .backup-msg {
    font-size: 0.75rem;
    color: #5e8c5a;
  }
</style>
