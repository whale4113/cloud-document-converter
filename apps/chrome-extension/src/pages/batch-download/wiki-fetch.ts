import { isLarkHost, type FetchJson } from './wiki-hierarchy'

/**
 * Authenticated GET of a Feishu/Lark tree API URL.
 *
 * The extension already holds host permissions for Feishu/Lark, so the page
 * first tries a direct credentialed fetch. If the session cookie isn't sent
 * (or the response isn't JSON), it falls back to running the same fetch
 * inside a tab on that origin with chrome.scripting, where it is a plain
 * same-origin request. No new permissions are needed for either path.
 */
export interface WikiFetcher {
  fetchJson: FetchJson
  /** 'direct' or 'tab', decided by the first successful probe. */
  mode: () => 'direct' | 'tab' | 'unknown'
  /** Close the background tab this fetcher opened, if any. */
  dispose: () => Promise<void>
}

const isSignedInJson = (body: unknown): boolean =>
  typeof body === 'object' &&
  body !== null &&
  (body as { code?: unknown }).code === 0

async function directFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { credentials: 'include' })
  const text = await res.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Runs inside the Feishu tab (isolated world), so the request is same-origin. */
async function fetchInPage(url: string): Promise<unknown> {
  try {
    const r = await fetch(url, { credentials: 'include' })
    return JSON.parse(await r.text()) as unknown
  } catch {
    return null
  }
}

type Injection = Parameters<typeof chrome.scripting.executeScript>[0]

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

export function createWikiFetcher(
  origin: string,
  pageUrl: string,
): WikiFetcher {
  let mode: 'direct' | 'tab' | 'unknown' = 'unknown'
  let tabId: number | null = null
  let openedTab = false

  const ensureTab = async (): Promise<number> => {
    if (tabId !== null) {
      try {
        await chrome.tabs.get(tabId)
        return tabId
      } catch {
        tabId = null
      }
    }
    const [existing] = await chrome.tabs.query({ url: `${origin}/*` })
    if (existing?.id !== undefined) {
      tabId = existing.id
    } else {
      const tab = await chrome.tabs.create({ url: pageUrl, active: false })
      if (tab.id === undefined) throw new Error('Could not open a Feishu tab')
      tabId = tab.id
      openedTab = true
    }
    return tabId
  }

  const tabFetch = async (url: string): Promise<unknown> => {
    const id = await ensureTab()
    // chrome-types declares `func: () => void`; the real API forwards `args`.
    const injection = {
      target: { tabId: id },
      func: fetchInPage,
      args: [url],
    } as unknown as Injection
    // A fresh tab can't be scripted until its Feishu document has committed;
    // only that is needed, not a full page load.
    for (let attempt = 0; ; attempt++) {
      try {
        const [result] = await chrome.scripting.executeScript(injection)
        const value: unknown = result?.result
        return value ?? null
      } catch (err) {
        if (attempt >= 50) throw err
        await sleep(300)
      }
    }
  }

  const fetchJson: FetchJson = async url => {
    const target = new URL(url)
    if (target.origin !== origin || !isLarkHost(target.hostname))
      throw new Error(`Refusing to fetch outside ${origin}`)
    if (mode === 'tab') return tabFetch(url)
    if (mode === 'direct') return directFetch(url)
    // Probe once: direct first, then tab. Lock in a path either way so
    // retries of a refused page don't pay for both paths every time.
    const direct = await directFetch(url).catch(() => null)
    if (isSignedInJson(direct)) {
      mode = 'direct'
      return direct
    }
    const viaTab = await tabFetch(url).catch(() => null)
    mode = isSignedInJson(viaTab) || direct === null ? 'tab' : 'direct'
    return viaTab ?? direct
  }

  return {
    fetchJson,
    mode: () => mode,
    dispose: async () => {
      if (openedTab && tabId !== null) {
        await chrome.tabs.remove(tabId).catch(() => undefined)
      }
      tabId = null
      openedTab = false
    },
  }
}
