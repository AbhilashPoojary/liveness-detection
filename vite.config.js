import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  publicDir: '../src/assets',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['@vladmandic/human'],
  },
});
