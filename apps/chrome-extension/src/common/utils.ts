import { toHast } from 'mdast-util-to-hast'
import { toHtml } from 'hast-util-to-html'
import type { InvalidTable } from '@dolphin/lark'
import { v4 as uuidv4 } from 'uuid'

interface Ref<T> {
  current: T
}

interface WithSignalOptions {
  signal?: AbortSignal
  onAbort?: () => void
}

export const withSignal = async <T>(
  inner: (isAborted: () => boolean) => Promise<T>,
  options: WithSignalOptions = {},
): Promise<T | null> => {
  const { signal, onAbort } = options

  let ref: Ref<boolean> = { current: false }
  const handler = () => {
    ref.current = true

    signal?.removeEventListener('abort', handler)

    onAbort?.()
  }

  signal?.addEventListener('abort', handler)

  let result = null

  try {
    result = await inner(() => ref.current)
  } catch (error) {
    console.error(error)
  }

  signal?.removeEventListener('abort', handler)

  // @ts-expect-error remove reference
  ref = null

  return result
}

export class UniqueFileName {
  private usedNames = new Set<string>()
  private fileNameToPreId = new Map<string, number>()

  generate(originFileName: string): string {
    let newFileName = originFileName

    while (this.usedNames.has(newFileName)) {
      const startDotIndex = originFileName.lastIndexOf('.')

      const preId = this.fileNameToPreId.get(originFileName) ?? 0
      const id = preId + 1
      this.fileNameToPreId.set(originFileName, id)

      newFileName =
        startDotIndex === -1
          ? originFileName.concat(`-${id.toFixed()}`)
          : originFileName
              .slice(0, startDotIndex)
              .concat(`-${id.toFixed()}`)
              .concat(originFileName.slice(startDotIndex))
    }

    this.usedNames.add(newFileName)

    return newFileName
  }

  generateWithUUID(originFileName: string): string {
    const startDotIndex = originFileName.lastIndexOf('.')
    const extension =
      startDotIndex === -1 ? '' : originFileName.slice(startDotIndex)
    const uuid = uuidv4()
    const newFileName = `${uuid}${extension}`

    // Ensure UUID-based names are also unique
    let finalFileName = newFileName
    let counter = 1
    while (this.usedNames.has(finalFileName)) {
      finalFileName = `${uuid}-${counter.toFixed()}${extension}`
      counter++
    }

    this.usedNames.add(finalFileName)

    return finalFileName
  }
}

export const transformInvalidTablesToHtml = (
  invalidTables: InvalidTable[],
): void => {
  invalidTables.forEach(invalidTable => {
    const invalidTableIndex = invalidTable.parent?.children.findIndex(
      child => child === invalidTable.inner,
    )
    if (invalidTableIndex !== undefined && invalidTableIndex !== -1) {
      invalidTable.parent?.children.splice(invalidTableIndex, 1, {
        type: 'html',
        value: toHtml(
          toHast({
            ...invalidTable.inner,
            // @ts-expect-error non-phrasing content can be supported.
            children: invalidTable.inner.children.map(row => ({
              ...row,
              children: row.children.map(cell => ({
                ...cell,
                children: cell.data?.invalidChildren ?? cell.children,
              })),
            })),
          }),
        ),
      })
    }
  })
}
