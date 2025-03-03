export const Second = 1000

export const waitFor = (timeout = 0.4 * Second): Promise<void> =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
