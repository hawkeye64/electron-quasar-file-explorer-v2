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

const { contextBridge, ipcRenderer } = require('electron')

// Set up context bridge between the renderer process and the main process
contextBridge.exposeInMainWorld(
  'myShell',
  {
    openFile: (path) => ipcRenderer.invoke('myShell:openFile', path),
    walkFolders: (path) => ipcRenderer.invoke('myShell:walkFolders', path),
    windowsDrives: () => ipcRenderer.invoke('myShell:windowsDrives'),
    shortcutFolders: () => ipcRenderer.invoke('myShell:shortcutFolders'),
    sep: () => ipcRenderer.invoke('myShell:sep'),
    platform: () => ipcRenderer.invoke('myShell:platform'),
    pathExists: (path) => ipcRenderer.invoke('myShell:pathExists', path),
    readFile: (path) => ipcRenderer.invoke('myShell:readFile', path)
  }
)
