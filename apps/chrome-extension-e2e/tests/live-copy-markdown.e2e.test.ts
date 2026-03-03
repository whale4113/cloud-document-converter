import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect, test } from '@playwright/test'
import { resolveLiveCopyConfig } from '../src/env.js'
import {
  type Settings,
  SettingKey,
  Grid,
} from '../../chrome-extension/src/common/settings.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceDir = path.resolve(dirname, '..')
const extensionPath = path.join(workspaceDir, '.cache/extension')
const { userDataDir: fixedUserDataDir, headless } = resolveLiveCopyConfig()
const targetUrl = 'https://my.feishu.cn/wiki/Ez2WwNvB2iMjd9kXMw3cfbqDnTe'
const quoteContentUrl = 'https://my.feishu.cn/wiki/Pi5ww1AdKilUGrkyfgrc791unQ8'
const underlineUrl = 'https://my.feishu.cn/wiki/X9tGwEQHgiodeqkIVSmcwqJynOh'

interface LiveCopyCase {
  name: string
  url: string
  expectedText: string
  match: 'equals' | 'contains'
  settings?: Partial<Settings>
}

const liveCopyCases: LiveCopyCase[] = [
  {
    name: 'source-content',
    url: targetUrl,
    expectedText: '源内容',
    match: 'equals',
  },
  {
    name: 'quote-content',
    url: quoteContentUrl,
    expectedText: '源内容',
    match: 'equals',
  },
  {
    name: 'underline-content',
    url: underlineUrl,
    expectedText: '<u>下划线样式</u>',
    match: 'contains',
  },
  {
    name: 'Grid & Synced Reference',
    url: 'https://my.feishu.cn/docx/NG8AdUZq4ogKvox4fAXcoztnnke',
    match: 'equals',
    expectedText: `<table><colgroup><col style="width: 27.439024390243905%"><col style="width: 72.5609756097561%"></colgroup>
<thead>
<tr>
<th>a水电费水电费地方水电费水电费的身份水电费水电费水电费<h1>Heading 1</h1></th>
<th>b</th>
</tr>
</thead>
</table>

同步内容`,
    settings: {
      [SettingKey.Grid]: Grid.ToHTML,
    },
  },
]

const createUserDataDir = async (): Promise<{
  path: string
  shouldCleanup: boolean
}> => {
  if (fixedUserDataDir) {
    await fs.mkdir(fixedUserDataDir, { recursive: true })
    return {
      path: fixedUserDataDir,
      shouldCleanup: false,
    }
  }

  return {
    path: await fs.mkdtemp(path.join(os.tmpdir(), 'cdc-extension-e2e-live-')),
    shouldCleanup: true,
  }
}

for (const liveCase of liveCopyCases) {
  test(`@live copy markdown equals expected text [${liveCase.name}]`, async () => {
    const userDataDir = await createUserDataDir()
    const context = await chromium.launchPersistentContext(userDataDir.path, {
      channel: 'chromium',
      headless,
      args: [
        '--disable-popup-blocking',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })

    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: new URL(liveCase.url).origin,
      })

      let serviceWorker = context.serviceWorkers().at(0)
      serviceWorker ??= await context.waitForEvent('serviceworker')
      expect(serviceWorker.url()).toContain('chrome-extension://')

      if (liveCase.settings) {
        await serviceWorker.evaluate(async settings => {
          // @ts-expect-error chrome is not typed in e2e test environment
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          await chrome.storage.sync.set(settings)
        }, liveCase.settings)
      }

      const page = await context.newPage()
      await page.goto(liveCase.url, {
        waitUntil: 'domcontentloaded',
      })
      await page.bringToFront()

      const copyButton = page.locator('[data-CDC-button-type="copy"]')
      await expect(copyButton).toBeVisible({
        timeout: 2 * 60 * 1000,
      })

      await copyButton.click()

      let clipboardResult = ''

      try {
        const poll = expect.poll(
          async () => {
            await page.bringToFront()
            const clipboardText = await page.evaluate(async () => {
              return await navigator.clipboard.readText()
            })

            clipboardResult = clipboardText.trim()

            return clipboardResult
          },
          {
            timeout: 20 * 1000,
            intervals: [500, 1000, 2000],
          },
        )

        if (liveCase.match === 'equals') {
          await poll.toBe(liveCase.expectedText)
        } else {
          await poll.toContain(liveCase.expectedText)
        }
      } catch {
        throw new Error(
          [
            'copy markdown 验证失败',
            `验证方式: ${liveCase.match}`,
            `验证内容: ${JSON.stringify(liveCase.expectedText)}`,
            `输出结果: ${JSON.stringify(clipboardResult)}`,
          ].join('\n'),
        )
      }
    } finally {
      await context.close()
      if (userDataDir.shouldCleanup) {
        await fs.rm(userDataDir.path, { recursive: true, force: true })
      }
    }
  })
}
