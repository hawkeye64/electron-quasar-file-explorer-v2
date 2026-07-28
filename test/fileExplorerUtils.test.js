import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createLatestRequestGuard,
  getFileSystemErrorMessage,
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
