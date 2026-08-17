import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  validateAbsolutePath,
  validateAbsolutePaths,
  validateThumbnailSize,
} from '../src-electron/validation.ts'

test('validateAbsolutePath accepts and normalizes an absolute path', () => {
  const absolutePath = path.join(os.tmpdir(), 'folder', '..', 'file.txt')

  assert.equal(validateAbsolutePath(absolutePath), path.normalize(absolutePath))
})

test('validateAbsolutePath rejects relative, empty, and NUL-containing paths', () => {
  assert.throws(() => validateAbsolutePath('relative/file.txt'), TypeError)
  assert.throws(() => validateAbsolutePath(''), TypeError)
  assert.throws(() => validateAbsolutePath(`${os.tmpdir()}\0file.txt`), TypeError)
})

test('validateThumbnailSize enforces small bounded integer dimensions', () => {
  assert.equal(validateThumbnailSize(16), 16)
  assert.equal(validateThumbnailSize(256), 256)
  assert.throws(() => validateThumbnailSize(15), RangeError)
  assert.throws(() => validateThumbnailSize(257), RangeError)
  assert.throws(() => validateThumbnailSize(64.5), RangeError)
  assert.throws(() => validateThumbnailSize(Number.POSITIVE_INFINITY), RangeError)
})

test('validateAbsolutePaths accepts a bounded list of absolute paths', () => {
  const paths = [path.join(os.tmpdir(), 'one'), path.join(os.tmpdir(), 'two')]
  assert.deepEqual(validateAbsolutePaths(paths), paths.map(path.normalize))
  assert.throws(() => validateAbsolutePaths([]), TypeError)
  assert.throws(() => validateAbsolutePaths(['relative']), TypeError)
  assert.throws(() => validateAbsolutePaths(new Array(1001).fill(os.tmpdir())), TypeError)
})
