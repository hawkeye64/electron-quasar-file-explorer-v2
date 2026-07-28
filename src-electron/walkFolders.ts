import { lstat, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import mime from 'mime'

import type {
  DirectoryListing,
  FileExplorerNode,
  FileSystemEntryError,
} from '../src/types/fileExplorer'

const defaultConcurrency = 32

// Error instances and Node errno objects are not a useful public IPC contract.
// Copy only the fields the renderer needs into a structured-clone-safe object.
function serializeFileSystemError(filePath: string, error: unknown): FileSystemEntryError {
  const nodeError = error as NodeJS.ErrnoException

  return {
    path: filePath,
    message: error instanceof Error ? error.message : String(error),
    ...(typeof nodeError?.code === 'string' ? { code: nodeError.code } : {}),
  }
}

export async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  worker: (value: Input) => Promise<Output>,
  concurrency = defaultConcurrency,
): Promise<Output[]> {
  if (Number.isFinite(concurrency) !== true || concurrency < 1) {
    throw new RangeError('concurrency must be a positive finite number')
  }

  // Preserve readdir order even though metadata work finishes concurrently.
  // The renderer may apply its own display sorting afterward.
  const results = new Array<Output>(values.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex++
      results[currentIndex] = await worker(values[currentIndex]!)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.floor(concurrency), values.length) }, runWorker),
  )

  return results
}

async function readEntry(
  folder: string,
  name: string,
): Promise<{ entry?: FileExplorerNode; error?: FileSystemEntryError }> {
  const entryPath = path.join(folder, name)

  try {
    const linkMetadata = await lstat(entryPath)
    const isSymLink = linkMetadata.isSymbolicLink()
    let metadata = linkMetadata

    if (isSymLink) {
      try {
        // lstat identifies the link itself; stat tells the UI whether its
        // target behaves like a file or directory. Broken links remain visible.
        metadata = await stat(entryPath)
      } catch {
        // Keep broken links visible as links instead of dropping the entry.
      }
    }

    const isDir = metadata.isDirectory()

    return {
      entry: {
        path: entryPath,
        name,
        isDir,
        isSymLink,
        // fs.Stats has prototype getters and cannot be relied upon after
        // Electron structured cloning, so transfer primitive values explicitly.
        metadata: {
          size: metadata.size,
          mtimeMs: metadata.mtimeMs,
        },
        mimetype: isDir ? 'inode/directory' : mime.getType(entryPath),
        ...(isDir ? { children: [] } : {}),
      },
    }
  } catch (error) {
    return {
      error: serializeFileSystemError(entryPath, error),
    }
  }
}

/**
 * Lists one directory level without blocking Electron's main process.
 * Directory links remain navigable, but traversal is always user-driven and
 * one level at a time, so a link cycle cannot trigger recursive scanning.
 */
export default async function walkFolders(folder: string): Promise<DirectoryListing> {
  let names: string[]

  try {
    names = await readdir(folder)
  } catch (error) {
    return {
      path: folder,
      entries: [],
      errors: [],
      error: serializeFileSystemError(folder, error),
    }
  }

  const results = await mapWithConcurrency(names, (name) => readEntry(folder, name))
  const entries: FileExplorerNode[] = []
  const errors: FileSystemEntryError[] = []

  for (const result of results) {
    if (result.entry !== void 0) {
      entries.push(result.entry)
    } else if (result.error !== void 0) {
      errors.push(result.error)
    }
  }

  return {
    path: folder,
    entries,
    errors,
  }
}
