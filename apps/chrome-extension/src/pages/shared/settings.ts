import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryReturnType,
  type UseMutationReturnType,
} from '@tanstack/vue-query'
import { pick } from 'es-toolkit'
import { defaultsDeep } from 'es-toolkit/compat'
import { fallbackSettings, SettingKey, type Settings } from '@/common/settings'
import { storage } from '@/lib/storage'

export const defaultSettings: Settings = {
  ...fallbackSettings,
  [SettingKey.Locale]: import.meta.env.DEV
    ? 'zh-CN'
    : chrome.i18n.getUILanguage(),
}

export const useSettings = <
  Key extends keyof Settings =
    | SettingKey.Locale
    | SettingKey.Theme
    | SettingKey.DownloadMethod
    | SettingKey.TableWithNonPhrasingContent
    | SettingKey.Grid
    | SettingKey.TextHighlight
    | SettingKey.DownloadFileWithUniqueName,
>(
  options: { keys?: Key[] } = {},
): {
  query: UseQueryReturnType<Pick<Settings, Key>, Error>
  mutation: UseMutationReturnType<
    Partial<Settings>,
    Error,
    Partial<Settings>,
    unknown
  >
} => {
  const {
    keys = [
      SettingKey.Locale,
      SettingKey.Theme,
      SettingKey.DownloadMethod,
      SettingKey.TableWithNonPhrasingContent,
      SettingKey.Grid,
      SettingKey.TextHighlight,
      SettingKey.DownloadFileWithUniqueName,
    ] as Key[],
  } = options

  const queryClient = useQueryClient()

  const queryKey = ['get_settings'].concat(keys)

  const query = useQuery<Pick<Settings, Key>>({
    queryKey,
    queryFn: async () => {
      const settings = await storage.sync.get(keys)

      return pick(defaultsDeep(settings, defaultSettings), keys) as Pick<
        Settings,
        Key
      >
    },
  })

  const mutation = useMutation({
    mutationKey: ['set_settings'],
    mutationFn: async (items: Partial<Settings>) => {
      await storage.sync.set(items)

      return items
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey,
      })
    },
  })

  return {
    query,
    mutation,
  }
}
