interface FileExplorerShell {
  openFile: (path: string) => Promise<string>;
  walkFolders: (path: string) => Promise<FileExplorerNode[]>;
  windowsDrives: () => Promise<string[]>;
  shortcutFolders: () => Promise<Record<string, string>>;
  sep: () => Promise<string>;
  platform: () => Promise<string>;
  pathExists: (path: string) => Promise<boolean>;
  readFile: (path: string) => Promise<ArrayBuffer>;
  getMimeType: (path: string) => Promise<string | false>;
}

interface FileExplorerNode {
  path: string;
  name?: string;
  isDir?: boolean;
  isSymLink?: boolean;
  children?: FileExplorerNode[];
  error?: unknown;
  metadata?: {
    size: number;
    mtime: Date;
    mtimeMs: number;
  };
  mimetype?: string | false;
}

interface Window {
  myShell: FileExplorerShell;
}

declare const myShell: FileExplorerShell;
