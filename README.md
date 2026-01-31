# figma-json-exporter

A Figma plugin that exports selected node properties to JSON for client code generation.

## Setup

Install dependencies:

```bash
npm install
```

Build the plugin:

```bash
npm run build
```

The build output is written to `dist/`.

## Use in Figma

1. Open **Figma Desktop**.
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select the `manifest.json` file in this repo.
4. Run the plugin from **Plugins → Development → figma-json-exporter**.

## Plugin UI

- **Export**: exports the selected node with children.
- **Export (only parent)**: exports only the selected node without children.
- **Download**: downloads the current JSON to a file.

## Output behavior

- Only fields listed in `src/code.ts` (`EXPORT_FIELDS`) are exported.
- `textStyleId` is **not** exported. If present, the style name is exported as `textVariableName`.
- Any object with `visible === false` is recursively dropped.
- Null/undefined/empty strings/empty arrays/empty objects are omitted.
- Solid paint colors are exported as `color.hexRGBA`, computed from `color.r/g/b` + `paint.opacity`.
- If a paint is bound to a color variable, `color.colorVariableName` is included and `boundVariables` is removed.
