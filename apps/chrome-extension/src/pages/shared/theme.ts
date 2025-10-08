import { watch } from 'vue'
import z from 'zod/v4'
import { SettingKey, Theme } from '@/common/settings'
import { defaultSettings, useSettings } from './settings'
import { useEventListener } from '@vueuse/core'

export const preferredDark = (theme: Theme): boolean =>
  theme === Theme.System
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : theme === Theme.Dark

export const updateTheme = (theme: Theme): void => {
  const match = preferredDark(theme)
  const el = document.querySelector('html')

  if (match && !el?.classList.contains('dark')) {
    el?.classList.add('dark')
  }

  if (!match && el?.classList.contains('dark')) {
    el.classList.remove('dark')
  }
}

export const initTheme = (): void => {
  const { data } = z.enum(Theme).safeParse(localStorage.getItem('cache.theme'))

  updateTheme(data ?? defaultSettings[SettingKey.Theme])
}

export const useInitTheme = () => {
  const { query } = useSettings()
  watch(query.data, newSettings => {
    if (newSettings !== undefined) {
      const newTheme = newSettings[SettingKey.Theme]
      updateTheme(newTheme)
    }
  })

  useEventListener(
    window.matchMedia('(prefers-color-scheme: dark)'),
    'change',
    () => {
      if (query.data.value?.[SettingKey.Theme] === Theme.System) {
        updateTheme(Theme.System)
      }
    },
    { passive: true },
  )
}
