import { defineConfig } from 'rollup'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import { babel } from '@rollup/plugin-babel'
import terser from '@rollup/plugin-terser'
import replace from '@rollup/plugin-replace'
import { globSync } from 'glob'

const isDev = process.env.BUILD === 'development'

/**
 *
 * @param {{ runtime: string }} options
 * @returns
 */
const createSharedPlugins = (options = {}) => {
  const { runtime } = options

  const sharedPlugins = [
    nodeResolve(),
    typescript({
      tsconfig: `tsconfig.${runtime}.json`,
      compilerOptions: {
        isolatedDeclarations: false,
        declaration: false,
      },
    }),
    babel({
      babelHelpers: 'bundled',
      // TODO: Exclude node_modules once https://github.com/babel/babel/issues/9419 is resolved
      exclude: [/node_modules\/core-js/],
    }),
    commonjs(),
    json(),
    replace({
      preventAssignment: true,
      'import.meta.env.DEV': JSON.stringify(isDev),
    }),
    ...(isDev ? [] : [terser()]),
  ]

  return sharedPlugins
}

export default defineConfig([
  {
    input: ['src/background.ts', 'src/content.ts', 'src/popup/popup.ts'],
    output: {
      entryFileNames: '[name].js',
      dir: 'bundles',
      format: 'esm',
    },
    plugins: [...createSharedPlugins({ runtime: 'extension' })],
  },
  ...globSync('src/scripts/*.ts').map(input => ({
    input,
    output: {
      dir: 'bundles/scripts',
      format: 'iife',
    },
    plugins: [...createSharedPlugins({ runtime: 'web' })],
  })),
])
