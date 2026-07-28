/**
 * Renderer-side wrappers around the preload bridge.
 *
 * Components import these helpers instead of talking to window.myShell directly.
 * That keeps IPC channel names centralized and easier to change later.
 */
/* eslint-disable no-undef */

const maximumCachedThumbnails = 200
const maximumConcurrentThumbnailRequests = 4
const thumbnailCache = new Map()
const thumbnailQueue = []
let activeThumbnailRequests = 0

// IntersectionObserver can reveal many images during one fast scroll. Queueing
// requests in the renderer avoids flooding the preload bridge; the separate
// main-process limit protects Electron if another caller bypasses this helper.
function runThumbnailQueue() {
  while (
    activeThumbnailRequests < maximumConcurrentThumbnailRequests &&
    thumbnailQueue.length > 0
  ) {
    const nextRequest = thumbnailQueue.shift()
    activeThumbnailRequests++

    Promise.resolve()
      .then(nextRequest.task)
      .then(nextRequest.resolve, nextRequest.reject)
      .finally(() => {
        activeThumbnailRequests--
        runThumbnailQueue()
      })
  }
}

function scheduleThumbnail(task) {
  return new Promise((resolve, reject) => {
    thumbnailQueue.push({ task, resolve, reject })
    runThumbnailQueue()
  })
}

function cacheThumbnail(key, thumbnailPromise) {
  // Cache the Promise rather than only its eventual value so two components
  // asking for the same thumbnail share one IPC request. Including mtime in the
  // key naturally invalidates the thumbnail after the file changes.
  if (thumbnailCache.size >= maximumCachedThumbnails) {
    thumbnailCache.delete(thumbnailCache.keys().next().value)
  }

  thumbnailCache.set(key, thumbnailPromise)
  thumbnailPromise.catch(() => {
    thumbnailCache.delete(key)
  })
}

export async function walkFolders(path) {
  return await myShell.walkFolders(path)
}

export async function openNewWindow() {
  await myShell.newWindow()
}

export async function windowsDrives() {
  return await myShell.windowsDrives()
}

export async function shortcutDirs() {
  return await myShell.shortcutFolders()
}

export async function getEnvironment() {
  return await myShell.environment()
}

export async function openFile(path) {
  return await myShell.openFile(path)
}

export async function getImageThumbnail(node, size) {
  const key = `${node.path}:${node.metadata?.mtimeMs ?? 0}:${size}`
  let thumbnail = thumbnailCache.get(key)

  if (thumbnail === void 0) {
    thumbnail = scheduleThumbnail(() => myShell.imageThumbnail(node.path, size))
    cacheThumbnail(key, thumbnail)
  }

  return await thumbnail
}
