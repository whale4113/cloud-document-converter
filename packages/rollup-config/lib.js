import { defineConfig } from 'rollup'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { globSync } from 'glob'

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
      nodeResolve(),
      typescript({
        tsconfig,
      }),
    ],
  })
