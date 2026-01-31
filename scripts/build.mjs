import { build, context } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const watch = process.argv.includes("--watch");
const root = process.cwd();
const distDir = resolve(root, "dist");
const srcDir = resolve(root, "src");

await mkdir(distDir, { recursive: true });

const common = {
  bundle: true,
  target: "es2020",
  sourcemap: true
};

const uiHtmlPath = resolve(srcDir, "ui.html");

const uiOptions = {
  ...common,
  entryPoints: [resolve(srcDir, "ui.ts")],
  outfile: resolve(distDir, "ui.js"),
  platform: "browser"
};

async function buildUiHtml() {
  const html = await readFile(uiHtmlPath, "utf8");
  const uiJs = await readFile(resolve(distDir, "ui.js"), "utf8");
  const inlined = html.replace(
    /<script\s+type="module"\s+src="\.\/ui\.js"><\/script>/,
    `<script>${uiJs}</script>`
  );
  await writeFile(resolve(distDir, "ui.html"), inlined, "utf8");
  return inlined;
}

async function buildCode(uiHtml) {
  const codeOptions = {
    ...common,
    entryPoints: [resolve(srcDir, "code.ts")],
    outfile: resolve(distDir, "code.js"),
    platform: "browser",
    define: {
      __html__: JSON.stringify(uiHtml)
    }
  };
  await build(codeOptions);
}

if (watch) {
  const uiCtx = await context(uiOptions);
  await uiCtx.watch();
  const uiHtml = await buildUiHtml();
  await buildCode(uiHtml);
  console.log("Watching for changes...");
} else {
  await build(uiOptions);
  const uiHtml = await buildUiHtml();
  await buildCode(uiHtml);
}
