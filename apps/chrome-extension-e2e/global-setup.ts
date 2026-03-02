import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(dirname, '../..')
const extensionDistDir = path.join(repoRoot, 'apps/chrome-extension/dist')
const preparedExtensionDir = path.join(dirname, '.cache/extension')

export default async function globalSetup(): Promise<void> {
  if (!process.env['CDC_E2E_SKIP_BUILD']) {
    execFileSync('pnpm', ['--filter', '@dolphin/chrome-extension', 'build'], {
      cwd: repoRoot,
      stdio: 'inherit',
    })
  }

  await fs.access(extensionDistDir).catch(() => {
    throw new Error(
      'Extension dist not found. Build @dolphin/chrome-extension first, or unset CDC_E2E_SKIP_BUILD.',
    )
  })

  await fs.rm(preparedExtensionDir, { recursive: true, force: true })
  await fs.mkdir(preparedExtensionDir, { recursive: true })
  await fs.cp(extensionDistDir, preparedExtensionDir, {
    recursive: true,
  })
}
