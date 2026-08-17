import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { getFileProperties, transferFiles } from '../src-electron/fileOperations.ts'

test('getFileProperties returns clone-safe file details', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'file-explorer-properties-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const filePath = path.join(directory, 'example.txt')
  await writeFile(filePath, 'example')

  const properties = await getFileProperties(filePath)
  assert.equal(properties.name, 'example.txt')
  assert.equal(properties.size, 7)
  assert.equal(properties.mimetype, 'text/plain')
  assert.equal(properties.isDirectory, false)
  assert.equal(typeof structuredClone(properties).modifiedMs, 'number')
})

test('transferFiles copies, reports conflicts, overwrites, and moves', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'file-explorer-transfer-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const sourceDirectory = path.join(directory, 'source')
  const destinationDirectory = path.join(directory, 'destination')
  const source = path.join(sourceDirectory, 'example.txt')
  await Promise.all([mkdir(sourceDirectory), mkdir(destinationDirectory)])
  await writeFile(source, 'first')

  const copied = await transferFiles({
    sources: [source],
    destination: destinationDirectory,
    mode: 'copy',
  })
  assert.deepEqual(copied.conflicts, [])
  assert.equal(await readFile(path.join(destinationDirectory, 'example.txt'), 'utf8'), 'first')

  const conflict = await transferFiles({
    sources: [source],
    destination: destinationDirectory,
    mode: 'copy',
  })
  assert.equal(conflict.conflicts.length, 1)

  await writeFile(source, 'replacement')
  await transferFiles({
    sources: [source],
    destination: destinationDirectory,
    mode: 'copy',
    overwrite: true,
  })
  assert.equal(
    await readFile(path.join(destinationDirectory, 'example.txt'), 'utf8'),
    'replacement',
  )

  const movedSource = path.join(sourceDirectory, 'moved.txt')
  await writeFile(movedSource, 'moved')
  await transferFiles({ sources: [movedSource], destination: destinationDirectory, mode: 'move' })
  assert.equal(await readFile(path.join(destinationDirectory, 'moved.txt'), 'utf8'), 'moved')
  await assert.rejects(() => readFile(movedSource), { code: 'ENOENT' })
})

test('transferFiles rejects a file destination and recursive folder transfer', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'file-explorer-invalid-transfer-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const sourceDirectory = path.join(directory, 'source')
  const nestedDirectory = path.join(sourceDirectory, 'nested')
  const destinationFile = path.join(directory, 'destination.txt')
  await mkdir(nestedDirectory, { recursive: true })
  await writeFile(destinationFile, 'file')

  await assert.rejects(
    () => transferFiles({ sources: [sourceDirectory], destination: nestedDirectory, mode: 'copy' }),
    /cannot be transferred into itself/,
  )
  await assert.rejects(
    () => transferFiles({ sources: [sourceDirectory], destination: destinationFile, mode: 'copy' }),
    /destination must be a directory/,
  )
})
