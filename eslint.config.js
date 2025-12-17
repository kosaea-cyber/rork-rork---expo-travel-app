const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
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
      '.expo/**',
      '**/.expo/**',
      '.expo/types/**',
      '**/.expo/types/**',
      '.expo/types/router.d.ts',
      '**/.expo/types/router.d.ts',
      'supabase/functions/**',
    ],
  },
  ...expoConfig,
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
      '.expo/**',
      '**/.expo/**',
      '**/.expo/**/*',
      '.expo/types/**',
      '**/.expo/types/**',
      '**/.expo/types/**/*',
      '.expo/types/router.d.ts',
      '**/.expo/types/router.d.ts',
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
    // Force at least one suppressed rule in Expo Router's generated types file
    // so its top-level eslint-disable banner isn't considered unused.
    files: ['.expo/types/router.d.ts', '**/.expo/types/router.d.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: 'generated-file',
        },
      ],
    },
  },
]);
