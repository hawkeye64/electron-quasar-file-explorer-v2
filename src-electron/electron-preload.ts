import { contextBridge, ipcRenderer } from 'electron'
import { quasarRuntime } from '#q-app/electron/preload'

import type { FileExplorerShell } from '../src/types/fileExplorer'

// Quasar injects a tiny runtime bridge for framework-level Electron helpers.
contextBridge.exposeInMainWorld('quasarRuntime', quasarRuntime)

// Keep the public renderer API intentionally small. Components call
// window.myShell.*, but they never receive ipcRenderer, shell, fs, or other
// powerful Electron/Node objects directly. `satisfies` keeps this bridge in
// sync with the renderer declaration without adding runtime code.
const fileExplorerShell = {
  appInfo: () => ipcRenderer.invoke('myShell:appInfo'),
  newWindow: () => ipcRenderer.invoke('myShell:newWindow'),
  openFile: (filePath: string) => ipcRenderer.invoke('myShell:openFile', filePath),
  walkFolders: (folderPath: string) => ipcRenderer.invoke('myShell:walkFolders', folderPath),
  windowsDrives: () => ipcRenderer.invoke('myShell:windowsDrives'),
  shortcutFolders: () => ipcRenderer.invoke('myShell:shortcutFolders'),
  environment: () => ipcRenderer.invoke('myShell:environment'),
  imageThumbnail: (filePath: string, size: number) =>
    ipcRenderer.invoke('myShell:imageThumbnail', filePath, size),
  fileProperties: (filePath: string) => ipcRenderer.invoke('myShell:fileProperties', filePath),
  transferFiles: (request) => ipcRenderer.invoke('myShell:transferFiles', request),
  trashFiles: (filePaths: string[]) => ipcRenderer.invoke('myShell:trashFiles', filePaths),
  watchDirectory: (folderPath: string) => ipcRenderer.invoke('myShell:watchDirectory', folderPath),
  unwatchDirectory: () => ipcRenderer.invoke('myShell:unwatchDirectory'),
  onDirectoryChanged: (listener: (folderPath: string) => void) => {
    const eventListener = (_event: Electron.IpcRendererEvent, folderPath: string) => {
      listener(folderPath)
    }
    ipcRenderer.on('myShell:directoryChanged', eventListener)
    return () => ipcRenderer.removeListener('myShell:directoryChanged', eventListener)
  },
  trashInfo: () => ipcRenderer.invoke('myShell:trashInfo'),
  openTrash: () => ipcRenderer.invoke('myShell:openTrash'),
} satisfies FileExplorerShell

contextBridge.exposeInMainWorld('myShell', fileExplorerShell)
