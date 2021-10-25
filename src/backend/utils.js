/**
 * This file contains JavaScript that communicates with Rust API functions
 */
/* eslint-disable no-undef */

// import { watch, watchImmediate } from 'tauri-plugin-fs-watch-api'
// import { readBinaryFile, readDir } from '@tauri-apps/api/fs'
// import { homeDir, desktopDir, documentDir, downloadDir, pictureDir, audioDir, videoDir, sep } from '@tauri-apps/api/path'
// import { metadata } from 'tauri-plugin-fs-extra-api'
// import { open } from '@tauri-apps/api/shell'
// import { platform } from '@tauri-apps/api/os'
// const { shell } = require('electron')
// const { ipcRenderer } = require('electron')

/**
 * Gets a watch on a path or an array of paths (this is debounced)
 *
 * @param {string|array} path Example: '/path/to/something' or ['/path/a', '/path/b']
 * @param {boolean} [recursive=true] If the watch should be recursive
 * @callback callback Returns '{ type, payload }'
 * @returns stopWatching function - when called stops watching the path
 */
export async function pathWatch (path, recursive = true, callback) {
  // const stopWatching = await watch(path, { recursive }, event => {
  //   // const { type, payload } = event
  //   if (callback) {
  //     callback(event)
  //   }
  // })

  // return stopWatching
}

/**
 * Gets a watch on a path or an array of paths (this is immediate)
 *
 * @param {string|array} path Example: '/path/to/something' or ['/path/a', '/path/b']
 * @param {boolean} [recursive=false] If the watch should be recursive
 * @callback callback Returns { path, operation, cookie }
 * @returns stopWatching function - when called stops watching the path
 */
export async function pathWatchImmediate (path, recursive = false, callback) {
  // const stopWatching = await watchImmediate(path, { recursive }, event => {
  //   // const { path, operation, cookie } = event
  //   if (callback) {
  //     callback(event)
  //   }
  // })

  // return stopWatching
}

/**
 * Function that lists all files in a folder recursively
 * in a synchronous fashion
 *
 * @param {String} folder - folder to start with
 * @returns array of '{ children: [] (optional), name: string, path: string }'
 */
export async function walkFolders (path) {
  return await shell.walkFolders(path)
}

export async function windowsDrives () {
  return await shell.windowsDrives()
}

export async function readFiles (path) {
  // try {
  //   const folders = await readDir(path, { recursive: false })
  //   return folders.filter(folder => folder.children === undefined)
  // }
  // catch (err) {
  //   return []
  // }
  // shell.readFiles(path)
  return Promise.resolve([])
}

export async function shortcutDirs () {
  return await shell.shortcutFolders()
}

// function removeEndSeparator (path) {
//   return path.slice(0, -1)
// }

/**
 * @param {string} path The absolute path to a file or folder
 * @returns An object containing the stat metadata
 */
export async function getMetadata (path) {
  // return await metadata(path)
  // shell.metadata(path)
  return Promise.resolve('')
}

/**
 * @returns The platform specific path separator ("\\" | "/")
 * '\' on Windows
 * '/' on POSIX
 */
export async function getSep () {
  return await shell.sep()
}

export async function openFile (path) {
  return await shell.openFile(path)
}

export async function getPlatform () {
  return await shell.platform()
}

export async function getBinaryFile (path) {
  // return await readBinaryFile(path)
}

export async function getImageFile (path) {
  return new Promise((resolve) => {
    shell.readFile(path)
      .then(buffer => {
        arrayBufferToBase64(new Uint8Array(buffer), base64 => {
          const image = 'data:image/png;base64,' + base64
          return resolve(image)
        })
      })
  })
}

export function arrayBufferToBase64 (buffer, callback) {
  const blob = new Blob([buffer], {
    type: 'application/octet-binary'
  })
  const reader = new FileReader()
  reader.onload = function (evt) {
    const dataurl = evt.target.result
    callback(dataurl.substr(dataurl.indexOf(',') + 1))
  }
  reader.readAsDataURL(blob)
}
