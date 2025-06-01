export const Second = 1000

export const Minute: number = 60 * Second

export const waitFor = (timeout: number = 0.4 * Second): Promise<void> =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
