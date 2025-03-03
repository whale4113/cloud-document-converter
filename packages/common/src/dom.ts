import { Second, waitFor } from './time'

export const waitForSelector = async (
  selector: string,
  options: {
    /**
     * @default 400
     */
    timeout?: number
  } = {},
) => {
  const { timeout = 0.4 * Second } = options

  let timeoutId: number | null = setTimeout(() => {
    timeoutId = null
  }, timeout)

  const isTimeout = () => timeoutId === null

  while (!document.querySelector(selector) && !isTimeout()) {
    await waitFor(0.1 * Second)
  }

  if (timeoutId !== null) {
    clearTimeout(timeoutId)
  }

  if (isTimeout()) {
    throw new Error(`Timeout waiting for selector: ${selector}`)
  }
}
