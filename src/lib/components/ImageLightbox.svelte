<script lang="ts">
  import { app } from '../store.svelte';

  // Toggle between fit-to-screen and 1:1 (natural pixels) for reading fine detail.
  let actualSize = $state(false);

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') app.closeImage();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="lightbox" onclick={() => app.closeImage()} role="presentation">
  <img
    class:actual={actualSize}
    src={app.lightboxSrc}
    alt="Note image"
    title={actualSize ? 'Click to fit' : 'Click to view actual size'}
    onclick={(e) => { e.stopPropagation(); actualSize = !actualSize; }}
  />
  <button class="close" aria-label="Close" onclick={() => app.closeImage()}>×</button>
</div>

<style>
  .lightbox {
    position: fixed;
    inset: 0;
    background: rgba(20, 16, 12, 0.86);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 3vh 3vw;
    overflow: auto;
  }
  img {
    max-width: 94vw;
    max-height: 94vh;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 12px 44px rgba(0, 0, 0, 0.55);
    cursor: zoom-in;
  }
  /* Actual pixels — larger than the viewport is fine; the overlay scrolls. */
  img.actual {
    max-width: none;
    max-height: none;
    cursor: zoom-out;
  }
  .close {
    position: fixed;
    top: 0.8rem;
    right: 1.1rem;
    font-size: 2rem;
    line-height: 1;
    color: #f4efe2;
    background: none;
    border: none;
    cursor: pointer;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  }
</style>
