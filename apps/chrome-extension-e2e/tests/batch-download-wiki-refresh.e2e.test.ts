import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test'

/**
 * Drives the real built extension's Batch Download page against a synthetic
 * Feishu wiki served by request interception. No Feishu account is used.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url))
const extensionPath = path.resolve(dirname, '../.cache/extension')
const ORIGIN = 'https://e2e.feishu.cn'
const ROOT_URL = `${ORIGIN}/wiki/ROOT`
const SPACE = '7000000000000000001'

interface FakePage {
  title: string
  children?: string[]
}

const makeWiki = (): Partial<Record<string, FakePage>> => ({
  ROOT: { title: 'Handbook', children: ['A', 'B'] },
  A: { title: '1. Basics', children: ['A1', 'A2'] },
  A1: { title: '1.1 Tokens' },
  A2: { title: '1.2 Attention' },
  B: { title: '2. Training' },
})

interface Harness {
  context: BrowserContext
  page: Page
  wiki: Partial<Record<string, FakePage>>
  apiCalls: { fromExtension: number; fromTab: number }
  cleanup: () => Promise<void>
}

/**
 * @param cookiesOnlyInTab When true, API calls made directly by the extension
 *   page get a login page (as if the session cookie were not sent), so the
 *   page must fall back to fetching inside a Feishu tab.
 */
async function launch(cookiesOnlyInTab = false): Promise<Harness> {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'cdc-e2e-wiki-refresh-'),
  )
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    // Optional: point at a locally cached Chromium when the pinned one is missing.
    executablePath: process.env['CDC_E2E_CHROMIUM_PATH'],
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })
  const wiki = makeWiki()
  const apiCalls = { fromExtension: 0, fromTab: 0 }

  await context.route(
    /^https:\/\/[^/]+\.feishu\.cn\//,
    async (route: Route) => {
      const request = route.request()
      const url = new URL(request.url())
      let frameUrl = ''
      try {
        frameUrl = request.frame().url()
      } catch {
        // service-worker requests have no frame
      }
      const fromExtension = frameUrl.startsWith('chrome-extension://')

      if (url.pathname.startsWith('/space/api/wiki/v2/tree/')) {
        if (fromExtension) apiCalls.fromExtension++
        else apiCalls.fromTab++
        if (cookiesOnlyInTab && fromExtension) {
          await route.fulfill({
            contentType: 'text/html',
            body: '<html>login</html>',
          })
          return
        }
        const token = url.searchParams.get('wiki_token') ?? ''
        const node = wiki[token]
        if (!node) {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ code: 920004012, msg: 'no permission' }),
          })
          return
        }
        const body = url.pathname.endsWith('/get_info/')
          ? {
              code: 0,
              data: {
                tree: {
                  nodes: {
                    [token]: {
                      title: node.title,
                      space_id: SPACE,
                      has_child: Boolean(node.children?.length),
                    },
                  },
                },
              },
            }
          : {
              code: 0,
              data: {
                [token]: (node.children ?? []).map((t, i) => ({
                  wiki_token: t,
                  title: wiki[t]?.title,
                  sort_id: i + 1,
                  has_child: Boolean(wiki[t]?.children?.length),
                  obj_type: 22,
                })),
              },
            }
        await route.fulfill({
          contentType: 'application/json',
          headers: fromExtension
            ? {
                'access-control-allow-origin':
                  request.headers()['origin'] ?? '*',
                'access-control-allow-credentials': 'true',
              }
            : {},
          body: JSON.stringify(body),
        })
        return
      }
      if (url.pathname.startsWith('/wiki/')) {
        await route.fulfill({
          contentType: 'text/html',
          body: '<html><title>wiki</title><body>wiki</body></html>',
        })
        return
      }
      await route.fulfill({ status: 404, body: '' })
    },
  )

  let serviceWorker = context.serviceWorkers().at(0)
  serviceWorker ??= await context.waitForEvent('serviceworker')
  const extensionId = new URL(serviceWorker.url()).host
  // An open (stubbed) Feishu tab, so the tab fallback reuses it. Tabs opened
  // by the extension itself would bypass request interception and load the
  // real site, so the test never lets the fetcher open its own tab.
  const feishuTab = await context.newPage()
  await feishuTab.goto(ROOT_URL)
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/pages/batch-download.html`)

  return {
    context,
    page,
    wiki,
    apiCalls,
    cleanup: async () => {
      await context.close()
      await fs.rm(userDataDir, { recursive: true, force: true })
    },
  }
}

const urlInput = (page: Page) =>
  page.getByPlaceholder('https://xxx.feishu.cn/wiki/...')

test('refresh now previews the wiki, applies it, and remembers the wiki', async () => {
  const h = await launch()
  try {
    const { page } = h
    await urlInput(page).fill(ROOT_URL)
    await page.getByTestId('refresh-now').click()

    const preview = page.getByTestId('refresh-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('0 → 5 pages: 5 added')
    await expect(preview).toContainText('+ 1.1 Tokens  [1. Basics]')

    await page.getByTestId('refresh-apply').click()
    await expect(preview).toBeHidden()
    await expect(page.getByText('000 - Handbook')).toBeVisible()
    await expect(
      page.getByText('Applied refreshed tree: 5 files'),
    ).toBeVisible()

    // The direct (extension page) path worked, so no tab was needed.
    expect(h.apiCalls.fromExtension).toBeGreaterThan(0)
    expect(h.apiCalls.fromTab).toBe(0)

    // Settings and tree survive a reload.
    await page.reload()
    await expect(urlInput(page)).toHaveValue(ROOT_URL)
    await expect(page.getByText('000 - Handbook')).toBeVisible()
  } finally {
    await h.cleanup()
  }
})

test('refresh before export waits for a decision when the wiki changed', async () => {
  const h = await launch()
  try {
    const { page, wiki } = h
    await urlInput(page).fill(ROOT_URL)
    await page.getByTestId('refresh-now').click()
    await page.getByTestId('refresh-apply').click()
    await page.getByTestId('refresh-before-run').check()

    // Feishu renames a page after the tree was built.
    wiki['A2'] = { title: '1.2 Self-Attention' }

    const exportButton = page.getByRole('button', { name: 'Export ZIP' })
    await exportButton.click()
    const preview = page.getByTestId('refresh-preview')
    await expect(preview).toContainText('1 renamed')
    await expect(preview).toContainText(
      '~ 1.2 Attention  →  1.2 Self-Attention',
    )

    // Cancel: no run starts and the tree is unchanged.
    await page.getByRole('button', { name: 'Cancel export' }).click()
    await expect(preview).toBeHidden()
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0)
    await expect(exportButton).toBeEnabled()

    // Apply and export: the new tree is applied and the run starts.
    await exportButton.click()
    await page.getByRole('button', { name: 'Apply and export' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect(
      page.getByText('Applied refreshed tree: 5 files'),
    ).toBeVisible()
    // Refreshing is locked while the run is active.
    await expect(page.getByTestId('refresh-now')).toBeDisabled()
  } finally {
    await h.cleanup()
  }
})

test('refresh before export starts at once when nothing changed', async () => {
  const h = await launch()
  try {
    const { page } = h
    await urlInput(page).fill(ROOT_URL)
    await page.getByTestId('refresh-now').click()
    await page.getByTestId('refresh-apply').click()
    await page.getByTestId('refresh-before-run').check()

    await page.getByRole('button', { name: 'Export ZIP' }).click()
    await expect(page.getByTestId('refresh-preview')).toBeHidden()
    await expect(
      page.getByText('The wiki matches the current tree.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  } finally {
    await h.cleanup()
  }
})

test('a failed walk leaves the tree untouched and does not export', async () => {
  const h = await launch()
  try {
    const { page, wiki } = h
    await urlInput(page).fill(ROOT_URL)
    await page.getByTestId('refresh-now').click()
    await page.getByTestId('refresh-apply').click()
    await page.getByTestId('refresh-before-run').check()

    // The root page disappears from the wiki: get_info returns no node.
    delete wiki['ROOT']
    await page.getByRole('button', { name: 'Export ZIP' }).click()
    await expect(page.getByText('Wiki refresh failed')).toBeVisible({
      timeout: 40_000,
    })
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0)
    await expect(page.getByText('000 - Handbook')).toBeVisible()
  } finally {
    await h.cleanup()
  }
})

test('falls back to fetching inside a Feishu tab when cookies are not sent', async () => {
  const h = await launch(true)
  try {
    const { page, context } = h
    const pagesBefore = context.pages().length
    await urlInput(page).fill(ROOT_URL)
    await page.getByTestId('refresh-now').click()
    await expect(page.getByTestId('refresh-preview')).toContainText('5 added', {
      timeout: 40_000,
    })
    await expect(page.getByText('(via tab)')).toBeVisible()
    expect(h.apiCalls.fromTab).toBeGreaterThan(0)
    // It reused the open Feishu tab and left it open.
    expect(context.pages().length).toBe(pagesBefore)
    await page.getByTestId('refresh-apply').click()
    await expect(page.getByText('000 - Handbook')).toBeVisible()
  } finally {
    await h.cleanup()
  }
})
