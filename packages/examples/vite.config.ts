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
      '@lanemc/core': resolve(__dirname, '../core/src'),
      '@lanemc/client-web': resolve(__dirname, '../client-web/src'),
      '@lanemc/server': resolve(__dirname, '../server/src'),
    },
  },
});