import { pick } from 'es-toolkit'
import { defaultsDeep } from 'es-toolkit/compat'
import { supported } from 'browser-fs-access'
import { EventName, sender } from './message'

export enum SettingKey {
  Locale = 'general.locale',
  Theme = 'general.theme',
  DownloadMethod = 'download.method',
  TableWithNonPhrasingContent = 'general.table_with_non_phrasing_content',
  TextHighlight = 'general.text_highlight',
}

export enum Theme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

export enum DownloadMethod {
  Direct = 'direct',
  ShowSaveFilePicker = 'showSaveFilePicker',
}

export enum TableWithNonPhrasingContent {
  Filtered = 'filtered',
  ToHTML = 'toHTML',
}

export interface Settings {
  [SettingKey.Locale]: string
  [SettingKey.Theme]: (typeof Theme)[keyof typeof Theme]
  [SettingKey.DownloadMethod]: (typeof DownloadMethod)[keyof typeof DownloadMethod]
  [SettingKey.TableWithNonPhrasingContent]: (typeof TableWithNonPhrasingContent)[keyof typeof TableWithNonPhrasingContent]
  [SettingKey.TextHighlight]: boolean
}

export const fallbackSettings: Settings = {
  [SettingKey.Locale]: 'en-US',
  [SettingKey.Theme]: Theme.System,
  [SettingKey.DownloadMethod]: supported
    ? DownloadMethod.ShowSaveFilePicker
    : DownloadMethod.Direct,
  [SettingKey.TableWithNonPhrasingContent]: TableWithNonPhrasingContent.ToHTML,
  [SettingKey.TextHighlight]: true,
}

export const getSettings = async <Key extends keyof Settings>(
  keys: Key[],
): Promise<Pick<Settings, Key>> => {
  try {
    const settings = await sender.sendAsync(EventName.GetSettings, keys)
    return pick(defaultsDeep(settings, fallbackSettings), keys)
  } catch (error) {
    console.error(error)

    return pick(fallbackSettings, keys)
  }
}

export const getGeneralSettings = async (): Promise<
  Pick<Settings, SettingKey.Locale | SettingKey.Theme>
> =>
  getSettings([
    SettingKey.Locale,
    SettingKey.Theme,
    SettingKey.TableWithNonPhrasingContent,
  ])

export const getDownloadSettings = async (): Promise<
  Pick<Settings, SettingKey.DownloadMethod>
> => getSettings([SettingKey.DownloadMethod])
