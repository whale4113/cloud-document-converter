export interface EventData<T> {
  flag: string
  payload: T
}

export const isEventData = (input: unknown): input is EventData<unknown> => {
  return (
    typeof input === 'object' &&
    input !== null &&
    'flag' in input &&
    typeof input.flag === 'string' &&
    'payload' in input
  )
}

export const isConsoleEventData = (
  input: unknown,
): input is EventData<unknown[]> => {
  return (
    isEventData(input) &&
    input.flag === 'console' &&
    Array.isArray(input.payload)
  )
}

export const log = (...input: unknown[]): void => {
  window.postMessage({
    flag: 'console',
    payload: input,
  })
}
