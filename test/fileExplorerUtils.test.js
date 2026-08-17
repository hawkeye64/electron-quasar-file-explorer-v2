import assert from 'node:assert/strict'
import test from 'node:test'

import {
  areFileSystemPathsEqual,
  createLatestRequestGuard,
  getEnteredPathErrorMessage,
  getExplorerKeyboardAction,
  getExplorerWheelDirection,
  getFileSystemRoot,
  getFileSystemErrorMessage,
  getFileNameDisplayParts,
  getParentFileSystemPath,
  getShortcutLinks,
  getTreePathKeys,
  isAbsoluteFileSystemPath,
  isFileSystemEntryVisible,
  isValidTimestamp,
  normalizeEnteredFileSystemPath,
  truncateFileNameMiddle,
} from '../src/utils/fileExplorer.js'

test('isValidTimestamp accepts finite timestamps including the Unix epoch', () => {
  assert.equal(isValidTimestamp(0), true)
  assert.equal(isValidTimestamp(1_725_000_000_000), true)
  assert.equal(isValidTimestamp(-1), true)
  assert.equal(isValidTimestamp(Number.NaN), false)
  assert.equal(isValidTimestamp(Number.POSITIVE_INFINITY), false)
  assert.equal(isValidTimestamp('1725000000000'), false)
  assert.equal(isValidTimestamp(undefined), false)
})

test('file name display parts preserve the ending of long names for middle ellipsis', () => {
  assert.deepEqual(getFileNameDisplayParts('short-name.md'), {
    start: 'short-name.md',
    end: '',
  })
  assert.deepEqual(getFileNameDisplayParts('quasar-full-audit-2026-07-27.md'), {
    start: 'quasar-full-audit-2',
    end: '026-07-27.md',
  })
})

test('grid file names use a bounded middle ellipsis', () => {
  assert.equal(truncateFileNameMiddle('short-name.md', 20), 'short-name.md')
  assert.equal(
    truncateFileNameMiddle('quasar-full-audit-2026-07-27.md', 21),
    'quasar-ful…6-07-27.md',
  )
  assert.equal(Array.from(truncateFileNameMiddle('😀-a-very-long-name.md', 12)).length, 12)
})

test('getFileSystemErrorMessage maps common filesystem failures to useful UI text', () => {
  assert.equal(
    getFileSystemErrorMessage({ path: '/private', code: 'EACCES' }),
    'Permission was denied while reading “/private”.',
  )
  assert.equal(
    getFileSystemErrorMessage({ path: '/missing', code: 'ENOENT' }),
    '“/missing” no longer exists.',
  )
  assert.equal(
    getFileSystemErrorMessage({ path: '/file', code: 'ENOTDIR' }),
    '“/file” is not a directory.',
  )
})

test('entered path errors explain the failed request without implying prior existence', () => {
  assert.equal(
    getEnteredPathErrorMessage('/opt/ivt', { code: 'ENOENT' }),
    'Unable to find “/opt/ivt”. Please check the spelling and try again.',
  )
  assert.equal(
    getEnteredPathErrorMessage('/home/jeff/file.txt', { code: 'ENOTDIR' }),
    '“/home/jeff/file.txt” is not a folder.',
  )
  assert.equal(
    getEnteredPathErrorMessage('/root', { code: 'EACCES' }),
    'You do not have permission to open “/root”.',
  )
})

test('createLatestRequestGuard accepts only the most recent request', () => {
  const requests = createLatestRequestGuard()
  const firstRequest = requests.begin()
  const secondRequest = requests.begin()

  assert.equal(requests.isLatest(firstRequest), false)
  assert.equal(requests.isLatest(secondRequest), true)
})

test('tree path helpers handle POSIX, Windows drive, and Windows UNC roots', () => {
  assert.equal(getFileSystemRoot('/home/jeff', '/', 'linux'), '/')
  assert.deepEqual(getTreePathKeys('/home/jeff/Documents', '/', '/'), [
    '/home',
    '/home/jeff',
    '/home/jeff/Documents',
  ])

  assert.equal(getFileSystemRoot('c:\\Users\\Jeff', '\\', 'win32'), 'C:\\')
  assert.deepEqual(getTreePathKeys('C:\\Users\\Jeff', 'C:\\', '\\'), [
    'C:\\Users',
    'C:\\Users\\Jeff',
  ])

  assert.equal(getFileSystemRoot('\\\\server\\share\\folder', '\\', 'win32'), '\\\\server\\share\\')
})

test('filesystem path equality highlights only the exact shortcut location', () => {
  assert.equal(areFileSystemPathsEqual('/home/jeff/', '/home/jeff', 'linux'), true)
  assert.equal(areFileSystemPathsEqual('/home/jeff/Documents', '/home/jeff', 'linux'), false)
  assert.equal(areFileSystemPathsEqual('c:\\Users\\Jeff', 'C:\\Users\\Jeff\\', 'win32'), true)
  assert.equal(areFileSystemPathsEqual('C:\\Users\\Jeff', 'C:\\Users\\Jeff\\Work', 'win32'), false)
  assert.equal(areFileSystemPathsEqual('/Users/Jeff', '/users/jeff', 'darwin'), false)
})

test('shortcut labels follow shared conventions and the macOS Movies name', () => {
  const folders = {
    home: '/Users/Jeff',
    desktop: '/Users/Jeff/Desktop',
    documents: '/Users/Jeff/Documents',
    downloads: '/Users/Jeff/Downloads',
    pictures: '/Users/Jeff/Pictures',
    music: '/Users/Jeff/Music',
    videos: '/Users/Jeff/Movies',
  }

  assert.deepEqual(
    getShortcutLinks(folders, 'linux').map(({ name }) => name),
    ['Home', 'Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'],
  )
  assert.equal(getShortcutLinks(folders, 'darwin').at(-1).name, 'Movies')
  assert.equal(getShortcutLinks(folders, 'darwin').at(-1).path, '/Users/Jeff/Movies')
})

test('absolute path validation follows POSIX, Windows drive, and UNC syntax', () => {
  assert.equal(isAbsoluteFileSystemPath('/home/jeff', 'linux'), true)
  assert.equal(isAbsoluteFileSystemPath('/Users/Jeff', 'darwin'), true)
  assert.equal(isAbsoluteFileSystemPath('C:\\Users\\Jeff', 'win32'), true)
  assert.equal(isAbsoluteFileSystemPath('\\\\server\\share\\folder', 'win32'), true)
  assert.equal(isAbsoluteFileSystemPath('Documents', 'linux'), false)
  assert.equal(isAbsoluteFileSystemPath('C:relative', 'win32'), false)
  assert.equal(isAbsoluteFileSystemPath('/tmp/\0unsafe', 'linux'), false)
})

test('entered Windows paths use the native separator expected by the tree', () => {
  assert.equal(
    normalizeEnteredFileSystemPath('  C:/Users/Jeff/Documents  ', 'win32'),
    'C:\\Users\\Jeff\\Documents',
  )
  assert.equal(
    normalizeEnteredFileSystemPath(' /home/jeff/Documents ', 'linux'),
    '/home/jeff/Documents',
  )
})

test('hidden entry filtering uses the portable leading-dot convention', () => {
  assert.equal(isFileSystemEntryVisible({ name: '.git' }, false), false)
  assert.equal(isFileSystemEntryVisible({ name: '.git' }, true), true)
  assert.equal(isFileSystemEntryVisible({ name: 'Documents' }, false), true)
})

test('parent path navigation stops at POSIX, drive, and UNC roots', () => {
  assert.equal(getParentFileSystemPath('/home/jeff', '/', 'linux'), '/home')
  assert.equal(getParentFileSystemPath('/home', '/', 'linux'), '/')
  assert.equal(getParentFileSystemPath('/', '/', 'linux'), '/')
  assert.equal(getParentFileSystemPath('C:\\Users\\Jeff', '\\', 'win32'), 'C:\\Users')
  assert.equal(getParentFileSystemPath('C:\\Users', '\\', 'win32'), 'C:\\')
  assert.equal(
    getParentFileSystemPath('\\\\server\\share\\folder', '\\', 'win32'),
    '\\\\server\\share\\',
  )
})

test('keyboard actions use Control on Windows/Linux and Command on macOS', () => {
  assert.equal(getExplorerKeyboardAction({ key: 'h', ctrlKey: true }, 'linux'), 'toggleHiddenFiles')
  assert.equal(getExplorerKeyboardAction({ key: 'o', ctrlKey: true }, 'win32'), 'openLocation')
  assert.equal(getExplorerKeyboardAction({ key: 'n', metaKey: true }, 'darwin'), 'newWindow')
  assert.equal(getExplorerKeyboardAction({ key: 'r', ctrlKey: true }, 'darwin'), null)
  assert.equal(getExplorerKeyboardAction({ key: 'F5' }, 'linux'), 'refresh')
  assert.equal(getExplorerKeyboardAction({ key: 'ArrowUp', altKey: true }, 'linux'), 'parentFolder')
  assert.equal(getExplorerKeyboardAction({ key: '1', ctrlKey: true }, 'linux'), 'gridView')
  assert.equal(getExplorerKeyboardAction({ key: '+', metaKey: true }, 'darwin'), 'increaseIconSize')
  assert.equal(getExplorerKeyboardAction({ key: 'c', ctrlKey: true }, 'linux'), 'copy')
  assert.equal(getExplorerKeyboardAction({ key: 'x', metaKey: true }, 'darwin'), 'cut')
  assert.equal(getExplorerKeyboardAction({ key: 'v', ctrlKey: true }, 'win32'), 'paste')
  assert.equal(getExplorerKeyboardAction({ key: 'i', metaKey: true }, 'darwin'), 'properties')
  assert.equal(getExplorerKeyboardAction({ key: 'Delete' }, 'linux'), 'trash')
})

test('modified mouse-wheel gestures resize icons without accepting browser zoom modifiers', () => {
  assert.equal(getExplorerWheelDirection({ deltaY: -100, ctrlKey: true }, 'linux'), 1)
  assert.equal(getExplorerWheelDirection({ deltaY: 100, ctrlKey: true }, 'win32'), -1)
  assert.equal(getExplorerWheelDirection({ deltaY: -1, metaKey: true }, 'darwin'), 1)
  assert.equal(getExplorerWheelDirection({ deltaY: -100, ctrlKey: true }, 'darwin'), 0)
  assert.equal(
    getExplorerWheelDirection({ deltaY: -100, ctrlKey: true, shiftKey: true }, 'linux'),
    0,
  )
  assert.equal(getExplorerWheelDirection({ deltaY: 0, ctrlKey: true }, 'linux'), 0)
})
