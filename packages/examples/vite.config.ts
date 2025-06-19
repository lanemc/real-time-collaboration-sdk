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
      '@thesaasdevkit/core': resolve(__dirname, '../core/src'),
      '@thesaasdevkit/client-web': resolve(__dirname, '../client-web/src'),
      '@thesaasdevkit/server': resolve(__dirname, '../server/src'),
    },
  },
});