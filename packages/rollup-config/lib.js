import { defineConfig } from 'rollup'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import replace from '@rollup/plugin-replace'
import { globSync } from 'glob'

const isDev = process.env.BUILD === 'development'

/**
 *
 * @param {{ tsconfig: string }} options
 * @returns
 */
export const defineLibConfig = ({ tsconfig }) =>
  defineConfig({
    input: globSync('src/*.ts', {
      ignore: {
        ignored: path => path.name.endsWith('.d.ts'),
      },
    }),
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      replace({
        preventAssignment: true,
        'import.meta.env.DEV': JSON.stringify(isDev),
      }),
      nodeResolve(),
      typescript({
        tsconfig,
      }),
    ],
  })
