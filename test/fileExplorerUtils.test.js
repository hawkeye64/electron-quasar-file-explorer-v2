import assert from 'node:assert/strict'
import test from 'node:test'

import {
  areFileSystemPathsEqual,
  createLatestRequestGuard,
  getFileSystemRoot,
  getFileSystemErrorMessage,
  getShortcutLinks,
  getTreePathKeys,
  isValidTimestamp,
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
