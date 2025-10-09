interface AsyncMessage extends PromiseWithResolvers<unknown> {
  id: number
  timer?: ReturnType<typeof setTimeout>
}

export enum MessageType {
  Request,
  Response,
}

interface Message {
  __dolphin__: true
  type: MessageType
  id: number
  from: string
  to: string
  async: boolean
  name: string
  data: unknown
}

interface PortOptions {
  /**
   * @default 10 * 1000
   */
  timeout?: number
}

let id = 0

const uuid = (): number => (id += 1)

const isMessage = (message: unknown): message is Message => {
  if (typeof message !== 'object' || message === null) {
    return false
  }

  const { __dolphin__ } = message as Record<string, unknown>

  return __dolphin__ === true
}

export class Port<
  Events extends Record<string, unknown> = Record<string, unknown>,
> {
  private queue: AsyncMessage[] = []
  private eventNameToHandlers = new Map<
    string,
    ((data: unknown) => unknown)[]
  >()

  constructor(
    public readonly from: string,
    public readonly to: string,
    public readonly options: PortOptions = {},
  ) {
    window.addEventListener('message', event => {
      if (event.source !== window) return

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data: message } = event

      if (
        isMessage(message) &&
        message.to === this.from &&
        message.from === this.to
      ) {
        const response = Promise.race(
          this.eventNameToHandlers
            .get(message.name)
            ?.map(handler => handler(message.data)) ?? [],
        )

        if (message.type === MessageType.Request && message.async) {
          response
            .then(data => {
              window.postMessage({
                ...message,
                type: MessageType.Response,
                async: false,
                from: this.from,
                to: this.to,
                data,
              })
            })
            .catch(() => undefined)
        }

        if (message.type === MessageType.Response && !message.async) {
          const pending: AsyncMessage[] = []
          const resolved: AsyncMessage[] = []

          this.queue.forEach(message => {
            if (message.id === message.id) {
              resolved.push(message)
            } else {
              pending.push(message)
            }
          })

          this.queue = pending

          resolved.forEach(asyncMessage => {
            clearTimeout(asyncMessage.timer)
            asyncMessage.resolve(message.data)
          })
        }
      }
    })
  }

  send<T extends keyof Events & string>(name: T, data: Events[T]): void {
    const message: Message = {
      __dolphin__: true,
      from: this.from,
      to: this.to,
      type: MessageType.Request,
      id: uuid(),
      async: false,
      name,
      data,
    }

    window.postMessage(message)
  }

  sendAsync<T extends keyof Events & string, U>(
    name: T,
    data: Events[T],
  ): Promise<U> {
    const { promise, resolve, reject } = Promise.withResolvers()

    const asyncMessage: AsyncMessage = {
      id: uuid(),
      promise,
      resolve,
      reject,
      timer: setTimeout(
        () => {
          asyncMessage.timer = undefined

          reject(new Error('timeout'))
        },
        this.options.timeout ?? 10 * 1000,
      ),
    }

    this.queue.push(asyncMessage)

    const message: Message = {
      __dolphin__: true,
      from: this.from,
      to: this.to,
      type: MessageType.Request,
      id: asyncMessage.id,
      async: true,
      name,
      data: data,
    }

    window.postMessage(message)

    return promise as Promise<U>
  }

  on<T extends keyof Events & string>(
    name: T,
    handler: (data: Events[T]) => unknown,
  ): void {
    const handlers = this.eventNameToHandlers.get(name)

    if (handlers) {
      handlers.push(handler as (data: unknown) => unknown)
    } else {
      this.eventNameToHandlers.set(name, [
        handler as (data: unknown) => unknown,
      ])
    }
  }

  off<T extends keyof Events & string>(
    name: T,
    handler?: (data: Events[T]) => unknown,
  ): void {
    const handlers = this.eventNameToHandlers.get(name)

    if (handlers) {
      if (handler) {
        handlers.splice(
          handlers.indexOf(handler as (data: unknown) => unknown) >>> 0,
          1,
        )
      } else {
        this.eventNameToHandlers.set(name, [])
      }
    }
  }
}
