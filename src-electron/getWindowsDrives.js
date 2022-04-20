const exec = require('child_process').exec
const os = require('os')
const fse = require('fs-extra')
const path = require('path')

function getWindowsDrives (callback) {
  if (!callback) {
    throw new Error('getWindowsDrives called with no callback')
  }
  if (os.platform() !== 'win32') {
    throw new Error('getWindowsDrives called but process.plaform !== \'win32\'')
  }
  const drives = []
  exec('wmic LOGICALDISK LIST BRIEF', (error, stdout) => {
    if (error) {
      callback(error, drives)
      return
    }
    // get the drives
    const parts = stdout.split('\n')
    if (parts.length) {
      // first part is titles; get rid of it
      parts.splice(0, 1)
      for (let index = 0; index < parts.length; ++index) {
        const drive = parts[ index ].slice(0, 2)
        if (drive.length && drive[ drive.length - 1 ] === ':') {
          try {
            // if stat fails, it'll throw an exception
            fse.statSync(drive + path.sep)

            // add the drive to array
            drives.push(drive)
          }
          catch (e) {
            console.error(`Cannot stat windows drive: ${ drive }`, e)
          }
        }
      }
      callback(null, drives)
    }
  })
}

export default getWindowsDrives
