import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import perfectionist from "eslint-plugin-perfectionist";
import pluginVue from "eslint-plugin-vue";

/**
 * Flat ESLint config for CommandVue.
 *
 * Composition:
 *   - eslint-plugin-vue (flat/recommended)
 *   - @vue/eslint-config-typescript (recommended, no type-aware rules — fast)
 *   - eslint-plugin-perfectionist (import sorting only)
 *   - @vue/eslint-config-prettier/skip-formatting (defer formatting to Prettier)
 *
 * Custom rules:
 *   - no-explicit-any is an error (template policy: no `any` types)
 *   - consistent-type-imports + verbatimModuleSyntax expects `import type`
 *   - vue/multi-word-component-names is off (App.vue and view names are allowed)
 *   - no-console warns except for `warn` / `error`
 */
export default defineConfigWithVueTs(
  {
    name: "commandvue/ignores",
    ignores: [
      "**/dist/**",
      "**/dist-ssr/**",
      "**/coverage/**",
      "**/.vite/**",
      "**/node_modules/**",
      "public/cesium/**",
      "pnpm-lock.yaml",
      "dictionaries/**",
      ".husky/_/**",
      "eslint.config.ts",
    ],
  },
  {
    name: "commandvue/files",
    files: ["**/*.{ts,mts,tsx,vue}"],
  },
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    name: "commandvue/rules",
    plugins: {
      perfectionist,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "vue/multi-word-component-names": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
          newlinesBetween: "always",
          groups: [
            "type",
            ["builtin", "external"],
            "internal-type",
            "internal",
            ["parent-type", "sibling-type", "index-type"],
            ["parent", "sibling", "index"],
            "object",
            "unknown",
          ],
        },
      ],
    },
  },
  {
    name: "commandvue/declarations",
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
