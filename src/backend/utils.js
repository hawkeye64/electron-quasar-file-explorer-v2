/**
 * Renderer-side wrappers around the preload bridge.
 *
 * Components import these helpers instead of talking to window.myShell directly.
 * That keeps IPC channel names centralized and easier to change later.
 */
/* eslint-disable no-undef */
// myShell is injected by src-electron/electron-preload.js.

/**
 * Function that lists all files in a folder recursively
 * in a synchronous fashion
 *
 * @param {String} folder - folder to start with
 * @returns array of '{ children: [] (optional), name: string, path: string }'
 */
export async function walkFolders(path) {
  // The actual filesystem scan happens in the Electron main process.
  return await myShell.walkFolders(path)
}

export async function windowsDrives() {
  return await myShell.windowsDrives()
}

export async function shortcutDirs() {
  return await myShell.shortcutFolders()
}

/**
 * @returns The platform specific path separator ("\\" | "/")
 * '\' on Windows
 * '/' on POSIX
 */
export async function getSep() {
  return await myShell.sep()
}

export async function openFile(path) {
  return await myShell.openFile(path)
}

export async function getPlatform() {
  return await myShell.platform()
}

export async function pathExists(path) {
  return await myShell.pathExists(path)
}

export async function readFile(path) {
  return await myShell.readFile(path)
}

export async function getImageFile(path, mimeType) {
  const buffer = await myShell.readFile(path)
  return await arrayBufferToDataUrl(buffer, mimeType)
}

function arrayBufferToDataUrl(buffer, mimeType) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], {
      type: mimeType || 'application/octet-stream',
    })
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to encode the image thumbnail'))
      }
    }
    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read the image thumbnail'))
    }
    reader.readAsDataURL(blob)
  })
}

export async function getMimeType(path) {
  return await myShell.getMimeType(path)
}
