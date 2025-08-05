import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: {
        dock: 'dock.html',
        source: 'source.html'
      }
    }
  }
});
