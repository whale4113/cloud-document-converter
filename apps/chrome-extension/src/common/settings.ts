import { pick } from 'es-toolkit'
import { defaultsDeep } from 'es-toolkit/compat'
import { supported } from 'browser-fs-access'
import { EventName, sender } from './message'

export enum SettingKey {
  Locale = 'general.locale',
  Theme = 'general.theme',
  DownloadMethod = 'download.method',
  TableWithNonPhrasingContent = 'general.table_with_non_phrasing_content',
  Grid = 'general.grid',
  TextHighlight = 'general.text_highlight',
  DownloadFileWithUniqueName = 'download.file_with_unique_name',
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

export enum Grid {
  Flatten = 'flatten',
  ToTable = 'toTable',
  ToHTML = 'toHTML',
}

export interface Settings {
  [SettingKey.Locale]: string
  [SettingKey.Theme]: (typeof Theme)[keyof typeof Theme]
  [SettingKey.DownloadMethod]: (typeof DownloadMethod)[keyof typeof DownloadMethod]
  [SettingKey.TableWithNonPhrasingContent]: (typeof TableWithNonPhrasingContent)[keyof typeof TableWithNonPhrasingContent]
  [SettingKey.Grid]: (typeof Grid)[keyof typeof Grid]
  [SettingKey.TextHighlight]: boolean
  [SettingKey.DownloadFileWithUniqueName]: boolean
}

export const fallbackSettings: Settings = {
  [SettingKey.Locale]: 'en-US',
  [SettingKey.Theme]: Theme.System,
  [SettingKey.DownloadMethod]: supported
    ? DownloadMethod.ShowSaveFilePicker
    : DownloadMethod.Direct,
  [SettingKey.TableWithNonPhrasingContent]: TableWithNonPhrasingContent.ToHTML,
  [SettingKey.Grid]: Grid.Flatten,
  [SettingKey.TextHighlight]: true,
  [SettingKey.DownloadFileWithUniqueName]: false,
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
