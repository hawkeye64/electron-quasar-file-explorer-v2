import assert from 'node:assert/strict'
import test from 'node:test'

import { parseTrashItemCount } from '../src-electron/trashUtils.ts'

test('parseTrashItemCount accepts platform command output safely', () => {
  assert.equal(parseTrashItemCount('3\r\n'), 3)
  assert.equal(parseTrashItemCount('0'), 0)
  assert.equal(parseTrashItemCount('unexpected'), 0)
  assert.equal(parseTrashItemCount('-1'), 0)
})
