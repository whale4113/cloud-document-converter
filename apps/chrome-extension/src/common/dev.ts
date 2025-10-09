import { EventName, sender } from './message'

export const log = (...input: unknown[]): void => {
  sender.send(EventName.Console, input)
}

if (import.meta.env.DEV) {
  console.log = log
}
