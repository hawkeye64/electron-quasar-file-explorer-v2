import assert from 'node:assert/strict'
import test from 'node:test'

import { parseWindowsDriveOutput } from '../src-electron/getWindowsDrives.ts'

test('parseWindowsDriveOutput normalizes PowerShell DriveInfo output', () => {
  assert.deepEqual(parseWindowsDriveOutput('C:\\\r\nD:\\\r\nc:\\\r\ninvalid\r\n'), ['C:', 'D:'])
})
