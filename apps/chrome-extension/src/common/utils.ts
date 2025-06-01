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
