interface Ref<T> {
  current: T
}

interface WithSignalOptions {
  signal?: AbortSignal
  onAbort?: () => void
}

export const withSignal = async <T>(
  inner: (isAborted: () => boolean) => Promise<T>,
  options: WithSignalOptions = {},
): Promise<T | null> => {
  const { signal, onAbort } = options

  let ref: Ref<boolean> = { current: false }
  const handler = () => {
    ref.current = true

    signal?.removeEventListener('abort', handler)

    onAbort?.()
  }

  signal?.addEventListener('abort', handler)

  let result = null

  try {
    result = await inner(() => ref.current)
  } catch (error) {
    console.error(error)
  }

  signal?.removeEventListener('abort', handler)

  // @ts-expect-error remove reference
  ref = null

  return result
}

export class UniqueFileName {
  private usedNames = new Set<string>()
  private fileNameToPreId = new Map<string, number>()

  generate(originFileName: string): string {
    let newFileName = originFileName

    while (this.usedNames.has(newFileName)) {
      const startDotIndex = originFileName.lastIndexOf('.')

      const preId = this.fileNameToPreId.get(originFileName) ?? 0
      const id = preId + 1
      this.fileNameToPreId.set(originFileName, id)

      newFileName =
        startDotIndex === -1
          ? originFileName.concat(`-${id.toFixed()}`)
          : originFileName
              .slice(0, startDotIndex)
              .concat(`-${id.toFixed()}`)
              .concat(originFileName.slice(startDotIndex))
    }

    this.usedNames.add(newFileName)

    return newFileName
  }
}
