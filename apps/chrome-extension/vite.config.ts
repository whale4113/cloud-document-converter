import { defineConfig, defaultClientConditions } from 'rolldown-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/pages/',
  plugins: [vue(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        options: resolve(__dirname, 'options.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        dir: 'dist/pages',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    ...(mode !== 'release' && {
      conditions: defaultClientConditions.concat('dev'),
    }),
  },
}))
