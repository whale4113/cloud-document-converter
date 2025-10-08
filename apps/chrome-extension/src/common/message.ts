import { Port } from '@dolphin/common/message'

export enum Flag {
  ExecuteViewScript = 'view_docx_as_markdown',
  ExecuteCopyScript = 'copy_docx_as_markdown',
  ExecuteDownloadScript = 'download_docx_as_markdown',
}

interface ExecuteScriptMessage {
  flag: Flag
}

export type Message = ExecuteScriptMessage

export enum EventName {
  Console = 'console',
  GetSettings = 'get_settings',
}

export interface Events extends Record<string, unknown> {
  [EventName.Console]: unknown[]
  [EventName.GetSettings]: string[]
}

export const sender: Port<Events> = /* @__PURE__ */ new Port<Events>(
  'sender',
  'receiver',
)

export const receiver: Port<Events> = /* @__PURE__ */ new Port<Events>(
  'receiver',
  'sender',
)
