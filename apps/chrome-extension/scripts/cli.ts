import { cac } from 'cac'
import { execa } from 'execa'
import { build as tsdownBuild } from 'tsdown'
import { createBuilder } from 'rolldown-vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import packageJson from '../package.json' with { type: 'json' }

const dirname = fileURLToPath(new URL('./', import.meta.url))

interface FirefoxBackgroundOptions {
  scripts: string[]
  type: 'module'
}

interface ChromeBackgroundOptions {
  service_worker: string
  type: 'module'
}

interface Manifest {
  version: string
  background: FirefoxBackgroundOptions | ChromeBackgroundOptions
  browser_specific_settings: {
    gecko: {
      id: string
    }
  }
}

const readManifest = async (
  manifestPath: string,
): Promise<Partial<Manifest> | undefined> => {
  try {
    const fileContent = await fs.readFile(manifestPath, 'utf8')
    const json = JSON.parse(fileContent) as Partial<Manifest>
    return json
  } catch (error) {
    console.error(error)

    return undefined
  }
}

interface BuildOptions {
  watch: boolean
  release: boolean
  target: string
}

const buildScripts = async (options: BuildOptions) => {
  const packagesPath = path.resolve(dirname, '../../../packages')
  const srcPath = path.resolve(dirname, '../src')

  await tsdownBuild({
    watch: options.watch ? [srcPath, packagesPath] : false,
    ignoreWatch: ['dist/**', 'node_modules/**'],
    env: {
      DEV: !options.release,
    },
  })
}

const buildPages = async (options: BuildOptions) => {
  const builder = await createBuilder(
    {
      mode: options.release ? 'release' : undefined,
      build: {
        watch: options.watch ? {} : undefined,
      },
    },
    null,
  )
  await builder.buildApp()
}

const copyResources = async () => {
  interface CopyEntry {
    from: string
    to: string
  }

  const copyEntries: CopyEntry[] = [
    {
      from: path.join(dirname, '../_locales'),
      to: path.join(dirname, '../dist/_locales'),
    },
    {
      from: path.join(dirname, '../images'),
      to: path.join(dirname, '../dist/images'),
    },
    {
      from: path.join(dirname, '../manifest.json'),
      to: path.join(dirname, '../dist/manifest.json'),
    },
  ]

  await Promise.all(
    copyEntries.map(entry =>
      fs.cp(entry.from, entry.to, {
        recursive: true,
      }),
    ),
  )
}

const genManifest = async (options: BuildOptions) => {
  const manifest = await readManifest(path.join(dirname, '../manifest.json'))

  if (!manifest) {
    throw new Error('manifest.json not found')
  }

  if (!manifest.background) {
    throw new Error('manifest.background not found')
  }

  if (options.target === 'firefox' && 'service_worker' in manifest.background) {
    manifest.background = {
      scripts: [manifest.background.service_worker],
      type: 'module',
    }

    manifest.browser_specific_settings = {
      gecko: {
        id: 'whale.4113@gmail.com',
      },
    }
  }

  manifest.version = packageJson.version

  await fs.writeFile(
    path.join(dirname, '../dist/manifest.json'),
    JSON.stringify(manifest, null, options.release ? undefined : 2),
  )

  console.log(`\n--- build end ---\n`)
  console.log(`Extension version: ${manifest.version}`)
}

const cli = cac('@dolphin/chrome-extension')
cli.help().version(packageJson.version)

cli
  .command('build', 'build the browser extension', {
    ignoreOptionDefaultValue: false,
  })
  .option('-w, --watch', 'Watch mode', {
    default: false,
  })
  .option(
    '-r, --release',
    'Build artifacts in release mode, with optimizations',
    {
      default: false,
    },
  )
  .option('--target <target>', 'Browser target, e.g "chromium", "firefox"', {
    default: 'chromium',
  })
  .action(async (options: BuildOptions) => {
    if (options.target !== 'chromium' && options.target !== 'firefox') {
      throw new Error(`'Invalid target: ${options.target}'`)
    }

    console.log('--- build scripts start ---\n')

    await buildScripts(options)

    console.log('\n--- build pages start ---\n')

    await buildPages(options)

    await copyResources()

    await genManifest(options)

    if (options.target === 'firefox') {
      for await (const line of execa('pnpm', [
        'exec',
        'web-ext',
        'lint',
        '--source-dir',
        'dist',
      ])) {
        console.log(`web-ext lint: ${line}`)
      }
    }
  })

cli.parse(process.argv, { run: false })

await cli.runMatchedCommand()
