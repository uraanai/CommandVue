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
      // VitePress config is standalone (loaded by `vitepress` CLI via its own
      // bundler); it's not part of the app's project-references graph.
      "docs/.vitepress/**",
      // Agent-skills reference templates are illustrative, not part of the
      // app's tsconfig project. They live alongside the SKILL.md files so
      // agents can read them in context.
      ".agent/skills/**",
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
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "primevue/datatable",
              message:
                "CommandVue defaults to @tanstack/vue-table via the <DataTable> wrapper at src/components/ui/DataTable.vue. Use primevue/datatable only when justified — see docs/decisions/0001-datatable-library.md. Document the justification in your PR.",
            },
          ],
        },
      ],
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
          // perfectionist 5 changed this from `"always" | "never"` to a number:
          // 1 = exactly one blank line between groups (matches the prior `"always"`).
          newlinesBetween: 1,
          // perfectionist 5 reversed the modifier-selector order for type-import
          // groups: `internal-type` → `type-internal`, etc. `object` is no longer a
          // valid group for sort-imports (it never matched anything here).
          groups: [
            "type",
            ["builtin", "external"],
            "type-internal",
            "internal",
            ["type-parent", "type-sibling", "type-index"],
            ["parent", "sibling", "index"],
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
