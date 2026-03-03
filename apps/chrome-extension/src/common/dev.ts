import { EventName, portImpl } from './message'

export const log = (...input: unknown[]): void => {
  portImpl.sender.send(EventName.Console, input)
}

if (import.meta.env.DEV) {
  console.log = log
}
