const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memingoIDE", {
  openFile: () => ipcRenderer.invoke("file:open"),
  openProject: () => ipcRenderer.invoke("project:open"),
  openProjectFile: filePath => ipcRenderer.invoke("project:open-file", filePath),
  saveFile: payload => ipcRenderer.invoke("file:save", payload),
  newFile: () => ipcRenderer.invoke("file:new"),
  run: filePath => ipcRenderer.invoke("memingo:run", filePath),
  stop: () => ipcRenderer.invoke("memingo:stop"),
  onOutput: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("memingo:output", listener);
    return () => ipcRenderer.removeListener("memingo:output", listener);
  }
});