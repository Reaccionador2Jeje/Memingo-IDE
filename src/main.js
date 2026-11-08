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
    filters: [{ name: "Memingo", extensions: ["mgo", "mgoa", "txt"] }, { name: "All files", extensions: ["*"] }]
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
  await fs.writeFile(result.filePath, "# Welcome to Memingo!\n\nvibe message = \"Hello, world!\"\nspill message\n", "utf8");
  return { path: result.filePath, content: await fs.readFile(result.filePath, "utf8") };
});

ipcMain.handle("memingo:run", async (event, filePath) => {
  if (!filePath) throw new Error("Save your .mgo file before running it.");
  if (activeProcess) throw new Error("A Memingo process is already running.");
  const cwd = path.dirname(filePath);
  return await new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "memingo.exe" : "memingo", ["run", filePath], {
      cwd,
      windowsHide: true,
      env: process.env
    });
    activeProcess = child;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      activeProcess = null;
      resolve(value);
    };
    child.stdout.on("data", data => event.sender.send("memingo:output", { type: "stdout", text: data.toString() }));
    child.stderr.on("data", data => event.sender.send("memingo:output", { type: "stderr", text: data.toString() }));
    child.on("error", error => {
      finish({ code: -1, error: error.code === "ENOENT" ? "Memingo no está instalado o el comando 'memingo' no está en PATH." : error.message });
    });
    child.on("close", code => finish({ code }));
  });
});

ipcMain.handle("memingo:stop", () => {
  if (activeProcess) {
    activeProcess.kill();
    activeProcess = null;
    return true;
  }
  return false;
});