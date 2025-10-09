import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { i18n } from '@/pages/shared/i18n'
import App from './popup.vue'
import { initTheme } from '../shared/theme'
import '../shared/shared.css'
import './main.css'

createApp(App).use(i18n).use(VueQueryPlugin).mount('#app')

initTheme()
