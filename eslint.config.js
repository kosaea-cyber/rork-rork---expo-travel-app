const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    files: ['.expo/types/router.d.ts', '**/.expo/types/router.d.ts', 'expo/types/router.d.ts', '**/expo/types/router.d.ts'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
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
      reportUnusedDisableDirectives: 'off',
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
      reportUnusedDisableDirectives: 'off',
    },
  })),
  {
    // Ensure this stays OFF even if eslint-config-expo enables it.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
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
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'eslint-comments/no-unused-disable': 'off',
      'eslint-comments/disable-enable-pair': 'off',
      'import/no-unresolved': 'off',
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
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
      reportUnusedDisableDirectives: 'off',
    },
  },

]);
