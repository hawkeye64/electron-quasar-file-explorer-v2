// The renderer and Electron main process share this contract. Keep every field
// compatible with Electron's structured-clone IPC transport: plain objects,
// arrays, strings, numbers and booleans cross the boundary predictably, while
// Node objects such as fs.Stats and their prototype getters do not.
export interface FileMetadata {
  size: number
  mtimeMs: number
}

export interface FileExplorerNode {
  path: string
  name: string
  isDir: boolean
  isSymLink: boolean
  metadata: FileMetadata
  mimetype: string | null
  children?: FileExplorerNode[]
  lazy?: boolean
  tickable?: boolean
}

export interface FileSystemEntryError {
  path: string
  message: string
  code?: string
}

export interface DirectoryListing {
  path: string
  entries: FileExplorerNode[]
  errors: FileSystemEntryError[]
  error?: FileSystemEntryError
}

export interface FileExplorerEnvironment {
  pathSeparator: string
  platform: NodeJS.Platform
}

export interface ShortcutFolders {
  home: string
  desktop: string
  documents: string
  downloads: string
  pictures: string
  music: string
  videos: string
}

export interface FileExplorerShell {
  newWindow: () => Promise<void>
  openFile: (path: string) => Promise<string>
  walkFolders: (path: string) => Promise<DirectoryListing>
  windowsDrives: () => Promise<string[]>
  shortcutFolders: () => Promise<ShortcutFolders>
  environment: () => Promise<FileExplorerEnvironment>
  imageThumbnail: (path: string, size: number) => Promise<string | null>
}
