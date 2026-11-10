/**
 * Rebuild the Batch Download tree from a Feishu/Lark wiki.
 *
 * Three pure-ish steps, each testable without a browser:
 *  1. walkWiki    – depth-first walk of the wiki's sidebar via the web app's
 *                   own tree API (the caller supplies an authenticated fetch).
 *  2. buildTree   – turn the walk into the Batch Download tree shape.
 *  3. diffTrees / carryOverStatuses – preview what changed against the current
 *                   tree, and keep finished work when the new tree is applied.
 *
 * This file deliberately has no imports so it can be unit tested under Node.
 * The node shapes below are structurally identical to FileNode/FolderNode in
 * components/FileTreeNode.vue.
 */

/** Feishu `obj_type` of a docx document. Other types (e.g. 12 = uploaded file) can't be extracted. */
export const DOC_OBJ_TYPE = 22

export interface HierarchyFile {
  id: string
  name: string
  type: 'file'
  url: string
  status: 'pending' | 'loading' | 'success' | 'failed' | 'skipped'
  progress?: number
  error?: string
  tabId?: number
}

export interface HierarchyFolder {
  id: string
  name: string
  type: 'folder'
  children: (HierarchyFile | HierarchyFolder)[]
}

export type HierarchyNode = HierarchyFile | HierarchyFolder

export interface WikiNode {
  token: string
  title: string
  /** 1 = direct child of the walk root. */
  depth: number
  objType: number
}

export interface WikiWalk {
  origin: string
  rootToken: string
  rootTitle: string
  spaceId: string
  nodes: WikiNode[]
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/** Feishu/Lark domains; mirrors `host_permissions` in manifest.json. */
const LARK_DOMAINS = [
  'feishu.cn',
  'feishu.net',
  'larksuite.com',
  'feishu-pre.net',
  'larkoffice.com',
  'larkenterprise.com',
]

/** Subdomain of a Feishu/Lark domain, as `https://*.<domain>/*` matches. */
export function isLarkHost(hostname: string): boolean {
  return LARK_DOMAINS.some(d => hostname.endsWith(`.${d}`))
}

/** Parse `https://<tenant>.feishu.cn/wiki/<token>` (query/hash ignored). */
export function parseWikiUrl(
  url: string,
): { origin: string; token: string } | null {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:' || !isLarkHost(u.hostname)) return null
    const m = /^\/wiki\/([A-Za-z0-9]+)\/?$/.exec(u.pathname)
    return m?.[1] ? { origin: u.origin, token: m[1] } : null
  } catch {
    return null
  }
}

/** Stable identity of a page across trees: wiki token if any, else origin+path. */
export function pageKey(url: string): string {
  const wiki = parseWikiUrl(url)
  if (wiki) return wiki.token
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return url
  }
}

// ---------------------------------------------------------------------------
// 1. Walk
// ---------------------------------------------------------------------------

export type FetchJson = (url: string) => Promise<unknown>

export interface WalkOptions {
  fetchJson: FetchJson
  sleep?: (ms: number) => Promise<void>
  /** Delay before every request. Bursts come back as empty JSON. */
  throttleMs?: number
  /** Attempts per request before the whole walk fails. */
  attempts?: number
  /** Backoff grows linearly: backoffMs * attempt. */
  backoffMs?: number
  signal?: AbortSignal
  onProgress?: (pagesFound: number) => void
}

export class WikiApiError extends Error {
  readonly code?: number
  constructor(message: string, code?: number) {
    super(message)
    this.name = 'WikiApiError'
    this.code = code
  }
}

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

interface ApiEnvelope {
  code?: number
  msg?: string
  data?: unknown
}

async function callApi(
  url: string,
  opts: WalkOptions,
  attempts = opts.attempts ?? 6,
): Promise<unknown> {
  const sleep = opts.sleep ?? defaultSleep
  const backoff = opts.backoffMs ?? 1500
  let last: WikiApiError = new WikiApiError(`No response from ${url}`)
  for (let a = 0; a < attempts; a++) {
    if (opts.signal?.aborted) throw new WikiApiError('Walk cancelled')
    await sleep(opts.throttleMs ?? 200)
    try {
      const body = (await opts.fetchJson(url)) as ApiEnvelope | null
      if (body && body.code === 0 && body.data) return body.data
      last = new WikiApiError(
        `Feishu API answered code ${String(body?.code ?? 'none')}${body?.msg ? ` (${body.msg})` : ''}`,
        body?.code,
      )
    } catch (e) {
      last = new WikiApiError(e instanceof Error ? e.message : String(e))
    }
    if (a + 1 < attempts) await sleep(backoff * (a + 1))
  }
  throw last
}

interface ApiNode {
  wiki_token: string
  title?: string
  space_id?: string | number
  sort_id?: number
  has_child?: boolean
  obj_type?: number
}

interface InfoData {
  tree?: { nodes?: Partial<Record<string, ApiNode>> }
}

type ChildData = Partial<Record<string, ApiNode[]>>

/** Look up one page's title and space. Throws if Feishu refuses it. */
export async function getWikiInfo(
  origin: string,
  token: string,
  opts: WalkOptions,
  attempts?: number,
): Promise<{ title: string; spaceId: string; hasChild: boolean }> {
  const data = (await callApi(
    `${origin}/space/api/wiki/v2/tree/get_info/?wiki_token=${encodeURIComponent(token)}&with_space=true&with_perm=false`,
    opts,
    attempts,
  )) as InfoData
  const node = data.tree?.nodes?.[token]
  if (!node) throw new WikiApiError(`Feishu returned no page for ${token}`)
  return {
    title: (node.title ?? '').trim(),
    spaceId: String(node.space_id ?? ''),
    hasChild: Boolean(node.has_child),
  }
}

/**
 * Walk every page under `rootUrl`, in sidebar order. Fails as a whole on any
 * request that keeps failing, so a partial walk can never replace a tree.
 */
export async function walkWiki(
  rootUrl: string,
  opts: WalkOptions,
): Promise<WikiWalk> {
  const parsed = parseWikiUrl(rootUrl)
  if (!parsed) throw new WikiApiError(`Not a wiki page URL: ${rootUrl}`)
  const { origin, token: rootToken } = parsed
  const info = await getWikiInfo(origin, rootToken, opts)
  const nodes: WikiNode[] = []

  const walk = async (token: string, depth: number) => {
    const data = (await callApi(
      `${origin}/space/api/wiki/v2/tree/get_node_child/?space_id=${encodeURIComponent(info.spaceId)}&wiki_token=${encodeURIComponent(token)}&with_perm=false`,
      opts,
    )) as ChildData
    const kids = [...(data[token] ?? [])].sort(
      (a, b) => (a.sort_id ?? 0) - (b.sort_id ?? 0),
    )
    for (const k of kids) {
      nodes.push({
        token: k.wiki_token,
        title: (k.title ?? '').trim(),
        depth,
        objType: k.obj_type ?? DOC_OBJ_TYPE,
      })
      opts.onProgress?.(nodes.length)
      if (k.has_child) await walk(k.wiki_token, depth + 1)
    }
  }
  if (info.hasChild) await walk(rootToken, 1)

  return {
    origin,
    rootToken,
    rootTitle: info.title,
    spaceId: info.spaceId,
    nodes,
  }
}

// ---------------------------------------------------------------------------
// 2. Build
// ---------------------------------------------------------------------------

export interface LeadPage {
  token: string
  title: string
}

export interface BuildOptions {
  /** Pages outside the walk, placed before the root page. */
  leads?: LeadPage[]
  /** token -> title overrides (e.g. a typo in Feishu itself). */
  renames?: Record<string, string>
  /** Keep only top-level sections whose title starts with one of these. Numbering is unaffected. */
  only?: string[]
  /** Prefix names with "NNN - " so the ZIP keeps sidebar order. Default true. */
  numbering?: boolean
  /** Digits in NNN. Default: enough for every page, at least 3. */
  width?: number
}

export interface BuildResult {
  tree: HierarchyFolder
  /** Non-document pages dropped together with their subtrees. */
  dropped: { token: string; title: string; url: string; objType: number }[]
  /** Rename keys that matched no page. */
  unusedRenames: string[]
  /** Structural problems; a non-empty list means the tree must not be applied. */
  problems: string[]
  fileCount: number
  folderCount: number
}

export function buildTree(
  walk: WikiWalk,
  opts: BuildOptions = {},
): BuildResult {
  const renames = new Map(Object.entries(opts.renames ?? {}))
  const title = (token: string, t: string) => {
    const r = renames.get(token)
    if (r !== undefined) {
      renames.delete(token)
      return r.trim()
    }
    return t.trim()
  }
  const url = (token: string) => `${walk.origin}/wiki/${token}`

  const kept: WikiNode[] = []
  const dropped: BuildResult['dropped'] = []
  let skipBelow: number | null = null
  for (const n of walk.nodes) {
    if (skipBelow !== null && n.depth > skipBelow) continue
    skipBelow = null
    if (n.objType !== DOC_OBJ_TYPE) {
      dropped.push({
        token: n.token,
        title: n.title,
        url: url(n.token),
        objType: n.objType,
      })
      skipBelow = n.depth
      continue
    }
    kept.push({ ...n, title: title(n.token, n.title) })
  }

  const leads = opts.leads ?? []
  const numbering = opts.numbering ?? true
  const total = leads.length + 1 + kept.length
  const width = opts.width ?? Math.max(3, String(total - 1).length)
  let counter = 0
  const file = (token: string, t: string): HierarchyFile => {
    const num = String(counter++).padStart(width, '0')
    return {
      id: `file_${token}`,
      name: numbering ? `${num} - ${t}` : t,
      type: 'file',
      url: url(token),
      status: 'pending',
    }
  }

  const root: HierarchyFolder = {
    id: 'root',
    name: 'Root',
    type: 'folder',
    children: [],
  }
  for (const l of leads) root.children.push(file(l.token, l.title.trim()))
  root.children.push(
    file(walk.rootToken, title(walk.rootToken, walk.rootTitle)),
  )

  const sectionOf = new Map<HierarchyNode, string>()
  const stack: [number, HierarchyFolder][] = [[0, root]]
  let section = ''
  const top = () => {
    const t = stack[stack.length - 1]
    if (!t) throw new Error('unreachable: root popped')
    return t
  }
  kept.forEach((n, i) => {
    while (stack.length > 1 && top()[0] >= n.depth) stack.pop()
    const parent = top()[1]
    if (n.depth === 1) section = n.title
    const f = file(n.token, n.title)
    parent.children.push(f)
    sectionOf.set(f, section)
    const next = kept[i + 1]
    if (next && next.depth > n.depth) {
      const folder: HierarchyFolder = {
        id: `folder_${n.token}`,
        name: n.title,
        type: 'folder',
        children: [],
      }
      parent.children.push(folder)
      sectionOf.set(folder, section)
      stack.push([n.depth, folder])
    }
  })

  const only = (opts.only ?? []).map(p => p.trim()).filter(Boolean)
  if (only.length) {
    root.children = root.children.filter(c => {
      const s = sectionOf.get(c)
      return s !== undefined && only.some(p => s.startsWith(p))
    })
  }

  const all = [...iterNodes(root)]
  return {
    tree: root,
    dropped,
    unusedRenames: [...renames.keys()],
    problems: validateTree(root, numbering ? width : null),
    fileCount: all.filter(n => n.type === 'file').length,
    folderCount: all.filter(n => n.type === 'folder').length - 1,
  }
}

export function* iterNodes(n: HierarchyNode): Generator<HierarchyNode> {
  yield n
  if (n.type === 'folder') for (const c of n.children) yield* iterNodes(c)
}

/** Duplicate ids, empty folders, and (when numbered) gaps or disorder in NNN. */
export function validateTree(
  root: HierarchyFolder,
  width: number | null,
): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  const nums: number[] = []
  const re = width ? new RegExp(`^(\\d{${String(width)}}) - \\S`) : null
  for (const n of iterNodes(root)) {
    if (ids.has(n.id)) problems.push(`duplicate id ${n.id}`)
    ids.add(n.id)
    if (n.type === 'folder' && n !== root && n.children.length === 0)
      problems.push(`empty folder ${n.name}`)
    if (n.type === 'file' && re) {
      const m = re.exec(n.name)
      if (m) nums.push(Number(m[1]))
      else problems.push(`bad name ${n.name}`)
    }
  }
  const contiguous = nums.every(
    (v, i) => i === 0 || v === (nums[i - 1] ?? NaN) + 1,
  )
  if (!contiguous) problems.push('numbers are not contiguous in tree order')
  return problems
}

// ---------------------------------------------------------------------------
// 3. Diff and merge
// ---------------------------------------------------------------------------

interface PageEntry {
  key: string
  title: string
  path: string
}

export interface TreeDiff {
  added: PageEntry[]
  removed: PageEntry[]
  renamed: { key: string; from: string; to: string }[]
  moved: { key: string; title: string; from: string; to: string }[]
  /** Shared pages appear in a different relative order. */
  reordered: boolean
  before: number
  after: number
}

const NUMBER_PREFIX = /^[\d.]+ - /

function pages(root: HierarchyFolder): PageEntry[] {
  const out: PageEntry[] = []
  const visit = (n: HierarchyNode, trail: string[]) => {
    if (n.type === 'file') {
      out.push({
        key: pageKey(n.url),
        title: n.name.replace(NUMBER_PREFIX, ''),
        path: trail.join(' / '),
      })
    } else {
      const next = n.id === 'root' ? trail : [...trail, n.name]
      for (const c of n.children) visit(c, next)
    }
  }
  visit(root, [])
  return out
}

export function diffTrees(
  before: HierarchyFolder,
  after: HierarchyFolder,
): TreeDiff {
  const o = pages(before)
  const n = pages(after)
  const om = new Map(o.map(p => [p.key, p]))
  const nm = new Map(n.map(p => [p.key, p]))
  const diff: TreeDiff = {
    added: n.filter(p => !om.has(p.key)),
    removed: o.filter(p => !nm.has(p.key)),
    renamed: [],
    moved: [],
    reordered: false,
    before: o.length,
    after: n.length,
  }
  for (const p of n) {
    const prev = om.get(p.key)
    if (!prev) continue
    if (prev.title !== p.title)
      diff.renamed.push({ key: p.key, from: prev.title, to: p.title })
    else if (prev.path !== p.path)
      diff.moved.push({
        key: p.key,
        title: p.title,
        from: prev.path,
        to: p.path,
      })
  }
  const so = o.filter(p => nm.has(p.key)).map(p => p.key)
  const sn = n.filter(p => om.has(p.key)).map(p => p.key)
  diff.reordered = so.some((k, i) => k !== sn[i])
  return diff
}

export function isEmptyDiff(d: TreeDiff): boolean {
  return (
    !d.added.length &&
    !d.removed.length &&
    !d.renamed.length &&
    !d.moved.length &&
    !d.reordered
  )
}

/**
 * Carry finished work from the current tree into a freshly built one.
 * A page matched by wiki token keeps its old id (so in-memory extraction
 * results stay attached) and its status: `success` only while its result is
 * still in memory, `skipped` as the user chose, everything else back to pending.
 */
export function carryOverStatuses(
  before: HierarchyFolder,
  after: HierarchyFolder,
  hasResult: (id: string) => boolean,
): { tree: HierarchyFolder; kept: number } {
  const old = new Map<string, HierarchyFile>()
  for (const n of iterNodes(before))
    if (n.type === 'file' && !old.has(pageKey(n.url)))
      old.set(pageKey(n.url), n)

  // Ids are `file_<token>` or random capture ids, so an inherited id can't
  // collide with a fresh one; the caller still runs validateTree on the result.
  const tree = structuredClone(after)
  let kept = 0
  for (const n of iterNodes(tree)) {
    if (n.type !== 'file') continue
    const prev = old.get(pageKey(n.url))
    if (!prev) continue
    old.delete(pageKey(n.url))
    n.id = prev.id
    if (prev.status === 'success' && hasResult(prev.id)) {
      n.status = 'success'
      kept++
    } else if (prev.status === 'skipped') {
      n.status = 'skipped'
    }
  }
  return { tree, kept }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface RefreshSettings {
  /** Refresh automatically before every Export/Resume. */
  beforeEachRun: boolean
  rootUrl: string
  /** One per line: `<wiki url or token> = <title>` */
  leads: string
  /** One per line: `<wiki url or token> = <title>` */
  renames: string
  /** One prefix per line. */
  only: string
  numbering: boolean
}

export const defaultRefreshSettings = (): RefreshSettings => ({
  beforeEachRun: false,
  rootUrl: '',
  leads: '',
  renames: '',
  only: '',
  numbering: true,
})

/** Parse `token-or-url = title` lines. Returns entries and the lines it could not read. */
export function parsePairs(text: string): {
  pairs: LeadPage[]
  invalid: string[]
} {
  const pairs: LeadPage[] = []
  const invalid: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const eq = line.indexOf('=')
    const left = (eq < 0 ? line : line.slice(0, eq)).trim()
    const t = eq < 0 ? '' : line.slice(eq + 1).trim()
    const token = parseWikiUrl(left)?.token ?? left
    if (/^[A-Za-z0-9]+$/.test(token)) pairs.push({ token, title: t })
    else invalid.push(line)
  }
  return { pairs, invalid }
}

export function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}
