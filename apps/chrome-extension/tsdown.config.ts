import { defineConfig, type UserConfig as Options } from 'tsdown'
import babel from '@rollup/plugin-babel'
import { glob } from 'glob'
import regexpEscape from 'regexp.escape'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import packageJson from './package.json' with { type: 'json' }
import '@dolphin/common/env'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(async cliOptions => {
  const isDev = Boolean(cliOptions.env?.['DEV'])

  const noExternal = Object.keys(packageJson.dependencies).map(
    dependency => new RegExp(`^${regexpEscape(dependency)}`),
  )

  const sharedConfig: Omit<Options, 'config' | 'filter'> = {
    inputOptions: {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
        ...(isDev && {
          conditionNames: ['dev'],
        }),
      },
    },
    platform: 'browser',
    target: ['es2024'],
    noExternal,
    minify: !isDev,
    plugins: !isDev
      ? [
          babel({
            extensions: ['.js', '.jsx', '.es6', '.es', '.mjs', '.ts', '.tsx'],
            babelHelpers: 'runtime',
            exclude: [/node_modules\/core-js/],
          }),
        ]
      : [],
  }

  const createModuleScriptConfig = (
    entry: Options['entry'],
  ): Omit<Options, 'config' | 'filter'> => ({
    entry,
    outDir: 'dist/bundles',
    format: 'esm',
    tsconfig: 'tsconfig.extension.json',
    ...sharedConfig,
  })

  const createClassicScriptConfig = (
    entry: Options['entry'],
  ): Omit<Options, 'config' | 'filter'> => ({
    entry,
    outDir: 'dist/bundles',
    format: 'iife',
    outputOptions: {
      entryFileNames: '[name].js',
    },
    tsconfig: 'tsconfig.web.json',
    ...sharedConfig,
  })

  return [
    createModuleScriptConfig({
      background: 'src/background.ts',
    }),
    ...(
      [
        { content: 'src/content.ts' },
        ...(await glob('src/scripts/*.ts')).map(entry => ({
          [`scripts/${path.parse(entry).name}`]: entry,
        })),
      ] satisfies Options['entry'][]
    ).map(createClassicScriptConfig),
  ]
})
