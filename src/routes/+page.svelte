<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '$lib/store.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import ReadingView from '$lib/components/ReadingView.svelte';
  import SearchPanel from '$lib/components/SearchPanel.svelte';

  let error = $state('');

  onMount(() => {
    app.init().catch((e) => (error = (e as Error).message));
  });
</script>

{#if error}
  <div class="fatal">
    <h1>Couldn’t load the library</h1>
    <p>{error}</p>
  </div>
{:else if !app.ready}
  <div class="booting">
    <div class="brand-name">Marginalia</div>
    <p>Opening the library…</p>
  </div>
{:else}
  <div class="app">
    <Toolbar />
    <div class="body">
      <ReadingView />
    </div>
  </div>
  {#if app.searchOpen}
    <SearchPanel />
  {/if}
{/if}

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .booting,
  .fatal {
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #6b5d4b;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .brand-name {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 2rem;
    color: #2b2520;
  }
  .fatal {
    color: #b03a2e;
    padding: 2rem;
    text-align: center;
  }
</style>
