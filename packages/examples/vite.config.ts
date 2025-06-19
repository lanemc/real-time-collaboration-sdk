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
      '@thesaasdevkit/rtc-core': resolve(__dirname, '../core/src'),
      '@thesaasdevkit/rtc-client-web': resolve(__dirname, '../client-web/src'),
      '@thesaasdevkit/rtc-server': resolve(__dirname, '../server/src'),
    },
  },
});