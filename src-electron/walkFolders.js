const path = require('path')
const fs = require('fs')

/**
 * Generator function that lists all files in a folder
 * in a synchronous fashion
 *
 * @param {String} folder - folder to start with
 * @returns {IterableIterator<String>}
 */
function *walkFolders (folder) {
  try {
    const files = fs.readdirSync(folder)
    for (const file of files) {
      try {
        const pathToFile = path.join(folder, file)
        const stat = fs.statSync(pathToFile)

        const isDirectory = stat.isDirectory()
        const isSymbolicLink = stat.isSymbolicLink()

        const retVal = {
          path: pathToFile,
          name: file,
          isDir: isDirectory,
          isSymLink: isSymbolicLink,
          metadata: stat
        }
        yield retVal
      }
      catch (err) {
        const retVal = {
          path: path.join(folder, file),
          name: file,
          error: err
        }
        yield retVal
      }
    }
  }
  catch (err) {
    const retVal = {
      path: folder,
      error: err

    }
    yield retVal
  }
}

export default walkFolders
