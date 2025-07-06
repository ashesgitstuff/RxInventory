// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge } = require('electron');

// Preload scripts run in a sandboxed environment with access to Node.js APIs.
// The contextBridge is used to securely expose specific functions to the
// renderer process (your web app) without leaking Node.js globals.
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
});
