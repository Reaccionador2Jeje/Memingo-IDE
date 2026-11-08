const editor = document.getElementById("editor");
const gutter = document.getElementById("gutter");
const syntaxLayer = document.getElementById("syntaxLayer");
const output = document.getElementById("output");
const pathLabel = document.getElementById("pathLabel");
const statusText = document.getElementById("statusText");
const runStatus = document.getElementById("runStatus");
const explorerRoot = document.getElementById("explorerRoot");
const tabsElement = document.getElementById("tabs");
const autocomplete = document.getElementById("autocomplete");

const suggestions = [
  {label:"vibe", detail:"declarar variable", insert:"vibe "},
  {label:"ritual", detail:"declarar función", insert:"ritual name() {\n    \n}"},
  {label:"when", detail:"condición", insert:"when condition {\n    \n}"},
  {label:"nah", detail:"alternativa de when", insert:"nah {\n    \n}"},
  {label:"grind", detail:"bucle", insert:"grind condition {\n    \n}"},
  {label:"spill", detail:"mostrar salida", insert:"spill "},
  {label:"drop", detail:"devolver valor", insert:"drop "},
  {label:"borrow", detail:"importar módulo o paquete", insert:"borrow "},
  {label:"whole", detail:"tipo numérico entero", insert:"whole"},
  {label:"caption", detail:"tipo de texto", insert:"caption"},
  {label:"party", detail:"tipo lista", insert:"party"},
  {label:"based", detail:"valor verdadero", insert:"based"},
  {label:"cringe", detail:"valor falso", insert:"cringe"},
  {label:"ghost", detail:"valor nulo", insert:"ghost"},
  ...["headcount","whatkind","json_parse","json_stringify","env","range","keys","push","append","set_value","delete_key","random","random_int","http_get","http_post","trim","join","split","sort","map","filter","reduce","sum","min","max","clamp","parse_int","parse_float","repeat","lines","unique","meme_case","shuffle","uuid","now","sleep","read_file","write_file","file_exists","list_files"].map(label=>({label,detail:"función integrada",insert:label+"("}))
];

let fileCounter = 0;
let tabs = [];
let activeTabId = null;
let projectPath = null;
let logEntries = [];
let suggestionItems = [];
let suggestionIndex = 0;
let outputMode = "console";

function basename(filePath) { return filePath.split(/[\\/]/).pop(); }
function makeId() { fileCounter += 1; return "tab-" + fileCounter; }
function activeTab() { return tabs.find(tab => tab.id === activeTabId); }
function escapeHTML(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function updateSyntax() {
  const source = editor.value;
  const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b(?:vibe|ritual|drop|when|nah|grind|spill|borrow)\b|\b(?:based|cringe|ghost|whole|caption|party)\b|\b(?:headcount|whatkind|json_parse|json_stringify|env|range|keys|push|append|set_value|delete_key|random|random_int|http_get|http_post|trim|join|split|sort|map|filter|reduce|sum|min|max|clamp|parse_int|parse_float|repeat|lines|unique|meme_case|shuffle|uuid|now|sleep|read_file|write_file|file_exists|list_files)\b|\b\d+(?:\.\d+)?\b)/g;
  let html = "";
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    html += escapeHTML(source.slice(last, match.index));
    const token = match[0];
    let kind = "number";
    if (token.startsWith("#")) kind = "comment";
    else if (token.startsWith('"') || token.startsWith("'")) kind = "string";
    else if (/^\d/.test(token)) kind = "number";
    else if (/^(based|cringe|ghost|whole|caption|party)$/.test(token)) kind = "value";
    else if (/^(headcount|whatkind|json_parse|json_stringify|env|range|keys|push|append|set_value|delete_key|random|random_int|http_get|http_post|trim|join|split|sort|map|filter|reduce|sum|min|max|clamp|parse_int|parse_float|repeat|lines|unique|meme_case|shuffle|uuid|now|sleep|read_file|write_file|file_exists|list_files)$/.test(token)) kind = "builtin";
    else kind = "keyword";
    html += '<span class="tok-' + kind + '">' + escapeHTML(token) + "</span>";
    last = match.index + token.length;
  }
  html += escapeHTML(source.slice(last));
  syntaxLayer.innerHTML = html + "\n";
}
let breakpoints = new Set();
function renderGutter() {
  const count = Math.max(1, editor.value.split("\n").length);
  gutter.replaceChildren();
  for (let line = 1; line <= count; line++) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "gutter-line" + (breakpoints.has(line) ? " has-breakpoint" : "");
    marker.textContent = String(line);
    marker.title = breakpoints.has(line) ? "Quitar breakpoint en línea " + line : "Añadir breakpoint en línea " + line;
    marker.addEventListener("click", () => {
      if (breakpoints.has(line)) breakpoints.delete(line); else breakpoints.add(line);
      renderGutter();
    });
    gutter.appendChild(marker);
  }
}
function updateLines() {
  renderGutter();
  gutter.scrollTop = editor.scrollTop;
  syntaxLayer.scrollTop = editor.scrollTop;
  syntaxLayer.scrollLeft = editor.scrollLeft;
}
function updateDirty() {
  const tab = activeTab();
  if (!tab) return;
  tab.content = editor.value;
  tab.dirty = tab.content !== tab.savedContent;
  const marker = tabsElement.querySelector('[data-tab-id="' + tab.id + '"] .tab-dirty');
  if (marker) marker.style.opacity = tab.dirty ? "1" : "0";
  statusText.textContent = tab.dirty ? "Cambios sin guardar" : "Listo";
  renderTabs();
}
function log(text, type = "stdout") {
  logEntries.push({text:String(text).replace(/\s+$/, ""),type});
  if (outputMode === "console") renderOutput();
}
function renderOutput() {
  output.replaceChildren();
  for (const entry of logEntries) {
    const line = document.createElement("div");
    line.className = entry.type;
    line.textContent = entry.text;
    output.appendChild(line);
  }
  output.scrollTop = output.scrollHeight;
}
function renderTabs() {
  tabsElement.replaceChildren();
  for (const tab of tabs) {
    const item = document.createElement("div");
    item.className = "tab" + (tab.id === activeTabId ? " active-tab" : "");
    item.dataset.tabId = tab.id;
    const open = document.createElement("button");
    open.className = "tab-open";
    open.type = "button";
    open.textContent = tab.name;
    open.title = tab.path || tab.name;
    open.addEventListener("click", () => switchTab(tab.id));
    const dirty = document.createElement("span");
    dirty.className = "tab-dirty";
    dirty.style.opacity = tab.dirty ? "1" : "0";
    const close = document.createElement("button");
    close.className = "tab-close";
    close.type = "button";
    close.textContent = "×";
    close.title = "Cerrar archivo";
    close.addEventListener("click", () => closeTab(tab.id));
    item.append(open, dirty, close);
    tabsElement.appendChild(item);
  }
}
function syncActiveToTab() {
  const tab = activeTab();
  if (!tab) return;
  tab.content = editor.value;
  tab.dirty = tab.content !== tab.savedContent;
}
function switchTab(id, saveCurrent = true) {
  if (saveCurrent) syncActiveToTab();
  const tab = tabs.find(item => item.id === id);
  if (!tab) return;
  activeTabId = id;
  editor.value = tab.content;
  pathLabel.textContent = projectPath || tab.path || "Sin proyecto abierto";
  updateLines(); updateSyntax(); renderTabs();
  statusText.textContent = tab.dirty ? "Cambios sin guardar" : "Listo";
  hideAutocomplete();
  editor.focus();
}
function addTab(file) {
  const existing = file.path && tabs.find(tab => tab.path === file.path);
  if (existing) { switchTab(existing.id); return; }
  syncActiveToTab();
  const id = makeId();
  tabs.push({id,path:file.path || null,name:file.path ? basename(file.path) : (file.name || "Sin título.mgo"),content:file.content || "",savedContent:file.content || "",dirty:false});
  activeTabId = id;
  switchTab(id, false);
}
function closeTab(id) {
  const tab = tabs.find(item => item.id === id);
  if (!tab) return;
  if (tab.id === activeTabId) syncActiveToTab();
  if (tab.dirty && !confirm("Hay cambios sin guardar en " + tab.name + ". ¿Cerrar igualmente?")) return;
  const index = tabs.findIndex(item => item.id === id);
  tabs.splice(index,1);
  if (!tabs.length) {
    tabs.push({id:makeId(),path:null,name:"Sin título.mgo",content:"",savedContent:"",dirty:false});
  }
  if (activeTabId === id) {
    activeTabId = tabs[Math.max(0,index-1)].id;
    switchTab(activeTabId);
  } else renderTabs();
}
async function openFile() {
  try { const file = await window.memingoIDE.openFile(); if (file) addTab(file); }
  catch (error) { log(error.message,"stderr"); }
}
async function openProjectFile(filePath) {
  try { const file = await window.memingoIDE.openProjectFile(filePath); addTab(file); }
  catch (error) { log(error.message,"stderr"); }
}
function renderTree(items, container, depth = 0) {
  for (const item of items) {
    const row = document.createElement("button");
    row.className = "tree-item " + (item.type === "directory" ? "tree-folder" : "tree-file");
    row.style.paddingLeft = (12 + depth * 15) + "px";
    row.type = "button";
    const icon = document.createElement("span");
    icon.className = "tree-icon";
    icon.textContent = item.type === "directory" ? "▸" : "M";
    const label = document.createElement("span");
    label.textContent = item.name;
    row.append(icon,label);
    container.appendChild(row);
    if (item.type === "directory") {
      const children = document.createElement("div");
      children.className = "tree-children";
      children.hidden = true;
      container.appendChild(children);
      row.addEventListener("click", () => {
        children.hidden = !children.hidden;
        icon.textContent = children.hidden ? "▸" : "▾";
      });
      renderTree(item.children || [],children,depth+1);
      if (!item.children || item.children.length === 0) row.disabled = true;
    } else row.addEventListener("click",() => openProjectFile(item.path));
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
    const manifest = project.manifest || { exists: false };
    const projectCard = document.createElement("section");
    projectCard.className = "manifest-card";
    const cardTitle = document.createElement("strong");
    cardTitle.textContent = manifest.exists ? (manifest.valid ? "Proyecto Memingo" : "Manifest inválido") : "Proyecto sin manifest";
    projectCard.appendChild(cardTitle);
    if (manifest.valid) {
      const details = document.createElement("p");
      details.textContent = manifest.name + " · v" + manifest.version;
      projectCard.appendChild(details);
      const entry = document.createElement("p");
      entry.textContent = "Principal: " + manifest.entry + (manifest.entryExists ? "" : " (no encontrado)");
      projectCard.appendChild(entry);
      const deps = document.createElement("p");
      deps.textContent = manifest.dependencyCount + " dependencia(s)";
      projectCard.appendChild(deps);
      if (manifest.entryExists) {
        const openEntry = document.createElement("button");
        openEntry.type = "button";
        openEntry.className = "manifest-entry";
        openEntry.textContent = "Abrir archivo principal";
        openEntry.addEventListener("click", () => openProjectFile(manifest.entryPath));
        projectCard.appendChild(openEntry);
      }
    } else {
      const message = document.createElement("p");
      message.textContent = manifest.error || "No se encontró memingo.toml. Esta carpeta se tratará como espacio de trabajo normal.";
      projectCard.appendChild(message);
    }
    explorerRoot.appendChild(projectCard);
    const tree = document.createElement("div");
    tree.className = "file-tree";
    explorerRoot.appendChild(tree);
    renderTree(project.tree,tree);
    if (!project.tree.length) {
      const empty = document.createElement("p");
      empty.className = "tree-empty";
      empty.textContent = "No se encontraron archivos .mgo o .mgoa.";
      explorerRoot.appendChild(empty);
    }
    log("Proyecto abierto: " + project.path,"hint-line");
    await refreshGitChanges();
    await refreshGitBranches();
  } catch (error) { log(error.message,"stderr"); }
}
async function saveFile() {
  const tab = activeTab();
  if (!tab) return false;
  tab.content = editor.value;
  try {
    const result = await window.memingoIDE.saveFile({path:tab.path,content:editor.value});
    if (!result) return false;
    tab.path = result.path;
    tab.name = basename(result.path);
    tab.savedContent = editor.value;
    tab.dirty = false;
    pathLabel.textContent = projectPath || tab.path;
    renderTabs(); updateDirty();
    log("Guardado: " + tab.path);
    return true;
  } catch (error) { log(error.message,"stderr"); return false; }
}
async function newFile() {
  syncActiveToTab();
  if (activeTab()?.dirty && !confirm("Hay cambios sin guardar. ¿Crear otro archivo?")) return;
  try { const file = await window.memingoIDE.newFile(); if (file) addTab(file); }
  catch (error) { log(error.message,"stderr"); }
}
async function runFile() {
  const tab = activeTab();
  if (!tab) return;
  if (!tab.path || editor.value !== tab.savedContent) {
    const saved = await saveFile();
    if (!saved) return;
  }
  outputMode = "console";
  document.getElementById("consoleTab").classList.add("selected");
  document.getElementById("problemsTab").classList.remove("selected");
  renderOutput();
  log("$ memingo run " + basename(tab.path),"hint-line");
  runStatus.textContent = "● Ejecutando";
  statusText.textContent = "Ejecutando…";
  try {
    const result = await window.memingoIDE.run(tab.path);
    if (result.error) log(result.error,"stderr");
    log(result.code === 0 ? "Proceso finalizado correctamente." : "Proceso terminado con código " + result.code,result.code === 0 ? "hint-line" : "stderr");
  } catch (error) { log(error.message,"stderr"); }
  finally { runStatus.textContent = "● Inactivo"; statusText.textContent = "Listo"; }
}
function analyzeSource(source) {
  const errors = [];
  const stack = [];
  const pairs = {")":"(","]":"[","}":"{"};
  let quote = null, escaped = false, line = 1, comment = false, quoteLine = 1;
  for (let i=0;i<source.length;i++) {
    const char = source[i];
    if (char === "\n") { line++; comment = false; continue; }
    if (comment) continue;
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "#") { comment = true; continue; }
    if (char === '"' || char === "'") { quote = char; quoteLine = line; continue; }
    if ("([{".includes(char)) stack.push({char,line});
    else if (")] }".replace(" ","").includes(char)) {
      const last = stack.pop();
      if (!last || last.char !== pairs[char]) errors.push({line,message:"Cierre " + char + " sin apertura correspondiente."});
    }
  }
  if (quote) errors.push({line:quoteLine,message:"Cadena de texto sin cerrar."});
  for (const item of stack) errors.push({line:item.line,message:"Falta cerrar " + item.char + "."});
  return errors.sort((a,b)=>a.line-b.line);
}
function showProblems() {
  syncActiveToTab();
  outputMode = "problems";
  output.replaceChildren();
  const tab = activeTab();
  const errors = analyzeSource(editor.value);
  if (!errors.length) {
    const item = document.createElement("div");
    item.className = "hint-line";
    item.textContent = "✓ No se encontraron errores básicos de delimitadores o cadenas.";
    output.appendChild(item);
  } else {
    for (const error of errors) {
      const item = document.createElement("button");
      item.className = "problem-item";
      item.type = "button";
      item.textContent = "Línea " + error.line + ": " + error.message;
      item.addEventListener("click",() => {
        const lines = editor.value.split("\n");
        const position = lines.slice(0,error.line-1).reduce((sum,value)=>sum+value.length+1,0);
        editor.focus(); editor.setSelectionRange(position,position);
      });
      output.appendChild(item);
    }
  }
}
function showConsole() {
  outputMode = "console";
  document.getElementById("consoleTab").classList.add("selected");
  document.getElementById("problemsTab").classList.remove("selected");
  renderOutput();
}
function hideAutocomplete() { autocomplete.hidden = true; suggestionItems = []; }
function applySuggestion(item) {
  const start = editor.selectionStart;
  const before = editor.value.slice(0,start);
  const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  const from = match ? start-match[0].length : start;
  editor.setRangeText(item.insert,from,start,"end");
  hideAutocomplete(); updateLines(); updateSyntax(); updateDirty(); editor.focus();
}
function showAutocomplete(force = false) {
  const cursor = editor.selectionStart;
  const before = editor.value.slice(0,cursor);
  const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  const prefix = match ? match[0].toLowerCase() : "";
  if (!force && prefix.length < 1) { hideAutocomplete(); return; }
  suggestionItems = suggestions.filter(item => item.label.toLowerCase().startsWith(prefix)).slice(0,9);
  if (!suggestionItems.length) { hideAutocomplete(); return; }
  suggestionIndex = 0;
  autocomplete.replaceChildren();
  for (let i=0;i<suggestionItems.length;i++) {
    const item = suggestionItems[i];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "completion-item" + (i===0 ? " chosen" : "");
    const name = document.createElement("strong"); name.textContent = item.label;
    const detail = document.createElement("span"); detail.textContent = item.detail;
    button.append(name,detail);
    button.addEventListener("mousedown",event=>{event.preventDefault();applySuggestion(item);});
    autocomplete.appendChild(button);
  }
  autocomplete.hidden = false;
}
function moveSuggestion(delta) {
  if (autocomplete.hidden) return;
  suggestionIndex = (suggestionIndex + delta + suggestionItems.length) % suggestionItems.length;
  [...autocomplete.children].forEach((item,index)=>item.classList.toggle("chosen",index===suggestionIndex));
}

async function checkFile() {
  const tab = activeTab();
  if (!tab) return;
  if (!tab.path || editor.value !== tab.savedContent) {
    const saved = await saveFile();
    if (!saved) return;
  }
  showConsole();
  log("$ memingo check " + basename(tab.path), "hint-line");
  try {
    const result = await window.memingoIDE.check(tab.path);
    if (result.stdout) log(result.stdout);
    if (result.stderr) log(result.stderr, "stderr");
    log(result.code === 0 ? "✓ Memingo validó el archivo correctamente." : "La validación terminó con código " + result.code, result.code === 0 ? "hint-line" : "stderr");
  } catch (error) { log(error.message, "stderr"); }
}
async function formatFile() {
  const tab = activeTab();
  if (!tab) return;
  if (!tab.path || editor.value !== tab.savedContent) {
    const saved = await saveFile();
    if (!saved) return;
  }
  showConsole();
  log("$ memingo fmt " + basename(tab.path), "hint-line");
  try {
    const result = await window.memingoIDE.format(tab.path);
    if (result.stdout) log(result.stdout);
    if (result.stderr) log(result.stderr, "stderr");
    if (result.code !== 0) {
      log("El formateador terminó con código " + result.code, "stderr");
      return;
    }
    if (typeof result.content === "string") {
      editor.value = result.content;
      tab.content = result.content;
      tab.savedContent = result.content;
      tab.dirty = false;
      updateLines(); updateSyntax(); renderTabs();
      statusText.textContent = "Listo";
      log("✓ Archivo formateado y actualizado en el editor.", "hint-line");
    }
  } catch (error) { log(error.message, "stderr"); }
}


async function debugFile() {
  const tab = activeTab();
  if (!tab) return;
  if (!tab.path || editor.value !== tab.savedContent) {
    const saved = await saveFile();
    if (!saved) return;
  }
  showConsole();
  log("$ memingo debug " + basename(tab.path) + (breakpoints.size ? " --breakpoints " + [...breakpoints].sort((a,b)=>a-b).join(",") : ""), "hint-line");
  runStatus.textContent = "● Depurando";
  statusText.textContent = "Depurando…";
  try {
    const result = await window.memingoIDE.debug({filePath:tab.path,breakpoints:[...breakpoints]});
    if (result.error) log(result.error,"stderr");
    if (result.stderr) log(result.stderr,"stderr");
    const trace = result.trace;
    if (!trace) {
      if (result.stdout) log(result.stdout,"stdout");
      log("No se recibió una traza de depuración. Comprueba que el runtime Memingo esté actualizado.", "stderr");
      return;
    }
    log("Traza: " + trace.events.length + " paso(s) ejecutado(s).", "hint-line");
    for (const event of trace.events) {
      const line = event.line ? "L" + event.line : "línea desconocida";
      const marker = event.breakpoint ? " ◆ BREAKPOINT" : "";
      log("Paso " + (event.index + 1) + " · " + line + " · " + event.type + marker, event.breakpoint ? "stderr" : "hint-line");
      const variables = Object.entries(event.variables || {});
      if (variables.length) log("  Variables: " + variables.map(([name,value])=>name+" = "+value).join(" · "), "stdout");
    }
    for (const value of trace.output || []) log(value, "stdout");
    if (trace.error) log("Error: " + trace.error, "stderr");
    else log("Depuración finalizada.", "hint-line");
  } catch (error) { log(error.message,"stderr"); }
  finally { runStatus.textContent = "● Inactivo"; statusText.textContent = "Listo"; }
}

const terminalForm = document.getElementById("terminalForm");
const terminalInput = document.getElementById("terminalInput");
let terminalBusy = false;
async function executeTerminalCommand(rawCommand) {
  const command = rawCommand.trim();
  if (!command || terminalBusy) return;
  log("› " + command, "hint-line");
  terminalInput.value = "";
  if (command === "clear") { logEntries = []; renderOutput(); return; }
  if (command === "help" || command === "pwd" || command === "ls" || /^memingo (run|check|fmt)$/.test(command)) {
    terminalBusy = true;
    terminalInput.disabled = true;
    try {
      const tab = activeTab();
      if (/^memingo (run|check|fmt)$/.test(command) && tab && (!tab.path || editor.value !== tab.savedContent)) {
        const saved = await saveFile();
        if (!saved) return;
      }
      const result = await window.memingoIDE.terminalExecute({command, filePath: activeTab()?.path || ""});
      if (result.stdout) log(result.stdout, "stdout");
      if (result.stderr) log(result.stderr, "stderr");
      if (result.error) log(result.error, "stderr");
      log("Comando finalizado (código " + result.code + ").", result.code === 0 ? "hint-line" : "stderr");
      if (command === "memingo fmt" && result.code === 0 && typeof result.content === "string") {
        const current = activeTab();
        if (current) {
          editor.value = result.content; current.content = result.content; current.savedContent = result.content; current.dirty = false;
          updateLines(); updateSyntax(); renderTabs();
        }
      }
    } catch (error) { log(error.message, "stderr"); }
    finally { terminalBusy = false; terminalInput.disabled = false; terminalInput.focus(); }
    return;
  }
  log("Comando no reconocido o no permitido. Escribe help.", "stderr");
}
terminalForm.addEventListener("submit", event => {
  event.preventDefault();
  executeTerminalCommand(terminalInput.value);
});
document.getElementById("projectBtn").addEventListener("click",openProject);
document.getElementById("sideProject").addEventListener("click",openProject);
document.getElementById("newBtn").addEventListener("click",newFile);
document.getElementById("openBtn").addEventListener("click",openFile);
document.getElementById("sideOpen").addEventListener("click",openFile);
document.getElementById("saveBtn").addEventListener("click",saveFile);
document.getElementById("runBtn").addEventListener("click",runFile);
document.getElementById("debugBtn").addEventListener("click",debugFile);
document.getElementById("checkBtn").addEventListener("click",checkFile);
document.getElementById("formatBtn").addEventListener("click",formatFile);
document.getElementById("stopBtn").addEventListener("click",()=>window.memingoIDE.stop());
document.getElementById("clearOutput").addEventListener("click",()=>{logEntries=[];renderOutput();});
document.getElementById("consoleTab").addEventListener("click",showConsole);
document.getElementById("problemsTab").addEventListener("click",()=>{
  document.getElementById("problemsTab").classList.add("selected");
  document.getElementById("consoleTab").classList.remove("selected");
  showProblems();
});
editor.addEventListener("input",()=>{
  updateLines(); updateSyntax(); updateDirty();
  if (outputMode==="problems") showProblems();
  showAutocomplete();
});
editor.addEventListener("scroll",updateLines);
editor.addEventListener("keydown",event=>{
  if (!autocomplete.hidden) {
    if (event.key==="ArrowDown") {event.preventDefault();moveSuggestion(1);return;}
    if (event.key==="ArrowUp") {event.preventDefault();moveSuggestion(-1);return;}
    if (event.key==="Enter" && suggestionItems.length) {event.preventDefault();applySuggestion(suggestionItems[suggestionIndex]);return;}
    if (event.key==="Escape") {hideAutocomplete();return;}
  }
  if (event.key==="Tab") {
    event.preventDefault();
    const start=editor.selectionStart,end=editor.selectionEnd;
    editor.setRangeText("    ",start,end,"end");
    updateLines();updateSyntax();updateDirty();
  }
  if ((event.ctrlKey||event.metaKey)&&event.key===" ") {event.preventDefault();showAutocomplete(true);}
  if ((event.ctrlKey||event.metaKey)&&event.key==="Enter") {event.preventDefault();runFile();}
  if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s") {event.preventDefault();saveFile();}
  if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="o") {event.preventDefault();openFile();}
});
editor.addEventListener("blur",()=>setTimeout(()=>{if (!autocomplete.matches(":hover")) hideAutocomplete();},120));
window.memingoIDE.onOutput(data=>log(data.text,data.type));
tabs.push({id:makeId(),path:null,name:"Sin título.mgo",content:editor.value,savedContent:editor.value,dirty:false});
activeTabId=tabs[0].id;
renderTabs();updateLines();updateSyntax();

function renderGitChanges(raw) {
  const container = document.getElementById("gitChanges");
  const diffView = document.getElementById("gitDiffView");
  container.replaceChildren();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    const empty = document.createElement("div");
    empty.className = "git-empty";
    empty.textContent = "✓ No hay cambios pendientes.";
    container.appendChild(empty);
    diffView.textContent = "El proyecto está limpio.";
    return;
  }
  for (const line of lines) {
    if (line.length < 4) continue;
    const code = line.slice(0, 2);
    const filePath = line.slice(3).replace(/^"(.*)"$/, "$1");
    const row = document.createElement("div");
    row.className = "git-change-row";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "git-file-name";
    open.textContent = filePath;
    open.title = "Ver diferencias de " + filePath;
    open.addEventListener("click", () => showGitDiff(filePath));
    const state = document.createElement("span");
    state.className = "git-file-state";
    state.textContent = code;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "git-file-action";
    const staged = code[0] !== " " && code !== "??";
    action.textContent = staged ? "Quitar" : "Preparar";
    action.title = staged ? "Quitar del staging" : "Preparar este archivo";
    action.addEventListener("click", () => runGitFileAction(staged ? "unstageFile" : "stageFile", filePath));
    row.append(state, open, action);
    container.appendChild(row);
  }
}
async function refreshGitChanges() {
  if (!projectPath) return;
  try {
    const result = await window.memingoIDE.versionControl({action:"changes"});
    if (result.code !== 0) {
      document.getElementById("gitChanges").textContent = result.error || result.stderr || "No se pudo consultar Git.";
      return;
    }
    renderGitChanges(result.stdout || "");
    document.getElementById("gitRepoLabel").textContent = "Control de versiones · " + basename(projectPath);
  } catch (error) { log(error.message, "stderr"); }
}
async function showGitDiff(filePath) {
  const view = document.getElementById("gitDiffView");
  view.textContent = "Cargando diferencias…";
  try {
    const result = await window.memingoIDE.versionControlFile({action:"fileDiff",path:filePath});
    view.textContent = result.code === 0 ? (result.stdout || "No hay diferencias para este archivo.") : (result.error || result.stderr || "No se pudo generar el diff.");
  } catch (error) { view.textContent = error.message; }
}
async function runGitFileAction(action, filePath) {
  try {
    const result = await window.memingoIDE.versionControlFile({action,path:filePath});
    if (result.code !== 0) log(result.error || result.stderr || "La operación Git falló.", "stderr");
    else log((action === "stageFile" ? "Preparado: " : "Quitado del staging: ") + filePath, "hint-line");
    await refreshGitChanges();
  } catch (error) { log(error.message, "stderr"); }
}

function renderGitHistory(raw) {
  const list = document.getElementById("gitHistory");
  list.replaceChildren();
  const commits = raw.split(/\r?\n/).filter(Boolean).map(line => {
    const parts = line.split("\x1f");
    return {hash:parts[0], short:parts[1], author:parts[2], date:parts[3], subject:parts.slice(4).join(" ")};
  }).filter(item => /^[a-f0-9]{40}$/i.test(item.hash));
  if (!commits.length) {
    const empty = document.createElement("div");
    empty.className = "git-empty";
    empty.textContent = "Todavía no hay commits en este repositorio.";
    list.appendChild(empty);
    return;
  }
  for (const commit of commits) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "git-commit-row";
    const subject = document.createElement("strong");
    subject.textContent = commit.subject || "(sin mensaje)";
    const meta = document.createElement("span");
    meta.textContent = commit.short + " · " + commit.author + " · " + commit.date.replace("T"," ").slice(0,16);
    button.append(subject, meta);
    button.addEventListener("click", () => showGitCommit(commit));
    list.appendChild(button);
  }
}
async function refreshGitHistory() {
  if (!projectPath) return;
  const list = document.getElementById("gitHistory");
  list.textContent = "Cargando historial…";
  try {
    const result = await window.memingoIDE.versionControl({action:"history"});
    if (result.code !== 0) {
      list.textContent = result.error || result.stderr || "No se pudo cargar el historial.";
      return;
    }
    renderGitHistory(result.stdout || "");
  } catch (error) { list.textContent = error.message; }
}
async function showGitCommit(commit) {
  const detail = document.getElementById("gitCommitDetail");
  detail.textContent = "Cargando commit " + commit.short + "…";
  try {
    const result = await window.memingoIDE.versionControlCommit({hash:commit.hash});
    if (result.code !== 0) {
      detail.textContent = result.error || result.stderr || "No se pudo consultar el commit.";
      return;
    }
    detail.replaceChildren();
    const heading = document.createElement("strong");
    heading.className = "git-detail-title";
    heading.textContent = commit.subject || "(sin mensaje)";
    const metadata = document.createElement("div");
    metadata.className = "git-detail-meta";
    metadata.textContent = commit.hash + " · " + commit.author + " · " + commit.date;
    const summary = document.createElement("pre");
    summary.className = "git-detail-summary";
    summary.textContent = result.stdout;
    detail.append(heading, metadata, summary);
    if (Array.isArray(result.files) && result.files.length) {
      const label = document.createElement("div");
      label.className = "git-detail-files-label";
      label.textContent = "ARCHIVOS DEL COMMIT";
      detail.appendChild(label);
      for (const filePath of result.files) {
        const fileButton = document.createElement("button");
        fileButton.type = "button";
        fileButton.className = "git-history-file";
        fileButton.textContent = filePath;
        fileButton.addEventListener("click", () => showCommitFileDiff(commit.hash, filePath));
        detail.appendChild(fileButton);
      }
    }
  } catch (error) { detail.textContent = error.message; }
}
async function showCommitFileDiff(hash, filePath) {
  const view = document.getElementById("gitDiffView");
  view.textContent = "Cargando versión del commit…";
  try {
    const result = await window.memingoIDE.versionControlFile({action:"commitFileDiff",path:filePath,hash});
    view.textContent = result.code === 0 ? (result.stdout || "Este archivo no contiene diferencias en el commit.") : (result.error || result.stderr || "No se pudo comparar el archivo.");
  } catch (error) { view.textContent = error.message; }
}

async function refreshGitBranches() {
  if (!projectPath) return;
  const list = document.getElementById("gitBranches");
  list.textContent = "Cargando ramas…";
  try {
    const result = await window.memingoIDE.versionControlBranches();
    if (result.code !== 0) { list.textContent = result.error || result.stderr || "No se pudieron cargar las ramas. ¿Es un repositorio Git?"; return; }
    document.getElementById("gitCurrentBranch").textContent = "Rama actual: " + (result.current || "(HEAD separado)");
    list.replaceChildren();
    const select = document.getElementById("gitMergeBranch");
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = ""; placeholder.textContent = "Selecciona rama";
    select.appendChild(placeholder);
    for (const branch of result.branches || []) {
      const row = document.createElement("div"); row.className = "git-branch-row";
      const name = document.createElement("span"); name.textContent = (branch.current ? "● " : "○ ") + branch.name;
      const change = document.createElement("button"); change.type = "button"; change.className = "git-file-action";
      change.textContent = branch.current ? "Actual" : "Cambiar"; change.disabled = branch.current;
      change.addEventListener("click", () => runGitBranchAction("switch", branch.name));
      row.append(name, change); list.appendChild(row);
      if (!branch.current) { const option = document.createElement("option"); option.value = branch.name; option.textContent = branch.name; select.appendChild(option); }
    }
    if (!result.branches?.length) {
      const empty = document.createElement("div"); empty.className = "git-empty"; empty.textContent = "Todavía no hay ramas (crea el primer commit)."; list.appendChild(empty);
    }
    await refreshGitConflicts();
  } catch (error) { list.textContent = error.message; }
}
async function runGitBranchAction(action, name = "") {
  if (!projectPath) return;
  const labels = {create:"Crear rama",switch:"Cambiar rama",merge:"Fusionar rama",abortMerge:"Cancelar fusión"};
  if (action === "merge" && !confirm("¿Fusionar la rama " + name + " en la rama actual?")) return;
  if (action === "abortMerge" && !confirm("¿Cancelar la fusión actual? Se descartará el estado de la operación de merge.")) return;
  runStatus.textContent = "● Git trabajando";
  try {
    const result = await window.memingoIDE.versionControlBranchAction({action,name});
    if (result.stdout) log(result.stdout, "stdout");
    if (result.stderr || result.error) log(result.error || result.stderr, result.code === 0 ? "hint-line" : "stderr");
    if (result.code === 0) log((labels[action] || action) + " completado.", "hint-line");
    else log((labels[action] || action) + " terminó con código " + result.code + ".", "stderr");
    await refreshGitBranches();
    await refreshGitChanges();
    await refreshGitHistory();
  } catch (error) { log(error.message, "stderr"); }
  finally { runStatus.textContent = "● Inactivo"; }
}
async function refreshGitConflicts() {
  if (!projectPath) return;
  const list = document.getElementById("gitConflicts");
  try {
    const result = await window.memingoIDE.versionControlBranchAction({action:"conflicts"});
    const files = result.files || [];
    list.replaceChildren();
    if (!files.length) {
      const empty = document.createElement("div"); empty.className = "git-empty"; empty.textContent = "✓ No hay conflictos pendientes."; list.appendChild(empty);
      document.getElementById("gitConflictEditor").hidden = true;
      return;
    }
    for (const filePath of files) {
      const button = document.createElement("button"); button.type = "button"; button.className = "git-history-file"; button.textContent = "⚠ " + filePath;
      button.addEventListener("click", () => openGitConflict(filePath));
      list.appendChild(button);
    }
    const abort = document.createElement("button"); abort.type = "button"; abort.className = "outline git-abort-merge"; abort.textContent = "Cancelar fusión";
    abort.addEventListener("click", () => runGitBranchAction("abortMerge"));
    list.appendChild(abort);
  } catch (error) { list.textContent = error.message; }
}
async function openGitConflict(filePath) {
  try {
    const result = await window.memingoIDE.readConflictFile({path:filePath});
    document.getElementById("gitConflictPath").textContent = result.path;
    document.getElementById("gitConflictContent").value = result.content;
    document.getElementById("gitConflictEditor").hidden = false;
    document.getElementById("saveGitConflict").dataset.path = result.path;
    document.getElementById("stageGitConflict").dataset.path = result.path;
  } catch (error) { log(error.message, "stderr"); }
}
async function saveGitConflict() {
  const button = document.getElementById("saveGitConflict"), filePath = button.dataset.path;
  if (!filePath) return;
  try {
    const result = await window.memingoIDE.saveConflictFile({path:filePath,content:document.getElementById("gitConflictContent").value});
    log(result.saved ? "Resolución guardada: " + filePath : "No se pudo guardar.", result.saved ? "hint-line" : "stderr");
  } catch (error) { log(error.message, "stderr"); }
}
async function stageGitConflict() {
  const button = document.getElementById("stageGitConflict"), filePath = button.dataset.path;
  if (!filePath) return;
  try {
    const saved = await window.memingoIDE.saveConflictFile({path:filePath,content:document.getElementById("gitConflictContent").value});
    if (!saved.saved) throw new Error("Guarda la resolución antes de marcarla.");
    const result = await window.memingoIDE.stageConflictFile({path:filePath});
    if (result.code !== 0) throw new Error(result.error || result.stderr || "No se pudo marcar el archivo como resuelto.");
    log("Conflicto marcado como resuelto: " + filePath, "hint-line");
    await refreshGitConflicts(); await refreshGitChanges();
  } catch (error) { log(error.message, "stderr"); }
}

async function runGitAction(action) {
  if (!projectPath) { log("Abre un proyecto antes de usar Git.", "stderr"); return; }
  let message = "";
  if (action === "commit") {
    message = document.getElementById("gitCommitMessage").value.trim();
    if (!message) { log("Escribe un mensaje para el commit.", "stderr"); return; }
  }
  const labels = {status:"git status",diff:"git diff",log:"git log",branch:"git branch",init:"git init",stage:"git add -A",commit:"git commit",pull:"git pull --ff-only",push:"git push",githubAuth:"gh auth status",githubRepo:"gh repo view",githubPublish:"gh repo create (privado)"};
  log("$ " + (labels[action] || action), "hint-line");
  runStatus.textContent = "● Git trabajando";
  try {
    const result = await window.memingoIDE.versionControl({action, message});
    if (result.stdout) log(result.stdout, "stdout");
    if (result.stderr) log(result.stderr, result.code === 0 ? "hint-line" : "stderr");
    if (result.error) log(result.error, "stderr");
    if (result.code === 0) {
      log("Acción completada.", "hint-line");
      if (action === "commit") document.getElementById("gitCommitMessage").value = "";
      if (["init","stage","commit","pull","push"].includes(action)) await refreshGitChanges();
      if (["init","commit","pull","push"].includes(action)) await refreshGitHistory();
      if (["init","commit","pull","push"].includes(action)) await refreshGitBranches();
      if (action === "log") await refreshGitHistory();
      if (action === "status" && result.stdout) {
        const match = result.stdout.match(/## ([^\\s]+)/);
        if (match) document.getElementById("gitRepoLabel").textContent = "Rama: " + match[1];
      }
    } else log("Git terminó con código " + result.code + ".", "stderr");
  } catch (error) { log(error.message, "stderr"); }
  finally { runStatus.textContent = "● Inactivo"; }
}
document.getElementById("refreshGitChanges").addEventListener("click", refreshGitChanges);
document.getElementById("refreshGitHistory").addEventListener("click", refreshGitHistory);
document.getElementById("refreshGitBranches").addEventListener("click", refreshGitBranches);
document.getElementById("refreshGitConflicts").addEventListener("click", refreshGitConflicts);
document.getElementById("createGitBranch").addEventListener("click", () => { const input=document.getElementById("gitNewBranchName"); const name=input.value.trim(); if(name) runGitBranchAction("create",name).then(()=>{input.value="";}); });
document.getElementById("mergeGitBranch").addEventListener("click", () => { const name=document.getElementById("gitMergeBranch").value; if(name) runGitBranchAction("merge",name); else log("Selecciona una rama para fusionar.","stderr"); });
document.getElementById("saveGitConflict").addEventListener("click", saveGitConflict);
document.getElementById("stageGitConflict").addEventListener("click", stageGitConflict);
document.querySelectorAll("[data-git]").forEach(button => {
  button.addEventListener("click", () => runGitAction(button.dataset.git));
});
