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
      '@rtcc/core': resolve(__dirname, '../core/src'),
      '@rtcc/client-web': resolve(__dirname, '../client-web/src'),
      '@rtcc/server': resolve(__dirname, '../server/src'),
    },
  },
});