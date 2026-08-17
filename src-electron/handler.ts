import { app, ipcMain, shell, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createImageThumbnail } from './imageThumbnail'
import { getFileProperties, transferFiles } from './fileOperations'
import { openPathWithoutWaitingForApplication } from './openPath'
import { validateAbsolutePath, validateAbsolutePaths, validateThumbnailSize } from './validation'
import walkFolders from './walkFolders'
import windowsDrives from './getWindowsDrives'
import { getTrashItemCount, openTrash } from './trash'

const trustedRendererIds = new Set<number>()
const directoryWatchers = new Map<number, FSWatcher>()

interface FileExplorerActions {
  newWindow: () => Promise<void>
}

// Register each BrowserWindow we create and forget it when destroyed. Checking
// this identity on every IPC call means an unexpected window or webview cannot
// reuse the preload channel merely because it knows a channel name.
export function trustRenderer(webContents: WebContents) {
  trustedRendererIds.add(webContents.id)
  webContents.once('destroyed', () => {
    trustedRendererIds.delete(webContents.id)
    directoryWatchers.get(webContents.id)?.close()
    directoryWatchers.delete(webContents.id)
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
export function useHandler({ newWindow }: FileExplorerActions) {
  handle('myShell:appInfo', () => {
    return {
      // Electron owns its runtime metadata. Return it through the narrow bridge
      // instead of exposing process or other Node globals to the Vue renderer.
      name: app.getName(),
      version: app.getVersion(),
      electronVersion: process.versions.electron,
    }
  })

  handle('myShell:newWindow', async () => {
    await newWindow()
  })

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
      documents: app.getPath('documents'),
      downloads: app.getPath('downloads'),
      pictures: app.getPath('pictures'),
      music: app.getPath('music'),
      videos: app.getPath('videos'),
    }
  })

  handle('myShell:environment', () => {
    return {
      pathSeparator: path.sep,
      platform: os.platform(),
    }
  })

  handle('myShell:openFile', async (_event, requestedPath) => {
    return await openPathWithoutWaitingForApplication(
      validateAbsolutePath(requestedPath),
      shell.openPath,
    )
  })

  handle('myShell:imageThumbnail', async (_event, requestedPath, requestedSize) => {
    return await createImageThumbnail(
      validateAbsolutePath(requestedPath),
      validateThumbnailSize(requestedSize),
    )
  })

  handle('myShell:fileProperties', async (_event, requestedPath) => {
    return await getFileProperties(requestedPath)
  })

  handle('myShell:transferFiles', async (_event, request) => {
    return await transferFiles(request)
  })

  handle('myShell:trashFiles', async (_event, requestedPaths) => {
    for (const filePath of validateAbsolutePaths(requestedPaths)) {
      await shell.trashItem(filePath)
    }
  })

  handle('myShell:watchDirectory', (event, requestedPath) => {
    const directoryPath = validateAbsolutePath(requestedPath)
    directoryWatchers.get(event.sender.id)?.close()

    let timer: ReturnType<typeof setTimeout> | undefined
    const watcher = watch(directoryPath, () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (event.sender.isDestroyed() !== true) {
          event.sender.send('myShell:directoryChanged', directoryPath)
        }
      }, 150)
    })
    watcher.on('error', () => {
      watcher.close()
      directoryWatchers.delete(event.sender.id)
    })
    directoryWatchers.set(event.sender.id, watcher)
  })

  handle('myShell:unwatchDirectory', (event) => {
    directoryWatchers.get(event.sender.id)?.close()
    directoryWatchers.delete(event.sender.id)
  })

  handle('myShell:trashInfo', async () => {
    return { hasItems: (await getTrashItemCount()) > 0 }
  })

  handle('myShell:openTrash', async () => {
    return await openTrash()
  })
}
