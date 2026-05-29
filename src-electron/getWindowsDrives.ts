import { exec } from "node:child_process";
import { statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

type WindowsDrivesCallback = (error: Error | null, drives: string[]) => void;

function getWindowsDrives(callback: WindowsDrivesCallback) {
  if (os.platform() !== "win32") {
    throw new Error("getWindowsDrives called but process.platform !== 'win32'");
  }

  const drives: string[] = [];

  // WMIC returns a table whose first row is headers. This demo keeps the drive
  // discovery simple and validates each candidate before showing it.
  exec("wmic LOGICALDISK LIST BRIEF", (error, stdout) => {
    if (error !== null) {
      callback(error, drives);
      return;
    }

    const parts = stdout.split("\n");
    if (parts.length > 0) {
      parts.splice(0, 1);

      for (const part of parts) {
        const drive = part.slice(0, 2);
        if (drive.length > 0 && drive[drive.length - 1] === ":") {
          try {
            // If stat fails, the drive is not accessible to this process.
            statSync(drive + path.sep);
            drives.push(drive);
          } catch (err) {
            console.error(`Cannot stat windows drive: ${drive}`, err);
          }
        }
      }
    }

    callback(null, drives);
  });
}

export default getWindowsDrives;
