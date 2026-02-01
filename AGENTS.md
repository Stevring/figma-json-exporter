# AGENTS

This repo contains a Figma plugin that exports selected node properties to JSON for iOS/Android code generation, with a simple UI (3 buttons + JSON viewer) and custom resize handle.

## Features
- Plugin behavior:
  - Export selection with/without children
  - Download JSON with default filename `figma-{node name}-{YYYY-MMDD-HHmmSS}.json`
  - UI is resizable via custom bottom-right handle
- Export filtering:
  - Omit invisible nodes (`visible === false`)
  - Recursively drop any object with `visible === false`
  - Omit null/undefined/empty strings/empty arrays/empty objects
- Variable name exports:
  - Color variable name is exported into `color.colorVariableName`
  - Text style name is exported into `textVariableName` (while `textStyleId` is omitted)
- Color encoding:
  - Colors with `r/g/b` floats are replaced with a single `hexRGBA` string in the `color` object

## File structure
- `src/` sources, `dist/` build output
- `src/code.ts` — Figma plugin main thread; export logic, filtering, resize handling.
- `src/ui.ts` / `src/ui.html` — UI logic and layout.
- `scripts/build.mjs` — esbuild pipeline + HTML/JS inlining.
- `manifest.json` points to `dist/code.js` and `dist/ui.html`

## Important fixes and caveats
- Figma runtime does not support newer JS syntax like nullish coalescing (`??`) or object spread (`...`).
  - Any usage caused syntax errors in Figma console.
  - Code was updated to use compatible `||` / explicit checks and `Object.assign` instead.
  - The serializer avoids object spread when adding `colorVariableName`.
- UI rendering issue:
  - Figma `showUI(__html__)` requires HTML string. The build now inlines `ui.js` into `ui.html`, then embeds that HTML into `__html__` in `code.js`.

## Build
- `npm run build` produces `dist/code.js` and `dist/ui.html`.

## Known expectations
- Keep original Figma property names/structure when exporting.
- Export whitelist is defined in `src/code.ts` under `EXPORT_FIELDS`.
