import { app, ipcMain, shell } from 'electron'
import { access, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import mime from 'mime'

import walkFolders, { type FileInfo } from './walkFolders'
import windowsDrives from './getWindowsDrives'

function pathExists(filePath: string) {
  return new Promise<boolean>((resolve) => {
    access(filePath, (error) => {
      resolve(error === null)
    })
  })
}

// Every channel registered here is exposed through electron-preload.ts. Keeping
// filesystem work in the main process lets the renderer stay sandbox-friendly.
export function useHandler() {
  ipcMain.handle('myShell:walkFolders', async (_event, requestedPath: string) => {
    const folders: FileInfo[] = []
    for (const fileInfo of walkFolders(requestedPath)) {
      if (fileInfo.isDir === true && fileInfo.error === void 0) {
        // QTree treats children: [] as "expandable"; the renderer lazy-loads
        // the actual children only when the user opens that branch.
        fileInfo.children = []
      }
      folders.push(fileInfo)
    }
    return folders
  })

  ipcMain.handle('myShell:windowsDrives', async () => {
    return new Promise<string[]>((resolve, reject) => {
      windowsDrives((error, drives) => {
        if (error === null) {
          resolve(drives)
        } else {
          console.error(error)
          reject(error)
        }
      })
    })
  })

  ipcMain.handle('myShell:shortcutFolders', async () => {
    // app.getPath normalizes common OS folders across Windows, macOS, and Linux.
    return {
      home: app.getPath('home'),
      desktop: app.getPath('desktop'),
      document: app.getPath('documents'),
      download: app.getPath('downloads'),
      picture: app.getPath('pictures'),
      audio: app.getPath('music'),
      video: app.getPath('videos'),
    }
  })

  ipcMain.handle('myShell:sep', async () => {
    return path.sep
  })

  ipcMain.handle('myShell:platform', async () => {
    return os.platform()
  })

  ipcMain.handle('myShell:pathExists', async (_event, requestedPath: string) => {
    return await pathExists(requestedPath)
  })

  ipcMain.handle('myShell:openFile', async (_event, requestedPath: string) => {
    // Delegate opening to the operating system's default application.
    return await shell.openPath(requestedPath)
  })

  ipcMain.handle('myShell:readFile', async (_event, requestedPath: string) => {
    // Used by the renderer to create image thumbnails from local files.
    return readFileSync(requestedPath)
  })

  ipcMain.handle('myShell:getMimeType', async (_event, requestedPath: string) => {
    return mime.getType(requestedPath)
  })
}
