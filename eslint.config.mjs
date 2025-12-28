import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import typescript from 'typescript-eslint'

export default defineConfig(
  eslint.configs.recommended,
  typescript.configs.strictTypeChecked,
  typescript.configs.stylisticTypeChecked,
  {
    rules: {
      '@typescript-eslint/array-type': ['error', { default: 'generic' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Note: there must be no other properties in this object
    ignores: [
      'build/',
      'coverage/',
      './babel.config.js',
      './eslint.config.mjs',
      './jest.config.ts',
    ],
  },
)
