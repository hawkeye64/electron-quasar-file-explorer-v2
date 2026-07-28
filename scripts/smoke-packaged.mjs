import { spawn } from 'node:child_process'
import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const packagedRoot = path.join(projectRoot, 'dist', 'electron', 'Packaged')
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))

async function findPlatformDirectory(prefix) {
  const entries = await readdir(packagedRoot, { withFileTypes: true })
  const entry = entries.find(
    (candidate) => candidate.isDirectory() && candidate.name.startsWith(prefix),
  )

  if (entry === undefined) {
    throw new Error(`Unable to find a ${prefix} build under ${packagedRoot}`)
  }

  return path.join(packagedRoot, entry.name)
}

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {}
  }

  throw new Error(`Unable to find a packaged executable:\n${candidates.join('\n')}`)
}

async function getPackagedExecutable() {
  if (process.platform === 'linux') {
    const unpackedDir = await findPlatformDirectory('linux')
    return await firstExistingPath([
      path.join(unpackedDir, packageJson.name),
      path.join(unpackedDir, packageJson.productName),
    ])
  }

  if (process.platform === 'win32') {
    const unpackedDir = await findPlatformDirectory('win')
    return await firstExistingPath([
      path.join(unpackedDir, `${packageJson.productName}.exe`),
      path.join(unpackedDir, `${packageJson.name}.exe`),
    ])
  }

  if (process.platform === 'darwin') {
    const unpackedDir = await findPlatformDirectory('mac')
    return await firstExistingPath([
      path.join(
        unpackedDir,
        `${packageJson.productName}.app`,
        'Contents',
        'MacOS',
        packageJson.productName,
      ),
      path.join(unpackedDir, `${packageJson.name}.app`, 'Contents', 'MacOS', packageJson.name),
    ])
  }

  throw new Error(`Packaged application smoke tests do not support ${process.platform}`)
}

const executable = await getPackagedExecutable()
const disableSandbox = process.env.FILE_EXPLORER_SMOKE_NO_SANDBOX === 'true'

if (disableSandbox === true && process.platform !== 'linux') {
  throw new Error('The smoke-test sandbox exception is supported only on Linux')
}

const needsVirtualDisplay =
  process.platform === 'linux' &&
  process.env.DISPLAY === undefined &&
  process.env.WAYLAND_DISPLAY === undefined
const executableArgs = disableSandbox === true ? ['--no-sandbox'] : []
const command = needsVirtualDisplay ? 'xvfb-run' : executable
const args = needsVirtualDisplay ? ['-a', executable, ...executableArgs] : executableArgs

console.info(`Launching packaged application smoke test: ${executable}`)

await new Promise((resolve, reject) => {
  const childEnv = {
    ...process.env,
    FILE_EXPLORER_SMOKE_TEST: '1',
  }

  // Some editor terminals export this variable so Electron-based tooling can
  // act like Node. Remove it because this test must launch the real desktop app.
  delete childEnv.ELECTRON_RUN_AS_NODE

  const child = spawn(command, args, {
    env: childEnv,
    stdio: 'inherit',
  })
  const timeout = setTimeout(() => {
    child.kill()
    reject(new Error('Packaged application smoke test timed out after 30 seconds'))
  }, 30_000)

  child.on('error', (error) => {
    clearTimeout(timeout)
    reject(error)
  })

  child.on('exit', (code, signal) => {
    clearTimeout(timeout)

    if (signal !== null) {
      reject(new Error(`Packaged application exited from signal ${signal}`))
    } else if (code !== 0) {
      reject(new Error(`Packaged application exited with code ${code}`))
    } else {
      resolve()
    }
  })
})
