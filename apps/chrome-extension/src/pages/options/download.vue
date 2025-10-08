<script setup lang="ts">
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod/v4'
import { pick } from 'es-toolkit'
import { useI18n } from 'vue-i18n'
import { LoaderCircle } from 'lucide-vue-next'
import { supported } from 'browser-fs-access'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SettingKey, DownloadMethod } from '@/common/settings'
import { useSettings } from '../shared/settings'

const { t } = useI18n()

const schema = z.object({
  [SettingKey.DownloadMethod]: z.enum(DownloadMethod),
})

const { query, mutation } = useSettings()

const { meta, values, isSubmitting, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: query.data.value,
})

watch(query.data, newValues => {
  if (newValues) {
    resetForm({ values: pick(newValues, [SettingKey.DownloadMethod]) })
  }
})

const onSubmit = handleSubmit.withControlled(async values => {
  await mutation.mutateAsync(values)
})

const downloadMethodDescription = computed(() => {
  switch (values[SettingKey.DownloadMethod]) {
    case DownloadMethod.Direct:
      return t('download.method.direct.description')
    case DownloadMethod.ShowSaveFilePicker:
      return t('download.method.showSaveFilePicker.description')
    default:
      return ''
  }
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        {{ t('download') }}
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-6">
      <form class="w-2/3 space-y-6" @submit="onSubmit">
        <FormField
          v-slot="{ componentField }"
          :name="`[${SettingKey.DownloadMethod}]`"
        >
          <FormItem>
            <FormLabel>{{ t('download.method') }}</FormLabel>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select v-else v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue
                    :placeholder="t('download.method.placeholder')"
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :value="DownloadMethod.Direct"
                    >{{ t('download.method.direct') }}
                  </SelectItem>
                  <SelectItem
                    :value="DownloadMethod.ShowSaveFilePicker"
                    :disabled="!supported"
                    >{{ t('download.method.showSaveFilePicker') }}</SelectItem
                  >
                </SelectGroup>
              </SelectContent>
            </Select>
            <Skeleton v-if="query.isPending.value" class="h-9 w-60" />
            <FormDescription v-else>
              {{ downloadMethodDescription }}
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>
        <Button
          type="submit"
          class="relative"
          :disabled="query.isPending.value || isSubmitting"
        >
          <LoaderCircle v-if="isSubmitting" class="size-5 animate-spin" />
          <template v-if="meta.dirty">
            <span
              class="bg-primary absolute -right-1 -top-1 inline-flex size-3 animate-ping rounded-full opacity-75"
            ></span>
            <span
              class="bg-primary absolute -right-1 -top-1 inline-flex size-3 rounded-full"
            ></span>
          </template>
          {{ t('save') }}
        </Button>
      </form>
    </CardContent>
  </Card>
</template>
