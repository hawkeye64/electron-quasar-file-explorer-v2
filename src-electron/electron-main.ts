import { BrowserWindow, app, ipcMain, nativeTheme } from 'electron'
import { unlinkSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { useHandler } from './handler'

// The main process owns native Electron APIs, application lifecycle, and IPC.
// Renderer code should reach this file only through the preload bridge.

// needed in case process is undefined under Linux
const platform = process.platform || os.platform()

function resolveElectronAssetsPath(...args: string[]) {
  const root = app.getAppPath()
  return path.join(
    root,
    import.meta.env.QUASAR_DEV ? '../../../src-electron/electron-assets' : 'electron-assets',
    ...args,
  )
}

function resolvePublicPath(...args: string[]) {
  const root = app.getAppPath()
  return path.join(root, import.meta.env.QUASAR_DEV ? '../../../public' : '.', ...args)
}

function registerQuasarRuntime() {
  ipcMain.on('quasar-electron:resolve-electron-assets', (event, ...args: string[]) => {
    event.returnValue = resolveElectronAssetsPath(...args)
  })

  ipcMain.on('quasar-electron:resolve-public', (event, ...args: string[]) => {
    event.returnValue = resolvePublicPath(...args)
  })
}

try {
  // Electron can hold stale DevTools extension metadata on Windows dark mode.
  // Removing it keeps local development startup predictable.
  if (platform === 'win32' && nativeTheme.shouldUseDarkColors === true) {
    unlinkSync(path.join(app.getPath('userData'), 'DevTools Extensions'))
  }
} catch {}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    // resolveElectronAssetsPath handles the dev/build path difference for files
    // copied through Quasar's Electron asset pipeline.
    icon: resolveElectronAssetsPath('icons/icon.png'),
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      // Keep the renderer isolated from Node/Electron globals. The preload file
      // exposes only the small API surface this app needs.
      contextIsolation: true,
      preload: path.join(import.meta.dirname, 'electron-preload.cjs'),
    },
  })

  // Quasar serves the renderer from Vite in dev and from index.html in builds.
  if (import.meta.env.QUASAR_DEV) {
    await mainWindow.loadURL(import.meta.env.QUASAR_APP_URL)
  } else {
    await mainWindow.loadFile('index.html')
  }

  if (import.meta.env.QUASAR_DEBUG) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools()
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools()
    })
  }
}

void app.whenReady().then(async () => {
  // Quasar's runtime wires aliases/assets used by Electron main/preload code.
  registerQuasarRuntime()

  // Register IPC channels before the renderer has a chance to call them.
  useHandler()

  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit()
  }
})
