const editor = document.getElementById("editor");
const gutter = document.getElementById("gutter");
const syntaxLayer = document.getElementById("syntaxLayer");
const output = document.getElementById("output");
const tabName = document.getElementById("tabName");
const pathLabel = document.getElementById("pathLabel");
const dirtyMark = document.getElementById("dirtyMark");
const statusText = document.getElementById("statusText");
const runStatus = document.getElementById("runStatus");
const explorerRoot = document.getElementById("explorerRoot");
let currentPath = null;
let projectPath = null;
let savedContent = editor.value;

function basename(filePath) { return filePath.split(/[\\/]/).pop(); }
function escapeHTML(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function updateSyntax() {
  const source = editor.value;
  const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b(?:vibe|ritual|drop|when|nah|grind|spill|borrow)\b|\b(?:based|cringe|ghost|whole|caption|party)\b|\b\d+(?:\.\d+)?\b)/g;
  let html = "";
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    html += escapeHTML(source.slice(last, match.index));
    const token = match[0];
    let kind = "number";
    if (token.startsWith("#")) kind = "comment";
    else if (token.startsWith('"') || token.startsWith("'")) kind = "string";
    else if (/^\d/.test(token)) kind = "number";
    else kind = "keyword";
    html += '<span class="tok-' + kind + '">' + escapeHTML(token) + "</span>";
    last = match.index + token.length;
  }
  html += escapeHTML(source.slice(last));
  syntaxLayer.innerHTML = html + "\n";
}
function updateLines() {
  const count = Math.max(1, editor.value.split("\n").length);
  gutter.textContent = Array.from({length: count}, (_, i) => i + 1).join("\n");
  gutter.scrollTop = editor.scrollTop;
  syntaxLayer.scrollTop = editor.scrollTop;
  syntaxLayer.scrollLeft = editor.scrollLeft;
}
function updateDirty() {
  const dirty = editor.value !== savedContent;
  dirtyMark.style.opacity = dirty ? "1" : "0";
  statusText.textContent = dirty ? "Cambios sin guardar" : "Listo";
}
function log(text, type = "stdout") {
  const line = document.createElement("div");
  line.className = type;
  line.textContent = String(text).replace(/\s+$/, "");
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}
function setFile(file) {
  currentPath = file.path;
  editor.value = file.content;
  savedContent = editor.value;
  tabName.textContent = basename(currentPath);
  pathLabel.textContent = currentPath;
  updateLines(); updateSyntax(); updateDirty();
}
async function openFile() {
  try {
    const file = await window.memingoIDE.openFile();
    if (file) setFile(file);
  } catch (error) { log(error.message, "stderr"); }
}
async function openProjectFile(filePath) {
  try {
    const file = await window.memingoIDE.openProjectFile(filePath);
    setFile(file);
  } catch (error) { log(error.message, "stderr"); }
}
function renderTree(items, container, depth = 0) {
  for (const item of items) {
    const row = document.createElement("button");
    row.className = "tree-item " + (item.type === "directory" ? "tree-folder" : "tree-file");
    row.style.paddingLeft = (12 + depth * 15) + "px";
    row.type = "button";
    row.innerHTML = '<span class="tree-icon">' + (item.type === "directory" ? "▸" : "M") + '</span><span></span>';
    row.lastElementChild.textContent = item.name;
    container.appendChild(row);
    if (item.type === "directory") {
      const children = document.createElement("div");
      children.className = "tree-children";
      children.hidden = true;
      container.appendChild(children);
      row.addEventListener("click", () => {
        children.hidden = !children.hidden;
        row.querySelector(".tree-icon").textContent = children.hidden ? "▸" : "▾";
      });
      renderTree(item.children || [], children, depth + 1);
      if (!item.children || item.children.length === 0) row.disabled = true;
    } else {
      row.addEventListener("click", () => openProjectFile(item.path));
    }
  }
}
async function openProject() {
  try {
    const project = await window.memingoIDE.openProject();
    if (!project) return;
    projectPath = project.path;
    pathLabel.textContent = project.path;
    explorerRoot.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "project-name";
    heading.textContent = "▰  " + project.name;
    explorerRoot.appendChild(heading);
    const tree = document.createElement("div");
    tree.className = "file-tree";
    explorerRoot.appendChild(tree);
    renderTree(project.tree, tree);
    if (!project.tree.length) {
      const empty = document.createElement("p");
      empty.className = "tree-empty";
      empty.textContent = "No se encontraron archivos .mgo o .mgoa.";
      explorerRoot.appendChild(empty);
    }
    log("Proyecto abierto: " + project.path, "hint-line");
  } catch (error) { log(error.message, "stderr"); }
}
async function saveFile() {
  try {
    const result = await window.memingoIDE.saveFile({path: currentPath, content: editor.value});
    if (!result) return false;
    currentPath = result.path;
    savedContent = editor.value;
    tabName.textContent = basename(currentPath);
    pathLabel.textContent = projectPath || currentPath;
    updateDirty();
    log("Guardado: " + currentPath);
    return true;
  } catch (error) { log(error.message, "stderr"); return false; }
}
async function newFile() {
  if (editor.value !== savedContent && !confirm("Hay cambios sin guardar. ¿Continuar?")) return;
  try {
    const file = await window.memingoIDE.newFile();
    if (file) setFile(file);
  } catch (error) { log(error.message, "stderr"); }
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
document.getElementById("projectBtn").addEventListener("click", openProject);
document.getElementById("sideProject").addEventListener("click", openProject);
document.getElementById("newBtn").addEventListener("click", newFile);
document.getElementById("openBtn").addEventListener("click", openFile);
document.getElementById("sideOpen").addEventListener("click", openFile);
document.getElementById("saveBtn").addEventListener("click", saveFile);
document.getElementById("runBtn").addEventListener("click", runFile);
document.getElementById("stopBtn").addEventListener("click", () => window.memingoIDE.stop());
document.getElementById("clearOutput").addEventListener("click", () => output.replaceChildren());
document.getElementById("clearBtn").addEventListener("click", () => log("No hay problemas detectados.", "hint-line"));
editor.addEventListener("input", () => { updateLines(); updateSyntax(); updateDirty(); });
editor.addEventListener("scroll", updateLines);
editor.addEventListener("keydown", event => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = editor.selectionStart, end = editor.selectionEnd;
    editor.setRangeText("    ", start, end, "end");
    updateLines(); updateSyntax(); updateDirty();
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
updateSyntax();