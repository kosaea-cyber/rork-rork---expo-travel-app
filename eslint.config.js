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
    files: ['.expo/types/router.d.ts', '**/.expo/types/router.d.ts'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'eslint-comments/no-unused-disable': 'off',
      'eslint-comments/disable-enable-pair': 'off',

      // Expo Router generated file sometimes contains a global `eslint-disable` banner.
      // `expo lint` may run with `--report-unused-disable-directives`, so ensure at least
      // one rule would have fired (making the directive “used”), while keeping it isolated.
      'no-unused-vars': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
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
    ],
  },
  {
    // Final override: never report unused eslint-disable directives (avoids warnings from generated files).
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'eslint-comments/no-unused-disable': 'off',
      'eslint-comments/disable-enable-pair': 'off',
    },
  },
]);
