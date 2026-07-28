import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const cleanTargets = ['node_modules', 'src-electron/node_modules', 'dist', '.quasar']

for (const relativeTarget of cleanTargets) {
  const target = path.resolve(projectRoot, relativeTarget)

  if (target === projectRoot || target.startsWith(projectRoot + path.sep) !== true) {
    throw new Error(`Refusing to clean path outside the project: ${target}`)
  }

  await rm(target, { force: true, recursive: true })
}
