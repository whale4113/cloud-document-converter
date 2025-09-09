import { cac } from 'cac'
import { execa } from 'execa'
import { build as tsdownBuild } from 'tsdown'
import fs from 'node:fs/promises'
import packageJson from '../package.json' with { type: 'json' }

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
  .action(
    async (options: { watch: boolean; release: boolean; target: string }) => {
      if (options.target !== 'chromium' && options.target !== 'firefox') {
        throw new Error(`'Invalid target: ${options.target}'`)
      }

      await tsdownBuild({
        watch: options.watch,
        env: {
          DEV: !options.release,
        },
      })

      interface CopyEntry {
        from: string
        to: string
      }

      const copyEntries: CopyEntry[] = [
        {
          from: '_locales',
          to: 'dist/_locales',
        },
        {
          from: 'images',
          to: 'dist/images',
        },
        {
          from: 'manifest.json',
          to: 'dist/manifest.json',
        },
        {
          from: 'src/popup/popup.html',
          to: 'dist/popup.html',
        },
      ]

      await Promise.all(
        copyEntries.map(entry =>
          fs.cp(entry.from, entry.to, {
            recursive: true,
          }),
        ),
      )

      const manifest = await readManifest('manifest.json')

      if (!manifest) {
        throw new Error('manifest.json not found')
      }

      if (!manifest.background) {
        throw new Error('manifest.background not found')
      }

      if (
        options.target === 'firefox' &&
        'service_worker' in manifest.background
      ) {
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
        'dist/manifest.json',
        JSON.stringify(manifest, null, options.release ? undefined : 2),
      )

      console.log(`Extension version: ${manifest.version}`)

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
    },
  )

cli.parse(process.argv, { run: false })

await cli.runMatchedCommand()
