import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

export interface FileMetadata {
  size: number
  mtimeMs: number
}

export interface FileInfo {
  path: string
  name?: string
  isDir?: boolean
  isSymLink?: boolean
  metadata?: FileMetadata
  children?: FileInfo[]
  error?: unknown
}

/**
 * Lists one folder level at a time. The QTree requests deeper levels lazily,
 * so the app stays responsive on large directory trees.
 */
function* walkFolders(folder: string): IterableIterator<FileInfo> {
  try {
    const files = readdirSync(folder)
    for (const file of files) {
      try {
        const pathToFile = path.join(folder, file)
        const stat = statSync(pathToFile)

        yield {
          path: pathToFile,
          name: file,
          isDir: stat.isDirectory(),
          isSymLink: stat.isSymbolicLink(),
          metadata: {
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          },
        }
      } catch (err) {
        // Yield per-file errors instead of failing the whole folder scan. The
        // renderer can skip unreadable entries and still show the rest.
        yield {
          path: path.join(folder, file),
          name: file,
          error: err,
        }
      }
    }
  } catch (err) {
    // Folder-level errors are returned as data for the same reason: a bad path
    // should not crash the main process.
    yield {
      path: folder,
      error: err,
    }
  }
}

export default walkFolders
