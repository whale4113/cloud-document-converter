import { Second, waitFor } from './time'

export const waitForSelector = async (
  selector: string,
  options: {
    /**
     * @default 400
     */
    timeout?: number
  } = {},
) => waitForFunction(() => document.querySelector(selector) !== null, options)

export const waitForFunction = async (
  func: () => boolean | Promise<boolean>,
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

  const _func = () => Promise.resolve(func()).catch(() => false)

  while (!(await _func()) && !isTimeout()) {
    await waitFor(0.1 * Second)
  }

  if (timeoutId !== null) {
    clearTimeout(timeoutId)
  }

  if (isTimeout()) {
    throw new Error(`Timeout waiting for function: ${func.name}`)
  }
}
