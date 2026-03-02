<script setup lang="ts">
import { watch } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod/v4'
import { pick } from 'es-toolkit'
import { LoaderCircle } from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
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
import {
  SettingKey,
  TableWithNonPhrasingContent,
  Grid,
  Theme,
} from '@/common/settings'
import { useI18n } from 'vue-i18n'
import { useSettings } from '../shared/settings'

const { locale, availableLocales, t } = useI18n()

const schema = z.object({
  [SettingKey.Locale]: z.enum(availableLocales.value),
  [SettingKey.Theme]: z.enum(Theme),
  [SettingKey.TableWithNonPhrasingContent]: z.enum(TableWithNonPhrasingContent),
  [SettingKey.Grid]: z.enum(Grid),
  [SettingKey.TextHighlight]: z.boolean(),
})

const { query, mutation } = useSettings()

const { meta, isSubmitting, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: query.data.value,
})

watch(query.data, newValues => {
  if (newValues) {
    resetForm({
      values: pick(newValues, [
        SettingKey.Locale,
        SettingKey.Theme,
        SettingKey.TableWithNonPhrasingContent,
        SettingKey.Grid,
        SettingKey.TextHighlight,
      ]),
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
      <form id="form-vee-general" class="w-2/3 space-y-6" @submit="onSubmit">
        <VeeField v-slot="{ field, errors }" :name="`[${SettingKey.Locale}]`">
          <Field orientation="responsive" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel for="form-vee-general-locale">{{
                t('general.language')
              }}</FieldLabel>
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select
              v-else
              :name="field.name"
              :model-value="field.value"
              @update:model-value="field.onChange"
            >
              <SelectTrigger
                id="form-vee-general-locale"
                :aria-invalid="!!errors.length"
              >
                <SelectValue :placeholder="t('general.language.placeholder')" />
              </SelectTrigger>
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
          </Field>
        </VeeField>
        <VeeField v-slot="{ field, errors }" :name="`[${SettingKey.Theme}]`">
          <Field orientation="responsive" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel for="form-vee-general-theme">{{
                t('general.theme')
              }}</FieldLabel>
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select
              v-else
              :model-value="field.value"
              @update:model-value="field.onChange"
            >
              <SelectTrigger
                id="form-vee-general-theme"
                :aria-invalid="!!errors.length"
              >
                <SelectValue :placeholder="t('general.theme.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    :key="`${locale}_${Theme.Light}`"
                    :value="Theme.Light"
                    >{{ t('general.theme.light') }}
                  </SelectItem>
                  <SelectItem
                    :key="`${locale}_${Theme.Dark}`"
                    :value="Theme.Dark"
                    >{{ t('general.theme.dark') }}
                  </SelectItem>
                  <SelectItem
                    :key="`${locale}_${Theme.System}`"
                    :value="Theme.System"
                    >{{ t('general.theme.system') }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </VeeField>

        <VeeField
          v-slot="{ field, errors }"
          :name="`[${SettingKey.TableWithNonPhrasingContent}]`"
        >
          <Field orientation="responsive" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel
                for="form-vee-general-table-with-non-phrasing-content"
                >{{ t('general.table_with_non_phrasing_content') }}</FieldLabel
              >
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select
              v-else
              :model-value="field.value"
              @update:model-value="field.onChange"
            >
              <SelectTrigger
                id="form-vee-general-table-with-non-phrasing-content"
                :aria-invalid="!!errors.length"
              >
                <SelectValue
                  :placeholder="
                    t('general.table_with_non_phrasing_content.placeholder')
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    :key="`${locale}_${TableWithNonPhrasingContent.Filtered}`"
                    :value="TableWithNonPhrasingContent.Filtered"
                    >{{ t('general.table_with_non_phrasing_content.filtered') }}
                  </SelectItem>
                  <SelectItem
                    :key="`${locale}_${TableWithNonPhrasingContent.ToHTML}`"
                    :value="TableWithNonPhrasingContent.ToHTML"
                    >{{ t('general.table_with_non_phrasing_content.to_html') }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </VeeField>
        <VeeField v-slot="{ field, errors }" :name="`[${SettingKey.Grid}]`">
          <Field orientation="responsive" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel for="form-vee-general-grid">{{
                t('general.grid')
              }}</FieldLabel>
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select
              v-else
              :model-value="field.value"
              @update:model-value="field.onChange"
            >
              <SelectTrigger
                id="form-vee-general-grid"
                :aria-invalid="!!errors.length"
              >
                <SelectValue :placeholder="t('general.grid.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    :key="`${locale}_${Grid.Flatten}`"
                    :value="Grid.Flatten"
                    >{{ t('general.grid.flatten') }}
                  </SelectItem>
                  <SelectItem
                    :key="`${locale}_${Grid.ToTable}`"
                    :value="Grid.ToTable"
                    >{{ t('general.grid.to_table') }}
                  </SelectItem>
                  <SelectItem
                    :key="`${locale}_${Grid.ToHTML}`"
                    :value="Grid.ToHTML"
                    >{{ t('general.grid.to_html') }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </VeeField>
        <VeeField
          v-slot="{ field, errors }"
          :name="`[${SettingKey.TextHighlight}]`"
        >
          <Field orientation="horizontal" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel for="form-vee-general-text-highlight">{{
                t('general.text_highlight')
              }}</FieldLabel>
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Switch
              v-else
              id="form-vee-general-text-highlight"
              :name="field.name"
              :model-value="field.value"
              :aria-invalid="!!errors.length"
              @update:model-value="field.onChange"
            />
          </Field>
        </VeeField>
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
