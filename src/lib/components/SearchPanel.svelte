<script lang="ts">
  import { app } from '../store.svelte';

  let query = $state('');
  let debounce: ReturnType<typeof setTimeout>;

  function onInput(e: Event) {
    query = (e.target as HTMLInputElement).value;
    clearTimeout(debounce);
    debounce = setTimeout(() => app.runSearch(query), 250);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') app.closeSearch();
  }

  const notesMode = $derived(app.searchMode === 'notes');
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" onclick={() => app.closeSearch()} role="presentation">
  <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
    <div class="tabs" role="tablist">
      <button
        class="tab"
        class:active={!notesMode}
        role="tab"
        aria-selected={!notesMode}
        onclick={() => app.setSearchMode('scripture')}
      >Scripture</button>
      <button
        class="tab"
        class:active={notesMode}
        role="tab"
        aria-selected={notesMode}
        onclick={() => app.setSearchMode('notes')}
      >My notes</button>
    </div>

    <div class="search-head">
      <input
        class="search-input"
        placeholder={notesMode ? 'Search your notes…' : 'Search the KJV…'}
        value={query}
        oninput={onInput}
        autofocus
      />
      <button class="close" aria-label="Close search" onclick={() => app.closeSearch()}>×</button>
    </div>

    <div class="results">
      {#if notesMode}
        {#if query.trim() && app.noteResults.length === 0}
          <p class="status">No notes match “{query}”.</p>
        {:else if app.noteResults.length}
          <p class="count">{app.noteResults.length} note{app.noteResults.length === 1 ? '' : 's'}</p>
          {#each app.noteResults as hit (hit.noteId)}
            <button class="hit" onclick={() => app.goToNoteHit(hit)}>
              <span class="ref">{hit.bookName} {hit.chapter}:{hit.verse}</span>
              <span class="text">{hit.snippet}</span>
            </button>
          {/each}
        {:else}
          <p class="status">Type to search the notes you’ve written.</p>
        {/if}
      {:else if app.searching}
        <p class="status">Searching…</p>
      {:else if query.trim() && app.searchResults.length === 0}
        <p class="status">No results for “{query}”.</p>
      {:else if app.searchResults.length}
        <p class="count">{app.searchResults.length} result{app.searchResults.length === 1 ? '' : 's'}</p>
        {#each app.searchResults as hit (hit.bookId + ':' + hit.chapter + ':' + hit.verse)}
          <button class="hit" onclick={() => app.goToHit(hit)}>
            <span class="ref">{hit.bookName} {hit.chapter}:{hit.verse}</span>
            <span class="text">{hit.text}</span>
          </button>
        {/each}
      {:else}
        <p class="status">Type to search all 66 books.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(43, 37, 32, 0.35);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 8vh;
    z-index: 50;
  }
  .panel {
    width: min(640px, 92vw);
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    background: #f4efe2;
    border: 1px solid #cbbfa8;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.6rem 0.9rem 0;
    border-bottom: 1px solid #ddd2bd;
  }
  .tab {
    font: inherit;
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: #8a7c66;
    cursor: pointer;
  }
  .tab:hover {
    color: #2b2520;
  }
  .tab.active {
    color: #2b2520;
    border-bottom-color: #7a5230;
    font-weight: 600;
  }
  .search-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.9rem 1rem;
    border-bottom: 1px solid #ddd2bd;
  }
  .search-input {
    flex: 1;
    font: inherit;
    font-size: 1.05rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid #c3b69c;
    border-radius: 8px;
    background: #fffdf8;
    color: #2b2520;
  }
  .search-input:focus {
    outline: 2px solid #c9b892;
    border-color: transparent;
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
  .results {
    overflow-y: auto;
    padding: 0.5rem;
  }
  .status,
  .count {
    color: #8a7c66;
    font-size: 0.85rem;
    padding: 0.6rem 0.6rem;
  }
  .hit {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: 8px;
    padding: 0.55rem 0.6rem;
    cursor: pointer;
    color: #2b2520;
  }
  .hit:hover {
    background: #e9e0cd;
  }
  .ref {
    display: block;
    font-size: 0.72rem;
    font-weight: 700;
    color: #7a5230;
    margin-bottom: 0.1rem;
  }
  .text {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 0.95rem;
    line-height: 1.4;
  }
</style>
