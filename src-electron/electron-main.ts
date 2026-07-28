import { BrowserWindow, app, nativeTheme } from 'electron'
import { unlinkSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { registerQuasarRuntime, resolveElectronAssetsPath } from '#q-app/electron/main'

import { trustRenderer, useHandler } from './handler'

// The main process owns native Electron APIs, application lifecycle, and IPC.
// Renderer code should reach this file only through the preload bridge.

// needed in case process is undefined under Linux
const platform = process.platform || os.platform()

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
      // Run preload code in an isolated JavaScript world so page scripts cannot
      // modify its built-ins or directly access its privileged objects.
      contextIsolation: true,

      // Do not add Node globals such as require, process, or Buffer to the Vue
      // renderer. Filesystem work must go through the narrow preload bridge.
      nodeIntegration: false,

      // Apply Chromium's renderer sandbox to reduce what a compromised renderer
      // can do outside the explicitly exposed contextBridge API.
      sandbox: true,

      // Keep Chromium's same-origin policy, CORS checks, and other normal web
      // security protections enabled in the Electron renderer.
      webSecurity: true,

      // Do not allow an HTTPS page to weaken transport security by loading
      // active content over HTTP.
      allowRunningInsecureContent: false,

      // Quasar compiles this preload to CommonJS for Electron's sandboxed
      // preload environment; it exposes only window.myShell and quasarRuntime.
      preload: path.join(import.meta.dirname, 'electron-preload.cjs'),
    },
  })

  trustRenderer(mainWindow.webContents)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-frame-navigate', (event) => {
    event.preventDefault()
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
  await registerQuasarRuntime()

  // Register IPC channels before the renderer has a chance to call them.
  useHandler({ newWindow: createWindow })

  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch((error) => {
        console.error('Failed to recreate the application window:', error)
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit()
  }
})
