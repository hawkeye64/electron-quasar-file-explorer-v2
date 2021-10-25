import { app, ipcMain } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'

import walkFolders from './walkFolders'
import windowsDrives from './getWindowsDrives'

export function useHandler () {
  ipcMain.handle('shell:walkFolders', async (event, path) => {
    const folders = []
    for (const fileInfo of walkFolders(path, 0)) {
      if (fileInfo.isDir && !fileInfo.error) {
        fileInfo.children = []
      }
      folders.push(fileInfo)
    }
    return folders
  })

  ipcMain.handle('shell:windowsDrives', async () => {
    return new Promise((resolve, reject) => {
      const localDrives = []
      windowsDrives((error, drives) => {
        if (!error) {
          localDrives.splice(0, localDrives.length, ...drives)
          resolve(localDrives)
        }
        else {
          console.error(error)
          reject(error)
        }
      })
    })
  })

  ipcMain.handle('shell:shortcutFolders', async () => {
    const home = app.getPath('home')
    const desktop = app.getPath('desktop')
    const document = app.getPath('documents')
    const download = app.getPath('downloads')
    const picture = app.getPath('pictures')
    const audio = app.getPath('music')
    const video = app.getPath('videos')

    const shortcuts = {
      home,
      desktop,
      document,
      download,
      picture,
      audio,
      video
    }

    return shortcuts
  })

  ipcMain.handle('shell:sep', async () => {
    return path.sep
  })

  ipcMain.handle('shell:platform', async () => {
    return os.platform()
  })

  ipcMain.handle('shell:openFile', async (event, path) => {
    // open the file as specified by the user
    return await shell.openPath(path)
  })

  ipcMain.handle('shell:readFile', async (event, path) => {
    return fs.readFileSync(path)
  })
}
