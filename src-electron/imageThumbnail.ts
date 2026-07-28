import { readFile, stat } from 'node:fs/promises'
import { nativeImage } from 'electron'
import mime from 'mime'

const maximumSourceBytes = 32 * 1024 * 1024
const maximumConcurrentThumbnails = 4

let activeThumbnailCount = 0
const thumbnailWaiters: Array<() => void> = []

// Image decoding can consume a surprising amount of CPU and memory. The main
// process owns a small queue so a directory full of photos cannot make the
// Electron application unresponsive by starting every decode at once.
async function acquireThumbnailSlot() {
  if (activeThumbnailCount >= maximumConcurrentThumbnails) {
    await new Promise<void>((resolve) => {
      thumbnailWaiters.push(resolve)
    })
    return
  }

  activeThumbnailCount++
}

function releaseThumbnailSlot() {
  const nextThumbnail = thumbnailWaiters.shift()

  if (nextThumbnail) {
    // Transfer the active slot directly to the next waiter. Keeping the count
    // unchanged avoids a gap where a new request could claim the same slot.
    nextThumbnail()
  } else {
    activeThumbnailCount--
  }
}

async function withThumbnailSlot<T>(task: () => Promise<T>): Promise<T> {
  await acquireThumbnailSlot()

  try {
    return await task()
  } finally {
    releaseThumbnailSlot()
  }
}

function resizeToFit(image: Electron.NativeImage, size: number) {
  const dimensions = image.getSize()

  if (dimensions.width <= size && dimensions.height <= size) {
    return image
  }

  return image.resize(
    dimensions.width >= dimensions.height
      ? { width: size, quality: 'good' }
      : { height: size, quality: 'good' },
  )
}

export async function createImageThumbnail(filePath: string, size: number): Promise<string | null> {
  return await withThumbnailSlot(async () => {
    try {
      const mimeType = mime.getType(filePath)

      if (mimeType?.startsWith('image/') !== true || mimeType === 'image/svg+xml') {
        return null
      }

      const fileMetadata = await stat(filePath)

      if (fileMetadata.isFile() !== true || fileMetadata.size > maximumSourceBytes) {
        return null
      }

      let image: Electron.NativeImage

      // Electron can ask the operating system for efficient thumbnails on macOS
      // and Windows. Linux does not implement that API, so it uses nativeImage
      // decoding after the source-size check above.
      if (process.platform === 'darwin' || process.platform === 'win32') {
        image = await nativeImage.createThumbnailFromPath(filePath, {
          width: size,
          height: size,
        })
      } else {
        image = nativeImage.createFromBuffer(await readFile(filePath))
      }

      if (image.isEmpty()) {
        return null
      }

      return resizeToFit(image, size).toDataURL()
    } catch {
      // A file can disappear, become unreadable, or have an extension that
      // does not match its contents. Those are normal browsing conditions, so
      // return "no thumbnail" and let the renderer keep its generic icon.
      return null
    }
  })
}
