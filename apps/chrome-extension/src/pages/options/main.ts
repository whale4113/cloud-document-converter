import { createApp } from 'vue'
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
} from 'vue-router'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { i18n } from '@/pages/shared/i18n'
import App from './options.vue'
import General from './general.vue'
import Download from './download.vue'
import { initTheme } from '../shared/theme'
import '../shared/shared.css'
import './main.css'

const routes: readonly RouteRecordRaw[] = [
  {
    path: '/general',
    name: 'general',
    component: General,
  },
  {
    path: '/download',
    name: 'download',
    component: Download,
  },
  {
    path: '/',
    redirect: '/general',
  },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

createApp(App).use(router).use(i18n).use(VueQueryPlugin).mount('#app')

initTheme()
