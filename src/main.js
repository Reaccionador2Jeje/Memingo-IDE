const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");

let mainWindow;
let activeProcess = null;
let projectRoot = null;
let agentProcess = null;
let agentPort = null;
let agentSessionId = null;
let agentEventAbort = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#101116",
    title: "Memingo IDE",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("before-quit", () => {
  if (agentEventAbort) agentEventAbort.abort();
  if (agentProcess) agentProcess.kill();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});


function sendAgentEvent(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("agents:event", payload);
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function reserveLocalPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}
async function ensureAgentPermissions(root) {
  const configDir = path.join(root, ".opencode");
  const configPath = path.join(configDir, "opencode.json");
  await fs.mkdir(configDir, { recursive: true });
  const directoryStat = await fs.lstat(configDir);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error("La carpeta .opencode no es una carpeta normal; no se modificó.");
  let config = {};
  try {
    const configStat = await fs.lstat(configPath);
    if (!configStat.isFile() || configStat.isSymbolicLink() || configStat.size > 256 * 1024) throw new Error("El archivo de configuración de OpenCode no es válido o supera 256 KB.");
    const source = await fs.readFile(configPath, "utf8");
    try { config = JSON.parse(source); }
    catch { throw new Error("Tu .opencode/opencode.json tiene comentarios o formato no compatible. No lo modificamos: revisa sus permisos manualmente antes de conectar el agente."); }
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("La configuración existente de OpenCode no es un objeto JSON válido.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const permission = {
    ...(config.permission && typeof config.permission === "object" && !Array.isArray(config.permission) ? config.permission : {}),
    "*": "ask",
    read: { "*": "allow", "*.env": "ask", "*.env.*": "ask", "*.env.example": "allow" },
    glob: "allow",
    grep: "allow",
    list: "allow",
    edit: "ask",
    bash: { "*": "ask", "git push *": "deny" },
    external_directory: "deny",
    webfetch: "ask",
    websearch: "ask",
    task: "ask",
    skill: "ask",
    lsp: "allow",
    question: "allow",
    todowrite: "allow",
    doom_loop: "ask"
  };
  config.$schema = config.$schema || "https://opencode.ai/config.json";
  config.permission = permission;
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return configPath;
}
async function agentApi(method, endpoint, body) {
  if (!agentPort) throw new Error("Conecta OpenCode primero.");
  const response = await fetch("http://127.0.0.1:" + agentPort + endpoint, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || raw || ("OpenCode respondió HTTP " + response.status));
    error.status = response.status;
    throw error;
  }
  return data;
}
async function agentApiCompat(method, modernEndpoint, legacyEndpoint, body) {
  try { return await agentApi(method, modernEndpoint, body); }
  catch (error) {
    if (error.status !== 404 && error.status !== 405) throw error;
    return agentApi(method, legacyEndpoint, body);
  }
}
async function streamAgentEvents(port, signal) {
  try {
    let response = await fetch("http://127.0.0.1:" + port + "/api/event", { signal });
    if (response.status === 404 || response.status === 405) {
      response = await fetch("http://127.0.0.1:" + port + "/global/event", { signal });
    }
    if (!response.ok || !response.body) throw new Error("No se pudo abrir el flujo de eventos de OpenCode.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const packet = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = packet.split(/\r?\n/).find(line => line.startsWith("data:"));
        if (!dataLine) continue;
        try {
          const event = JSON.parse(dataLine.slice(5).trim());
          const payload = event.payload || (event.data ? { type: event.type, properties: event.data } : event);
          sendAgentEvent(payload);
        } catch {}
      }
    }
  } catch (error) {
    if (!signal.aborted) sendAgentEvent({ type: "agent.connection.error", message: error.message });
  }
}
ipcMain.handle("agents:connect", async () => {
  if (!projectRoot) throw new Error("Abre una carpeta de proyecto antes de conectar un agente.");
  if (agentProcess && agentPort) return { connected: true, port: agentPort };
  const root = path.resolve(projectRoot);
  const stat = await fs.stat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new Error("La carpeta del proyecto ya no está disponible.");
  const configPath = await ensureAgentPermissions(root);
  const port = await reserveLocalPort();
  const child = spawn(process.platform === "win32" ? "opencode.exe" : "opencode", ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, windowsHide: true, env: process.env, shell: false
  });
  let spawnError = null;
  agentProcess = child;
  agentPort = port;
  child.stdout.on("data", data => sendAgentEvent({ type: "agent.log", text: data.toString() }));
  child.stderr.on("data", data => sendAgentEvent({ type: "agent.log", text: data.toString() }));
  child.on("error", error => {
    spawnError = error;
    if (agentProcess === child) {
      agentProcess = null; agentPort = null; agentSessionId = null;
    }
    sendAgentEvent({ type: "agent.connection.error", message: error.code === "ENOENT" ? "No se encontró OpenCode. Instálalo desde opencode.ai y vuelve a conectar." : error.message });
  });
  child.on("exit", code => {
    if (agentProcess === child) {
      agentProcess = null; agentPort = null; agentSessionId = null;
      sendAgentEvent({ type: "agent.disconnected", code });
    }
  });
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (agentProcess !== child || child.exitCode !== null) break;
    try {
      let response = await fetch("http://127.0.0.1:" + port + "/api/info", { signal: AbortSignal.timeout(1000) });
      if (response.status === 404 || response.status === 405) {
        response = await fetch("http://127.0.0.1:" + port + "/global/health", { signal: AbortSignal.timeout(1000) });
      }
      if (response.ok) { healthy = true; break; }
    } catch {}
    await delay(250);
  }
  if (!healthy) {
    if (agentProcess === child) { child.kill(); agentProcess = null; agentPort = null; }
    if (spawnError?.code === "ENOENT") throw new Error("No se encontró OpenCode. Instálalo desde https://opencode.ai y asegúrate de que el comando opencode esté en PATH.");
    throw new Error("OpenCode no respondió. Comprueba que esté instalado y que pueda iniciarse.");
  }
  agentEventAbort = new AbortController();
  streamAgentEvents(port, agentEventAbort.signal);
  sendAgentEvent({ type: "agent.connected", message: "OpenCode conectado. Permisos protegidos en " + path.relative(root, configPath) });
  return { connected: true, port };
});
ipcMain.handle("agents:send", async (_event, payload = {}) => {
  if (!projectRoot || !agentPort) throw new Error("Conecta OpenCode primero.");
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const profile = typeof payload.profile === "string" ? payload.profile : "plan";
  if (!prompt || prompt.length > 8000) throw new Error("Escribe una petición de entre 1 y 8000 caracteres.");
  if (!["plan", "build", "review"].includes(profile)) throw new Error("Perfil de agente no permitido.");
  if (!agentSessionId) {
    const session = await agentApiCompat("POST", "/api/session", "/session", { title: "Memingo IDE · " + profile });
    if (!session?.id) throw new Error("OpenCode no devolvió una sesión válida.");
    agentSessionId = session.id;
  }
  const profileInstructions = {
    plan: "Analiza el proyecto y explica en español un plan paso a paso. No modifiques archivos ni ejecutes comandos.",
    build: "Ayuda a construir lo solicitado. Antes de cada acción que requiera permiso, espera la aprobación del usuario. Explica en español qué cambiarás y por qué. No publiques ni subas cambios a Git.",
    review: "Revisa el proyecto buscando errores, riesgos y mejoras. No modifiques archivos ni ejecutes comandos. Explica los hallazgos en español y ordénalos por importancia."
  };
  const fullPrompt = profileInstructions[profile] + "\n\nPetición del usuario:\n" + prompt + "\n\nEl usuario puede ser principiante: evita jerga innecesaria, explica cada paso y pregunta si falta información importante.";
  const sessionPath = "/session/" + encodeURIComponent(agentSessionId);
  const promptBody = {
    agent: profile === "build" ? "build" : "plan",
    parts: [{ type: "text", text: fullPrompt }]
  };
  await agentApiCompat("POST", "/api" + sessionPath + "/prompt", sessionPath + "/prompt_async", promptBody);
  return { sent: true, sessionId: agentSessionId };
});
ipcMain.handle("agents:permission", async (_event, payload = {}) => {
  if (!agentSessionId || typeof payload.id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(payload.id)) throw new Error("Solicitud de permiso no válida.");
  const response = payload.response === "once" ? "once" : "reject";
  const sessionPath = "/session/" + encodeURIComponent(agentSessionId);
  const requestId = encodeURIComponent(payload.id);
  return agentApiCompat("POST", "/api" + sessionPath + "/permission/" + requestId + "/reply", sessionPath + "/permissions/" + requestId, { response, remember: false });
});
ipcMain.handle("agents:stop", async () => {
  if (!agentSessionId || !agentPort) return { stopped: false };
  const sessionPath = "/session/" + encodeURIComponent(agentSessionId);
  await agentApiCompat("POST", "/api" + sessionPath + "/interrupt", sessionPath + "/abort").catch(() => null);
  return { stopped: true };
});
ipcMain.handle("agents:disconnect", async () => {
  if (agentEventAbort) { agentEventAbort.abort(); agentEventAbort = null; }
  if (agentProcess) { const child = agentProcess; agentProcess = null; child.kill(); }
  agentPort = null; agentSessionId = null;
  sendAgentEvent({ type: "agent.disconnected", message: "Agente desconectado." });
  return { disconnected: true };
});


ipcMain.handle("file:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Memingo", extensions: ["mgo", "mgoa"] },
      { name: "Todos los archivos", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return { path: filePath, content: await fs.readFile(filePath, "utf8") };
});

ipcMain.handle("file:save", async (_event, payload) => {
  let filePath = payload.path;
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: "main.mgo",
      filters: [{ name: "Memingo", extensions: ["mgo"] }]
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }
  await fs.writeFile(filePath, payload.content, "utf8");
  return { path: filePath };
});

ipcMain.handle("file:new", async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: "main.mgo",
    filters: [{ name: "Memingo", extensions: ["mgo"] }]
  });
  if (result.canceled || !result.filePath) return null;
  const template = '# Welcome to Memingo!\n\nvibe message = "Hello, world!"\nspill message\n';
  await fs.writeFile(result.filePath, template, "utf8");
  return { path: result.filePath, content: template };
});

ipcMain.handle("memingo:run", async (event, filePath) => {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error("Guarda tu archivo .mgo antes de ejecutarlo.");
  }
  if (activeProcess) throw new Error("Ya hay un programa Memingo en ejecución.");
  const absolutePath = path.resolve(filePath);
  const stat = await fs.stat(absolutePath).catch(() => null);
  if (!stat || !stat.isFile()) throw new Error("No se encontró el archivo que quieres ejecutar.");

  return await new Promise(resolve => {
    const child = spawn(process.platform === "win32" ? "memingo.exe" : "memingo", ["run", absolutePath], {
      cwd: path.dirname(absolutePath),
      windowsHide: true,
      env: process.env
    });
    activeProcess = child;
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (activeProcess === child) activeProcess = null;
      resolve(result);
    };
    child.stdout.on("data", data => {
      if (!event.sender.isDestroyed()) event.sender.send("memingo:output", { type: "stdout", text: data.toString() });
    });
    child.stderr.on("data", data => {
      if (!event.sender.isDestroyed()) event.sender.send("memingo:output", { type: "stderr", text: data.toString() });
    });
    child.on("error", error => {
      finish({
        code: -1,
        error: error.code === "ENOENT"
          ? "No se encontró Memingo. Instala el runtime y comprueba que el comando 'memingo' esté en PATH."
          : error.message
      });
    });
    child.on("close", code => finish({ code: code ?? -1 }));
  });
});

ipcMain.handle("memingo:stop", () => {
  if (!activeProcess) return false;
  const child = activeProcess;
  activeProcess = null;
  child.kill();
  return true;
});

function parseManifestValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

async function readProjectManifest(root) {
  const manifestPath = path.join(root, "memingo.toml");
  let source;
  try {
    const stat = await fs.stat(manifestPath);
    if (!stat.isFile() || stat.size > 64 * 1024) return { exists: true, valid: false, error: "memingo.toml supera el límite de 64 KB o no es un archivo." };
    source = await fs.readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false };
    return { exists: true, valid: false, error: error.message };
  }
  const sections = {};
  let section = "";
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sectionMatch = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
    if (sectionMatch) { section = sectionMatch[1]; sections[section] ||= {}; continue; }
    const fieldMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*?)\s*(?:#.*)?$/);
    if (fieldMatch && section) sections[section][fieldMatch[1]] = parseManifestValue(fieldMatch[2]);
  }
  const packageInfo = sections.package || sections.project || {};
  const entry = String(packageInfo.entry || "main.mgo");
  const entryPath = path.resolve(root, entry);
  const relativeEntry = path.relative(root, entryPath);
  if (relativeEntry.startsWith("..") || path.isAbsolute(relativeEntry)) return { exists: true, valid: false, error: "La ruta del archivo principal sale del proyecto." };
  const entryStat = await fs.stat(entryPath).catch(() => null);
  return {
    exists: true, valid: true,
    name: String(packageInfo.name || path.basename(root)),
    version: String(packageInfo.version || "0.0.0"),
    entry, entryPath, entryExists: Boolean(entryStat && entryStat.isFile()),
    dependencyCount: Object.keys(sections.dependencies || {}).length
  };
}

ipcMain.handle("project:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return null;
  if (agentEventAbort) { agentEventAbort.abort(); agentEventAbort = null; }
  if (agentProcess) { const previousAgent = agentProcess; agentProcess = null; previousAgent.kill(); }
  agentPort = null; agentSessionId = null;
  projectRoot = path.resolve(result.filePaths[0]);
  async function scan(directory, depth = 0) {
    if (depth > 5) return [];
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const items = [];
    for (const entry of entries.slice(0, 300)) {
      if (entry.name.startsWith(".") || ["node_modules", "dist", "build", "__pycache__"].includes(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        items.push({ name: entry.name, path: fullPath, type: "directory", children: await scan(fullPath, depth + 1) });
      } else if (entry.isFile() && /\.(mgo|mgoa)$/i.test(entry.name)) {
        items.push({ name: entry.name, path: fullPath, type: "file" });
      }
    }
    return items;
  }
  return { path: projectRoot, name: path.basename(projectRoot), manifest: await readProjectManifest(projectRoot), tree: await scan(projectRoot) };
});

ipcMain.handle("project:open-file", async (_event, filePath) => {
  if (!projectRoot || typeof filePath !== "string") throw new Error("Abre un proyecto primero.");
  const absolute = path.resolve(filePath);
  const relative = path.relative(projectRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("El archivo está fuera del proyecto.");
  if (!/\.(mgo|mgoa)$/i.test(absolute)) throw new Error("Solo se admiten archivos .mgo y .mgoa desde el explorador.");
  const stat = await fs.stat(absolute);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error("El archivo no es válido o supera 2 MB.");
  return { path: absolute, content: await fs.readFile(absolute, "utf8") };
});


async function runMemingoTool(event, command, filePath) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error("Guarda el archivo .mgo antes de usar esta herramienta.");
  }
  if (activeProcess) throw new Error("Ya hay un proceso Memingo en ejecución.");
  const absolutePath = path.resolve(filePath);
  const stat = await fs.stat(absolutePath).catch(() => null);
  if (!stat || !stat.isFile() || !/\.mgo$/i.test(absolutePath)) {
    throw new Error("Selecciona un archivo .mgo válido.");
  }
  return await new Promise(resolve => {
    const child = spawn(process.platform === "win32" ? "memingo.exe" : "memingo", [command, absolutePath], {
      cwd: path.dirname(absolutePath), windowsHide: true, env: process.env
    });
    activeProcess = child;
    let stdout = "", stderr = "", settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (activeProcess === child) activeProcess = null;
      resolve(result);
    };
    child.stdout.on("data", data => { stdout += data.toString(); });
    child.stderr.on("data", data => { stderr += data.toString(); });
    child.on("error", error => finish({
      code: -1,
      error: error.code === "ENOENT" ? "No se encontró Memingo. Comprueba que esté instalado y disponible en PATH." : error.message
    }));
    child.on("close", async code => {
      let content = null;
      if (command === "fmt" && code === 0) {
        try { content = await fs.readFile(absolutePath, "utf8"); }
        catch (error) { stderr += error.message; code = 1; }
      }
      finish({ code: code ?? -1, stdout, stderr, content });
    });
  });
}

ipcMain.handle("memingo:check", (_event, filePath) => runMemingoTool(_event, "check", filePath));
ipcMain.handle("memingo:format", (_event, filePath) => runMemingoTool(_event, "fmt", filePath));


ipcMain.handle("terminal:execute", async (_event, payload = {}) => {
  const command = typeof payload.command === "string" ? payload.command.trim().replace(/\s+/g, " ") : "";
  const activeFile = typeof payload.filePath === "string" ? payload.filePath : "";
  if (!command) return { code: 0, stdout: "" };
  if (command === "help") return { code: 0, stdout: [
    "Comandos disponibles:",
    "  help           Muestra esta ayuda",
    "  clear          Limpia la consola (comando local)",
    "  pwd            Muestra la carpeta del proyecto",
    "  ls             Lista archivos de la carpeta del proyecto",
    "  memingo run    Ejecuta el archivo activo",
    "  memingo check  Comprueba el archivo activo",
    "  memingo fmt    Formatea el archivo activo"
  ].join("\n") };
  if (command === "pwd") return { code: 0, stdout: projectRoot || "No hay un proyecto abierto." };
  if (command === "ls") {
    if (!projectRoot) return { code: 1, stderr: "Abre un proyecto primero." };
    const entries = await fs.readdir(projectRoot, { withFileTypes: true });
    return { code: 0, stdout: entries.filter(item => !item.name.startsWith(".")).map(item => item.name + (item.isDirectory() ? "/" : "")).join("\n") || "(carpeta vacía)" };
  }
  const match = command.match(/^memingo (run|check|fmt)$/);
  if (!match) return { code: 2, stderr: "Comando no permitido. Escribe help para ver los comandos disponibles." };
  if (!activeFile) return { code: 1, stderr: "Abre o guarda un archivo .mgo antes de ejecutar este comando." };
  const absolute = path.resolve(activeFile);
  if (!/\.mgo$/i.test(absolute)) return { code: 1, stderr: "Solo se admiten archivos .mgo." };
  if (projectRoot) {
    const relative = path.relative(projectRoot, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return { code: 1, stderr: "El archivo activo está fuera del proyecto." };
  }
  if (activeProcess) return { code: 1, stderr: "Ya hay un proceso en ejecución." };
  return await runMemingoTool(_event, match[1], absolute);
});


async function runMemingoDebug(event, filePath, breakpoints = []) {
  if (typeof filePath !== "string" || !filePath.trim()) throw new Error("Guarda un archivo .mgo antes de depurar.");
  if (activeProcess) throw new Error("Ya hay un proceso Memingo en ejecución.");
  const absolutePath = path.resolve(filePath);
  const relative = projectRoot ? path.relative(projectRoot, absolutePath) : "";
  if (projectRoot && (relative.startsWith("..") || path.isAbsolute(relative))) throw new Error("El archivo está fuera del proyecto.");
  const stat = await fs.stat(absolutePath).catch(() => null);
  if (!stat || !stat.isFile() || !/\.mgo$/i.test(absolutePath)) throw new Error("Selecciona un archivo .mgo válido.");
  const lines = Array.isArray(breakpoints) ? [...new Set(breakpoints.filter(value => Number.isInteger(value) && value > 0))].slice(0, 200) : [];
  const args = ["debug", absolutePath];
  if (lines.length) args.push("--breakpoints", lines.join(","));
  return await new Promise(resolve => {
    const child = spawn(process.platform === "win32" ? "memingo.exe" : "memingo", args, {
      cwd: path.dirname(absolutePath), windowsHide: true, env: process.env
    });
    activeProcess = child;
    let stdout = "", stderr = "", settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (activeProcess === child) activeProcess = null;
      resolve(result);
    };
    child.stdout.on("data", data => { stdout += data.toString(); });
    child.stderr.on("data", data => { stderr += data.toString(); });
    child.on("error", error => finish({
      code: -1,
      error: error.code === "ENOENT" ? "El runtime no reconoce el comando debug. Actualiza Memingo a la versión que incluye el depurador." : error.message
    }));
    child.on("close", code => {
      const marker = "MEMINGO_DEBUG:";
      const start = stdout.lastIndexOf(marker);
      let trace = null;
      if (start >= 0) {
        try { trace = JSON.parse(stdout.slice(start + marker.length).trim()); }
        catch (error) { stderr += "\\nNo se pudo interpretar la traza: " + error.message; }
      }
      finish({ code: code ?? -1, stdout, stderr, trace });
    });
  });
}
ipcMain.handle("memingo:debug", (event, payload) => runMemingoDebug(event, payload?.filePath, payload?.breakpoints));


async function runGitFileAction(action, relativePath = "", commitHash = "") {
  if (!projectRoot) throw new Error("Abre un proyecto antes de usar Git.");
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) throw new Error("Selecciona un archivo válido del proyecto.");
  const root = path.resolve(projectRoot);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("La ruta del archivo sale del proyecto.");
  if (action !== "commitFileDiff") {
    const stat = await fs.lstat(target).catch(() => null);
    if (!stat || !stat.isFile() || stat.isSymbolicLink()) throw new Error("El archivo ya no existe o no es válido.");
  }
  let args;
  if (action === "commitFileDiff") {
    const hash = commitHash;
    if (typeof hash !== "string" || !/^[a-f0-9]{40}$/i.test(hash)) throw new Error("Identificador de commit no válido.");
    return runGitProcess(root, "git", ["show", "--format=", "--no-ext-diff", "--no-color", hash, "--", relative]);
  }
  if (action === "fileDiff") {
    const staged = await runGitProcess(root, "git", ["diff", "--cached", "--no-ext-diff", "--no-color", "--", relative]);
    const unstaged = await runGitProcess(root, "git", ["diff", "--no-ext-diff", "--no-color", "--", relative]);
    return { code: staged.code || unstaged.code, stdout: [staged.stdout, unstaged.stdout].filter(Boolean).join("\\n"), stderr: [staged.stderr, unstaged.stderr].filter(Boolean).join("\\n") };
  }
  if (action === "stageFile") args = ["add", "--", relative];
  else if (action === "unstageFile") {
    const head = await runGitProcess(root, "git", ["rev-parse", "--verify", "HEAD"]);
    args = head.code === 0 ? ["reset", "-q", "HEAD", "--", relative] : ["rm", "--cached", "--", relative];
  } else throw new Error("Acción de archivo Git no permitida.");
  return runGitProcess(root, "git", args);
}

function runGitProcess(root, executable, args) {
  return new Promise(resolve => {
    const child = spawn(executable, args, { cwd: root, windowsHide: true, env: process.env, shell: false });
    let stdout = "", stderr = "", settled = false;
    const append = (current, data) => (current + data.toString()).slice(-1024 * 1024);
    const finish = result => { if (settled) return; settled = true; resolve(result); };
    child.stdout.on("data", data => { stdout = append(stdout, data); });
    child.stderr.on("data", data => { stderr = append(stderr, data); });
    child.on("error", error => finish({ code: -1, stdout, stderr, error: error.code === "ENOENT" ? "Git no está instalado o no está disponible en PATH." : error.message }));
    child.on("close", code => finish({ code: code ?? -1, stdout, stderr }));
  });
}

const GIT_ACTIONS = {
  status: ["git", ["status", "--short", "--branch"]],
  changes: ["git", ["status", "--porcelain=v1", "-uall"]],
  history: ["git", ["log", "-30", "--date=iso-strict", "--format=%H%x1f%h%x1f%an%x1f%ad%x1f%s"]],
  diff: ["git", ["diff", "--"]],
  log: ["git", ["log", "-5", "--oneline", "--decorate"]],
  branch: ["git", ["branch", "--show-current"]],
  init: ["git", ["init"]],
  stage: ["git", ["add", "-A"]],
  pull: ["git", ["pull", "--ff-only"]],
  push: ["git", ["push"]],
  githubAuth: ["gh", ["auth", "status"]],
  githubRepo: ["gh", ["repo", "view", "--json", "nameWithOwner,url,visibility"]],
  githubPublish: ["gh", ["repo", "create", "--source", ".", "--remote", "origin", "--private", "--push"]]
};

async function runVersionControl(action, message = "") {
  if (!projectRoot) throw new Error("Abre un proyecto antes de usar Git.");
  const root = path.resolve(projectRoot);
  const stat = await fs.stat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new Error("La carpeta del proyecto ya no está disponible.");
  let executable, args;
  if (action === "commit") {
    const text = typeof message === "string" ? message.trim() : "";
    if (!text || text.length > 200) throw new Error("Escribe un mensaje de commit (máximo 200 caracteres).");
    executable = "git";
    args = ["commit", "-m", text];
  } else {
    const command = GIT_ACTIONS[action];
    if (!command) throw new Error("Acción de control de versiones no permitida.");
    [executable, args] = command;
  }
  return await new Promise(resolve => {
    const child = spawn(process.platform === "win32" && executable === "git" ? "git.exe" : executable, args, {
      cwd: root, windowsHide: true, env: process.env, shell: false
    });
    let stdout = "", stderr = "", settled = false;
    const append = (current, data) => (current + data.toString()).slice(-1024 * 1024);
    const finish = result => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    child.stdout.on("data", data => { stdout = append(stdout, data); });
    child.stderr.on("data", data => { stderr = append(stderr, data); });
    child.on("error", error => finish({
      code: -1, stdout, stderr,
      error: error.code === "ENOENT"
        ? (executable === "gh" ? "GitHub CLI (gh) no está instalado. Instálalo para usar la autenticación y la vista del repositorio." : "Git no está instalado o no está disponible en PATH.")
        : error.message
    }));
    child.on("close", code => finish({ code: code ?? -1, stdout, stderr }));
  });
}

async function getGitBranches(root) {
  const result = await runGitProcess(root, "git", ["for-each-ref", "--format=%(refname:short)%09%(HEAD)", "refs/heads"]);
  if (result.code !== 0) return result;
  return { ...result, branches: result.stdout.split(/\r?\n/).filter(Boolean).map(line => {
    const parts = line.split("\t");
    return { name: parts[0], current: parts[1] === "*" };
  }) };
}
function validateBranchName(name) {
  if (typeof name !== "string" || !name.trim() || name.length > 100) throw new Error("Escribe un nombre de rama válido (máximo 100 caracteres).");
  return name.trim();
}
ipcMain.handle("vcs:branches", async () => {
  if (!projectRoot) throw new Error("Abre un proyecto antes de gestionar ramas.");
  const root = path.resolve(projectRoot);
  const status = await runGitProcess(root, "git", ["rev-parse", "--is-inside-work-tree"]);
  if (status.code !== 0) return status;
  const [branches, current] = await Promise.all([
    getGitBranches(root),
    runGitProcess(root, "git", ["branch", "--show-current"])
  ]);
  return { code: branches.code, branches: branches.branches || [], current: current.stdout.trim(), error: branches.error, stderr: branches.stderr };
});
ipcMain.handle("vcs:branch-action", async (_event, payload = {}) => {
  if (!projectRoot) throw new Error("Abre un proyecto antes de gestionar ramas.");
  const root = path.resolve(projectRoot);
  const action = typeof payload.action === "string" ? payload.action : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (["create","switch","merge"].includes(action)) {
    if (!name || name.length > 100) throw new Error("Nombre de rama no válido.");
    const checked = await runGitProcess(root, "git", ["check-ref-format", "--branch", name]);
    if (checked.code !== 0) throw new Error("El nombre de rama no es válido.");
  }
  if (action === "create") return runGitProcess(root, "git", ["switch", "-c", name]);
  if (action === "switch" || action === "merge") {
    const clean = await runGitProcess(root, "git", ["status", "--porcelain"]);
    if (clean.code !== 0) return clean;
    if (clean.stdout.trim()) return { code: 2, stderr: "Guarda o prepara tus cambios antes de cambiar de rama o fusionar." };
    if (action === "switch") return runGitProcess(root, "git", ["switch", name]);
    return runGitProcess(root, "git", ["merge", "--no-edit", "--no-ff", name]);
  }
  if (action === "abortMerge") return runGitProcess(root, "git", ["merge", "--abort"]);
  if (action === "conflicts") {
    const result = await runGitProcess(root, "git", ["diff", "--name-only", "--diff-filter=U"]);
    return { ...result, files: result.stdout.split(/\r?\n/).filter(Boolean).slice(0,100) };
  }
  throw new Error("Acción de ramas no permitida.");
});
ipcMain.handle("vcs:conflict-read", async (_event, payload = {}) => {
  if (!projectRoot || typeof payload.path !== "string") throw new Error("Archivo de conflicto no válido.");
  const root = path.resolve(projectRoot), target = path.resolve(root, payload.path), relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("La ruta sale del proyecto.");
  const status = await runGitProcess(root, "git", ["diff", "--name-only", "--diff-filter=U"]);
  if (status.code !== 0 || !status.stdout.split(/\r?\n/).includes(relative)) throw new Error("El archivo no está en conflicto.");
  const stat = await fs.lstat(target).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink() || stat.size > 1024*1024) throw new Error("El archivo no existe, no es regular o supera 1 MB.");
  return { path: relative, content: await fs.readFile(target, "utf8") };
});
ipcMain.handle("vcs:conflict-save", async (_event, payload = {}) => {
  if (!projectRoot || typeof payload.path !== "string" || typeof payload.content !== "string") throw new Error("Datos de resolución no válidos.");
  if (payload.content.length > 1024*1024) throw new Error("El archivo supera 1 MB.");
  const root = path.resolve(projectRoot), target = path.resolve(root, payload.path), relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("La ruta sale del proyecto.");
  const status = await runGitProcess(root, "git", ["diff", "--name-only", "--diff-filter=U"]);
  if (status.code !== 0 || !status.stdout.split(/\r?\n/).includes(relative)) throw new Error("El archivo ya no está en conflicto.");
  const stat = await fs.lstat(target).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) throw new Error("El archivo no es válido.");
  await fs.writeFile(target, payload.content, "utf8");
  return { saved: true, path: relative };
});
ipcMain.handle("vcs:conflict-stage", async (_event, payload = {}) => {
  if (!projectRoot || typeof payload.path !== "string") throw new Error("Archivo no válido.");
  const root = path.resolve(projectRoot), target = path.resolve(root, payload.path), relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("La ruta sale del proyecto.");
  const stat = await fs.lstat(target).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) throw new Error("El archivo no es válido.");
  return runGitProcess(root, "git", ["add", "--", relative]);
});


ipcMain.handle("vcs:commit-detail", async (_event, payload = {}) => {
  if (!projectRoot) throw new Error("Abre un proyecto antes de consultar el historial.");
  const hash = typeof payload.hash === "string" ? payload.hash : "";
  if (!/^[a-f0-9]{40}$/i.test(hash)) throw new Error("Identificador de commit no válido.");
  const root = path.resolve(projectRoot);
  const detail = await runGitProcess(root, "git", ["show", "--format=fuller", "--stat", "--no-renames", "--no-color", hash]);
  if (detail.code !== 0) return detail;
  const names = await runGitProcess(root, "git", ["diff-tree", "--no-commit-id", "--name-only", "-r", hash]);
  return { ...detail, files: names.code === 0 ? names.stdout.split(/\r?\n/).filter(Boolean).slice(0, 300) : [] };
});

ipcMain.handle("vcs:file", async (_event, payload = {}) => {
  const action = typeof payload.action === "string" ? payload.action : "";
  const filePath = typeof payload.path === "string" ? payload.path : "";
  const hash = typeof payload.hash === "string" ? payload.hash : "";
  return runGitFileAction(action, filePath, hash);
});

ipcMain.handle("vcs:execute", async (_event, payload = {}) => {
  const action = typeof payload.action === "string" ? payload.action : "";
  const message = typeof payload.message === "string" ? payload.message : "";
  return runVersionControl(action, message);
});
