<script lang="ts">
  import { app } from '../store.svelte';

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') app.closeCompanion();
    else if (e.key === 'ArrowLeft') app.companionStep(-1);
    else if (e.key === 'ArrowRight') app.companionStep(1);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" onclick={() => app.closeCompanion()} role="presentation">
  <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Bible Companion daily readings">
    <div class="head">
      <div class="titles">
        <div class="kicker">Bible Companion</div>
        <div class="date">
          {app.companionDateLabel}
          {#if app.companionIsToday}<span class="today-badge">Today</span>{/if}
        </div>
      </div>
      <div class="nav">
        <button class="btn arrow" aria-label="Previous day" onclick={() => app.companionStep(-1)}>‹</button>
        {#if !app.companionIsToday}
          <button class="btn today" onclick={() => app.companionToday()}>Today</button>
        {/if}
        <button class="btn arrow" aria-label="Next day" onclick={() => app.companionStep(1)}>›</button>
      </div>
      <button class="close" aria-label="Close" onclick={() => app.closeCompanion()}>×</button>
    </div>

    <div class="readings">
      {#if app.companionReadings.length === 0}
        <p class="status">No reading scheduled for this day.</p>
      {:else}
        {#each app.companionReadings as portion, i (portion.label + i)}
          <div class="reading" class:done={app.isReadingDone(i)}>
            <button
              class="check"
              role="checkbox"
              aria-checked={app.isReadingDone(i)}
              aria-label={`Mark ${portion.label} read`}
              onclick={() => app.toggleReadingDone(i)}
            >
              {#if app.isReadingDone(i)}✓{/if}
            </button>
            <button class="ref" onclick={() => app.openReading(portion)} title="Open in the reading view">
              {portion.label}
            </button>
          </div>
        {/each}
      {/if}
    </div>

    {#if app.companionReadings.length > 0}
      <div class="foot">
        <button class="btn markall" onclick={() => app.toggleDayDone()}>
          {app.companionDayDone ? 'Unmark day' : 'Mark day read'}
        </button>
        <span class="hint">The whole Bible in a year — Old Testament once, New Testament twice.</span>
      </div>
    {/if}
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
    padding-top: 10vh;
    z-index: 50;
  }
  .panel {
    width: min(520px, 92vw);
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
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    border-bottom: 1px solid #ddd2bd;
  }
  .titles {
    flex: 1;
    min-width: 0;
  }
  .kicker {
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8a7c66;
  }
  .date {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 1.35rem;
    color: #2b2520;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .today-badge {
    font-family: system-ui, sans-serif;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #f4efe2;
    background: #7a5230;
    padding: 0.12rem 0.4rem;
    border-radius: 999px;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .btn {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.35rem 0.6rem;
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
  .arrow {
    font-size: 1.05rem;
    line-height: 1;
    padding: 0.3rem 0.55rem;
  }
  .today {
    font-size: 0.78rem;
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
  .readings {
    padding: 0.5rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .reading {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.5rem 0.55rem;
    border-radius: 9px;
  }
  .reading:hover {
    background: #e9e0cd;
  }
  .check {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid #b8a888;
    background: #fffdf8;
    color: #f4efe2;
    font-size: 0.95rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .reading.done .check {
    background: #5e8c5a;
    border-color: #5e8c5a;
  }
  .ref {
    flex: 1;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 1.1rem;
    color: #2b2520;
    padding: 0;
  }
  .ref:hover {
    color: #7a5230;
    text-decoration: underline;
  }
  .reading.done .ref {
    color: #8a7c66;
    text-decoration: line-through;
  }
  .status {
    color: #8a7c66;
    font-size: 0.9rem;
    padding: 1rem 0.6rem;
    text-align: center;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem 0.9rem;
    border-top: 1px solid #ddd2bd;
  }
  .markall {
    font-size: 0.8rem;
  }
  .hint {
    font-size: 0.72rem;
    color: #8a7c66;
    line-height: 1.35;
  }
</style>
