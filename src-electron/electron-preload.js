/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 *
 * WARNING!
 * If you import anything from node_modules, then make sure that the package is specified
 * in package.json > dependencies and NOT in devDependencies
 *
 * Example (injects window.myAPI.doAThing() into renderer thread):
 *
 *   import { contextBridge } from 'electron'
 *
 *   contextBridge.exposeInMainWorld('myAPI', {
 *     doAThing: () => {}
 *   })
 */

import { contextBridge, ipcRenderer } from "electron";
import { quasarRuntime } from "#q-app/electron/preload";

// Quasar injects a tiny runtime bridge for framework-level Electron helpers.
contextBridge.exposeInMainWorld("quasarRuntime", quasarRuntime);

// Keep the public renderer API intentionally small. Components call
// window.myShell.*, but they never receive ipcRenderer, shell, fs, or other
// powerful Electron/Node objects directly.
contextBridge.exposeInMainWorld("myShell", {
  openFile: (path) => ipcRenderer.invoke("myShell:openFile", path),
  walkFolders: (path) => ipcRenderer.invoke("myShell:walkFolders", path),
  windowsDrives: () => ipcRenderer.invoke("myShell:windowsDrives"),
  shortcutFolders: () => ipcRenderer.invoke("myShell:shortcutFolders"),
  sep: () => ipcRenderer.invoke("myShell:sep"),
  platform: () => ipcRenderer.invoke("myShell:platform"),
  pathExists: (path) => ipcRenderer.invoke("myShell:pathExists", path),
  readFile: (path) => ipcRenderer.invoke("myShell:readFile", path),
  getMimeType: (path) => ipcRenderer.invoke("myShell:getMimeType", path),
});
