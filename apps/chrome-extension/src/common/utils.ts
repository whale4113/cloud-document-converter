import { toHast } from 'mdast-util-to-hast'
import { toHtml } from 'hast-util-to-html'
import { Docx, type InvalidTable, type mdast } from '@dolphin/lark'
import { v4 as uuidv4 } from 'uuid'
import { Second, waitForFunction } from '@dolphin/common'

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
  options: { allowDangerousHtml: boolean } = { allowDangerousHtml: false },
): void => {
  invalidTables.forEach(invalidTable => {
    const invalidTableIndex = invalidTable.parent?.children.findIndex(
      child => child === invalidTable.inner,
    )
    if (invalidTableIndex !== undefined && invalidTableIndex !== -1) {
      invalidTable.parent?.children.splice(invalidTableIndex, 1, {
        type: 'html',
        value: toHtml(
          toHast(
            {
              ...invalidTable.inner,
              // @ts-expect-error non-phrasing content can be supported.
              children: invalidTable.inner.children.map(row => ({
                ...row,
                children: row.children.map(cell => ({
                  ...cell,
                  children: cell.data?.invalidChildren ?? cell.children,
                })),
              })),
            },
            {
              allowDangerousHtml: options.allowDangerousHtml,
            },
          ),
          {
            allowDangerousHtml: options.allowDangerousHtml,
          },
        ),
      })
    }
  })
}

const isParent = (node: mdast.Node): node is mdast.Parent =>
  'children' in node && Array.isArray(node.children)

export const transformGridToHtml = (
  root: mdast.Root,
  options: { allowDangerousHtml: boolean } = { allowDangerousHtml: false },
): void => {
  interface HastNode {
    type: string
    tagName?: string
    properties?: Record<string, unknown>
    children?: HastNode[]
  }

  const findTableElement = (node: HastNode): HastNode | null => {
    if (node.type === 'element' && node.tagName === 'table') return node
    if (!node.children) return null
    for (const child of node.children) {
      const found = findTableElement(child)
      if (found) return found
    }
    return null
  }

  const normalizeWidthValue = (value: string): string => {
    if (value.includes('%') || /[a-z]/i.test(value)) return value
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return value
    return numeric <= 1 ? `${String(numeric * 100)}%` : `${String(numeric)}px`
  }

  const extractColumnWidths = (table: mdast.Table): string[] | null => {
    const colWidths = (table.data as { colWidths?: number[] } | undefined)
      ?.colWidths
    if (!colWidths || colWidths.length === 0) return null
    if (table.children.length === 0) return null
    const columnCount = table.children[0].children.length
    if (colWidths.length !== columnCount) return null
    return colWidths.map(value => normalizeWidthValue(String(value)))
  }

  const visit = (node: mdast.Parent): void => {
    for (let index = 0; index < node.children.length; index++) {
      const child = node.children[index]
      const tableType = (child.data as { type?: string } | undefined)?.type
      if (child.type === 'table' && tableType === 'grid') {
        const colWidths = extractColumnWidths(child)
        const hast = toHast(child, {
          allowDangerousHtml: options.allowDangerousHtml,
        }) as HastNode
        const tableElement = findTableElement(hast)
        if (tableElement && colWidths) {
          const colgroup: HastNode = {
            type: 'element',
            tagName: 'colgroup',
            children: colWidths.map(width => ({
              type: 'element',
              tagName: 'col',
              properties: {
                style: `width: ${width}`,
              },
              children: [],
            })),
          }
          tableElement.children = [colgroup, ...(tableElement.children ?? [])]
        }
        node.children.splice(index, 1, {
          type: 'html',
          value: toHtml(hast as unknown as Parameters<typeof toHtml>[0], {
            allowDangerousHtml: options.allowDangerousHtml,
          }),
        })
        continue
      }

      if (isParent(child)) {
        visit(child)
      }
    }
  }

  visit(root)
}

export const transformMentionUsers = async (
  mentionUsers: mdast.InlineCode[],
): Promise<void> => {
  for (const user of mentionUsers) {
    if (user.data?.parentBlockRecordId && user.data.mentionUserId) {
      await waitForFunction(
        () =>
          Docx.locateBlockWithRecordId(
            user.data?.parentBlockRecordId ?? '',
          ).then(
            isSuccess =>
              isSuccess &&
              document.querySelector(
                `a[data-token="${user.data?.mentionUserId ?? ''}"]`,
              ) !== null,
          ),
        {
          timeout: 3 * Second,
        },
      )

      const el: HTMLElement | null = document.querySelector(
        `a[data-token="${user.data.mentionUserId}"]`,
      )

      if (el?.innerText) {
        user.value = '@' + el.innerText
      }
    }
  }
}
