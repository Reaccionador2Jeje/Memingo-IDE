const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memingoIDE", {
  openFile: () => ipcRenderer.invoke("file:open"),
  openProject: () => ipcRenderer.invoke("project:open"),
  refreshProject: () => ipcRenderer.invoke("project:refresh"),
  openProjectFile: filePath => ipcRenderer.invoke("project:open-file", filePath),
  saveFile: payload => ipcRenderer.invoke("file:save", payload),
  newFile: () => ipcRenderer.invoke("file:new"),
  run: filePath => ipcRenderer.invoke("memingo:run", filePath),
  check: filePath => ipcRenderer.invoke("memingo:check", filePath),
  format: filePath => ipcRenderer.invoke("memingo:format", filePath),
  debug: payload => ipcRenderer.invoke("memingo:debug", payload),
  terminalExecute: payload => ipcRenderer.invoke("terminal:execute", payload),
  versionControl: payload => ipcRenderer.invoke("vcs:execute", payload),
  versionControlFile: payload => ipcRenderer.invoke("vcs:file", payload),
  versionControlCommit: payload => ipcRenderer.invoke("vcs:commit-detail", payload),
  versionControlBranches: () => ipcRenderer.invoke("vcs:branches"),
  versionControlBranchAction: payload => ipcRenderer.invoke("vcs:branch-action", payload),
  readConflictFile: payload => ipcRenderer.invoke("vcs:conflict-read", payload),
  saveConflictFile: payload => ipcRenderer.invoke("vcs:conflict-save", payload),
  stageConflictFile: payload => ipcRenderer.invoke("vcs:conflict-stage", payload),
  connectAgent: payload => ipcRenderer.invoke("agents:connect", payload),
  sendAgentPrompt: payload => ipcRenderer.invoke("agents:send", payload),
  answerAgentPermission: payload => ipcRenderer.invoke("agents:permission", payload),
  stopAgent: () => ipcRenderer.invoke("agents:stop"),
  disconnectAgent: () => ipcRenderer.invoke("agents:disconnect"),
  onAgentEvent: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("agents:event", listener);
    return () => ipcRenderer.removeListener("agents:event", listener);
  },
  stop: () => ipcRenderer.invoke("memingo:stop"),
  onOutput: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("memingo:output", listener);
    return () => ipcRenderer.removeListener("memingo:output", listener);
  }
});