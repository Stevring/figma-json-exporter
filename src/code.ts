const UI_WIDTH = 720;
const UI_HEIGHT = 520;

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });

const EXPORT_FIELDS = [
  // Identity & structure
  "id",
  "name",
  "type",
  "visible",
  "locked",
  "constraints",
  "layoutAlign",
  "layoutGrow",
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "clipsContent",

  // Layout (Auto Layout)
  "layoutMode",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "itemSpacing",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "layoutWrap",
  "counterAxisSpacing",
  "counterAxisAlignContent",

  // Resizing
  "layoutPositioning",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "layoutSizingHorizontal",
  "layoutSizingVertical",

  // Geometry & styling
  "fills",
  "strokes",
  "cornerRadius",
  "rectangleCornerRadii",
  "opacity",
  "effects",

  // Text
  "characters",
  "textAlignHorizontal",
  "textAlignVertical",
  "textAutoResize",
  "fontName",
  "fontSize",
  "textDecoration"
] as const;

type ExportField = (typeof EXPORT_FIELDS)[number];
const MIXED_CORNER_KEYS = [
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius"
] as const;

function formatDateForFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}${dd}-${hh}${min}${ss}`;
}

function sanitizeValue(value: unknown): unknown {
  if (value === figma.mixed) return "MIXED";
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" && value.trim() === "") return undefined;
  if (typeof value === "symbol") return value.toString();
  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map(sanitizeValue)
      .filter((item) => item !== undefined && item !== null);
    return sanitizedItems.length ? sanitizedItems : undefined;
  }
  if (typeof value === "object") {
    if ("visible" in (value as Record<string, unknown>) && (value as { visible?: boolean }).visible === false) {
      return undefined;
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const sanitized = sanitizeValue(val);
      if (sanitized !== undefined) out[key] = sanitized;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

function isRgbColor(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const obj = value as { r?: unknown; g?: unknown; b?: unknown };
  return typeof obj.r === "number" && typeof obj.g === "number" && typeof obj.b === "number";
}

function rgbaToHex(color: { r: number; g: number; b: number }, opacity?: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const toHex = (n: number) => Math.round(clamp(n) * 255).toString(16).padStart(2, "0");
  const alpha = typeof opacity === "number" ? opacity : 1;
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}${toHex(alpha)}`.toUpperCase();
}

async function addColorVariableName(
  paint: Paint,
  sanitized: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const bound = (paint as { boundVariables?: { color?: VariableAlias } }).boundVariables;
  if (!bound || !bound.color || !("id" in bound.color)) return sanitized;
  const variable = await figma.variables.getVariableByIdAsync(bound.color.id);
  if (!variable) return sanitized;

  const color = (sanitized.color as Record<string, unknown>) || {};
  const nextColor = Object.assign({}, color, { colorVariableName: variable.name });
  return Object.assign({}, sanitized, { color: nextColor });
}

async function sanitizePaints(value: unknown): Promise<unknown> {
  if (value === figma.mixed) return "MIXED";
  if (!Array.isArray(value)) return sanitizeValue(value);
  const paints = value as Paint[];
  const sanitizedItems = await Promise.all(
    paints.map(async (paint) => {
      const sanitized = sanitizeValue(paint);
      if (!sanitized || typeof sanitized !== "object") return sanitized;

      const paintRecord = sanitized as Record<string, unknown>;
      if (paint && "color" in paint && isRgbColor(paint.color)) {
        paintRecord.color = { hexRGBA: rgbaToHex(paint.color as { r: number; g: number; b: number }, paint.opacity) };
      }

      const withName = await addColorVariableName(paint, paintRecord);
      if (withName && typeof withName === "object" && "boundVariables" in withName) {
        const cleaned = Object.assign({}, withName as Record<string, unknown>);
        delete cleaned.boundVariables;
        return cleaned;
      }
      return withName;
    })
  );
  const filtered = sanitizedItems.filter((item) => item !== undefined && item !== null);
  return filtered.length ? filtered : undefined;
}

function hasOwn(node: SceneNode, key: ExportField): boolean {
  return key in node && (node as Record<string, unknown>)[key] !== undefined;
}

async function exportNode(node: SceneNode, includeChildren: boolean): Promise<Record<string, unknown> | null> {
  if (node.visible === false) return null;
  const data: Record<string, unknown> = {};
  for (const key of EXPORT_FIELDS) {
    if (hasOwn(node, key)) {
      const raw = (node as Record<string, unknown>)[key];
      if (key === "cornerRadius" && raw === figma.mixed) {
        for (const cornerKey of MIXED_CORNER_KEYS) {
          const cornerValue = (node as Record<string, unknown>)[cornerKey];
          const sanitizedCorner = sanitizeValue(cornerValue);
          if (sanitizedCorner !== undefined && sanitizedCorner !== "MIXED") {
            data[cornerKey] = sanitizedCorner;
          }
        }
        continue;
      }
      const value =
        key === "fills" || key === "strokes" ? await sanitizePaints(raw) : sanitizeValue(raw);
      if (value !== undefined) data[key] = value;
    }
  }

  if ("textStyleId" in node && node.textStyleId && node.textStyleId !== figma.mixed) {
    const style = await figma.getStyleByIdAsync(node.textStyleId as string);
    if (style && style.name) {
      data.textVariableName = style.name;
    }
  }

  if (includeChildren && "children" in node) {
    const parent = node as BaseNode & ChildrenMixin;
    const childrenResults = await Promise.all(parent.children.map((child) => exportNode(child, true)));
    const children = childrenResults.filter((child): child is Record<string, unknown> => child !== null);
    if (children.length) data.children = children;
  }

  return Object.keys(data).length ? data : null;
}

function getSelectedNode(): SceneNode | null {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) return null;
  return selection[0];
}

async function sendExport(includeChildren: boolean): Promise<void> {
  const node = getSelectedNode();
  if (!node) {
    figma.ui.postMessage({
      type: "exportResult",
      jsonString: "",
      nodeName: "",
      fileName: "",
      warning: "No node selected. Please select a single node."
    });
    return;
  }

  const exported = (await exportNode(node, includeChildren)) || {};
  const jsonString = JSON.stringify(exported, null, 2);
  const safeName = (node.name || "node").replace(/[\\/:*?"<>|]+/g, "-");
  const stamp = formatDateForFilename(new Date());
  const fileName = `figma-${safeName}-${stamp}.json`;

  figma.ui.postMessage({
    type: "exportResult",
    jsonString,
    nodeName: node.name || "node",
    fileName
  });
}

function formatError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch (err) {
    return String(error);
  }
}

figma.ui.onmessage = async (msg: { type?: string; message?: string; width?: number; height?: number }) => {
  if (!msg || !msg.type) return;
  try {
    if (msg.type === "export") {
      await sendExport(true);
    } else if (msg.type === "exportParent") {
      await sendExport(false);
    } else if (msg.type === "notify") {
      if (msg.message) figma.notify(msg.message);
    } else if (msg.type === "resize") {
      const rawWidth = msg.width == null ? UI_WIDTH : msg.width;
      const rawHeight = msg.height == null ? UI_HEIGHT : msg.height;
      const width = Math.max(360, Math.round(rawWidth));
      const height = Math.max(240, Math.round(rawHeight));
      figma.ui.resize(width, height);
    }
  } catch (error) {
    figma.ui.postMessage({
      type: "exportResult",
      jsonString: "",
      nodeName: "",
      fileName: "",
      warning: formatError(error)
    });
  }
};
