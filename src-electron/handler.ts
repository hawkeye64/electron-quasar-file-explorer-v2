import { app, ipcMain, shell, type IpcMainInvokeEvent, type WebContents } from 'electron'
import os from 'node:os'
import path from 'node:path'

import { createImageThumbnail } from './imageThumbnail'
import { validateAbsolutePath, validateThumbnailSize } from './validation'
import walkFolders from './walkFolders'
import windowsDrives from './getWindowsDrives'

const trustedRendererIds = new Set<number>()

// Register each BrowserWindow we create and forget it when destroyed. Checking
// this identity on every IPC call means an unexpected window or webview cannot
// reuse the preload channel merely because it knows a channel name.
export function trustRenderer(webContents: WebContents) {
  trustedRendererIds.add(webContents.id)
  webContents.once('destroyed', () => {
    trustedRendererIds.delete(webContents.id)
  })
}

function assertTrustedSender(event: IpcMainInvokeEvent) {
  if (
    trustedRendererIds.has(event.sender.id) !== true ||
    event.senderFrame === null ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error('IPC request did not originate from the trusted application renderer')
  }
}

function handle(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
) {
  // Centralizing sender validation makes it difficult to add a future channel
  // that accidentally bypasses the same trust boundary.
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedSender(event)
    return await listener(event, ...args)
  })
}

// Every channel registered here is exposed through electron-preload.ts. Keeping
// filesystem work in the main process lets the renderer stay sandbox-friendly.
export function useHandler() {
  handle('myShell:walkFolders', async (_event, requestedPath) => {
    return await walkFolders(validateAbsolutePath(requestedPath))
  })

  handle('myShell:windowsDrives', async () => {
    return await windowsDrives()
  })

  handle('myShell:shortcutFolders', () => {
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

  handle('myShell:environment', () => {
    return {
      pathSeparator: path.sep,
      platform: os.platform(),
    }
  })

  handle('myShell:openFile', async (_event, requestedPath) => {
    return await shell.openPath(validateAbsolutePath(requestedPath))
  })

  handle('myShell:imageThumbnail', async (_event, requestedPath, requestedSize) => {
    return await createImageThumbnail(
      validateAbsolutePath(requestedPath),
      validateThumbnailSize(requestedSize),
    )
  })
}
