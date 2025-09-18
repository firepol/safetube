import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default [
  eslint.configs.recommended,
  // Node globals for src/test/**/*.ts files
  {
    files: ['src/test/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        console: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        setImmediate: 'readonly',
        AbortController: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  eslint.configs.recommended,
  // Node environment for all JS files, scripts/config, main, preload
  {
    files: [
      '**/*.js',
      'scripts/**/*.{js,ts}',
      '*.config.js',
      '*.config.ts',
      '*.js',
      '*.ts',
      'src/main/**/*.{ts,js}',
      'src/preload/**/*.{ts,js}'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        console: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        setImmediate: 'readonly',
        AbortController: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Jest environment for test files (with Node globals)
  {
    files: ['**/*.test.{js,ts,tsx}', '**/__tests__/**/*.{js,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        expect: 'readonly',
        jest: 'readonly',
        test: 'readonly',
        describe: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        it: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        console: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        setImmediate: 'readonly',
        AbortController: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Jest environment for test files
  {
    files: ['**/*.test.{js,ts,tsx}', '**/__tests__/**/*.{js,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        expect: 'readonly',
        jest: 'readonly',
        test: 'readonly',
        describe: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Node/Electron main process and config files
  {
    files: ['src/main/**/*.{ts,js}', 'vite.config.ts', 'src/preload/**/*.{ts,js}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import': importPlugin,
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'import/order': 'off'
    },
  },
  // Renderer (React)
  {
    files: ['src/renderer/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        // add more browser globals as needed
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'import': importPlugin
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'import/order': 'off'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    ignores: [
      'node_modules',
      'dist',
      'release',
      'coverage',
      '.vite',
      '.cursor/cache',
      '.cursor/logs'
    ]
  }
];
