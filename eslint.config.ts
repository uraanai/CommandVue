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
      // Dev-only scripts run via tsx / node — not part of the typed app graph
      // (the existing build scripts are .mjs and already outside the file glob).
      "scripts/**",
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
      // Use the @typescript-eslint variant so `allowTypeImports` is honoured —
      // `import type { MenuItem } from "primevue/menuitem"` is fine, but
      // `import FileUpload from "primevue/fileupload"` in consumer code is not.
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "primevue/datatable",
              message:
                "CommandVue defaults to @tanstack/vue-table via the <DataTable> wrapper at src/components/ui/DataTable.vue. Use primevue/datatable only when justified — see docs/decisions/0001-datatable-library.md. Document the justification in your PR.",
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              // Restrict direct imports of PrimeVue *components* from consumer
              // code. The negation entries below carve out paths that are not
              // components and have no wrapper, plus the DataTable escape
              // valve which already fires its more specific named rule above:
              //   - menuitem      → types only (MenuItem interface)
              //   - config / api  → app bootstrap singleton + util constants
              //   - usetoast / useconfirm → composables consumed by wrappers
              //   - datatable / column → governed by ADR 0001 (named rule above)
              group: [
                "primevue/*",
                "!primevue/menuitem",
                "!primevue/config",
                "!primevue/api",
                "!primevue/usetoast",
                "!primevue/useconfirm",
                "!primevue/datatable",
                "!primevue/column",
              ],
              message:
                "Direct primevue/* component imports are restricted to UI primitive files (src/components/ui/** and src/volt/**). Consumer code should import the project wrapper or Volt component instead — see docs/contributing-ui.md and docs/decisions/0002-volt-vs-handrolled-wrappers.md.",
              allowTypeImports: true,
            },
          ],
        },
      ],
      "vue/no-restricted-html-elements": [
        "warn",
        {
          element: ["button", "input", "select", "textarea"],
          message:
            "Raw HTML interactive elements are restricted. Use the project's UI primitive wrappers in src/components/ui/* (Button, IconButton, Input, Select) or the Volt-vendored components in src/volt/* (Textarea, Checkbox, …). See docs/contributing-ui.md.",
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
  {
    // Volt components are vendored from `npx volt-vue add` and follow upstream
    // PrimeVue conventions (`interface Props extends <PvProps> {}`, implicit
    // any in some event handlers, `any` in the passthrough merge util). We
    // own these files but want to keep upstream parity, so the strict rules
    // we enforce on the rest of the app are relaxed here.
    name: "commandvue/volt-vendored",
    files: ["src/volt/**/*.{ts,vue}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "vue/no-v-html": "off",
    },
  },
  {
    // UI primitive layer — these files are the wrappers themselves, so raw
    // HTML interactive elements and direct `primevue/*` imports are not only
    // allowed, they're expected. The restrictions in `commandvue/rules` apply
    // to *consumers* of these primitives.
    //
    // Mirrors the file split documented in ADR 0002:
    //   - src/components/ui/*       → hand-rolled wrappers (Button, IconButton, …)
    //   - src/volt/*                → Volt-vendored primitives
    //   - src/components/ui/datatable/* → TanStack-backed DataTable internals
    name: "commandvue/ui-primitives",
    files: ["src/components/ui/**/*.{ts,vue}", "src/volt/**/*.{ts,vue}"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": "off",
      "vue/no-restricted-html-elements": "off",
    },
  },
);
