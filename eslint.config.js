const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const EXPO_GENERATED_IGNORES = [
  '.expo/types/router.d.ts',
  '**/.expo/types/router.d.ts',
  '.expo/types/**',
  '**/.expo/types/**',
  '.expo/**',
  '**/.expo/**',
  'expo/types/router.d.ts',
  '**/expo/types/router.d.ts',
  'expo/types/**',
  '**/expo/types/**',
  'expo/**',
  '**/expo/**',
];

module.exports = defineConfig([
  {
    files: ['.expo/types/router.d.ts', '**/.expo/types/router.d.ts'],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {},
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    ignores: [...EXPO_GENERATED_IGNORES, 'supabase/functions/**'],
  },
  ...expoConfig.map((c) => ({
    ...c,
    linterOptions: {
      ...(c.linterOptions ?? {}),
      reportUnusedDisableDirectives: false,
    },
    ignores: [...(c.ignores ?? []), ...EXPO_GENERATED_IGNORES],
  })),
]);
