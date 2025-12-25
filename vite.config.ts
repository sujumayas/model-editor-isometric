import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@level': resolve(__dirname, 'src/level'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@editor': resolve(__dirname, 'src/editor'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@input': resolve(__dirname, 'src/input'),
    },
  },
  publicDir: 'assets',
});
