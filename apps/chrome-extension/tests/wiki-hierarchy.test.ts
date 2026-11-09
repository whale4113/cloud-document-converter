import { describe, expect, it } from 'vitest'
import {
  buildTree,
  carryOverStatuses,
  diffTrees,
  isEmptyDiff,
  iterNodes,
  parsePairs,
  parseWikiUrl,
  walkWiki,
  type FetchJson,
  type HierarchyFile,
  type HierarchyFolder,
  type WikiWalk,
} from '../src/pages/batch-download/wiki-hierarchy'

const ORIGIN = 'https://example.feishu.cn'
const SPACE = '7000000000000000001'

/** A synthetic wiki: token -> { title, objType, children in sidebar order }. */
interface FakePage {
  title: string
  objType?: number
  children?: string[]
}
const WIKI: Record<string, FakePage> = {
  ROOT: { title: 'Handbook', children: ['A', 'B', 'C'] },
  A: { title: '1. Basics', children: ['A1', 'A2'] },
  A1: { title: '1.1 Tokens' },
  A2: { title: '1.2 Attention / Heads', children: ['A2x'] },
  A2x: { title: 'Notes: Q&A?' },
  B: { title: '2. Training', children: ['B1', 'BFILE'] },
  B1: { title: '2.1 Data' },
  BFILE: { title: 'script.py', objType: 12, children: ['BFILEKID'] },
  BFILEKID: { title: 'child of a file' },
  C: { title: '3. Serving' },
}

/** Serves WIKI through the two tree endpoints, with children in reversed order so sort_id matters. */
function fakeApi(opts: { flaky?: Set<string>; refuse?: Set<string> } = {}) {
  const calls: string[] = []
  const fetchJson: FetchJson = url => Promise.resolve(respond(url))
  const respond = (url: string): unknown => {
    calls.push(url)
    const u = new URL(url)
    const token = u.searchParams.get('wiki_token') ?? ''
    if (opts.flaky?.has(token)) {
      opts.flaky.delete(token)
      return {} // burst throttling looks like empty JSON
    }
    if (opts.refuse?.has(token)) return { code: 920004012, msg: 'no perm' }
    const page = WIKI[token]
    if (u.pathname.endsWith('/get_info/')) {
      return {
        code: 0,
        data: {
          tree: {
            nodes: {
              [token]: {
                title: ` ${page.title} `,
                space_id: SPACE,
                has_child: Boolean(page.children?.length),
              },
            },
          },
        },
      }
    }
    expect(u.searchParams.get('space_id')).toBe(SPACE)
    const kids = (page.children ?? []).map((t, i) => ({
      wiki_token: t,
      title: WIKI[t].title,
      sort_id: (i + 1) * 1024,
      has_child: Boolean(WIKI[t].children?.length),
      obj_type: WIKI[t].objType ?? 22,
    }))
    return { code: 0, data: { [token]: kids.reverse() } }
  }
  return { fetchJson, calls }
}

const noSleep = () => Promise.resolve()

const walkFake = (api = fakeApi()) =>
  walkWiki(`${ORIGIN}/wiki/ROOT?from=share`, {
    fetchJson: api.fetchJson,
    sleep: noSleep,
  })

const names = (n: HierarchyFolder): unknown =>
  n.children.map(c => (c.type === 'file' ? c.name : { [c.name]: names(c) }))

describe('parseWikiUrl', () => {
  it('accepts wiki page URLs and rejects others', () => {
    expect(parseWikiUrl(`${ORIGIN}/wiki/AbC123?x=1#h`)).toEqual({
      origin: ORIGIN,
      token: 'AbC123',
    })
    expect(parseWikiUrl(`${ORIGIN}/docx/AbC123`)).toBeNull()
    expect(parseWikiUrl('http://example.feishu.cn/wiki/AbC123')).toBeNull()
    expect(parseWikiUrl('not a url')).toBeNull()
    // only hosts the extension already has permission for
    expect(parseWikiUrl('https://evil.example.com/wiki/AbC123')).toBeNull()
    expect(parseWikiUrl('https://feishu.cn.evil.com/wiki/AbC123')).toBeNull()
    expect(parseWikiUrl('https://x.larksuite.com/wiki/AbC123')?.token).toBe(
      'AbC123',
    )
  })
})

describe('walkWiki', () => {
  it('walks depth-first in sidebar order with trimmed titles', async () => {
    const walk = await walkFake()
    expect(walk.rootTitle).toBe('Handbook')
    expect(walk.spaceId).toBe(SPACE)
    expect(walk.nodes.map(n => `${String(n.depth)}:${n.token}`)).toEqual([
      '1:A',
      '2:A1',
      '2:A2',
      '3:A2x',
      '1:B',
      '2:B1',
      '2:BFILE',
      '3:BFILEKID',
      '1:C',
    ])
  })

  it('retries a request that comes back empty', async () => {
    const api = fakeApi({ flaky: new Set(['A']) })
    const walk = await walkFake(api)
    expect(walk.nodes).toHaveLength(9)
    expect(api.calls.filter(u => u.includes('wiki_token=A&'))).toHaveLength(2)
  })

  it('fails the whole walk when a request keeps failing', async () => {
    const api = fakeApi({ refuse: new Set(['B']) })
    await expect(
      walkWiki(`${ORIGIN}/wiki/ROOT`, {
        fetchJson: api.fetchJson,
        sleep: noSleep,
        attempts: 2,
      }),
    ).rejects.toMatchObject({ code: 920004012 })
  })

  it('stops when aborted', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(
      walkWiki(`${ORIGIN}/wiki/ROOT`, {
        fetchJson: fakeApi().fetchJson,
        sleep: noSleep,
        signal: ctrl.signal,
      }),
    ).rejects.toThrow('cancelled')
  })
})

describe('buildTree', () => {
  it('numbers pages in order, pairs each parent page with a folder, drops non-docs', async () => {
    const r = buildTree(await walkFake())
    expect(r.problems).toEqual([])
    expect(names(r.tree)).toEqual([
      '000 - Handbook',
      '001 - 1. Basics',
      {
        '1. Basics': [
          '002 - 1.1 Tokens',
          '003 - 1.2 Attention / Heads',
          { '1.2 Attention / Heads': ['004 - Notes: Q&A?'] },
        ],
      },
      '005 - 2. Training',
      { '2. Training': ['006 - 2.1 Data'] },
      '007 - 3. Serving',
    ])
    expect(r.dropped).toEqual([
      {
        token: 'BFILE',
        title: 'script.py',
        url: `${ORIGIN}/wiki/BFILE`,
        objType: 12,
      },
    ])
    expect(r.fileCount).toBe(8)
    expect(r.folderCount).toBe(3)
    const first = r.tree.children[0] as HierarchyFile
    expect(first).toEqual({
      id: 'file_ROOT',
      name: '000 - Handbook',
      type: 'file',
      url: `${ORIGIN}/wiki/ROOT`,
      status: 'pending',
    })
    expect(r.tree.children[2].id).toBe('folder_A')
  })

  it('puts leads first, applies renames, and keeps full numbering in a subset', async () => {
    const r = buildTree(await walkFake(), {
      leads: [{ token: 'INTRO', title: 'Read me first' }],
      renames: { A1: '1.1 Tokenizers', NOPE: 'x' },
      only: ['2.'],
    })
    expect(r.problems).toEqual([])
    expect(r.unusedRenames).toEqual(['NOPE'])
    expect(names(r.tree)).toEqual([
      '006 - 2. Training',
      { '2. Training': ['007 - 2.1 Data'] },
    ])
    const full = buildTree(await walkFake(), {
      leads: [{ token: 'INTRO', title: 'Read me first' }],
      renames: { A1: '1.1 Tokenizers' },
    })
    const all = [...iterNodes(full.tree)].map(n => n.name)
    expect(all.slice(0, 2)).toEqual(['Root', '000 - Read me first'])
    expect(all).toContain('003 - 1.1 Tokenizers')
  })

  it('can leave names unnumbered and widens numbers for large trees', async () => {
    const plain = buildTree(await walkFake(), { numbering: false })
    expect(plain.problems).toEqual([])
    expect(plain.tree.children[0].name).toBe('Handbook')

    const big: WikiWalk = {
      origin: ORIGIN,
      rootToken: 'R',
      rootTitle: 'Root page',
      spaceId: SPACE,
      nodes: Array.from({ length: 1200 }, (_, i) => ({
        token: `P${String(i)}`,
        title: `Page ${String(i)}`,
        depth: 1,
        objType: 22,
      })),
    }
    const r = buildTree(big)
    expect(r.problems).toEqual([])
    expect(r.tree.children[1].name).toBe('0001 - Page 0')
  })
})

describe('diffTrees', () => {
  it('reports nothing for identical trees, even when renumbered', async () => {
    const a = buildTree(await walkFake()).tree
    const b = buildTree(await walkFake(), {
      leads: [{ token: 'INTRO', title: 'Lead' }],
    }).tree
    const d = diffTrees(a, b)
    expect(d.added.map(p => p.key)).toEqual(['INTRO'])
    expect(d.removed).toEqual([])
    expect(d.renamed).toEqual([])
    expect(d.moved).toEqual([])
    expect(d.reordered).toBe(false)
    expect(isEmptyDiff(diffTrees(a, structuredClone(a)))).toBe(true)
  })

  it('finds added, removed, renamed, moved and reordered pages', async () => {
    const before = buildTree(await walkFake()).tree
    const walk = await walkFake()
    walk.nodes = walk.nodes.filter(n => n.token !== 'C') // removed
    walk.nodes.push({ token: 'D', title: '4. New', depth: 1, objType: 22 }) // added
    const b1 = walk.nodes.find(n => n.token === 'B1')
    if (b1) b1.title = '2.1 Datasets' // renamed
    const a2x = walk.nodes.findIndex(n => n.token === 'A2x')
    walk.nodes[a2x].depth = 2 // moved up out of "1.2 Attention / Heads"
    const after = buildTree(walk).tree
    const d = diffTrees(before, after)
    expect(d.added.map(p => p.key)).toEqual(['D'])
    expect(d.removed.map(p => p.key)).toEqual(['C'])
    expect(d.renamed).toEqual([
      { key: 'B1', from: '2.1 Data', to: '2.1 Datasets' },
    ])
    expect(d.moved).toEqual([
      {
        key: 'A2x',
        title: 'Notes: Q&A?',
        from: '1. Basics / 1.2 Attention / Heads',
        to: '1. Basics',
      },
    ])
    expect(d.reordered).toBe(false)

    const swapped = structuredClone(before)
    ;[swapped.children[0], swapped.children[5]] = [
      swapped.children[5],
      swapped.children[0],
    ]
    expect(diffTrees(before, swapped).reordered).toBe(true)
  })
})

describe('carryOverStatuses', () => {
  it('keeps finished work by page, not by name or id', async () => {
    // A hand-captured tree with random ids and un-numbered names.
    const before: HierarchyFolder = {
      id: 'root',
      name: 'Root',
      type: 'folder',
      children: [
        file('file_1_x', 'Tokens', 'A1', 'success'),
        file('file_2_y', 'Data', 'B1', 'success'),
        file('file_3_z', 'Serving', 'C', 'skipped'),
        file('file_4_w', 'Basics', 'A', 'failed'),
      ],
    }
    const after = buildTree(await walkFake()).tree
    const { tree, kept } = carryOverStatuses(
      before,
      after,
      id => id === 'file_1_x',
    )
    const byUrl = new Map(
      [...iterNodes(tree)]
        .filter((n): n is HierarchyFile => n.type === 'file')
        .map(n => [n.url.split('/').pop(), n]),
    )
    expect(kept).toBe(1)
    expect(byUrl.get('A1')).toMatchObject({ id: 'file_1_x', status: 'success' })
    // success without an in-memory result must be re-extracted
    expect(byUrl.get('B1')).toMatchObject({ id: 'file_2_y', status: 'pending' })
    expect(byUrl.get('C')).toMatchObject({ id: 'file_3_z', status: 'skipped' })
    expect(byUrl.get('A')).toMatchObject({ id: 'file_4_w', status: 'pending' })
    expect(byUrl.get('ROOT')).toMatchObject({
      id: 'file_ROOT',
      status: 'pending',
    })
    // the built tree itself is untouched
    expect((after.children[0] as HierarchyFile).id).toBe('file_ROOT')
  })
})

describe('parsePairs', () => {
  it('reads url-or-token = title lines', () => {
    expect(
      parsePairs(
        `${ORIGIN}/wiki/Tok1 = Intro = guide\n\n  Tok2=Second \nbad token = x\nTok3`,
      ),
    ).toEqual({
      pairs: [
        { token: 'Tok1', title: 'Intro = guide' },
        { token: 'Tok2', title: 'Second' },
        { token: 'Tok3', title: '' },
      ],
      invalid: ['bad token = x'],
    })
  })
})

function file(
  id: string,
  name: string,
  token: string,
  status: HierarchyFile['status'],
): HierarchyFile {
  return { id, name, type: 'file', url: `${ORIGIN}/wiki/${token}`, status }
}
