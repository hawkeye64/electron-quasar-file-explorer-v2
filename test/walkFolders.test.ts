import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import walkFolders, { mapWithConcurrency } from '../src-electron/walkFolders.ts'

test('walkFolders returns clone-safe metadata, MIME data, and lazy directories', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'file-explorer-listing-'))
  t.after(async () => {
    await rm(directory, { force: true, recursive: true })
  })

  await writeFile(path.join(directory, 'example.txt'), 'example')
  await mkdir(path.join(directory, 'nested'))

  const listing = await walkFolders(directory)
  const file = listing.entries.find((entry) => entry.name === 'example.txt')
  const nested = listing.entries.find((entry) => entry.name === 'nested')

  assert.equal(listing.error, undefined)
  assert.deepEqual(listing.errors, [])
  assert.equal(file?.mimetype, 'text/plain')
  assert.equal(typeof file?.metadata.mtimeMs, 'number')
  assert.equal(nested?.isDir, true)
  assert.deepEqual(nested?.children, [])

  const clonedListing = structuredClone(listing)
  const clonedFile = clonedListing.entries.find((entry) => entry.name === 'example.txt')
  assert.equal(typeof clonedFile?.metadata.mtimeMs, 'number')
})

test('walkFolders identifies symbolic links without recursively traversing them', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'file-explorer-link-'))
  t.after(async () => {
    await rm(directory, { force: true, recursive: true })
  })

  const target = path.join(directory, 'target')
  await mkdir(target)

  try {
    await symlink(target, path.join(directory, 'linked-target'), 'dir')
  } catch (error) {
    if (process.platform === 'win32') {
      t.skip(`Creating directory symlinks requires additional Windows privileges: ${error}`)
      return
    }
    throw error
  }

  const listing = await walkFolders(directory)
  const linkedDirectory = listing.entries.find((entry) => entry.name === 'linked-target')

  assert.equal(linkedDirectory?.isSymLink, true)
  assert.equal(linkedDirectory?.isDir, true)
  assert.deepEqual(linkedDirectory?.children, [])
})

test('walkFolders reports a folder-level error without throwing across IPC', async () => {
  const missingDirectory = path.join(os.tmpdir(), `missing-file-explorer-${Date.now()}`)
  const listing = await walkFolders(missingDirectory)

  assert.equal(listing.entries.length, 0)
  assert.equal(listing.error?.path, missingDirectory)
  assert.equal(listing.error?.code, 'ENOENT')
})

test('mapWithConcurrency preserves order and respects its worker bound', async () => {
  let active = 0
  let maximumActive = 0

  const results = await mapWithConcurrency(
    [1, 2, 3, 4, 5, 6],
    async (value) => {
      active++
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return value * 2
    },
    2,
  )

  assert.deepEqual(results, [2, 4, 6, 8, 10, 12])
  assert.equal(maximumActive, 2)
})

test('mapWithConcurrency rejects non-finite and non-positive limits', async () => {
  await assert.rejects(() => mapWithConcurrency([1], async (value) => value, 0), RangeError)
  await assert.rejects(
    () => mapWithConcurrency([1], async (value) => value, Number.POSITIVE_INFINITY),
    RangeError,
  )
})
