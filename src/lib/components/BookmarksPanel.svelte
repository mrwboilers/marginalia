<script lang="ts">
  import { app } from '../store.svelte';

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') app.closeBookmarks();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" onclick={() => app.closeBookmarks()} role="presentation">
  <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Bookmarks">
    <div class="head">
      <div class="title">Bookmarks</div>
      <button class="close" aria-label="Close" onclick={() => app.closeBookmarks()}>×</button>
    </div>

    <div class="list">
      {#if app.bookmarks.length === 0}
        <p class="status">No bookmarks yet. Use the ☆ next to the chapter picker to save a place.</p>
      {:else}
        {#each app.bookmarks as bm (bm.id)}
          <div class="row">
            <button class="go" onclick={() => app.goToBookmark(bm)}>{bm.label}</button>
            <button class="remove" aria-label={`Remove ${bm.label}`} onclick={() => app.removeBookmark(bm.id)}>×</button>
          </div>
        {/each}
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
    padding-top: 9vh;
    z-index: 50;
  }
  .panel {
    width: min(420px, 92vw);
    max-height: 74vh;
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
    justify-content: space-between;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid #ddd2bd;
  }
  .title {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 1.15rem;
    color: #2b2520;
  }
  .close {
    border: none;
    background: none;
    font-size: 1.6rem;
    line-height: 1;
    color: #8a7c66;
    cursor: pointer;
    padding: 0 0.2rem;
  }
  .list {
    overflow-y: auto;
    padding: 0.4rem;
  }
  .status {
    color: #8a7c66;
    font-size: 0.85rem;
    padding: 0.9rem 0.7rem;
    line-height: 1.4;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    border-radius: 8px;
  }
  .row:hover {
    background: #e9e0cd;
  }
  .go {
    flex: 1;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.55rem 0.6rem;
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 1rem;
    color: #2b2520;
  }
  .remove {
    border: none;
    background: none;
    font-size: 1.2rem;
    line-height: 1;
    color: #a2937a;
    cursor: pointer;
    padding: 0 0.5rem;
  }
  .remove:hover {
    color: #b03a2e;
  }
</style>
