import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      '@rtc-sdk/core': resolve(__dirname, '../core/src'),
      '@rtc-sdk/client-web': resolve(__dirname, '../client-web/src'),
      '@rtc-sdk/server': resolve(__dirname, '../server/src'),
    },
  },
});