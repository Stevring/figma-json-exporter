const exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
const exportParentBtn = document.getElementById("export-parent-btn") as HTMLButtonElement;
const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
const viewer = document.getElementById("viewer") as HTMLTextAreaElement;
const status = document.getElementById("status") as HTMLDivElement;
const resizeHandle = document.getElementById("resize-handle") as HTMLDivElement;

let currentFileName = "";
let isResizing = false;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

function setStatus(message: string): void {
  status.textContent = message || "";
}

exportBtn.onclick = () => {
  parent.postMessage({ pluginMessage: { type: "export" } }, "*");
};

exportParentBtn.onclick = () => {
  parent.postMessage({ pluginMessage: { type: "exportParent" } }, "*");
};

downloadBtn.onclick = () => {
  if (!viewer.value) {
    setStatus("No JSON to download.");
    parent.postMessage({ pluginMessage: { type: "notify", message: "Nothing to download." } }, "*");
    return;
  }

  const blob = new Blob([viewer.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = currentFileName || "figma-export.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${anchor.download}`);
};

window.onmessage = (event: MessageEvent) => {
  const msg = (event.data as { pluginMessage?: { type?: string; warning?: string; jsonString?: string; fileName?: string } })
    .pluginMessage;
  if (!msg || msg.type !== "exportResult") return;

  if (msg.warning) {
    viewer.value = "";
    currentFileName = "";
    setStatus(msg.warning);
    return;
  }

  viewer.value = msg.jsonString || "";
  currentFileName = msg.fileName || "";
  setStatus(currentFileName ? `Ready to download: ${currentFileName}` : "");
};

resizeHandle.addEventListener("mousedown", (event) => {
  isResizing = true;
  startX = event.clientX;
  startY = event.clientY;
  startWidth = window.innerWidth;
  startHeight = window.innerHeight;
  event.preventDefault();
});

window.addEventListener("mousemove", (event) => {
  if (!isResizing) return;
  const nextWidth = Math.max(360, Math.round(startWidth + (event.clientX - startX)));
  const nextHeight = Math.max(240, Math.round(startHeight + (event.clientY - startY)));
  parent.postMessage({ pluginMessage: { type: "resize", width: nextWidth, height: nextHeight } }, "*");
});

window.addEventListener("mouseup", () => {
  isResizing = false;
});
