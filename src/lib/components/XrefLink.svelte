<script lang="ts">
  import { app } from '../store.svelte';

  let { refStr }: { refStr: string } = $props();

  let open = $state(false);
  let loading = $state(false);
  let preview = $state<{ ref: string; text: string } | null>(null);
  let pos = $state({ top: 0, left: 0 });
  let spanEl: HTMLElement | undefined = $state();
  let timer: ReturnType<typeof setTimeout>;

  // This component is reused across chapters (keyed by position), so clear the
  // cached passage whenever the reference it points to changes.
  $effect(() => {
    refStr;
    preview = null;
    loading = false;
    open = false;
  });

  async function enter() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!spanEl) return;
      const r = spanEl.getBoundingClientRect();
      const width = 300;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      pos = { top: r.bottom + 6, left };
      open = true;
      if (!preview) {
        loading = true;
        preview = await app.refPreview(refStr);
        loading = false;
      }
    }, 110);
  }
  function leave() {
    clearTimeout(timer);
    open = false;
  }
</script>

<span
  class="xref"
  bind:this={spanEl}
  role="link"
  tabindex="0"
  onmouseenter={enter}
  onmouseleave={leave}
  onclick={() => app.goToRef(refStr)}
  onkeydown={(e) => e.key === 'Enter' && app.goToRef(refStr)}>{refStr}</span>

{#if open}
  <div class="xref-tip" style={`top:${pos.top}px; left:${pos.left}px`} role="tooltip">
    {#if preview}
      <div class="tip-ref">{preview.ref}</div>
      <div class="tip-text">{preview.text}</div>
    {:else if loading}
      <div class="tip-text muted">…</div>
    {:else}
      <div class="tip-text muted">Reference not found</div>
    {/if}
  </div>
{/if}

<style>
  .xref {
    cursor: pointer;
    white-space: nowrap;
  }
  .xref:hover {
    color: #7a5230;
    text-decoration: underline;
    text-decoration-color: #c9b892;
  }
  .xref-tip {
    position: fixed;
    width: 300px;
    max-width: 88vw;
    background: #fffdf8;
    border: 1px solid #d8ccb4;
    border-left: 3px solid #7a5230;
    border-radius: 8px;
    box-shadow: 0 12px 34px rgba(43, 37, 32, 0.28);
    padding: 0.55rem 0.7rem;
    z-index: 60;
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    pointer-events: none;
  }
  .tip-ref {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 0.66rem;
    font-weight: 700;
    color: #7a5230;
    margin-bottom: 0.25rem;
  }
  .tip-text {
    font-size: 0.92rem;
    line-height: 1.45;
    color: #2b2520;
  }
  .tip-text.muted {
    color: #a2937a;
    font-style: italic;
  }
</style>
