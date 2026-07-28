export function isValidTimestamp(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function getFileSystemErrorMessage(error) {
  if (!error) return ''

  const path = error.path ? `“${error.path}”` : 'this location'

  switch (error.code) {
    case 'EACCES':
    case 'EPERM':
      return `Permission was denied while reading ${path}.`
    case 'ENOENT':
      return `${path} no longer exists.`
    case 'ENOTDIR':
      return `${path} is not a directory.`
    default:
      return `Unable to read ${path}.`
  }
}

// Filesystem requests can finish out of order. A small request guard keeps the
// Vue layout independent from the IPC implementation while ensuring that only
// the most recent navigation is allowed to update the visible directory.
export function createLatestRequestGuard() {
  let latestRequestId = 0

  return {
    begin() {
      return ++latestRequestId
    },
    isLatest(requestId) {
      return requestId === latestRequestId
    },
  }
}

// The renderer cannot import Node's path module, so keep the small amount of
// platform-specific tree decomposition explicit and testable.
export function getFileSystemRoot(absolutePath, pathSeparator, platform) {
  if (platform !== 'win32') {
    return pathSeparator
  }

  if (absolutePath.startsWith(pathSeparator + pathSeparator)) {
    const [server, share] = absolutePath.split(pathSeparator).filter(Boolean)
    if (server && share) {
      return pathSeparator + pathSeparator + server + pathSeparator + share + pathSeparator
    }
  }

  return absolutePath.slice(0, 2).toUpperCase() + pathSeparator
}

export function getTreePathKeys(absolutePath, rootPath, pathSeparator) {
  const parts = absolutePath.slice(rootPath.length).split(pathSeparator).filter(Boolean)
  const keys = []
  let currentPath = rootPath

  for (const part of parts) {
    if (currentPath.endsWith(pathSeparator) !== true) {
      currentPath += pathSeparator
    }
    currentPath += part
    keys.push(currentPath)
  }

  return keys
}

// Windows paths are case-insensitive in the normal Electron environments this
// sample targets. Ignore only trailing separators elsewhere so the shortcut
// highlight represents an exact location rather than one of its descendants.
export function areFileSystemPathsEqual(firstPath, secondPath, platform) {
  function withoutTrailingSeparators(value) {
    return value.length > 1 ? value.replace(/[\\/]+$/, '') : value
  }

  const first = withoutTrailingSeparators(firstPath)
  const second = withoutTrailingSeparators(secondPath)

  return platform === 'win32' ? first.toLowerCase() === second.toLowerCase() : first === second
}

// Electron supplies the native locations, while the renderer supplies familiar
// cross-platform labels. Finder calls its video directory “Movies”; GNOME Files
// and Windows File Explorer call the equivalent location “Videos”.
export function getShortcutLinks(shortcuts, platform) {
  return [
    { name: 'Home', path: shortcuts.home, icon: 'home' },
    { name: 'Desktop', path: shortcuts.desktop, icon: 'desktop_windows' },
    { name: 'Documents', path: shortcuts.documents, icon: 'folder' },
    { name: 'Downloads', path: shortcuts.downloads, icon: 'vertical_align_bottom' },
    { name: 'Pictures', path: shortcuts.pictures, icon: 'image' },
    { name: 'Music', path: shortcuts.music, icon: 'music_note' },
    {
      name: platform === 'darwin' ? 'Movies' : 'Videos',
      path: shortcuts.videos,
      icon: 'local_movies',
    },
  ]
}

export function isAbsoluteFileSystemPath(value, platform) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    return false
  }

  if (platform === 'win32') {
    return /^[a-z]:[\\/]/i.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value)
  }

  return value.startsWith('/')
}

export function normalizeEnteredFileSystemPath(value, platform) {
  const trimmedPath = value.trim()

  // Windows APIs accept forward slashes, but the renderer's breadcrumbs and
  // lazy tree use the native separator supplied by Electron. Normalize only
  // user-entered paths so every downstream path operation sees one form.
  return platform === 'win32' ? trimmedPath.replaceAll('/', '\\') : trimmedPath
}

// Leading-dot entries are the portable hidden-file convention available from
// Node's cross-platform directory APIs. Native Windows Hidden attributes are a
// separate platform metadata feature and are intentionally not guessed here.
export function isFileSystemEntryVisible(entry, showHiddenFiles) {
  return showHiddenFiles === true || entry.name.startsWith('.') !== true
}

export function getParentFileSystemPath(absolutePath, pathSeparator, platform) {
  const rootPath = getFileSystemRoot(absolutePath, pathSeparator, platform)
  if (absolutePath === rootPath) {
    return rootPath
  }

  const pathWithoutTrailingSeparators = absolutePath.replace(/[\\/]+$/, '')
  const separatorIndex = pathWithoutTrailingSeparators.lastIndexOf(pathSeparator)

  return separatorIndex < rootPath.length
    ? rootPath
    : pathWithoutTrailingSeparators.slice(0, separatorIndex) || rootPath
}

export function getExplorerKeyboardAction(event, platform) {
  const key = event.key.toLowerCase()
  const usesPrimaryModifier =
    platform === 'darwin'
      ? event.metaKey === true && event.ctrlKey !== true
      : event.ctrlKey === true && event.metaKey !== true

  if (usesPrimaryModifier && event.altKey !== true) {
    return (
      {
        n: 'newWindow',
        h: 'toggleHiddenFiles',
        o: 'openLocation',
        r: 'refresh',
        1: 'gridView',
        2: 'listView',
        '+': 'increaseIconSize',
        '=': 'increaseIconSize',
        '-': 'decreaseIconSize',
        _: 'decreaseIconSize',
      }[key] ?? null
    )
  }

  if (key === 'f5' && event.ctrlKey !== true && event.metaKey !== true && event.altKey !== true) {
    return 'refresh'
  }

  if (
    key === 'arrowup' &&
    event.altKey === true &&
    event.ctrlKey !== true &&
    event.metaKey !== true &&
    event.shiftKey !== true
  ) {
    return 'parentFolder'
  }

  return null
}
