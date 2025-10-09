<script setup lang="ts">
import { Eye, Copy, Download, Info, Settings } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Flag } from '@/common/message'
import { useInitLocale } from '../shared/i18n'
import { useInitTheme } from '../shared/theme'

const { t } = useInitLocale()
useInitTheme()

const handleMessage = async (flag: Flag) => {
  if (import.meta.env.DEV) {
    console.log(`chrome.runtime.sendMessage({ flag: '${flag}'})`)
  } else {
    await chrome.runtime.sendMessage({ flag })
  }

  window.close()
}

const handleOpenOptionsPage = () => {
  if (import.meta.env.DEV) {
    window.open('/pages/options', '_blank')
  } else {
    chrome.runtime.openOptionsPage()
  }
}
</script>

<template>
  <DropdownMenu :open="true">
    <DropdownMenuContent class="border-0 rounded-none">
      <DropdownMenuItem @select="() => handleMessage(Flag.ExecuteViewScript)">
        <Eye />
        {{ t('lark.docx.view') }}
      </DropdownMenuItem>
      <DropdownMenuItem @select="() => handleMessage(Flag.ExecuteCopyScript)">
        <Copy />
        {{ t('lark.docx.copy') }}
      </DropdownMenuItem>
      <DropdownMenuItem
        @select="() => handleMessage(Flag.ExecuteDownloadScript)"
      >
        <Download />
        {{ t('lark.docx.download') }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        :as-child="true"
        class="underline-offset-4 hover:underline"
        href="https://github.com/whale4113/cloud-document-converter"
        target="_blank"
      >
        <a>
          <Info />
          {{ t('help.and.feedback') }}
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem
        class="underline-offset-4 hover:underline"
        @select="handleOpenOptionsPage"
      >
        <Settings />
        {{ t('settings') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
