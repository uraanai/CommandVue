# Keyboard shortcuts

All shortcuts are bound globally via `useKeyboardShortcuts` (`src/composables/useKeyboardShortcuts.ts`). The catalog lives in `src/modules/shortcuts/catalog.ts` — one place to read, one place to extend.

The `mod` modifier is platform-conditional: **Cmd on macOS**, **Ctrl on Windows/Linux**. Inputs and textareas skip every shortcut except Escape and `mod+k`.

## Global

| Combo         | Action                  | Wired in                              |
| ------------- | ----------------------- | ------------------------------------- |
| `mod+k`       | Open command palette    | `useUiStore.openCommandPalette`       |
| `mod+s`       | Save Layout             | `useSessionStore.updateCurrentLayout` |
| `mod+shift+s` | Save Layout As…         | Opens `SaveLayoutAsDialog`            |
| `mod+b`       | Toggle Components Panel | `AppShell.toggleComponentsPanel`      |

## Map tools

| Combo    | Action                  | Wired in                                   |
| -------- | ----------------------- | ------------------------------------------ |
| `m`      | Measure distance        | `useToolsStore.toggle("measure-distance")` |
| `p`      | Draw polygon            | `useToolsStore.toggle("draw-polygon")`     |
| `escape` | Deactivate current tool | `useToolsStore.deactivate`                 |

## Adding a new shortcut

Three steps:

1. **Add the entry to `src/modules/shortcuts/catalog.ts`.** The `ShortcutAction` type union narrows the legal action ids; add yours there too.

   ```typescript
   export type ShortcutAction =
     | "layout.save"
     | "layout.saveAs"
     | "palette.open"
     | "tool.deactivate"
     | "view.toggleComponents"
     | "view.toggleMyThing" // ← new
     | `tool.${string}`;

   export const SHORTCUTS: readonly ShortcutDef[] = [
     // …existing
     {
       keys: ["mod+shift+m"],
       scope: "global",
       label: "Toggle my thing",
       action: "view.toggleMyThing",
     },
   ];
   ```

2. **Bridge the action in `AppShell.vue`.**

   ```typescript
   useKeyboardShortcuts({
     onAction(action) {
       // …
       if (action === "view.toggleMyThing") {
         toggleMyThing();
         return;
       }
       // …
     },
   });
   ```

3. **(Optional) Show the combo in your menu item via `formatCombo`** so platform rendering is consistent.

   ```typescript
   {
     label: "My Thing",
     command: () => toggleMyThing(),
     shortcut: formatCombo("mod+shift+m", isMac),
   }
   ```

The catalog single-sources the display string and the binding so they can't drift apart.

## Scopes

| Scope     | When the binding fires                                    |
| --------- | --------------------------------------------------------- |
| `global`  | Anywhere (subject to the inputs-skip-rule above)          |
| `map`     | Documented intent — runtime enforcement is per-tool today |
| `palette` | Reserved for the command palette's internal navigation    |

`scope` is a documentation hint today. If you need hard scoping (e.g., shortcut active only when a specific panel has focus), wrap the bridge:

```typescript
if (action === "panel.specific" && document.activeElement?.closest("[data-panel='my-panel']")) {
  // …
}
```
