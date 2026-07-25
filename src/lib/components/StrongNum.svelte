<script lang="ts">
  import { getStrongDef } from '../provider/strongs';
  import type { LexEntry } from '../types';

  let { num }: { num: string } = $props();

  let open = $state(false);
  // undefined = not loaded, null = no entry, entry = loaded
  let entry = $state<LexEntry | null | undefined>(undefined);
  let pos = $state({ top: 0, left: 0 });
  let el: HTMLElement | undefined = $state();
  let timer: ReturnType<typeof setTimeout>;

  const lang = $derived(num.startsWith('H') ? 'Hebrew' : 'Greek');

  async function enter() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 300;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      pos = { top: r.bottom + 6, left };
      open = true;
      if (entry === undefined) entry = (await getStrongDef(num)) ?? null;
    }, 80);
  }
  function leave() {
    clearTimeout(timer);
    open = false;
  }
</script>

<sup
  class="strong"
  class:greek={lang === 'Greek'}
  bind:this={el}
  role="button"
  tabindex="-1"
  onmouseenter={enter}
  onmouseleave={leave}>{num}</sup>

{#if open}
  <div class="strong-tip" style={`top:${pos.top}px; left:${pos.left}px`} role="tooltip">
    {#if entry}
      <div class="s-head">
        <span class="s-word">{entry.w}</span>
        {#if entry.t}<span class="s-tl">{entry.t}</span>{/if}
        <span class="s-num">{num}</span>
      </div>
      {#if entry.p}<div class="s-pos">{entry.p}</div>{/if}
      {#if entry.d}<div class="s-def">{entry.d}</div>{/if}
      {#if entry.u}<div class="s-usage"><span class="s-label">Usage:</span> {entry.u}</div>{/if}
    {:else if entry === null}
      <div class="s-def muted">No entry for {num}</div>
    {:else}
      <div class="s-def muted">…</div>
    {/if}
  </div>
{/if}

<style>
  .strong {
    font-size: 0.6em;
    font-weight: 600;
    color: #4a7a8c;
    vertical-align: super;
    line-height: 0;
    margin: 0 0.15em 0 0.02em;
    cursor: help;
    user-select: none;
    white-space: nowrap;
  }
  .strong.greek {
    color: #7a5a8c;
  }
  .strong:hover {
    text-decoration: underline;
  }
  .strong-tip {
    position: fixed;
    width: 300px;
    max-width: 88vw;
    background: #fffdf8;
    border: 1px solid #d8ccb4;
    border-left: 3px solid #4a7a8c;
    border-radius: 8px;
    box-shadow: 0 12px 34px rgba(43, 37, 32, 0.28);
    padding: 0.6rem 0.75rem;
    z-index: 60;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    pointer-events: none;
  }
  .s-head {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-bottom: 0.3rem;
  }
  .s-word {
    font-size: 1.15rem;
    color: #2b2520;
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
  }
  .s-tl {
    font-style: italic;
    color: #6b5d4b;
    font-size: 0.85rem;
  }
  .s-num {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 700;
    color: #4a7a8c;
  }
  .s-pos {
    font-size: 0.72rem;
    color: #8a7c66;
    margin-bottom: 0.3rem;
  }
  .s-def {
    font-size: 0.86rem;
    line-height: 1.45;
    color: #2b2520;
  }
  .s-def.muted {
    color: #a2937a;
    font-style: italic;
  }
  .s-usage {
    font-size: 0.8rem;
    line-height: 1.4;
    color: #6b5d4b;
    margin-top: 0.35rem;
  }
  .s-label {
    font-weight: 700;
    color: #8a7c66;
  }
</style>
