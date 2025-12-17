const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    ignores: [
      '.expo/**',
      '**/.expo/**',
      '.expo/types/**',
      '**/.expo/types/**',
      'expo/**',
      '**/expo/**',
    ],
  },
  {
    ignores: [
      '.expo/**',
      '**/.expo/**',
      'expo/**',
      '**/expo/**',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      'eslint-comments/no-unused-disable': 'off',
      'eslint-comments/disable-enable-pair': 'off',
    },
    ignores: [
      'dist/*',
      '.expo/types/router.d.ts',
      '**/.expo/types/router.d.ts',
      '.expo/**',
      '**/.expo/**',
      '.expo/types/**',
      '**/.expo/types/**',
      'expo/types/router.d.ts',
      '**/expo/types/router.d.ts',
      'expo/**',
      '**/expo/**',
      'expo/types/**',
      '**/expo/types/**',
      'supabase/functions/**',
    ],
  },
  ...expoConfig.map((c) => ({
    ...c,
    linterOptions: {
      ...(c.linterOptions ?? {}),
      reportUnusedDisableDirectives: false,
    },
  })),
  {
    // Ensure this stays OFF even if eslint-config-expo enables it.
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      'eslint-comments/no-unused-disable': 'off',
      'eslint-comments/disable-enable-pair': 'off',
    },
  },
  {
    // Hard-ignore Expo Router generated types (can contain eslint-disable banners).
    ignores: [
      '.expo/types/router.d.ts',
      '**/.expo/types/router.d.ts',
      '.expo/**',
      '**/.expo/**',
      '**/.expo/**/*',
      '.expo/types/**',
      '**/.expo/types/**',
      '**/.expo/types/**/*',
      'expo/types/router.d.ts',
      '**/expo/types/router.d.ts',
      'expo/**',
      '**/expo/**',
      'expo/types/**',
      '**/expo/types/**',
      'supabase/functions/**',
    ],
  },
  {
    files: ['supabase/functions/**', '**/supabase/functions/**'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  {
    // Final override
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      'eslint-comments/no-unused-disable': 'off',
      'eslint-comments/disable-enable-pair': 'off',
      'import/no-unresolved': 'off',
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    // Final hard-ignore (must be last so nothing re-includes these files).
    ignores: [
      '.expo/types/router.d.ts',
      '**/.expo/types/router.d.ts',
      '.expo/**',
      '**/.expo/**',
      '.expo/types/**',
      '**/.expo/types/**',
      'expo/types/router.d.ts',
      '**/expo/types/router.d.ts',
      'expo/**',
      '**/expo/**',
      'expo/types/**',
      '**/expo/types/**',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ['.expo/types/router.d.ts', '**/.expo/types/router.d.ts'],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      'eslint-comments/no-unused-disable': 'off',
      'eslint-comments/disable-enable-pair': 'off',
    },
  },  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    ignores: [
      '.expo/**',
      '**/.expo/**',
      '.expo/types/**',
      '**/.expo/types/**',
      '.expo/types/router.d.ts',
      '**/.expo/types/router.d.ts',
      'expo/**',
      '**/expo/**',
      'expo/types/**',
      '**/expo/types/**',
      'expo/types/router.d.ts',
      '**/expo/types/router.d.ts',
    ],
  },

]);
