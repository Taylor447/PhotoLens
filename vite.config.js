import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  cacheDir: './.vite-cache',
  server: { host: '0.0.0.0' },
  optimizeDeps: { noDiscovery: true },
  // Source map chỉ tăng kích thước gói phát hành; mã gốc vẫn có trong repo để debug.
  // Chunk HEIC được lazy-load riêng, hiện khoảng 1.35 MB thô / 341 KB gzip.
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['core/**/*.test.js'] }
});
