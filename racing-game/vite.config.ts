import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`         -> dist/ (regular static build, serve with any web server)
// `npm run build:single`  -> dist-single/index.html (everything inlined, opens straight from disk)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
  },
  server: {
    host: true,
    port: 5173,
  },
}));
