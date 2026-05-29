import path from "node:path";
import fse from "fs-extra";

/**
 * Lists one folder level at a time. The QTree requests deeper levels lazily,
 * so the app stays responsive on large directory trees.
 *
 * @param {String} folder - folder to start with
 * @returns {IterableIterator<Object>}
 */
function* walkFolders(folder) {
  try {
    const files = fse.readdirSync(folder);
    for (const file of files) {
      try {
        const pathToFile = path.join(folder, file);
        const stat = fse.statSync(pathToFile);

        const isDirectory = stat.isDirectory();
        const isSymbolicLink = stat.isSymbolicLink();

        const retVal = {
          path: pathToFile,
          name: file,
          isDir: isDirectory,
          isSymLink: isSymbolicLink,
          metadata: stat,
        };
        yield retVal;
      } catch (err) {
        // Yield per-file errors instead of failing the whole folder scan. The
        // renderer can skip unreadable entries and still show the rest.
        const retVal = {
          path: path.join(folder, file),
          name: file,
          error: err,
        };
        yield retVal;
      }
    }
  } catch (err) {
    // Folder-level errors are returned as data for the same reason: a bad path
    // should not crash the main process.
    const retVal = {
      path: folder,
      error: err,
    };
    yield retVal;
  }
}

export default walkFolders;
