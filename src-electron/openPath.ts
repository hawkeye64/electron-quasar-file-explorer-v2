const launchAcknowledgementTimeout = 1500

export async function openPathWithoutWaitingForApplication(
  filePath: string,
  openPath: (filePath: string) => Promise<string>,
  timeout = launchAcknowledgementTimeout,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      openPath(filePath),
      new Promise<string>((resolve) => {
        timeoutId = setTimeout(() => resolve(''), timeout)
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}
