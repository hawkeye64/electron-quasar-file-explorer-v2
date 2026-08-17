import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { shell } from 'electron'

import { parseTrashItemCount } from './trashUtils'

const execFileAsync = promisify(execFile)

function getLinuxTrashPath() {
  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
  return path.join(dataHome, 'Trash', 'files')
}

export async function getTrashItemCount(): Promise<number> {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '(New-Object -ComObject Shell.Application).Namespace(10).Items().Count',
    ])
    return parseTrashItemCount(stdout)
  }

  if (process.platform === 'darwin') {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "Finder" to count items of trash',
    ])
    return parseTrashItemCount(stdout)
  }

  try {
    return (await readdir(getLinuxTrashPath())).length
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw error
  }
}

export async function openTrash(): Promise<string> {
  if (process.platform === 'win32') {
    await shell.openExternal('shell:RecycleBinFolder')
    return ''
  }

  if (process.platform === 'darwin') {
    await execFileAsync('osascript', ['-e', 'tell application "Finder" to open trash'])
    return ''
  }

  // GIO owns the freedesktop trash virtual filesystem. Opening its URI lets
  // the desktop file manager aggregate trash across mounted volumes instead
  // of exposing only the implementation directory under XDG_DATA_HOME.
  await execFileAsync('gio', ['open', 'trash:///'])
  return ''
}
