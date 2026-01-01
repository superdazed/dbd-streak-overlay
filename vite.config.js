import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src',
  build: {
    // Output to a folder not used by electron-builder
    outDir: '../renderer',
    rollupOptions: {
      input: {
        dock: path.resolve(__dirname, 'src/dock.html'),
        source: path.resolve(__dirname, 'src/source.html'),
        about: path.resolve(__dirname, 'src/about.html')
      }
    }
  }
});
