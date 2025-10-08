/* eslint-disable @typescript-eslint/consistent-indexed-object-style */
/* eslint-disable @typescript-eslint/no-explicit-any */

const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const normalizeKeys = (
  keys?: string | string[] | { [name: string]: any },
): string[] => {
  if (typeof keys === 'string') {
    return [keys]
  }

  if (Array.isArray(keys)) {
    return keys
  }

  if (keys) {
    return Object.keys(keys)
  }

  return []
}

class StorageImpl {
  constructor(public ns: string) {}

  /**
   * Gets one or more items from storage.
   *
   * @chrome-returns-extra since Chrome 95
   * @param keys A single key to get, list of keys to get, or a dictionary specifying default values (see description of the object). An empty list or object will return an empty result object. Pass in `null` to get the entire contents of storage.
   */
  async get(
    keys?: string | string[] | { [name: string]: any },
  ): Promise<{ [name: string]: any }> {
    await timeout(Math.random() * 1000)

    const storage = JSON.parse(localStorage.getItem(this.ns) ?? '{}') as {
      [name: string]: any
    }
    const normalizedKeys = normalizeKeys(keys)
    const items = normalizedKeys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = storage[key]

      return acc
    }, {})
    return items
  }

  /**
       * Sets multiple items.
       *
       * @chrome-returns-extra since Chrome 95
       * @param items

      An object which gives each key/value pair to update storage with. Any other key/value pairs in storage will not be affected.

      Primitive values such as numbers will serialize as expected. Values with a `typeof` `"object"` and `"function"` will typically serialize to `{}`, with the exception of `Array` (serializes as expected), `Date`, and `Regex` (serialize using their `String` representation).
       */
  async set(items: { [name: string]: any }): Promise<void> {
    await timeout(Math.random() * 1000)

    const originItems = JSON.parse(localStorage.getItem(this.ns) ?? '{}') as {
      [name: string]: any
    }

    localStorage.setItem(
      this.ns,
      JSON.stringify(Object.assign(originItems, items)),
    )
  }
}

export const storage: typeof chrome.storage = import.meta.env.DEV
  ? ({
      sync: new StorageImpl('sync'),
    } as unknown as typeof chrome.storage)
  : chrome.storage
