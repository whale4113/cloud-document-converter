import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    conditions: ['dev'],
  },
  test: {
    environment: 'happy-dom',
  },
})
