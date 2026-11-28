import { defineConfig } from 'vite';
import { buildRevision } from './tools/assets/build-revision.mjs';

export default defineConfig({
  base: '/PhotoLens/',
  plugins: [buildRevision()],
  server: { host: '0.0.0.0' },
  build: { target: 'es2022', sourcemap: true }
});
