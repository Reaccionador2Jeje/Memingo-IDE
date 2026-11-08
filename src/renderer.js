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
let languageRegistry = [];
let languageServerRegistry = [];
let activeLspKey = null;
let lspChangeTimer = null;
let lspCompletionTimer = null;
let lspCompletionMode = false;
let lspDiagnostics = [];
let lspDiagnosticsUri = null;
let languageOverrides = new Map();
let suggestionIndex = 0;
let outputMode = "console";

function basename(filePath) { return filePath.split(/[\\/]/).pop(); }
function makeId() { fileCounter += 1; return "tab-" + fileCounter; }
function activeTab() { return tabs.find(tab => tab.id === activeTabId); }
function escapeHTML(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function currentLanguageInfo() {
  const tab = activeTab();
  const override = tab ? languageOverrides.get(tab.id) : null;
  if (override === "plaintext") return { id: "plaintext", name: "Texto plano", category: "plain", keywords: "" };
  if (override) {
    const selected = languageRegistry.find(language => language.id === override);
    if (selected) return selected;
  }
  const fileName = (tab?.name || (tab?.path ? basename(tab.path) : "main.mgo")).toLowerCase();
  const special = languageRegistry.find(language => (language.fileNames || []).some(name => {
    const candidate = name.toLowerCase();
    return fileName === candidate || (candidate.startsWith(".") && fileName.endsWith(candidate));
  }));
  if (special) return special;
  const extension = fileName.includes(".") ? fileName.split(".").pop() : fileName;
  const priority = { v: "verilog", m: "matlab", pl: "perl", h: "c", f: "fortran" };
  const preferred = priority[extension];
  const match = preferred
    ? languageRegistry.find(language => language.id === preferred && language.extensions.includes(extension))
    : languageRegistry.find(language => language.extensions.includes(extension));
  if (match) return match;
  if (extension === "mgo" || extension === "mgoa") return { id: "memingo", name: "Memingo", category: "memingo", keywords: "" };
  return { id: "plaintext", name: "Texto plano", category: "plain", keywords: "" };
}
function updateSyntax() {
  const source = editor.value;
  const language = currentLanguageInfo();
  const languageSelect = document.getElementById("languageSelect");
  if (languageSelect && languageSelect.value !== language.id) languageSelect.value = language.id;
  let html = "";
  let last = 0;
  if (language.id === "memingo") {
    const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b(?:vibe|ritual|drop|when|nah|grind|spill|borrow)\b|\b(?:based|cringe|ghost|whole|caption|party)\b|\b(?:headcount|whatkind|json_parse|json_stringify|env|range|keys|push|append|set_value|delete_key|random|random_int|http_get|http_post|trim|join|split|sort|map|filter|reduce|sum|min|max|clamp|parse_int|parse_float|repeat|lines|unique|meme_case|shuffle|uuid|now|sleep|read_file|write_file|file_exists|list_files)\b|\b\d+(?:\.\d+)?\b)/g;
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
  } else {
    const keywords = new Set(String(language.keywords || "").split(/\s+/).filter(Boolean));
    const tokenPattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->|#[^\n]*|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|<\/?[A-Za-z][^>]*>|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g;
    for (const match of source.matchAll(tokenPattern)) {
      html += escapeHTML(source.slice(last, match.index));
      const token = match[0];
      let kind = "plain";
      if (token.startsWith("//") || token.startsWith("#") || token.startsWith("/*") || token.startsWith("<!--") || token.startsWith("--")) kind = "comment";
      else if (token.startsWith('"') || token.startsWith("'")) kind = "string";
      else if (/^<\/?[A-Za-z]/.test(token)) kind = "tag";
      else if (/^\d/.test(token)) kind = "number";
      else if (/^(true|false|null|undefined|none|nil|NaN|Infinity|True|False|None)$/.test(token)) kind = "value";
      else if (keywords.has(token)) kind = "keyword";
      else if (/^[A-Z][A-Z0-9_]*$/.test(token)) kind = "value";
      else if (/^[A-Za-z_$][\w$]*$/.test(token) && /^\s*\(/.test(source.slice(match.index + token.length))) kind = "builtin";
      else if (/^[A-Z]/.test(token)) kind = "type";
      html += kind === "plain" ? escapeHTML(token) : '<span class="tok-' + kind + '">' + escapeHTML(token) + "</span>";
      last = match.index + token.length;
    }
  }
  html += escapeHTML(source.slice(last));
  syntaxLayer.innerHTML = html + "\n";
}
async function connectLspForActiveTab() {
  const tab = activeTab();
  const language = currentLanguageInfo();
  const server = languageServerRegistry.find(item => item.languageId === language.id);
  if (!tab?.path || !projectPath || !server) {
    if (activeLspKey) window.memingoIDE.stopLanguageServer().catch(()=>{});
    activeLspKey = null;
    return;
  }
  const key = tab.path + "::" + language.id;
  if (activeLspKey === key) return;
  activeLspKey = key;
  try {
    const result = await window.memingoIDE.startLanguageServer({ path:tab.path, languageId:language.id, text:editor.value });
    if (activeLspKey !== key) return;
    if (result?.connected) {
      statusText.textContent = "LSP: " + language.name;
      log("Servidor de lenguaje conectado: " + result.command, "hint-line");
    } else {
      activeLspKey = null;
    }
  } catch (error) {
    if (activeLspKey === key) activeLspKey = null;
    statusText.textContent = "LSP no disponible";
    log("LSP: " + error.message, "stderr");
  }
}
function sendLspDocumentChange() {
  const tab = activeTab();
  if (!tab?.path || !activeLspKey || !activeLspKey.startsWith(tab.path + "::")) return;
  clearTimeout(lspChangeTimer);
  const text = editor.value;
  lspChangeTimer = setTimeout(() => {
    window.memingoIDE.changeLanguageDocument({ text }).catch(error => log("LSP: " + error.message, "stderr"));
  }, 250);
}
async function loadLanguageServers() {
  try { languageServerRegistry = await window.memingoIDE.listLanguageServers(); }
  catch (error) { log("No se pudo cargar la lista de servidores LSP: " + error.message, "stderr"); }
}
window.memingoIDE.onLspEvent(event => {
  if (event.type === "lsp.diagnostics") {
    const diagnostics = Array.isArray(event.diagnostics) ? event.diagnostics : [];
    lspDiagnostics = diagnostics;
    lspDiagnosticsUri = event.uri || null;
    if (!diagnostics.length) { if (outputMode === "problems") showProblems(); return; }
    const errors = diagnostics.filter(item => item.severity === 1).length;
    const warnings = diagnostics.filter(item => item.severity === 2).length;
    log("LSP encontró " + errors + " error(es) y " + warnings + " advertencia(s).", errors ? "stderr" : "hint-line");
    for (const item of diagnostics.slice(0, 12)) {
      const line = Number.isInteger(item.range?.start?.line) ? item.range.start.line + 1 : "?";
      log("Línea " + line + ": " + (item.message || "Diagnóstico"), item.severity === 1 ? "stderr" : "hint-line");
    }
  } else if (event.type === "lsp.error") {
    activeLspKey = null;
    statusText.textContent = "LSP desconectado";
    log("LSP: " + event.message, "stderr");
  } else if (event.type === "lsp.stopped") {
    activeLspKey = null;
  }
});
async function loadLanguageRegistry() {
  try {
    const languages = await window.memingoIDE.listLanguages();
    languageRegistry = Array.isArray(languages) ? languages : [];
    const selector = document.getElementById("languageSelect");
    if (selector) {
      selector.replaceChildren();
      for (const language of [...languageRegistry, { id: "plaintext", name: "Texto plano" }]) {
        const option = document.createElement("option");
        option.value = language.id;
        option.textContent = language.name;
        selector.appendChild(option);
      }
      selector.addEventListener("change", () => {
        const tab = activeTab();
        if (tab) languageOverrides.set(tab.id, selector.value);
        updateSyntax();
      });
    }
    updateSyntax();
  } catch (error) {
    log("No se pudo cargar el catálogo de lenguajes: " + error.message, "stderr");
  }
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
  connectLspForActiveTab();
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
      empty.textContent = "No se encontraron archivos de los lenguajes compatibles.";
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
  if (currentLanguageInfo().id !== "memingo") {
    log("Este archivo está reconocido para edición, pero Memingo IDE todavía no tiene un ejecutor configurado para " + currentLanguageInfo().name + ". No se intentó ejecutarlo con el runtime Memingo.", "stderr");
    return;
  }
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
 syncActiveToTab();outputMode="problems";output.replaceChildren();
 const tab=activeTab(),local=analyzeSource(editor.value).map(item=>({line:item.line,message:item.message,severity:1,local:true}));
 let remote=[];
 if(tab?.path&&lspDiagnosticsUri===new URL("file://"+tab.path).href)remote=lspDiagnostics.map(item=>({line:(item.range?.start?.line??0)+1,message:item.message||"Diagnóstico LSP",severity:item.severity||3,range:item.range}));
 const errors=[...local,...remote].sort((a,b)=>a.line-b.line);
 if(!errors.length){const item=document.createElement("div");item.className="hint-line";item.textContent="✓ No se encontraron errores ni advertencias.";output.appendChild(item);return;}
 for(const error of errors){
  const item=document.createElement("button");item.className="problem-item";item.type="button";
  const level=error.severity===1?"Error":error.severity===2?"Advertencia":error.severity===3?"Información":"Sugerencia";
  item.textContent=level+" · Línea "+error.line+": "+error.message;
  item.addEventListener("click",()=>{
   const offset=error.range?.start?offsetAt(error.range.start):editor.value.split("\\n").slice(0,error.line-1).reduce((sum,value)=>sum+value.length+1,0);
   editor.focus();editor.setSelectionRange(offset,offset);
  });
  output.appendChild(item);
 }
}
function showConsole() {
  outputMode = "console";
  document.getElementById("consoleTab").classList.add("selected");
  document.getElementById("problemsTab").classList.remove("selected");
  renderOutput();
}
function hideAutocomplete() { autocomplete.hidden = true; suggestionItems = []; lspCompletionMode = false; }
function applySuggestion(item) {
  const start = editor.selectionStart;
  const before = editor.value.slice(0,start);
  const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  const from = match ? start-match[0].length : start;
  editor.setRangeText(item.insert,from,start,"end");
  hideAutocomplete(); updateLines(); updateSyntax(); updateDirty(); editor.focus();
}
function showAutocomplete(force = false) {
  if (currentLanguageInfo().id !== "memingo") { hideAutocomplete(); return; }
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
function editorPosition() {
 const before=editor.value.slice(0,editor.selectionStart);
 return {line:before.split("\\n").length-1,character:before.length-before.lastIndexOf("\\n")-1};
}
function offsetAt(position,source=editor.value) {
 const lines=source.split("\\n"),line=Math.max(0,Math.min(Number(position?.line)||0,lines.length-1));
 let offset=0;for(let i=0;i<line;i++)offset+=lines[i].length+1;
 return offset+Math.max(0,Math.min(Number(position?.character)||0,lines[line].length));
}
function renderLspCompletions(items) {
 suggestionItems=items;lspCompletionMode=true;suggestionIndex=0;autocomplete.replaceChildren();
 for(let i=0;i<items.length;i++){const item=items[i],button=document.createElement("button");button.type="button";button.className="completion-item"+(i===0?" chosen":"");const name=document.createElement("strong"),detail=document.createElement("span");name.textContent=item.label;detail.textContent=item.detail||"LSP";button.append(name,detail);button.addEventListener("mousedown",e=>{e.preventDefault();applyLspCompletion(item);});autocomplete.appendChild(button);}
 autocomplete.hidden=!items.length;
}
function applyLspCompletion(item) {
 let start=editor.selectionStart,end=editor.selectionEnd,text=item.insertText||item.label;
 if(item.textEdit?.range){start=offsetAt(item.textEdit.range.start);end=offsetAt(item.textEdit.range.end);text=item.textEdit.newText||text;}
 else {const m=editor.value.slice(0,start).match(/[A-Za-z_$][A-Za-z0-9_$]*$/);if(m)start-=m[0].length;}
 if(item.insertTextFormat===2)text=text.replace(/\\$\\{\\d+(?::([^}]*))?\\}|\\$\\d+/g,(_,fallback)=>fallback||"");
 editor.setRangeText(text,start,end,"end");hideAutocomplete();updateLines();updateSyntax();updateDirty();sendLspDocumentChange();editor.focus();
}
async function requestLspCompletion(){if(!activeLspKey)return showAutocomplete(true);try{const items=await window.memingoIDE.requestLspCompletion({position:editorPosition()});if(items.length)renderLspCompletions(items);else hideAutocomplete();}catch(error){log("Autocompletado LSP: "+error.message,"hint-line");}}
function scheduleLspCompletion(){if(!activeLspKey||currentLanguageInfo().id==="memingo")return;clearTimeout(lspCompletionTimer);lspCompletionTimer=setTimeout(requestLspCompletion,450);}
function locationParts(location){const uri=location?.targetUri||location?.uri,range=location?.targetSelectionRange||location?.targetRange||location?.range;return uri?{uri,range}:null;}
async function navigateLspLocation(location){
 const part=locationParts(location);if(!part)return;let targetPath="";
 try{const url=new URL(part.uri);if(url.protocol!=="file:")throw new Error();targetPath=decodeURIComponent(url.pathname);if(/^\\/[A-Za-z]:\\//.test(targetPath))targetPath=targetPath.slice(1);}catch{log("La ubicación LSP no es un archivo local.","hint-line");return;}
 const tab=activeTab();if(!projectPath||!tab?.path||!(targetPath===tab.path||targetPath.startsWith(projectPath.replace(/[\\/]+$/,"")+"/")||targetPath.startsWith(projectPath.replace(/[\\/]+$/,"")+"\\"))){log("La definición está fuera del proyecto abierto: "+targetPath,"hint-line");return;}
 if(targetPath!==tab.path){try{const file=await window.memingoIDE.openProjectFile(targetPath);if(file)addTab(file);}catch(error){log("No se pudo abrir el destino: "+error.message,"stderr");return;}}
 if(part.range?.start){const offset=offsetAt(part.range.start);editor.focus();editor.setSelectionRange(offset,offset);}
}
async function lspHover(){if(!activeLspKey)return log("No hay un servidor LSP activo.","hint-line");try{const result=await window.memingoIDE.requestLspHover({position:editorPosition()});log(result?.contents||"Sin información para este símbolo.", "hint-line");}catch(error){log("Hover: "+error.message,"stderr");}}
async function lspDefinition(){if(!activeLspKey)return log("No hay un servidor LSP activo.","hint-line");try{const result=await window.memingoIDE.requestLspDefinition({position:editorPosition()}),location=Array.isArray(result)?result[0]:result;if(!location)return log("No se encontró una definición.","hint-line");await navigateLspLocation(location);}catch(error){log("Definición: "+error.message,"stderr");}}
async function lspReferences(){if(!activeLspKey)return log("No hay un servidor LSP activo.","hint-line");try{const result=await window.memingoIDE.requestLspReferences({position:editorPosition()}),items=Array.isArray(result)?result.slice(0,30):[];if(!items.length)return log("No se encontraron referencias.","hint-line");log("Referencias encontradas: "+items.length,"hint-line");for(const location of items){const part=locationParts(location),button=document.createElement("button");button.type="button";button.className="problem-item";button.textContent=(part?.uri?.split("/").pop()||"archivo")+":"+(part?.range?.start?.line+1||1);button.addEventListener("click",()=>navigateLspLocation(location));output.appendChild(button);}}catch(error){log("Referencias: "+error.message,"stderr");}}
function applyCurrentWorkspaceEdit(edit){
 const tab=activeTab();if(!tab?.path||!edit)return false;const uri=new URL("file://"+tab.path).href;
 let edits=edit.changes?.[uri]||[];if(!edits.length&&Array.isArray(edit.documentChanges)){const entry=edit.documentChanges.find(item=>item.textDocument?.uri===uri);edits=entry?.edits||[];}
 if(!Array.isArray(edits)||!edits.length)return false;
 const prepared=edits.map(item=>({start:offsetAt(item.range.start),end:offsetAt(item.range.end),text:String(item.newText??"")})).sort((a,b)=>b.start-a.start);
 for(let i=1;i<prepared.length;i++)if(prepared[i-1].start<prepared[i].end)throw new Error("Cambios superpuestos devueltos por LSP.");
 let source=editor.value;for(const item of prepared)source=source.slice(0,item.start)+item.text+source.slice(item.end);
 editor.value=source;syncActiveToTab();updateLines();updateSyntax();updateDirty();sendLspDocumentChange();return true;
}
async function lspRename(){
 if(!activeLspKey)return log("No hay un servidor LSP activo.","hint-line");
 const newName=window.prompt("Escribe el nuevo nombre del símbolo:");if(newName===null)return;
 try{const edit=await window.memingoIDE.requestLspRename({position:editorPosition(),newName});if(!edit)return log("No hay cambios para renombrar.","hint-line");if(applyCurrentWorkspaceEdit(edit))log("Renombrado aplicado al archivo actual. Guarda con Ctrl+S.","hint-line");else log("No hay ediciones para el archivo actual.","hint-line");if(Object.keys(edit.changes||{}).length>1||(edit.documentChanges||[]).length>1)log("Aviso: otros archivos también requieren cambios; esta versión solo aplica el archivo activo.","hint-line");}catch(error){log("Renombrar: "+error.message,"stderr");}
}
async function lspCodeActions(){
 if(!activeLspKey)return log("No hay un servidor LSP activo.","hint-line");
 try{
  const pos=offset=>{const before=editor.value.slice(0,offset);return{line:before.split("\\n").length-1,character:before.length-before.lastIndexOf("\\n")-1};};
  const actions=await window.memingoIDE.requestLspCodeActions({range:{start:pos(editor.selectionStart),end:pos(editor.selectionEnd)},diagnostics:lspDiagnostics});
  if(!actions.length)return log("No hay acciones rápidas en esta posición.","hint-line");
  suggestionItems=actions.map(action=>({label:action.title,detail:action.kind||"Acción rápida",action}));lspCompletionMode=true;suggestionIndex=0;autocomplete.replaceChildren();
  for(let i=0;i<suggestionItems.length;i++){const item=suggestionItems[i],button=document.createElement("button");button.type="button";button.className="completion-item"+(i===0?" chosen":"");const name=document.createElement("strong"),detail=document.createElement("span");name.textContent=item.label;detail.textContent=item.detail;button.append(name,detail);button.addEventListener("mousedown",e=>{e.preventDefault();hideAutocomplete();try{if(item.action.edit&&applyCurrentWorkspaceEdit(item.action.edit))log("Acción aplicada al archivo actual. Guarda con Ctrl+S.","hint-line");else log("Esta acción requiere soporte adicional o modifica otros archivos.","hint-line");}catch(error){log(error.message,"stderr");}});autocomplete.appendChild(button);}
  autocomplete.hidden=false;
 }catch(error){log("Acciones rápidas: "+error.message,"stderr");}
}
function moveSuggestion(delta) {
  if (autocomplete.hidden) return;
  suggestionIndex = (suggestionIndex + delta + suggestionItems.length) % suggestionItems.length;
  [...autocomplete.children].forEach((item,index)=>item.classList.toggle("chosen",index===suggestionIndex));
}

async function checkFile() {
  const tab = activeTab();
  if (!tab) return;
  if (currentLanguageInfo().id !== "memingo") { log("El comprobador oficial disponible actualmente es para archivos Memingo (.mgo).", "stderr"); return; }
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
  if (currentLanguageInfo().id !== "memingo") { log("El formateador oficial disponible actualmente es para archivos Memingo (.mgo).", "stderr"); return; }
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
  if (currentLanguageInfo().id !== "memingo") { log("El depurador integrado disponible actualmente es para archivos Memingo (.mgo).", "stderr"); return; }
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
  sendLspDocumentChange();
  if (outputMode==="problems") showProblems();
  if (currentLanguageInfo().id === "memingo") showAutocomplete(); else scheduleLspCompletion();
});
editor.addEventListener("scroll",updateLines);
editor.addEventListener("keydown",event=>{
  if (!autocomplete.hidden) {
    if (event.key==="ArrowDown") {event.preventDefault();moveSuggestion(1);return;}
    if (event.key==="ArrowUp") {event.preventDefault();moveSuggestion(-1);return;}
    if (event.key==="Enter" && suggestionItems.length) {event.preventDefault();const item=suggestionItems[suggestionIndex];if(item?.action){hideAutocomplete();try{if(item.action.edit&&applyCurrentWorkspaceEdit(item.action.edit))log("Acción aplicada. Guarda con Ctrl+S.","hint-line");else log("La acción requiere soporte adicional.","hint-line");}catch(error){log(error.message,"stderr");}}else if(lspCompletionMode)applyLspCompletion(item);else applySuggestion(item);return;}
    if (event.key==="Escape") {hideAutocomplete();return;}
  }
  if (event.key==="Tab") {
    event.preventDefault();
    const start=editor.selectionStart,end=editor.selectionEnd;
    editor.setRangeText("    ",start,end,"end");
    updateLines();updateSyntax();updateDirty();
  }
  if ((event.ctrlKey||event.metaKey)&&event.key===" ") {event.preventDefault();if(activeLspKey&&currentLanguageInfo().id!=="memingo")requestLspCompletion();else showAutocomplete(true);}
  if (event.key==="F12") {event.preventDefault();if(event.shiftKey)lspReferences();else lspDefinition();}
  if (event.key==="F2") {event.preventDefault();lspRename();}
  if ((event.ctrlKey||event.metaKey)&&event.key===".") {event.preventDefault();lspCodeActions();}
  if ((event.ctrlKey||event.metaKey)&&event.key==="Enter") {event.preventDefault();runFile();}
  if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s") {event.preventDefault();saveFile();}
  if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="o") {event.preventDefault();openFile();}
});
editor.addEventListener("blur",()=>setTimeout(()=>{if (!autocomplete.matches(":hover")) hideAutocomplete();},120));
document.getElementById("lspHover").addEventListener("click", lspHover);
document.getElementById("lspDefinition").addEventListener("click", lspDefinition);
document.getElementById("lspReferences").addEventListener("click", lspReferences);
document.getElementById("lspRename").addEventListener("click", lspRename);
document.getElementById("lspActions").addEventListener("click", lspCodeActions);
window.memingoIDE.onOutput(data=>log(data.text,data.type));
tabs.push({id:makeId(),path:null,name:"Sin título.mgo",content:editor.value,savedContent:editor.value,dirty:false});
activeTabId=tabs[0].id;
renderTabs();updateLines();updateSyntax();
loadLanguageServers();

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


let agentConnected = false;
let activeAgentEngine = "opencode";
const agentConversation = document.getElementById("agentConversation");
const agentPermission = document.getElementById("agentPermission");
const agentTextParts = new Map();
function addAgentMessage(role, text) {
  const empty = agentConversation.querySelector(".agent-empty");
  if (empty) empty.remove();
  const item = document.createElement("div");
  item.className = "agent-message " + role;
  const heading = document.createElement("strong");
  heading.textContent = role === "user" ? "Tú" : role === "assistant" ? "Agente" : "Memingo IDE";
  const body = document.createElement("p");
  body.textContent = text;
  item.append(heading, body);
  agentConversation.appendChild(item);
  agentConversation.scrollTop = agentConversation.scrollHeight;
}
function renderAgentText() {
  const existing = agentConversation.querySelector(".agent-live-answer");
  if (existing) existing.remove();
  const text = [...agentTextParts.values()].join("");
  if (!text) return;
  const item = document.createElement("div");
  item.className = "agent-message assistant agent-live-answer";
  const heading = document.createElement("strong"); heading.textContent = "Agente";
  const body = document.createElement("p"); body.textContent = text;
  item.append(heading, body);
  agentConversation.appendChild(item);
  agentConversation.scrollTop = agentConversation.scrollHeight;
}
function setAgentConnection(connected, status) {
  agentConnected = connected;
  document.getElementById("agentStatus").textContent = status;
  document.getElementById("connectAgent").textContent = connected ? "Desconectar" : "Conectar";
  document.getElementById("sendAgentPrompt").disabled = !connected;
  document.getElementById("stopAgent").disabled = !connected;
  document.getElementById("agentEngine").disabled = connected;
}
async function refreshAgentProjectFiles() {
  if (!projectPath) return;
  try {
    const project = await window.memingoIDE.refreshProject();
    const tree = explorerRoot.querySelector(".file-tree");
    if (tree) {
      tree.replaceChildren();
      renderTree(project.tree || [], tree);
      if (!project.tree?.length) {
        const empty = document.createElement("p");
        empty.className = "tree-empty";
        empty.textContent = "No se encontraron archivos de texto compatibles.";
        tree.appendChild(empty);
      }
    }
    for (const tab of tabs) {
      if (!tab.path || tab.dirty) continue;
      try {
        const fresh = await window.memingoIDE.openProjectFile(tab.path);
        tab.content = fresh.content;
        tab.savedContent = fresh.content;
        if (tab.id === activeTabId) editor.value = fresh.content;
      } catch {}
    }
    renderTabs(); updateLines(); updateSyntax();
    await refreshGitChanges();
    await refreshGitBranches();
    await refreshGitHistory();
  } catch (error) { addAgentMessage("system", "No se pudo actualizar la vista del proyecto: " + error.message); }
}
function showAgentPermission(event) {
  const props = event.properties || event;
  const request = props.permission || props.request || props;
  const id = request.id || props.permissionID || props.id;
  if (typeof id !== "string") return;
  agentPermission.replaceChildren();
  agentPermission.hidden = false;
  const title = document.createElement("strong");
  title.textContent = "El agente solicita permiso";
  const detail = document.createElement("p");
  detail.textContent = String(request.description || request.message || request.type || "Quiere realizar una acción en el proyecto. Revisa los detalles antes de aprobar.") + (request.resources ? "\nRecursos: " + request.resources.join(", ") : (request.patterns ? "\n" + JSON.stringify(request.patterns) : ""));
  const once = document.createElement("button");
  once.type = "button"; once.className = "agent-approve"; once.textContent = "Permitir una vez";
  once.addEventListener("click", async () => {
    try {
      await window.memingoIDE.answerAgentPermission({id,response:"once"});
      agentPermission.hidden = true;
      addAgentMessage("system", "Permiso aprobado una sola vez.");
    } catch (error) { addAgentMessage("system", error.message); }
  });
  const reject = document.createElement("button");
  reject.type = "button"; reject.className = "outline"; reject.textContent = "Rechazar";
  reject.addEventListener("click", async () => {
    try {
      await window.memingoIDE.answerAgentPermission({id,response:"reject"});
      agentPermission.hidden = true;
      addAgentMessage("system", "Permiso rechazado.");
    } catch (error) { addAgentMessage("system", error.message); }
  });
  const actions = document.createElement("div"); actions.className = "agent-permission-actions";
  actions.append(once,reject);
  agentPermission.append(title,detail,actions);
}

function showGoosePermission(event) {
  const props = event.properties || {};
  const tool = props.toolCall || {};
  const options = Array.isArray(props.options) ? props.options : [];
  agentPermission.replaceChildren();
  agentPermission.hidden = false;
  const title = document.createElement("strong");
  title.textContent = "Goose solicita permiso";
  const detail = document.createElement("p");
  const locationText = Array.isArray(tool.locations) ? tool.locations.map(item => item.path || "").filter(Boolean).join("\n") : "";
  const rawInput = tool.rawInput === undefined ? "" : JSON.stringify(tool.rawInput, null, 2);
  detail.textContent = String(tool.title || "Quiere realizar una acción en el proyecto.") +
    (tool.kind ? "\nTipo: " + tool.kind : "") +
    (locationText ? "\nArchivos:\n" + locationText : "") +
    (rawInput ? "\nDetalles de la acción:\n" + rawInput : "");
  const actions = document.createElement("div");
  actions.className = "agent-permission-actions";
  const safeOptions = options.filter(option => ["allow_once", "reject_once"].includes(option.kind));
  const visibleOptions = safeOptions.length ? safeOptions : [];
  function reply(optionId, cancelled = false) {
    return window.memingoIDE.answerAgentPermission({
      engine: "goose", id: event.requestId,
      optionId: optionId || "", cancelled
    }).then(() => {
      agentPermission.hidden = true;
      addAgentMessage("system", cancelled ? "Solicitud de Goose cancelada." : "Decisión enviada a Goose.");
    }).catch(error => addAgentMessage("system", error.message));
  }
  for (const option of visibleOptions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = option.kind === "allow_once" ? "agent-approve" : "outline";
    button.textContent = option.kind === "allow_once" ? "Permitir una vez" : "Rechazar";
    button.addEventListener("click", () => reply(option.optionId));
    actions.appendChild(button);
  }
  if (!visibleOptions.length) {
    const cancel = document.createElement("button");
    cancel.type = "button"; cancel.className = "outline"; cancel.textContent = "Cancelar solicitud";
    cancel.addEventListener("click", () => reply("", true));
    actions.appendChild(cancel);
  }
  agentPermission.append(title, detail, actions);
}
function handleGooseUpdate(props) {
  const update = props.update || {};
  if (update.sessionUpdate === "agent_message_chunk" && update.content?.type === "text") {
    const key = String(update.messageId || "goose-answer");
    agentTextParts.set(key, (agentTextParts.get(key) || "") + String(update.content.text || ""));
    renderAgentText();
    return;
  }
  if (update.sessionUpdate === "tool_call") {
    addAgentMessage("system", "Goose: " + String(update.title || update.name || "acción solicitada") + " · " + String(update.status || "pendiente"));
    return;
  }
  if (update.sessionUpdate === "tool_call_update") {
    addAgentMessage("system", "Acción " + String(update.status || "actualizada") + (update.content?.length ? " · " + update.content.map(item => item.content?.text || "").join(" ") : ""));
    return;
  }
}

function handleAgentEvent(event) {
  if (!event || typeof event !== "object") return;
  const type = String(event.type || "");
  const props = event.properties || event;
  if (type === "agent.connected") {
    activeAgentEngine = event.engine === "goose" ? "goose" : "opencode";
    setAgentConnection(true, "Conectado · " + (activeAgentEngine === "goose" ? "Goose ACP" : "OpenCode"));
    addAgentMessage("system", event.message || (activeAgentEngine === "goose" ? "Goose conectado." : "OpenCode conectado."));
    return;
  }
  if (type === "agent.disconnected") {
    setAgentConnection(false, "Desconectado");
    agentPermission.hidden = true;
    return;
  }
  if (type === "agent.connection.error") {
    setAgentConnection(false, "Error: " + (event.message || "no se pudo conectar"));
    addAgentMessage("system", event.message || "Error de conexión.");
    return;
  }
  if (type === "goose.permission") { showGoosePermission(event); return; }
  if (type === "goose.session.update") { handleGooseUpdate(props); return; }
  if (type === "goose.turn.finished") {
    document.getElementById("agentStatus").textContent = "Conectado · Listo";
    refreshAgentProjectFiles();
    return;
  }
  if (type.includes("permission") && (type.includes("asked") || type.includes("updated"))) {
    showAgentPermission(event);
    return;
  }
  if (type === "session.text.delta") {
    const key = String(props.messageID || "answer");
    const delta = typeof props.delta === "string" ? props.delta : "";
    if (delta) { agentTextParts.set(key, (agentTextParts.get(key) || "") + delta); renderAgentText(); }
    return;
  }
  if (type === "session.text.ended") return;
  if (type === "message.part.updated" || type === "message.part.delta") {
    const part = props.part || props;
    if (part.type === "text") {
      const key = String(part.id || props.messageID || "answer");
      if (type === "message.part.delta") {
        const delta = typeof props.delta === "string" ? props.delta : (typeof part.delta === "string" ? part.delta : "");
        if (delta) agentTextParts.set(key, (agentTextParts.get(key) || "") + delta);
      } else if (typeof part.text === "string") agentTextParts.set(key, part.text);
      renderAgentText();
    }
    return;
  }
  if (type === "session.idle" || type === "session.status" && props.status?.type === "idle") {
    document.getElementById("agentStatus").textContent = "Conectado · Listo";
    document.getElementById("sendAgentPrompt").disabled = !agentConnected;
    refreshAgentProjectFiles();
    return;
  }
  if (type === "session.error" || type === "message.error") {
    addAgentMessage("system", props.error?.message || props.message || "El agente informó de un error.");
  }
}
window.memingoIDE.onAgentEvent(handleAgentEvent);

let agentRegistry = { engines: [], profiles: [], adapters: [] };
async function loadAgentRegistry() {
  const engineSelect = document.getElementById("agentEngine");
  const profileSelect = document.getElementById("agentProfile");
  try {
    const registry = await window.memingoIDE.listAgentEngines();
    agentRegistry = {
      engines: Array.isArray(registry.engines) ? registry.engines : [],
      profiles: Array.isArray(registry.profiles) ? registry.profiles : [],
      adapters: Array.isArray(registry.adapters) ? registry.adapters : []
    };
    const supportedProtocols = new Set(agentRegistry.adapters.map(adapter => adapter.id));
    agentRegistry.engines = agentRegistry.engines.filter(engine => supportedProtocols.has(engine.protocol));
    if (agentRegistry.engines.length) {
      const selected = engineSelect.value;
      engineSelect.replaceChildren();
      for (const engine of agentRegistry.engines) {
        const option = document.createElement("option");
        option.value = engine.id;
        option.textContent = engine.name + " · " + engine.license;
        option.dataset.protocol = engine.protocol;
        engineSelect.appendChild(option);
      }
      if (agentRegistry.engines.some(engine => engine.id === selected)) engineSelect.value = selected;
      updateAgentEngineDocs();
    }
    if (agentRegistry.profiles.length) {
      const selected = profileSelect.value;
      profileSelect.replaceChildren();
      for (const profile of agentRegistry.profiles) {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.label + " · " + profile.description;
        profileSelect.appendChild(option);
      }
      if (agentRegistry.profiles.some(profile => profile.id === selected)) profileSelect.value = selected;
    }
  } catch (error) {
    addAgentMessage("system", "No se pudo cargar el registro de agentes: " + error.message);
  }
}
function updateAgentEngineDocs() {
  const engine = agentRegistry.engines.find(item => item.id === document.getElementById("agentEngine").value);
  const link = document.getElementById("agentEngineDocs");
  if (!engine || !link) return;
  link.href = engine.docs;
  link.textContent = engine.name + ": instalación y documentación ↗";
}
document.getElementById("agentEngine").addEventListener("change", updateAgentEngineDocs);
loadAgentRegistry();
loadLanguageRegistry();

async function connectAgent() {
  if (!projectPath) {
    addAgentMessage("system", "Primero abre una carpeta de proyecto.");
    return;
  }
  if (agentConnected) {
    await window.memingoIDE.disconnectAgent();
    setAgentConnection(false, "Desconectado");
    return;
  }
  const button = document.getElementById("connectAgent");
  button.disabled = true; button.textContent = "Conectando…";
  const engine = document.getElementById("agentEngine").value;
  const engineInfo = agentRegistry.engines.find(item => item.id === engine);
  if (!engineInfo) { addAgentMessage("system", "El motor seleccionado no está registrado."); return; }
  activeAgentEngine = engine;
  document.getElementById("agentStatus").textContent = "Iniciando " + engineInfo.name + "…";
  try {
    await window.memingoIDE.connectAgent({engine});
    setAgentConnection(true, "Conectado · " + engineInfo.name);
    addAgentMessage("system", engineInfo.name + " está listo. Elige un perfil y describe lo que quieres crear.");
  } catch (error) {
    setAgentConnection(false, error.message);
    addAgentMessage("system", error.message);
  } finally { button.disabled = false; }
}
async function sendAgentPrompt() {
  const input = document.getElementById("agentPrompt");
  const prompt = input.value.trim();
  if (!prompt || !agentConnected) return;
  const profile = document.getElementById("agentProfile").value;
  const button = document.getElementById("sendAgentPrompt");
  button.disabled = true;
  addAgentMessage("user", prompt);
  input.value = "";
  agentTextParts.clear();
  try {
    await window.memingoIDE.sendAgentPrompt({prompt,profile,engine:activeAgentEngine});
    document.getElementById("agentStatus").textContent = "Trabajando…";
    button.disabled = false;
  } catch (error) {
    addAgentMessage("system", error.message);
    button.disabled = false;
  }
}
document.getElementById("connectAgent").addEventListener("click", connectAgent);
document.getElementById("sendAgentPrompt").addEventListener("click", sendAgentPrompt);
document.getElementById("agentPrompt").addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); sendAgentPrompt(); }
});
document.getElementById("stopAgent").addEventListener("click", async () => {
  try {
    await window.memingoIDE.stopAgent();
    addAgentMessage("system", "Se solicitó detener al agente.");
  } catch (error) { addAgentMessage("system", error.message); }
});

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
