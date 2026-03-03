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

class PortImpl {
  private _sender: Port<Events> | null = null
  private _receiver: Port<Events> | null = null

  get sender(): Port<Events> {
    this._sender ??= new Port<Events>('sender', 'receiver')
    return this._sender
  }

  get receiver(): Port<Events> {
    this._receiver ??= new Port<Events>('receiver', 'sender')
    return this._receiver
  }
}

export const portImpl: PortImpl = /* @__PURE__ */ new PortImpl()
