import type * as mdast from 'mdast'
import chunk from 'lodash-es/chunk'
import {
  toBlob as svgToBlob,
  imageDataToBlob,
  compare,
  isDefined,
  waitForFunction,
  OneHundred,
  Second,
} from '@dolphin/common'
import { toMarkdown, type Options } from 'mdast-util-to-markdown'
import { gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTaskListItemToMarkdown } from 'mdast-util-gfm-task-list-item'
import { gfmTableToMarkdown } from 'mdast-util-gfm-table'
import { mathToMarkdown, type InlineMath } from 'mdast-util-math'
import { PageMain, User } from './env'
import {
  isBlockquoteContent,
  isParent,
  isPhrasingContent,
  isRootContent,
  isTableCell,
  isListItemContent,
} from './utils/mdast'
import { resolveFileDownloadUrl } from './file'
import isString from 'lodash-es/isString'
import escape from 'lodash-es/escape'

declare module 'mdast' {
  interface ImageData {
    name?: string
    token?: string
    fetchSources?: () => Promise<ImageSources | null>
    fetchBlob?: () => Promise<Blob | null>
  }

  interface ListItemData {
    seq?: number | 'auto'
  }

  interface LinkData {
    name?: string
    fetchFile?: (init?: RequestInit) => Promise<Response>
  }

  interface TableData {
    invalid?: boolean
  }

  interface TableCellData {
    invalidChildren?: mdast.Nodes[]
  }

  interface InlineCodeData {
    mentionUserId?: string
    parentBlockRecordId?: string
  }
}

/**
 * @see https://open.feishu.cn/document/client-docs/docs-add-on/06-data-structure/BlockType
 */
export enum BlockType {
  PAGE = 'page',
  BITABLE = 'bitable',
  CALLOUT = 'callout',
  CHAT_CARD = 'chat_card',
  CODE = 'code',
  DIAGRAM = 'diagram',
  DIVIDER = 'divider',
  FILE = 'file',
  GRID = 'grid',
  GRID_COLUMN = 'grid_column',
  HEADING1 = 'heading1',
  HEADING2 = 'heading2',
  HEADING3 = 'heading3',
  HEADING4 = 'heading4',
  HEADING5 = 'heading5',
  HEADING6 = 'heading6',
  HEADING7 = 'heading7',
  HEADING8 = 'heading8',
  HEADING9 = 'heading9',
  IFRAME = 'iframe',
  IMAGE = 'image',
  ISV = 'isv',
  MINDNOTE = 'mindnote',
  BULLET = 'bullet',
  ORDERED = 'ordered',
  TODO = 'todo',
  QUOTE = 'quote',
  QUOTE_CONTAINER = 'quote_container',
  SHEET = 'sheet',
  TABLE = 'table',
  CELL = 'table_cell',
  TEXT = 'text',
  VIEW = 'view',
  SYNCED_SOURCE = 'synced_source',
  WHITEBOARD = 'whiteboard',
  FALLBACK = 'fallback',
}

interface Attributes {
  fixEnter?: string

  italic?: string
  bold?: string
  strikethrough?: string

  inlineCode?: string
  equation?: string
  textHighlight?: string
  textHighlightBackground?: string
  'inline-component'?: string

  link?: string
  mentionUserId?: string

  [attrName: string]: unknown
}

interface Operation {
  attributes?: Attributes
  insert: string
}

interface BlockZoneState {
  allText: string
  content: {
    ops: Operation[]
  }
  _node: HTMLElement
}

interface BlockSnapshot {
  type: BlockType | 'pending'
}

interface Block<T extends Blocks = Blocks> {
  id: number
  type: BlockType
  zoneState?: BlockZoneState
  record?: { id: string }
  snapshot: BlockSnapshot
  children: T[]
}

export interface PageBlock extends Block {
  type: BlockType.PAGE
}

interface DividerBlock extends Block {
  type: BlockType.DIVIDER
}

interface HeadingBlock extends Block<TextBlock> {
  type:
    | BlockType.HEADING1
    | BlockType.HEADING2
    | BlockType.HEADING3
    | BlockType.HEADING4
    | BlockType.HEADING5
    | BlockType.HEADING6
    | BlockType.HEADING7
    | BlockType.HEADING8
    | BlockType.HEADING9
  depth: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  snapshot: {
    type:
      | BlockType.HEADING1
      | BlockType.HEADING2
      | BlockType.HEADING3
      | BlockType.HEADING4
      | BlockType.HEADING5
      | BlockType.HEADING6
      | BlockType.HEADING7
      | BlockType.HEADING8
      | BlockType.HEADING9
    /**
     * sequence value
     */
    seq?: string
    seq_level?: string
  }
}

interface CodeBlock extends Block<TextBlock> {
  type: BlockType.CODE
  language: string
}

interface QuoteContainerBlock extends Block {
  type: BlockType.QUOTE_CONTAINER
}

interface BulletBlock extends Block {
  type: BlockType.BULLET
}

interface OrderedBlock extends Block<TextBlock> {
  type: BlockType.ORDERED
  snapshot: {
    type: BlockType.ORDERED
    seq: string
  }
}

interface TodoBlock extends Block {
  type: BlockType.TODO
  snapshot: {
    type: BlockType.TODO
    done?: boolean
  }
}

interface TextBlock extends Block {
  type: BlockType.TEXT
}

interface Caption {
  text: {
    initialAttributedTexts: {
      text: { 0: string } | null
    }
  }
}

interface ImageBlockData {
  token: string
  width: number
  height: number
  mimeType: string
  name: string
  caption?: Caption
}

interface ImageSources {
  originSrc: string
  src: string
}

interface ImageBlock extends Block {
  type: BlockType.IMAGE
  snapshot: {
    type: BlockType.IMAGE
    image: ImageBlockData
  }
  imageManager: {
    fetch: (
      image: {
        token: string
        isHD: boolean
        fuzzy: boolean
        width?: number
        height?: number
      },
      options: unknown,
      callback: (sources: ImageSources) => void,
    ) => Promise<void>
  }
}

interface TableBlock extends Block<TableCellBlock> {
  type: BlockType.TABLE
  snapshot: {
    type: BlockType.TABLE
    rows_id: string[]
    columns_id: string[]
  }
}

interface TableCellBlock extends Block {
  type: BlockType.CELL
}

interface Grid extends Block<GridColumn> {
  type: BlockType.GRID
}

interface GridColumn extends Block {
  type: BlockType.GRID_COLUMN
}

interface Callout extends Block {
  type: BlockType.CALLOUT
}

interface SyncedSource extends Block {
  type: BlockType.SYNCED_SOURCE
}

interface ImageDataWrapper {
  data: ImageData
  release: () => void
}

interface RatioApp {
  ratioAppProxy: {
    getOriginImageDataByNodeId: (
      i: 24,
      o: [''],
      r: false,
      n: 2,
    ) => Promise<ImageDataWrapper | null>
  }
}

interface WhiteboardBlock {
  isolateEnv: {
    hasRatioApp: () => boolean
    getRatioApp: () => RatioApp
  }
}

interface Whiteboard extends Block {
  type: BlockType.WHITEBOARD
  whiteboardBlock?: WhiteboardBlock
  snapshot: {
    type: BlockType.WHITEBOARD
    caption?: Caption
  }
}

interface BlockView {
  getSvg: () => SVGElement | null
}

interface BlockManager {
  getBlockViewByBlockId: (blockId: number) => BlockView | null
}

interface DiagramBlock extends Block {
  type: BlockType.DIAGRAM
  blockManager?: BlockManager
  snapshot: {
    type: BlockType.DIAGRAM
  }
}

interface View extends Block<File> {
  type: BlockType.VIEW
}

interface File extends Block {
  type: BlockType.FILE
  snapshot: {
    type: BlockType.FILE
    file: {
      name: string
      token: string
    }
  }
}

enum ISVBlockTypeId {
  /**
   * Text Drawing
   */
  TextDrawing = 'blk_631fefbbae02400430b8f9f4',

  /**
   * Timeline
   */
  Timeline = 'blk_6358a421bca0001c22536e4c',
  /**
   * Other ISV block (type inference)
   */
  _Other = '',
}

interface OtherISVBlock extends Block {
  type: BlockType.ISV
  snapshot: {
    type: BlockType.ISV
    /**
     * ISV block type id
     */
    block_type_id: ISVBlockTypeId._Other
    /**
     * ISV block data
     */
    data: unknown
  }
}

interface TextDrawingBlock extends Block {
  type: BlockType.ISV
  snapshot: {
    type: BlockType.ISV
    /**
     * ISV block type id
     */
    block_type_id: ISVBlockTypeId.TextDrawing
    /**
     * ISV block data
     */
    data: {
      /**
       * Mermaid code
       */
      data: string
    }
  }
}

interface Timeline {
  time: string
  title: string
  text?: string
}

interface TimelineBlock extends Block {
  type: BlockType.ISV
  snapshot: {
    type: BlockType.ISV
    /**
     * ISV block type id
     */
    block_type_id: ISVBlockTypeId.Timeline
    /**
     * ISV block data
     */
    data: {
      /**
       * Mermaid code
       */
      items: Timeline[]
    }
  }
}

type ISVBlocks = TextDrawingBlock | TimelineBlock | OtherISVBlock

interface NotSupportedBlock extends Block {
  type:
    | BlockType.QUOTE
    | BlockType.BITABLE
    | BlockType.CHAT_CARD
    | BlockType.MINDNOTE
    | BlockType.SHEET
    | BlockType.FALLBACK
  children: []
}

type Blocks =
  | PageBlock
  | DividerBlock
  | HeadingBlock
  | CodeBlock
  | QuoteContainerBlock
  | BulletBlock
  | OrderedBlock
  | TodoBlock
  | TextBlock
  | ImageBlock
  | TableBlock
  | TableCellBlock
  | Grid
  | GridColumn
  | Callout
  | SyncedSource
  | Whiteboard
  | DiagramBlock
  | View
  | File
  | IframeBlock
  | ISVBlocks
  | NotSupportedBlock

interface IframeBlock extends Block {
  type: BlockType.IFRAME
  snapshot: {
    type: BlockType.IFRAME
    iframe: Partial<{
      height: number
      component: Partial<{
        url: string
      }>
    }>
  }
}

const iframeToHTML = (iframe: IframeBlock): mdast.Html | null => {
  const { height = 4 * OneHundred, component = {} } = iframe.snapshot.iframe
  const { url } = component

  if (!url) {
    return null
  }

  const html = `<iframe src="${url}" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-downloads" allowfullscreen allow="encrypted-media; fullscreen; autoplay" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" style="width: 100%; min-height: ${height.toFixed()}px; border-radius: 8px;"></iframe>`

  return {
    type: 'html',
    value: html,
  }
}

/**
 * @description Removes an enter from the end of this string if it exists.
 */
const trimEndEnter = (input: string) =>
  input.length > 0 && input.endsWith('\n') ? input.slice(0, -1) : input

const chunkBy = <T>(
  items: T[],
  isEqual: (current: T, next: T) => boolean,
): T[][] => {
  const chunks: T[][] = []
  let index = 0

  while (index < items.length) {
    let nextIndex = index + 1
    while (
      nextIndex < items.length &&
      isEqual(items[index], items[nextIndex])
    ) {
      nextIndex++
    }

    chunks.push(items.slice(index, nextIndex))

    index = nextIndex
  }

  return chunks
}

export const mergeListItems = <T extends mdast.Nodes>(
  nodes: T[],
): (mdast.List | T)[] =>
  chunkBy(nodes, (current, next) => {
    const listItemType = (listItem: mdast.ListItem) => {
      if (typeof listItem.checked === 'boolean') {
        return BlockType.TODO
      }

      if (
        typeof listItem.data?.seq === 'number' ||
        listItem.data?.seq === 'auto'
      ) {
        return BlockType.ORDERED
      }

      return BlockType.BULLET
    }

    const isEqualOrderedListItem = (
      node: mdast.ListItem,
      other: mdast.ListItem,
    ) => {
      const seq = node.data?.seq
      const otherSeq = other.data?.seq

      if (!seq || !otherSeq) return false

      if (seq === 'auto') {
        return otherSeq === 'auto'
      }

      return otherSeq === 'auto' || seq + 1 === otherSeq
    }

    const isEqualListItem = (node: mdast.ListItem, other: mdast.ListItem) => {
      const type = listItemType(node)
      const otherType = listItemType(other)

      if (type === otherType) {
        return type === BlockType.ORDERED
          ? isEqualOrderedListItem(node, other)
          : true
      }

      return false
    }

    return (
      current.type === 'listItem' &&
      next.type === 'listItem' &&
      isEqualListItem(current, next)
    )
  }).map(nodes => {
    const node = nodes[0]

    if (node.type === 'listItem') {
      const list: mdast.List = {
        type: 'list',
        ...(typeof node.data?.seq === 'number'
          ? {
              ordered: true,
              start: node.data.seq,
            }
          : null),
        children: nodes as mdast.ListItem[],
      }
      return list
    }

    return node
  })

export const mergePhrasingContents = (
  nodes: mdast.PhrasingContent[],
): mdast.PhrasingContent[] =>
  chunkBy(nodes, (current, next) => {
    if (current.type === 'link' && next.type === 'link') {
      return current.url === next.url
    }

    if (
      current.type === 'emphasis' ||
      current.type === 'strong' ||
      current.type === 'delete' ||
      current.type === 'text' ||
      (current.type === 'inlineCode' && !current.data?.mentionUserId)
    ) {
      return current.type === next.type
    }

    return false
  }).map(nodes => {
    const node = nodes.reduce((pre, cur) => {
      if ('children' in pre && 'children' in cur) {
        return {
          ...pre,
          ...cur,
          children: pre.children.concat(cur.children),
        }
      }

      if ('value' in pre && 'value' in cur) {
        return {
          ...pre,
          ...cur,
          value: pre.value.concat(cur.value),
        }
      }

      return pre
    })

    if ('children' in node) {
      node.children = mergePhrasingContents(node.children)
    }

    return node
  })

export interface transformOperationsToPhrasingContentsOptions {
  highlight?: boolean
}

export const transformOperationsToPhrasingContents = (
  ops: Operation[],
  options: transformOperationsToPhrasingContentsOptions = {},
): { contents: mdast.PhrasingContent[]; mentionUsers: mdast.InlineCode[] } => {
  const mentionUsers: mdast.InlineCode[] = []

  const operations = ops
    .filter(operation => {
      if (
        isDefined(operation.attributes) &&
        isDefined(operation.attributes.fixEnter)
      ) {
        return false
      }

      if (!isDefined(operation.attributes) && operation.insert === '\n') {
        return false
      }

      return true
    })
    .map(op => {
      if (isDefined(op.attributes) && op.attributes['inline-component']) {
        try {
          const inlineComponent = JSON.parse(
            op.attributes['inline-component'],
          ) as
            | {
                type: 'mention_doc'
                data: {
                  raw_url: string
                  title: string
                }
              }
            | {
                type: 'user'
                data: {
                  uid: string
                }
              }
            | {
                type: 'string'
                data: unknown
              }
          if (inlineComponent.type === 'mention_doc') {
            return {
              attributes: {
                ...op.attributes,
                link: inlineComponent.data.raw_url,
              },
              insert: op.insert + inlineComponent.data.title,
            } as Operation
          } else if (inlineComponent.type === 'user') {
            return {
              attributes: {
                ...op.attributes,
                mentionUserId: inlineComponent.data.uid,
              },
              insert: '',
            }
          }

          return op
        } catch {
          return op
        }
      }

      return op
    })

  let indexToMarks = operations.map(({ attributes = {} }) => {
    type SupportAttrName = 'italic' | 'bold' | 'strikethrough' | 'link'

    const isSupportAttr = (attr: string): attr is SupportAttrName =>
      attr === 'italic' ||
      attr === 'bold' ||
      attr === 'strikethrough' ||
      attr === 'link'

    const attrNameToNodeType = (
      attr: SupportAttrName,
    ): 'emphasis' | 'strong' | 'delete' | 'link' => {
      switch (attr) {
        case 'italic':
          return 'emphasis'
        case 'bold':
          return 'strong'
        case 'strikethrough':
          return 'delete'
        case 'link':
          return 'link'
        default:
          return undefined as never
      }
    }

    const marks = Object.keys(attributes)
      .filter(isSupportAttr)
      .map(attrNameToNodeType)

    return marks
  })

  indexToMarks = indexToMarks.map((marks, index) => {
    const markToPriority = new Map(marks.map(mark => [mark, 0]))

    marks.forEach(mark => {
      let priority = 0
      let start = index
      while (start >= 0 && indexToMarks[start].includes(mark)) {
        priority += operations[start].insert.length
        start--
      }
      let end = index + 1
      while (end < indexToMarks.length && indexToMarks[end].includes(mark)) {
        priority += operations[end].insert.length
        end++
      }
      markToPriority.set(mark, priority)
    })

    return marks.sort((a, b) =>
      compare(markToPriority.get(a) ?? 0, markToPriority.get(b) ?? 0),
    )
  })

  const createLiteral = (
    op: Operation,
  ): mdast.Text | mdast.InlineCode | InlineMath | mdast.Html => {
    const { attributes, insert } = op
    const {
      inlineCode,
      equation,
      textHighlight,
      textHighlightBackground,
      mentionUserId,
    } = attributes ?? {}

    if (mentionUserId) {
      const mentionUser: mdast.InlineCode = {
        type: 'inlineCode',
        value: insert,
        data: {
          mentionUserId,
        },
      }

      mentionUsers.push(mentionUser)

      return mentionUser
    }

    if (inlineCode) {
      return {
        type: 'inlineCode',
        value: insert,
      }
    }

    if (equation && equation.length > 0) {
      return {
        type: 'inlineMath',
        value: trimEndEnter(equation),
      }
    }

    if (options.highlight && (textHighlight || textHighlightBackground)) {
      return {
        type: 'html',
        value: `<span style="color: ${textHighlight ?? 'inherit'}; background-color: ${textHighlightBackground ?? 'inherit'}">${escape(insert)}</span>`,
      }
    }

    return {
      type: 'text',
      value: insert,
    }
  }

  const nodes = indexToMarks.map((marks, index) => {
    const op = operations[index]

    let node: mdast.PhrasingContent = createLiteral(op)
    for (const mark of marks) {
      node =
        mark === 'link'
          ? {
              type: mark,
              url: decodeURIComponent(op.attributes?.link ?? ''),
              children: [node],
            }
          : {
              type: mark,
              children: [node],
            }
    }

    return node
  })

  const contents = mergePhrasingContents(nodes)

  return {
    contents,
    mentionUsers,
  }
}

const fetchImageSources = (imageBlock: ImageBlock) =>
  new Promise<ImageSources>((resolve, reject) => {
    const {
      imageManager,
      snapshot: {
        image: { token },
      },
    } = imageBlock

    imageManager
      .fetch({ token, isHD: true, fuzzy: false }, {}, resolve)
      .catch(reject)
  })

const whiteboardToImageData = async (
  whiteboard: Whiteboard,
): Promise<ImageDataWrapper | null> => {
  if (!whiteboard.whiteboardBlock) return null

  const { isolateEnv } = whiteboard.whiteboardBlock

  if (!isolateEnv.hasRatioApp()) return null

  const rationApp = isolateEnv.getRatioApp()

  const imageData = await rationApp.ratioAppProxy.getOriginImageDataByNodeId(
    24,
    [''],
    false,
    2,
  )

  if (!imageData) return null

  return imageData
}

const diagramToSVGElement = (diagram: DiagramBlock): SVGElement | null => {
  if (!diagram.blockManager) return null

  const blockView = diagram.blockManager.getBlockViewByBlockId(diagram.id)
  if (!blockView) return null

  const svgElement = blockView.getSvg()
  if (!svgElement) return null

  return svgElement
}

const evaluateAlt = (caption?: Caption) =>
  trimEndEnter(caption?.text.initialAttributedTexts.text?.[0] ?? '')

type Mutate<T extends Block> = T extends PageBlock
  ? mdast.Root
  : T extends DividerBlock
    ? mdast.ThematicBreak
    : T extends HeadingBlock
      ? mdast.Heading
      : T extends CodeBlock
        ? mdast.Code
        : T extends QuoteContainerBlock | Callout
          ? mdast.Blockquote
          : T extends BulletBlock | OrderedBlock | TodoBlock
            ? mdast.ListItem
            : T extends TextBlock
              ? mdast.Text
              : T extends TableBlock | Grid
                ? mdast.Table
                : T extends TableCellBlock | GridColumn
                  ? mdast.TableCell
                  : T extends Whiteboard | DiagramBlock
                    ? mdast.Image
                    : T extends View
                      ? mdast.Paragraph
                      : T extends File
                        ? mdast.Link
                        : T extends IframeBlock
                          ? mdast.Html
                          : T extends TextDrawingBlock | TimelineBlock
                            ? mdast.Code
                            : null

interface TransformerOptions {
  /**
   * Enable convert whiteboard to image.
   * @default false
   */
  whiteboard?: boolean
  /**
   * Enable convert diagram to image.
   * @default false
   */
  diagram?: boolean
  /**
   * Enable convert file to resource link.
   * @default false
   */
  file?: boolean
  /**
   * Enable convert text highlight to html.
   * @default false
   */
  highlight?: boolean
  /**
   * Enable flat grid.
   * @default false
   */
  flatGrid?: boolean
  /**
   * Locate block with record id.
   */
  locateBlockWithRecordId?: (recordId: string) => Promise<boolean>
}

export interface InvalidTable {
  inner: mdast.Table
  parent: mdast.Parent | null
}

interface TransformResult<T> {
  root: T
  images: mdast.Image[]
  invalidTables: InvalidTable[]
  files: mdast.Link[]
  mentionUsers: mdast.InlineCode[]
}

export class Transformer {
  private parent: mdast.Parent | null = null
  private images: mdast.Image[] = []
  private mentionUsers: mdast.InlineCode[] = []
  private invalidTables: InvalidTable[] = []
  /**
   * Resource link to file.
   */
  private files: mdast.Link[] = []
  /**
   * heading sequence state
   */
  private sequences: (string | undefined)[] = []

  constructor(
    public options: TransformerOptions = {
      whiteboard: false,
      diagram: false,
      file: false,
      highlight: false,
      flatGrid: false,
    },
  ) {}

  private normalizeImage(image: mdast.Image): mdast.Image | mdast.Paragraph {
    return this.parent?.type === 'tableCell'
      ? image
      : { type: 'paragraph', children: [image] }
  }

  private transformParentBlock<T extends Blocks>(
    block: T,
    evaluateNode: (block: T) => Mutate<T>,
    transformChildren: (
      children: mdast.Nodes[],
    ) => Mutate<T> extends mdast.Parent ? Mutate<T>['children'] : never,
  ) {
    const previousParent = this.parent

    const currentParent = evaluateNode(block)
    if (!currentParent || !isParent(currentParent)) {
      return currentParent
    }
    this.parent = currentParent

    const flatChildren = (children: Blocks[]): Blocks[] =>
      children
        .map(child => {
          if (child.type === BlockType.GRID && this.options.flatGrid) {
            return flatChildren(
              child.children.map(column => column.children).flat(1),
            )
          }

          if (
            child.type === BlockType.HEADING1 ||
            child.type === BlockType.HEADING2 ||
            child.type === BlockType.HEADING3 ||
            child.type === BlockType.HEADING4 ||
            child.type === BlockType.HEADING5 ||
            child.type === BlockType.HEADING6 ||
            child.type === BlockType.HEADING7 ||
            child.type === BlockType.HEADING8 ||
            child.type === BlockType.HEADING9 ||
            child.type === BlockType.TEXT
          ) {
            return [child, ...flatChildren(child.children)]
          }

          if (child.type === BlockType.SYNCED_SOURCE) {
            return flatChildren(child.children)
          }

          return child
        })
        .flat(1)

    currentParent.children = transformChildren(
      flatChildren(block.children).map(this._transform).filter(isDefined),
    )

    this.parent = previousParent

    return currentParent
  }

  private _transform = (block: Blocks): mdast.Nodes | null => {
    const createChildrenFromOps = () => {
      const { contents, mentionUsers } = transformOperationsToPhrasingContents(
        block.zoneState?.content.ops ?? [],
        { highlight: this.options.highlight },
      )

      mentionUsers.forEach(user => {
        if (user.data) {
          user.data.parentBlockRecordId = block.record?.id
        }
      })

      this.mentionUsers = this.mentionUsers.concat(mentionUsers)

      return contents
    }

    switch (block.type) {
      case BlockType.PAGE: {
        return this.transformParentBlock(
          block,
          () => ({
            type: 'root',
            children: [],
          }),
          nodes => mergeListItems(nodes).filter(isRootContent),
        )
      }
      case BlockType.DIVIDER: {
        const thematicBreak: mdast.ThematicBreak = {
          type: 'thematicBreak',
        }
        return thematicBreak
      }
      case BlockType.HEADING1:
      case BlockType.HEADING2:
      case BlockType.HEADING3:
      case BlockType.HEADING4:
      case BlockType.HEADING5:
      case BlockType.HEADING6: {
        const depth = Number(block.type.at(-1)) as mdast.Heading['depth']

        const heading: mdast.Heading = {
          type: 'heading',
          depth,
          children: createChildrenFromOps(),
        }

        if (typeof block.snapshot.seq === 'string') {
          // reset sequences state
          this.sequences = this.sequences.slice(0, depth)

          // automatic incremental sequence number
          if (block.snapshot.seq === 'auto') {
            const previousSequenceSibling = this.sequences[depth - 1] ?? '0'
            this.sequences[depth - 1] = String(
              parseInt(previousSequenceSibling, 10) + 1,
            )
          } else {
            this.sequences[depth - 1] = block.snapshot.seq
          }

          const sequences =
            block.snapshot.seq_level === 'auto'
              ? this.sequences.slice(0, depth).filter(isString)
              : [block.snapshot.seq]

          heading.children.unshift({
            type: 'text',
            value: sequences.join('.') + (sequences.length === 1 ? '. ' : ' '),
          })
        }

        return heading
      }
      case BlockType.CODE: {
        const code: mdast.Code = {
          type: 'code',
          lang: block.language.toLocaleLowerCase(),
          value: trimEndEnter(block.zoneState?.allText ?? ''),
        }
        return code
      }
      case BlockType.QUOTE_CONTAINER:
      case BlockType.CALLOUT: {
        return this.transformParentBlock(
          block,
          () => ({
            type: 'blockquote',
            children: [],
          }),
          nodes => mergeListItems(nodes).filter(isBlockquoteContent),
        )
      }
      case BlockType.BULLET:
      case BlockType.ORDERED:
      case BlockType.TODO: {
        const paragraph: mdast.Paragraph = {
          type: 'paragraph',
          children: createChildrenFromOps(),
        }
        return this.transformParentBlock(
          block,
          () => ({
            type: 'listItem',
            children: [],
            ...(block.type === BlockType.TODO
              ? { checked: Boolean(block.snapshot.done) }
              : null),
            ...(block.type === BlockType.ORDERED
              ? {
                  data: {
                    seq: /[0-9]+/.test(block.snapshot.seq)
                      ? Number(block.snapshot.seq)
                      : 'auto',
                  },
                }
              : null),
          }),
          nodes => [
            paragraph,
            ...mergeListItems(nodes).filter(isListItemContent),
          ],
        )
      }
      case BlockType.TEXT:
      case BlockType.HEADING7:
      case BlockType.HEADING8:
      case BlockType.HEADING9: {
        const paragraph: mdast.Paragraph = {
          type: 'paragraph',
          children: createChildrenFromOps(),
        }
        return paragraph
      }
      case BlockType.IMAGE: {
        const imageBlockToImage = (block: ImageBlock) => {
          const { caption, name, token } = block.snapshot.image
          const image: mdast.Image = {
            type: 'image',
            url: '',
            alt: evaluateAlt(caption),
            data: {
              name,
              token,
              fetchSources: () => fetchImageSources(block),
            },
          }
          return image
        }

        const image: mdast.Image = imageBlockToImage(block)

        this.images.push(image)

        return this.normalizeImage(image)
      }
      case BlockType.WHITEBOARD: {
        if (!this.options.whiteboard) return null

        const whiteboardToImage = (whiteboard: Whiteboard): mdast.Image => {
          const image: mdast.Image = {
            type: 'image',
            url: '',
            alt: evaluateAlt(whiteboard.snapshot.caption),
            data: {
              fetchBlob: async () => {
                try {
                  const {
                    locateBlockWithRecordId = () => Promise.resolve(false),
                  } = this.options

                  await waitForFunction(
                    () =>
                      locateBlockWithRecordId(whiteboard.record?.id ?? '').then(
                        isSuccess =>
                          isSuccess && whiteboard.whiteboardBlock !== undefined,
                      ),
                    {
                      timeout: 3 * Second,
                    },
                  )
                } catch (error) {
                  console.error(error)
                }

                const imageDataWrapper = await whiteboardToImageData(whiteboard)
                if (!imageDataWrapper) return null

                return await imageDataToBlob(imageDataWrapper.data, {
                  onDispose: imageDataWrapper.release,
                })
              },
            },
          }
          return image
        }

        const image: mdast.Image = whiteboardToImage(block)

        this.images.push(image)

        return this.normalizeImage(image)
      }
      case BlockType.DIAGRAM: {
        if (!this.options.diagram) return null

        const diagramToImage = (diagram: DiagramBlock): mdast.Image => {
          const image: mdast.Image = {
            type: 'image',
            url: '',
            data: {
              fetchBlob: async () => {
                try {
                  const {
                    locateBlockWithRecordId = () => Promise.resolve(false),
                  } = this.options

                  await waitForFunction(
                    () =>
                      locateBlockWithRecordId(diagram.record?.id ?? '').then(
                        isSuccess => isSuccess,
                      ),
                    {
                      timeout: 3 * Second,
                    },
                  )
                } catch (error) {
                  console.error(error)
                }

                const svgElement = diagramToSVGElement(diagram)
                if (!svgElement) return null

                return await svgToBlob(svgElement)
              },
            },
          }
          return image
        }

        const image: mdast.Image = diagramToImage(block)

        this.images.push(image)

        return this.normalizeImage(image)
      }
      case BlockType.TABLE:
      case BlockType.GRID: {
        let table: mdast.Table = { type: 'table', children: [] }

        table = this.transformParentBlock(
          block,
          () => table,
          nodes => {
            const tableCells = nodes.filter(isTableCell)

            table.data = {
              invalid: tableCells.some(cell => cell.data?.invalidChildren),
            }

            return (
              block.type === BlockType.GRID
                ? [tableCells]
                : chunk(tableCells, block.snapshot.columns_id.length)
            ).map(tableCells => ({
              type: 'tableRow',
              children: tableCells,
            }))
          },
        )

        if (table.data?.invalid) {
          this.invalidTables.push({
            inner: table,
            parent: this.parent,
          })
        }

        return table
      }
      case BlockType.CELL:
      case BlockType.GRID_COLUMN: {
        const cell: mdast.TableCell = { type: 'tableCell', children: [] }

        return this.transformParentBlock(
          block,
          () => cell,
          nodes => {
            const mergedNodes = mergeListItems(nodes)
            const normalizedNodes: mdast.Nodes[] = []

            for (let i = 0; i < mergedNodes.length; i++) {
              const node = mergedNodes[i]
              const nextNode = mergedNodes.at(i + 1)

              if (node.type === 'paragraph') {
                normalizedNodes.push(...node.children)
              } else {
                normalizedNodes.push(node as mdast.PhrasingContent)
              }

              if (
                nextNode &&
                node.type === 'paragraph' &&
                nextNode.type === 'paragraph'
              ) {
                normalizedNodes.push({ type: 'html', value: '<br />' })
              }
            }

            if (normalizedNodes.every(isPhrasingContent)) {
              return normalizedNodes
            }

            cell.data = {
              invalidChildren: normalizedNodes,
            }

            return normalizedNodes.filter(isPhrasingContent)
          },
        )
      }
      case BlockType.VIEW: {
        if (!this.options.file) return null

        const paragraph: mdast.Paragraph = this.transformParentBlock(
          block,
          () => ({
            type: 'paragraph',
            children: [],
          }),
          nodes => nodes.filter(isPhrasingContent),
        )
        return paragraph
      }
      case BlockType.FILE: {
        if (!this.options.file) return null

        const { name, token } = block.snapshot.file

        const link: mdast.Link = {
          type: 'link',
          url: '',
          children: [{ type: 'text', value: name }],
          data: {
            name,
            fetchFile: (init?: RequestInit) =>
              fetch(
                resolveFileDownloadUrl({
                  token,
                  recordId: block.record?.id ?? '',
                }),
                {
                  method: 'Get',
                  credentials: 'include',
                  ...init,
                },
              ),
          },
        }

        this.files.push(link)

        return link
      }
      case BlockType.IFRAME: {
        return iframeToHTML(block)
      }
      case BlockType.ISV: {
        if (block.snapshot.block_type_id === ISVBlockTypeId.TextDrawing) {
          const code: mdast.Code = {
            type: 'code',
            lang: 'mermaid',
            value: block.snapshot.data.data,
          }

          return code
        } else if (block.snapshot.block_type_id === ISVBlockTypeId.Timeline) {
          const code: mdast.Code = {
            type: 'code',
            lang: 'mermaid',
            value: this.generateMermaidTimeline(block.snapshot.data.items),
          }

          return code
        }

        return null
      }
      default:
        return null
    }
  }

  generateMermaidTimeline(items: Timeline[]): string {
    let chart = 'timeline\n'

    items.forEach(item => {
      const cleanTitle = (item.title || '').replace(/:/g, '：')
      const time = item.time || ''

      if (item.text) {
        const cleanText = item.text.replace(/\n/g, '<br>')
        chart += `    ${time} : ${cleanTitle} : ${cleanText}\n`
      } else {
        chart += `    ${time} : ${cleanTitle}\n`
      }
    })

    return chart
  }

  transform<T extends Blocks>(block: T): TransformResult<Mutate<T>> {
    const node = this._transform(block) as Mutate<T>

    const result: TransformResult<Mutate<T>> = {
      root: node,
      images: this.images,
      invalidTables: this.invalidTables,
      files: this.files,
      mentionUsers: this.mentionUsers,
    }

    this.parent = null

    this.images = []
    this.invalidTables = []
    this.files = []
    this.mentionUsers = []

    this.sequences = []

    return result
  }
}

export class Docx {
  static stringify(root: mdast.Root, options?: Options): string {
    return toMarkdown(root, {
      ...options,
      extensions: [
        gfmStrikethroughToMarkdown(),
        gfmTaskListItemToMarkdown(),
        gfmTableToMarkdown(),
        mathToMarkdown({
          singleDollarTextMath: false,
        }),
        ...(options?.extensions ?? []),
      ],
    })
  }

  static async locateBlockWithRecordId(recordId: string): Promise<boolean> {
    try {
      if (!PageMain) {
        return false
      }

      return await PageMain.locateBlockWithRecordIdImpl(recordId)
    } catch (error) {
      console.error(error)
    }

    return false
  }

  get rootBlock(): PageBlock | null {
    if (!PageMain) {
      return null
    }

    return PageMain.blockManager.rootBlockModel
  }

  get language(): 'zh' | 'en' {
    return User?.language === 'zh' ? 'zh' : 'en'
  }

  get pageTitle(): string | undefined {
    if (!this.rootBlock?.zoneState) return undefined

    return trimEndEnter(this.rootBlock.zoneState.allText)
  }

  get container(): HTMLDivElement | null {
    const container = document.querySelector<HTMLDivElement>(
      '#mainBox .bear-web-x-container',
    )

    return container
  }

  isReady(
    options: {
      /**
       * @default false
       */
      checkWhiteboard?: boolean
    } = {},
  ): boolean {
    const { checkWhiteboard = false } = options

    return (
      !!this.rootBlock &&
      this.rootBlock.children.every(block => {
        const prerequisite = block.snapshot.type !== 'pending'

        const isWhiteboard = (block: Blocks): boolean =>
          block.type === BlockType.WHITEBOARD ||
          (block.type === BlockType.FALLBACK &&
            block.snapshot.type === BlockType.WHITEBOARD)

        if (checkWhiteboard && isWhiteboard(block)) {
          return prerequisite && block.type !== BlockType.FALLBACK
        }

        return prerequisite
      })
    )
  }

  scrollTo(options: ScrollToOptions): void {
    const container = this.container
    if (container) {
      const {
        left,
        top = container.scrollHeight,
        behavior = 'smooth',
      } = options

      container.scrollTo({
        left,
        top: Math.min(top, container.scrollHeight),
        behavior,
      })
    }
  }

  intoMarkdownAST(
    transformerOptions: TransformerOptions = {},
  ): TransformResult<mdast.Root> {
    if (!this.rootBlock) {
      return {
        root: { type: 'root', children: [] },
        images: [],
        invalidTables: [],
        files: [],
        mentionUsers: [],
      }
    }

    const transformer = new Transformer({
      locateBlockWithRecordId: recordId =>
        Docx.locateBlockWithRecordId(recordId),
      ...transformerOptions,
    })

    return transformer.transform(this.rootBlock)
  }
}

export const docx: Docx = new Docx()
