import { toHast } from 'mdast-util-to-hast'
import { toHtml } from 'hast-util-to-html'
import {
  Docx,
  type TableWithParent,
  type mdast,
  type hast,
  BlockType,
} from '@dolphin/lark'
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
  invalidTables: TableWithParent[],
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
              children: invalidTable.inner.children.map(row => ({
                ...row,
                children: row.children.map(cell => ({
                  ...cell,
                  children: cell.data?.invalidChildren ?? cell.children,
                })),
              })),
            } as mdast.Table,
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

export const transformGridToHtml = (
  grids: TableWithParent[],
  options: { allowDangerousHtml: boolean } = { allowDangerousHtml: false },
): void => {
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

  for (const grid of grids) {
    const gridIndex = grid.parent?.children.findIndex(
      child => child === grid.inner,
    )
    if (gridIndex !== undefined && gridIndex !== -1) {
      const hast = toHast(
        grid.inner.data?.invalid
          ? ({
              ...grid.inner,
              children: grid.inner.children.map(row => ({
                ...row,
                children: row.children.map(cell => ({
                  ...cell,
                  children: cell.data?.invalidChildren ?? cell.children,
                })),
              })),
            } as mdast.Table)
          : grid.inner,
        {
          allowDangerousHtml: options.allowDangerousHtml,
        },
      )

      const colWidths = extractColumnWidths(grid.inner)
      if (colWidths) {
        const colgroup: hast.Element = {
          type: 'element',
          tagName: 'colgroup',
          properties: {},
          children: colWidths.map(width => ({
            type: 'element',
            tagName: 'col',
            properties: {
              style: `width: ${width}`,
            },
            children: [],
          })),
        }
        if (hast.type === 'element') {
          hast.children = ([colgroup] as hast.ElementContent[]).concat(
            hast.children,
          )
        }
      }

      grid.parent?.children.splice(gridIndex, 1, {
        type: 'html',
        value: toHtml(hast, {
          allowDangerousHtml: options.allowDangerousHtml,
        }),
      })
    }
  }
}

const readMergeInfoFromDom = (
  cellBlockIds: number[],
): { rowSpan: number; colSpan: number }[] | null => {
  const result: { rowSpan: number; colSpan: number }[] = []
  let hasAnyMerge = false
  let missingCount = 0

  for (const id of cellBlockIds) {
    const td = document.querySelector<HTMLTableCellElement>(
      `td[data-block-id="${String(id)}"]`,
    )

    if (!td) {
      missingCount++
      result.push({ rowSpan: 1, colSpan: 1 })
      continue
    }

    if (td.style.display === 'none') {
      result.push({ rowSpan: 0, colSpan: 0 })
      continue
    }

    const rowSpan = td.rowSpan
    const colSpan = td.colSpan
    result.push({ rowSpan, colSpan })
    if (rowSpan > 1 || colSpan > 1) hasAnyMerge = true
  }

  if (missingCount === cellBlockIds.length) return null
  return hasAnyMerge ? result : null
}

interface TableDataWithBlockInfo {
  recordId?: string
  cellBlockIds?: number[]
  mergeInfo?: { rowSpan: number; colSpan: number }[]
  type?: string
}

export const resolveMergedTablesFromDom = async (
  tableWithParents: TableWithParent[],
): Promise<void> => {
  for (const entry of tableWithParents) {
    const table = entry.inner
    const data = table.data as TableDataWithBlockInfo | undefined
    if (data?.mergeInfo) continue
    if (data?.type !== BlockType.TABLE) continue

    const cellBlockIds = data.cellBlockIds
    if (!cellBlockIds || cellBlockIds.length === 0) continue

    let mergeInfo = readMergeInfoFromDom(cellBlockIds)

    if (!mergeInfo && data.recordId) {
      try {
        await waitForFunction(
          () =>
            Docx.locateBlockWithRecordId(data.recordId ?? '').then(
              isSuccess =>
                isSuccess &&
                document.querySelector(
                  `td[data-block-id="${String(cellBlockIds[0])}"]`,
                ) !== null,
            ),
          { timeout: 3 * Second },
        )
        mergeInfo = readMergeInfoFromDom(cellBlockIds)
      } catch {
        continue
      }
    }

    if (!mergeInfo) continue

    table.data = { ...table.data, mergeInfo }

    const allCells = table.children.flatMap(row => row.children)
    if (mergeInfo.length === allCells.length) {
      allCells.forEach((cell, i) => {
        cell.data = {
          ...cell.data,
          rowSpan: mergeInfo[i].rowSpan,
          colSpan: mergeInfo[i].colSpan,
        }
      })
    }
  }
}

const cellContentToMarkdown = (cell: mdast.TableCell): string => {
  const children = cell.data?.invalidChildren ?? cell.children
  if (children.length === 0) return ''

  const root: mdast.Root = {
    type: 'root',
    children: children.map(child => {
      if (
        child.type === 'text' ||
        child.type === 'emphasis' ||
        child.type === 'strong' ||
        child.type === 'inlineCode' ||
        child.type === 'delete' ||
        child.type === 'link' ||
        child.type === 'image' ||
        child.type === 'html' ||
        child.type === 'break'
      ) {
        return { type: 'paragraph', children: [child] } as mdast.Paragraph
      }
      return child as mdast.RootContent
    }),
  }

  return Docx.stringify(root).trim()
}

export const transformMergedTablesToHtml = (
  mergedTables: TableWithParent[],
): void => {
  for (const entry of mergedTables) {
    const tableIndex = entry.parent?.children.findIndex(
      child => child === entry.inner,
    )
    if (tableIndex === undefined || tableIndex === -1) continue

    const table = entry.inner
    const rows = table.children

    const lines: string[] = ['<table>']

    for (const row of rows) {
      lines.push('<tr>')

      for (const cell of row.children) {
        const rowSpan = cell.data?.rowSpan ?? 1
        const colSpan = cell.data?.colSpan ?? 1

        if (rowSpan === 0 || colSpan === 0) continue

        const attrs: string[] = []
        if (rowSpan > 1) attrs.push(`rowspan="${String(rowSpan)}"`)
        if (colSpan > 1) attrs.push(`colspan="${String(colSpan)}"`)

        const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : ''
        const content = cellContentToMarkdown(cell)
        const isMultiline = content.includes('\n')

        if (isMultiline) {
          lines.push(`<td${attrStr}>`)
          lines.push('')
          lines.push(content)
          lines.push('')
          lines.push('</td>')
        } else {
          lines.push(`<td${attrStr}>${content}</td>`)
        }
      }

      lines.push('</tr>')
    }

    lines.push('</table>')

    entry.parent?.children.splice(tableIndex, 1, {
      type: 'html',
      value: lines.join('\n'),
    })
  }
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

export interface TransformTableWithParentsOptions {
  transformGridToHtml: boolean
  transformInvalidTablesToHtml: boolean
}

export const transformTableWithParents = (
  tableWithParents: TableWithParent[],
  options: TransformTableWithParentsOptions,
): void => {
  transformMergedTablesToHtml(
    tableWithParents.filter(item => item.inner.data?.mergeInfo),
  )

  if (options.transformGridToHtml) {
    transformGridToHtml(
      tableWithParents.filter(item => item.inner.data?.type === BlockType.GRID),
      {
        allowDangerousHtml: true,
      },
    )
  }

  if (options.transformInvalidTablesToHtml) {
    transformInvalidTablesToHtml(
      tableWithParents.filter(
        item =>
          item.inner.data?.invalid &&
          (options.transformGridToHtml
            ? item.inner.data.type !== BlockType.GRID
            : true),
      ),
      {
        allowDangerousHtml: true,
      },
    )
  }
}
