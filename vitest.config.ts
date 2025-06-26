import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/renderer/setupTests.ts', './vitest.setup.ts'],
    globals: true,
    testTimeout: 30000, // 30 seconds timeout for integration tests
    hookTimeout: 30000, // 30 seconds timeout for hooks
    pool: 'threads', // Use threads for isolation
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 1 // Enforce single process for shared in-memory cache
      }
    },
    css: true, // Enable CSS processing in tests
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
}); 