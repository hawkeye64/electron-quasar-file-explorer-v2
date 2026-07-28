import type {
  DirectoryListing,
  FileExplorerEnvironment,
  FileExplorerNode,
  FileExplorerShell,
} from './types/fileExplorer'

declare global {
  interface Window {
    myShell: FileExplorerShell
  }

  const myShell: FileExplorerShell
}

export type { DirectoryListing, FileExplorerEnvironment, FileExplorerNode, FileExplorerShell }
