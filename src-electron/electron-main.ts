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
const smokeTestRequested = process.env.FILE_EXPLORER_SMOKE_TEST === '1'

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
    // Keep enough room for the navigation drawer and a usable content pane.
    // This applies equally to the grid and detailed list views.
    minWidth: 760,
    // CI launches the packaged app to verify the complete renderer/preload/IPC
    // path. Keep that diagnostic window hidden from hosted runner desktops.
    show: smokeTestRequested !== true,
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

  return mainWindow
}

async function runPackagedSmokeTest(mainWindow: BrowserWindow) {
  // executeJavaScript runs in the isolated renderer world, so this verifies the
  // same contextBridge API that Vue uses instead of reaching into Electron
  // internals from the main process.
  const result = await mainWindow.webContents.executeJavaScript(`
    (async () => {
      if (typeof window.myShell !== 'object') {
        return { error: 'The preload bridge is unavailable.' }
      }

      const [appInfo, environment, shortcutFolders, trashInfo] = await Promise.all([
        window.myShell.appInfo(),
        window.myShell.environment(),
        window.myShell.shortcutFolders(),
        window.myShell.trashInfo()
      ])
      const listing = await window.myShell.walkFolders(shortcutFolders.home)
      const properties = await window.myShell.fileProperties(shortcutFolders.home)

      return {
        appName: appInfo.name,
        appVersion: appInfo.version,
        platform: environment.platform,
        home: shortcutFolders.home,
        entryCount: Array.isArray(listing.entries) ? listing.entries.length : -1,
        homeIsDirectory: properties.isDirectory,
        hasFileOperations:
          typeof window.myShell.transferFiles === 'function' &&
          typeof window.myShell.trashFiles === 'function' &&
          typeof window.myShell.watchDirectory === 'function',
        trashHasItems: trashInfo.hasItems,
        error: listing.error?.message || null
      }
    })()
  `)

  if (
    typeof result?.platform !== 'string' ||
    result.appName !== app.getName() ||
    result.appVersion !== app.getVersion() ||
    typeof result?.home !== 'string' ||
    result.home.length === 0 ||
    Number.isInteger(result.entryCount) !== true ||
    result.entryCount < 0 ||
    result.homeIsDirectory !== true ||
    result.hasFileOperations !== true ||
    typeof result.trashHasItems !== 'boolean' ||
    result.error !== null
  ) {
    throw new Error(`Packaged application smoke test failed: ${JSON.stringify(result)}`)
  }

  console.info(
    `Packaged application smoke test passed on ${result.platform} ` +
      `(${result.entryCount} home entries).`,
  )
}

async function startApplication() {
  // Quasar's runtime wires aliases/assets used by Electron main/preload code.
  await registerQuasarRuntime()

  // Register IPC channels before the renderer has a chance to call them.
  useHandler({
    newWindow: async () => {
      await createWindow()
    },
  })

  const mainWindow = await createWindow()

  if (smokeTestRequested) {
    await runPackagedSmokeTest(mainWindow)
    app.exit(0)
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch((error) => {
        console.error('Failed to recreate the application window:', error)
      })
    }
  })
}

void app
  .whenReady()
  .then(startApplication)
  .catch((error) => {
    console.error('Failed to start File Explorer:', error)
    app.exit(1)
  })

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit()
  }
})
