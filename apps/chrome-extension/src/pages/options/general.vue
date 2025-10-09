<script setup lang="ts">
import { watch, watchEffect } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod/v4'
import { pick } from 'es-toolkit'
import { LoaderCircle } from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
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
import { SettingKey, Theme } from '@/common/settings'
import { useI18n } from 'vue-i18n'
import { useSettings } from '../shared/settings'

const { locale, availableLocales, t } = useI18n()

const schema = z.object({
  [SettingKey.Locale]: z.enum(availableLocales.value),
  [SettingKey.Theme]: z.enum(Theme),
})

const { query, mutation } = useSettings()

const { meta, isSubmitting, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: query.data.value,
})

watch(query.data, newValues => {
  if (newValues) {
    resetForm({
      values: pick(newValues, [SettingKey.Locale, SettingKey.Theme]),
    })

    localStorage.setItem('cache.locale', newValues[SettingKey.Locale])
    localStorage.setItem('cache.theme', newValues[SettingKey.Theme])
  }
})

const onSubmit = handleSubmit.withControlled(async values => {
  await mutation.mutateAsync(values)
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        {{ t('general') }}
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-6">
      <form class="w-2/3 space-y-6" @submit="onSubmit">
        <FormField v-slot="{ componentField }" :name="`[${SettingKey.Locale}]`">
          <FormItem>
            <FormLabel>{{ t('general.language') }}</FormLabel>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select v-else v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue
                    :placeholder="t('general.language.placeholder')"
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="value of availableLocales"
                    :key="`${locale}_${value}`"
                    :value="value"
                    >{{ t(`language.${value}`) }}</SelectItem
                  >
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>
        <FormField v-slot="{ componentField }" :name="`[${SettingKey.Theme}]`">
          <FormItem>
            <FormLabel>{{ t('general.theme') }}</FormLabel>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select v-else v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue :placeholder="t('general.theme.placeholder')" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    :key="`${locale}_${Theme.Light}`"
                    :value="Theme.Light"
                    >{{ t('general.theme.light') }}</SelectItem
                  >
                  <SelectItem
                    :key="`${locale}_${Theme.Dark}`"
                    :value="Theme.Dark"
                    >{{ t('general.theme.dark') }}</SelectItem
                  >
                  <SelectItem
                    :key="`${locale}_${Theme.System}`"
                    :value="Theme.System"
                    >{{ t('general.theme.system') }}</SelectItem
                  >
                </SelectGroup>
              </SelectContent>
            </Select>
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
