import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@middleware': path.resolve(__dirname, 'src/middleware'),
      '@tasks': path.resolve(__dirname, 'src/tasks'),
    },
  },
  test: {
    globals: false,
    exclude: ['dist/**', 'node_modules/**'],
  },
});
