/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 *
 * WARNING!
 * If you import anything from node_modules, then make sure that the package is specified
 * in /src-electron/package.json > dependencies and NOT in devDependencies
 *
 * Example (injects window.myAPI.doAThing() into renderer thread):
 *
 *   import { contextBridge } from 'electron'
 *
 *   contextBridge.exposeInMainWorld('myAPI', {
 *     doAThing: () => {}
 *   })
 *
 * WARNING!
 * If accessing Node functionality (like importing @electron/remote) then in your
 * electron-main.ts you will need to set the following when you instantiate BrowserWindow:
 *
 * mainWindow = new BrowserWindow({
 *   // ...
 *   webPreferences: {
 *     // ...
 *     sandbox: false // <-- to be able to import @electron/remote in preload script
 *   }
 * }
 */

import { contextBridge, ipcRenderer } from "electron";
import { quasarRuntime } from "#q-app/electron/preload";

/**
 * Can be used in the renderer process through `window.quasarRuntime`
 */
// Quasar injects a tiny runtime bridge for framework-level Electron helpers.
contextBridge.exposeInMainWorld("quasarRuntime", quasarRuntime);

// Keep the public renderer API intentionally small. Components call
// window.myShell.*, but they never receive ipcRenderer, shell, fs, or other
// powerful Electron/Node objects directly.
contextBridge.exposeInMainWorld("myShell", {
  openFile: (filePath: string) => ipcRenderer.invoke("myShell:openFile", filePath),
  walkFolders: (folderPath: string) => ipcRenderer.invoke("myShell:walkFolders", folderPath),
  windowsDrives: () => ipcRenderer.invoke("myShell:windowsDrives"),
  shortcutFolders: () => ipcRenderer.invoke("myShell:shortcutFolders"),
  sep: () => ipcRenderer.invoke("myShell:sep"),
  platform: () => ipcRenderer.invoke("myShell:platform"),
  pathExists: (filePath: string) => ipcRenderer.invoke("myShell:pathExists", filePath),
  readFile: (filePath: string) => ipcRenderer.invoke("myShell:readFile", filePath),
  getMimeType: (filePath: string) => ipcRenderer.invoke("myShell:getMimeType", filePath),
});
