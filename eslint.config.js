const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: [
      "dist/*",
      ".expo/**",
      "**/.expo/**",
      ".expo/types/**",
      "**/.expo/types/**",
      ".expo/types/router.d.ts",
      "**/.expo/types/router.d.ts",
    ],
  },
  ...expoConfig,
  {
    files: [".expo/**/*", "**/.expo/**/*"],
    rules: {
      "eslint-comments/no-unused-disable": "off",
    },
  },
  {
    files: [".expo/types/router.d.ts", "**/.expo/types/router.d.ts"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "eslint-comments/no-unused-disable": "off",
    },
  },
]);
