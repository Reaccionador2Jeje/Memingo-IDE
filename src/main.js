const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

let mainWindow;
let activeProcess = null;

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
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
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