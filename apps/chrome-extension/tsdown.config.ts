import { defineConfig, type Options } from 'tsdown'
import babel from '@rollup/plugin-babel'
import { glob } from 'glob'
import regexpEscape from 'regexp.escape'
import path from 'node:path'
import packageJson from './package.json' with { type: 'json' }
import '@dolphin/common/env'

export default defineConfig(async cliOptions => {
  const isDev = Boolean(cliOptions.env?.['DEV'])

  const noExternal = Object.keys(packageJson.dependencies).map(
    dependency => new RegExp(`^${regexpEscape(dependency)}`),
  )

  const sharedConfig: Omit<Options, 'config' | 'filter'> = {
    inputOptions: {
      resolve: {
        conditionNames: ['dev'],
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
    outDir: 'dist',
    format: 'esm',
    tsconfig: 'tsconfig.extension.json',
    ...sharedConfig,
  })

  const createClassicScriptConfig = (
    entry: Options['entry'],
  ): Omit<Options, 'config' | 'filter'> => ({
    entry,
    outDir: 'dist',
    format: 'iife',
    outputOptions: {
      entryFileNames: '[name].js',
    },
    tsconfig: 'tsconfig.web.json',
    ...sharedConfig,
  })

  return [
    createModuleScriptConfig({
      'bundles/background': 'src/background.ts',
    }),
    ...(
      [
        { 'bundles/content': 'src/content.ts' },
        { 'bundles/popup': 'src/popup/popup.ts' },
        ...(await glob('src/scripts/*.ts')).map(entry => ({
          [`bundles/scripts/${path.parse(entry).name}`]: entry,
        })),
      ] satisfies Options['entry'][]
    ).map(createClassicScriptConfig),
  ]
})
