export function isValidTimestamp(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function getFileSystemErrorMessage(error) {
  if (!error) return ''

  const path = error.path ? `“${error.path}”` : 'this location'

  switch (error.code) {
    case 'EACCES':
    case 'EPERM':
      return `Permission was denied while reading ${path}.`
    case 'ENOENT':
      return `${path} no longer exists.`
    case 'ENOTDIR':
      return `${path} is not a directory.`
    default:
      return `Unable to read ${path}.`
  }
}

// Filesystem requests can finish out of order. A small request guard keeps the
// Vue layout independent from the IPC implementation while ensuring that only
// the most recent navigation is allowed to update the visible directory.
export function createLatestRequestGuard() {
  let latestRequestId = 0

  return {
    begin() {
      return ++latestRequestId
    },
    isLatest(requestId) {
      return requestId === latestRequestId
    },
  }
}
