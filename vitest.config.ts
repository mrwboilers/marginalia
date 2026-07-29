import { defineConfig } from 'vitest/config';

// Unit tests run in a DOM environment (happy-dom) because some of the code under
// test — notably the note HTML sanitizer — uses DOMParser and the DOM APIs.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'data/**/*.test.ts'],
    globals: true,
  },
});
