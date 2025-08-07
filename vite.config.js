import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: {
        dock: path.resolve(__dirname, 'src/dock.html'),
        source: path.resolve(__dirname, 'src/source.html'),
        instructions: path.resolve(__dirname, 'src/instructions.html')
      }
    }
  }
});
