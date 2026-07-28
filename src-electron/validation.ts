import path from 'node:path'

const maximumPathLength = 32_768
export const maximumThumbnailDimension = 256

/**
 * IPC values are untrusted even when they come from this app's preload bridge.
 * Normalize only absolute filesystem paths and reject embedded NUL characters
 * before a value reaches Node or Electron filesystem APIs.
 */
export function validateAbsolutePath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumPathLength ||
    value.includes('\0') ||
    path.isAbsolute(value) !== true
  ) {
    throw new TypeError('filesystem path must be a valid absolute path')
  }

  return path.normalize(value)
}

/**
 * Bounding requested dimensions prevents the renderer from using the thumbnail
 * channel as an unbounded image-allocation primitive in Electron's main process.
 */
export function validateThumbnailSize(size: unknown): number {
  if (
    typeof size !== 'number' ||
    Number.isInteger(size) !== true ||
    size < 16 ||
    size > maximumThumbnailDimension
  ) {
    throw new RangeError(
      `thumbnail size must be an integer between 16 and ${maximumThumbnailDimension}`,
    )
  }

  return size
}
