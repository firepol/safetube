import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
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
      env: env, // Pass loaded environment variables to test environment
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
  };
}); 