import { cp, lstat, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import mime from 'mime'

import type {
  FileProperties,
  FileTransferRequest,
  FileTransferResult,
} from '../src/types/fileExplorer.ts'
import { validateAbsolutePath, validateAbsolutePaths } from './validation.ts'

export async function getFileProperties(requestedPath: unknown): Promise<FileProperties> {
  const filePath = validateAbsolutePath(requestedPath)
  const stats = await lstat(filePath)

  return {
    path: filePath,
    name: path.basename(filePath) || filePath,
    isDirectory: stats.isDirectory(),
    isSymbolicLink: stats.isSymbolicLink(),
    size: stats.size,
    createdMs: stats.birthtimeMs,
    modifiedMs: stats.mtimeMs,
    accessedMs: stats.atimeMs,
    mimetype: stats.isDirectory() ? null : (mime.getType(filePath) ?? null),
  }
}

function validateTransferRequest(value: unknown): Required<FileTransferRequest> {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('file transfer request must be an object')
  }

  const request = value as Partial<FileTransferRequest>
  if (request.mode !== 'copy' && request.mode !== 'move') {
    throw new TypeError('file transfer mode must be copy or move')
  }

  if (request.overwrite !== void 0 && typeof request.overwrite !== 'boolean') {
    throw new TypeError('overwrite must be a boolean')
  }

  return {
    sources: validateAbsolutePaths(request.sources),
    destination: validateAbsolutePath(request.destination),
    mode: request.mode,
    overwrite: request.overwrite === true,
  }
}

async function destinationExists(destinationPath: string) {
  try {
    await lstat(destinationPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function movePath(source: string, destination: string, overwrite: boolean) {
  if (overwrite) {
    await rm(destination, { recursive: true, force: true })
  }

  try {
    await rename(source, destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
    await cp(source, destination, { recursive: true, force: overwrite, errorOnExist: !overwrite })
    await rm(source, { recursive: true })
  }
}

export async function transferFiles(requestedTransfer: unknown): Promise<FileTransferResult> {
  const request = validateTransferRequest(requestedTransfer)
  const completed: string[] = []
  const conflicts: string[] = []
  const destinationStats = await lstat(request.destination)
  if (destinationStats.isDirectory() !== true) {
    throw new TypeError('file transfer destination must be a directory')
  }

  for (const source of request.sources) {
    const destination = path.join(request.destination, path.basename(source))
    const relativeDestination = path.relative(source, destination)
    if (
      relativeDestination !== '' &&
      relativeDestination !== '..' &&
      relativeDestination.startsWith(`..${path.sep}`) !== true &&
      path.isAbsolute(relativeDestination) !== true
    ) {
      throw new TypeError('a folder cannot be transferred into itself')
    }
    if (source === destination) {
      conflicts.push(destination)
      continue
    }

    if (request.overwrite !== true && (await destinationExists(destination))) {
      conflicts.push(destination)
      continue
    }

    if (request.mode === 'copy') {
      await cp(source, destination, {
        recursive: true,
        force: request.overwrite,
        errorOnExist: !request.overwrite,
      })
    } else {
      await movePath(source, destination, request.overwrite)
    }
    completed.push(destination)
  }

  return { completed, conflicts }
}
