import { Second, waitFor } from './time'

export const waitForSelector = async (
  selector: string,
  options: {
    /**
     * @default 400
     */
    timeout?: number
  } = {},
): Promise<void> =>
  waitForFunction(() => document.querySelector(selector) !== null, options)

export const waitForFunction = async (
  func: () => boolean | Promise<boolean>,
  options: {
    /**
     * @default 400
     */
    timeout?: number
  } = {},
): Promise<void> => {
  const { timeout = 0.4 * Second } = options

  let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timeoutId = null
  }, timeout)

  const isTimeout = (): boolean => timeoutId === null

  const _func = () => Promise.resolve(func()).catch(() => false)

  while (!(await _func()) && !isTimeout()) {
    await waitFor(0.1 * Second)
  }

  if (isTimeout()) {
    throw new Error(`Timeout waiting for function: ${func.name}`)
  } else {
    clearTimeout(timeoutId)
  }
}
