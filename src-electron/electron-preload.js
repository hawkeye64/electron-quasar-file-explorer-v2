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
  'shell',
  {
    openFile: (path) => ipcRenderer.invoke('shell:openFile', path),
    walkFolders: (path) => ipcRenderer.invoke('shell:walkFolders', path),
    windowsDrives: () => ipcRenderer.invoke('shell:windowsDrives'),
    shortcutFolders: () => ipcRenderer.invoke('shell:shortcutFolders'),
    sep: () => ipcRenderer.invoke('shell:sep'),
    platform: () => ipcRenderer.invoke('shell:platform'),
    readFile: (path) => ipcRenderer.invoke('shell:readFile', path)
  }
)
