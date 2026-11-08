const editor = document.getElementById("editor");
const gutter = document.getElementById("gutter");
const output = document.getElementById("output");
const tabName = document.getElementById("tabName");
const pathLabel = document.getElementById("pathLabel");
const dirtyMark = document.getElementById("dirtyMark");
const statusText = document.getElementById("statusText");
const runStatus = document.getElementById("runStatus");
let currentPath = null;
let savedContent = editor.value;

function basename(filePath) { return filePath.split(/[\\/]/).pop(); }
function updateLines() {
  const count = Math.max(1, editor.value.split("\n").length);
  gutter.textContent = Array.from({length: count}, (_, i) => i + 1).join("\n");
  gutter.scrollTop = editor.scrollTop;
}
function updateDirty() {
  const dirty = editor.value !== savedContent;
  dirtyMark.style.opacity = dirty ? "1" : "0";
  statusText.textContent = dirty ? "Cambios sin guardar" : "Listo";
}
function log(text, type = "stdout") {
  const line = document.createElement("div");
  line.className = type;
  line.textContent = text.replace(/\s+$/, "");
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}
async function openFile() {
  const file = await window.memingoIDE.openFile();
  if (!file) return;
  currentPath = file.path;
  editor.value = file.content;
  savedContent = editor.value;
  tabName.textContent = basename(currentPath);
  pathLabel.textContent = currentPath;
  updateLines(); updateDirty();
}
async function saveFile() {
  const result = await window.memingoIDE.saveFile({path: currentPath, content: editor.value});
  if (!result) return false;
  currentPath = result.path;
  savedContent = editor.value;
  tabName.textContent = basename(currentPath);
  pathLabel.textContent = currentPath;
  updateDirty();
  log("Guardado: " + currentPath);
  return true;
}
async function newFile() {
  if (editor.value !== savedContent && !confirm("Hay cambios sin guardar. ¿Continuar?")) return;
  const file = await window.memingoIDE.newFile();
  if (!file) return;
  currentPath = file.path;
  editor.value = file.content;
  savedContent = editor.value;
  tabName.textContent = basename(currentPath);
  pathLabel.textContent = currentPath;
  updateLines(); updateDirty();
}
async function runFile() {
  if (!currentPath || editor.value !== savedContent) {
    const saved = await saveFile();
    if (!saved) return;
  }
  output.replaceChildren();
  log("$ memingo run " + basename(currentPath), "hint-line");
  runStatus.textContent = "● Ejecutando";
  statusText.textContent = "Ejecutando…";
  try {
    const result = await window.memingoIDE.run(currentPath);
    if (result.error) log(result.error, "stderr");
    log(result.code === 0 ? "Proceso finalizado correctamente." : "Proceso terminado con código " + result.code, result.code === 0 ? "hint-line" : "stderr");
  } catch (error) {
    log(error.message, "stderr");
  } finally {
    runStatus.textContent = "● Inactivo";
    statusText.textContent = "Listo";
  }
}
document.getElementById("newBtn").addEventListener("click", newFile);
document.getElementById("openBtn").addEventListener("click", openFile);
document.getElementById("sideOpen").addEventListener("click", openFile);
document.getElementById("saveBtn").addEventListener("click", saveFile);
document.getElementById("runBtn").addEventListener("click", runFile);
document.getElementById("stopBtn").addEventListener("click", () => window.memingoIDE.stop());
document.getElementById("clearOutput").addEventListener("click", () => output.replaceChildren());
document.getElementById("clearBtn").addEventListener("click", () => log("No hay problemas detectados.", "hint-line"));
editor.addEventListener("input", () => { updateLines(); updateDirty(); });
editor.addEventListener("scroll", () => { gutter.scrollTop = editor.scrollTop; });
editor.addEventListener("keydown", event => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = editor.selectionStart, end = editor.selectionEnd;
    editor.setRangeText("    ", start, end, "end");
    updateLines(); updateDirty();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault(); runFile();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault(); saveFile();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
    event.preventDefault(); openFile();
  }
});
window.memingoIDE.onOutput(data => log(data.text, data.type));
updateLines();