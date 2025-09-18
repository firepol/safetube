import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 2020,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      react: reactPlugin,
    },
    rules: {
      ...importPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...tsPlugin.configs['recommended-type-checked'].rules,
      'import/order': ['error', { 'newlines-between': 'always' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-unused-vars': 'warn',
    },
  },
  {
    files: [
      '**/*.{js,jsx,ts,tsx,mjs,cjs}',
      'scripts/**/*',
      'src/main/**/*',
      'src/preload/**/*',
      'src/shared/**/*',
      'src/test/**/*',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
      '**/__tests__/**/*',
      'test/**/*',
      '*.config.{js,ts}',
      '*.config.*.js',
      '*.config.*.ts',
      '*.cjs',
      '*.mjs',
      '*.js',
      '*.ts',
    ],
    languageOptions: {
      env: {
        node: true,
        es2021: true,
        jest: true,
      },
      // Add globals here if needed
    },
  },
];