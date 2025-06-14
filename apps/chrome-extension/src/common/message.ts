export enum Flag {
  ExecuteViewScript = 'view_docx_as_markdown',
  ExecuteCopyScript = 'copy_docx_as_markdown',
  ExecuteDownloadScript = 'download_docx_as_markdown',
}

interface ExecuteScriptMessage {
  flag: Flag
}

export type Message = ExecuteScriptMessage
