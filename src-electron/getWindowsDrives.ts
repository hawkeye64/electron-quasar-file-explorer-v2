import { execFile } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// PowerShell emits one drive root per line. Parsing is intentionally separate
// from process execution so this platform-specific boundary can be tested on
// Linux and macOS CI as ordinary string handling.
export function parseWindowsDriveOutput(output: string): string[] {
  return [
    ...new Set(
      output
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => /^[a-z]:[\\/]?$/i.test(entry))
        .map((entry) => entry.slice(0, 2).toUpperCase()),
    ),
  ].sort()
}

export default async function getWindowsDrives(): Promise<string[]> {
  if (os.platform() !== 'win32') {
    throw new Error("getWindowsDrives called but process.platform !== 'win32'")
  }

  // WMIC is no longer present on many current Windows installations.
  // DriveInfo is part of .NET and execFile passes fixed arguments directly,
  // avoiding both the deprecated dependency and command-shell interpolation.
  const { stdout } = await execFileAsync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '[System.IO.DriveInfo]::GetDrives() | ForEach-Object { $_.Name }',
    ],
    {
      windowsHide: true,
      timeout: 10_000,
    },
  )

  const drives = parseWindowsDriveOutput(stdout)

  if (drives.length === 0) {
    throw new Error('Windows did not report any filesystem drives')
  }

  return drives
}
