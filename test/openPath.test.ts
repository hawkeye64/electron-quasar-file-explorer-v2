import assert from 'node:assert/strict'
import test from 'node:test'

import { openPathWithoutWaitingForApplication } from '../src-electron/openPath.ts'

test('returns the operating system launcher result when it settles promptly', async () => {
  assert.equal(await openPathWithoutWaitingForApplication('/file', async () => '', 20), '')
  assert.equal(
    await openPathWithoutWaitingForApplication('/file', async () => 'No application found', 20),
    'No application found',
  )
})

test('does not wait for a delayed external application result', async () => {
  let rejectOpen: ((error: Error) => void) | undefined
  const delayedResult = new Promise<string>((_resolve, reject) => {
    rejectOpen = reject
  })

  assert.equal(await openPathWithoutWaitingForApplication('/file', () => delayedResult, 0), '')

  rejectOpen?.(new Error('The external application exited after launch'))
  await new Promise((resolve) => setImmediate(resolve))
})

test('preserves prompt launcher exceptions', async () => {
  await assert.rejects(
    openPathWithoutWaitingForApplication(
      '/file',
      async () => {
        throw new Error('Unable to invoke launcher')
      },
      20,
    ),
    /Unable to invoke launcher/,
  )
})
