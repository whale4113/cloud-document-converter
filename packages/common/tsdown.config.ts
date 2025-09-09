import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/*.ts',
  tsconfig: 'tsconfig.lib.json',
})
