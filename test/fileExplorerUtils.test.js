import assert from 'node:assert/strict'
import test from 'node:test'

import {
  areFileSystemPathsEqual,
  createLatestRequestGuard,
  getExplorerKeyboardAction,
  getFileSystemRoot,
  getFileSystemErrorMessage,
  getParentFileSystemPath,
  getShortcutLinks,
  getTreePathKeys,
  isAbsoluteFileSystemPath,
  isFileSystemEntryVisible,
  isValidTimestamp,
  normalizeEnteredFileSystemPath,
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
})
