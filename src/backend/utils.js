/**
 * Renderer-side wrappers around the preload bridge.
 *
 * Components import these helpers instead of talking to window.myShell directly.
 * That keeps IPC channel names centralized and easier to change later.
 */
/* eslint-disable no-undef */
// myShell is injected by src-electron/electron-preload.js.

/**
 * Gets a watch on a path or an array of paths (this is debounced)
 *
 * @param {string|array} path Example: '/path/to/something' or ['/path/a', '/path/b']
 * @param {boolean} [recursive=true] If the watch should be recursive
 * @callback callback Returns '{ type, payload }'
 * @returns stopWatching function - when called stops watching the path
 */
export async function pathWatch(_path, _recursive = true, _callback) {
  // TBD
}

/**
 * Gets a watch on a path or an array of paths (this is immediate)
 *
 * @param {string|array} path Example: '/path/to/something' or ['/path/a', '/path/b']
 * @param {boolean} [recursive=false] If the watch should be recursive
 * @callback callback Returns { path, operation, cookie }
 * @returns stopWatching function - when called stops watching the path
 */
export async function pathWatchImmediate(_path, _recursive = false, _callback) {
  // TBD
}

/**
 * Function that lists all files in a folder recursively
 * in a synchronous fashion
 *
 * @param {String} folder - folder to start with
 * @returns array of '{ children: [] (optional), name: string, path: string }'
 */
export async function walkFolders(path) {
  // The actual filesystem scan happens in the Electron main process.
  return await myShell.walkFolders(path);
}

export async function windowsDrives() {
  return await myShell.windowsDrives();
}

export async function shortcutDirs() {
  return await myShell.shortcutFolders();
}

/**
 * @returns The platform specific path separator ("\\" | "/")
 * '\' on Windows
 * '/' on POSIX
 */
export async function getSep() {
  return await myShell.sep();
}

export async function openFile(path) {
  return await myShell.openFile(path);
}

export async function getPlatform() {
  return await myShell.platform();
}

export async function pathExists(path) {
  return await myShell.pathExists(path);
}

export async function readFile(path) {
  return await myShell.readFile(path);
}

export async function getImageFile(path) {
  return new Promise((resolve) => {
    myShell.readFile(path).then((buffer) => {
      // Local image thumbnails are passed to <img> as data URLs so the
      // renderer does not need direct file:// access.
      arrayBufferToBase64(new Uint8Array(buffer), (base64) => {
        const image = "data:image/png;base64," + base64;
        return resolve(image);
      });
    });
  });
}

export function arrayBufferToBase64(buffer, callback) {
  // FileReader is available in the renderer and avoids pulling in another
  // dependency just to encode thumbnail bytes.
  const blob = new Blob([buffer], {
    type: "application/octet-binary",
  });
  const reader = new FileReader();
  reader.onload = function (evt) {
    const dataurl = evt.target.result;
    callback(dataurl.substr(dataurl.indexOf(",") + 1));
  };
  reader.readAsDataURL(blob);
}

export async function getMimeType(path) {
  return await myShell.getMimeType(path);
}
