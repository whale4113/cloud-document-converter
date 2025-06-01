// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {}

interface ToastOptions {
  key?: string
  content: string
  actionText?: string
  duration?: number
  keepAlive?: boolean
  closable?: boolean
  onActionClick?: () => void
  onClose?: () => void
}

export interface Toast {
  error: (options: ToastOptions) => void
  warning: (options: ToastOptions) => void
  info: (options: ToastOptions) => void
  loading: (options: ToastOptions) => void
  success: (options: ToastOptions) => void
  remove: (key: string) => void
}

const defaultToast: Toast = {
  error: noop,
  warning: noop,
  info: noop,
  loading: noop,
  success: noop,
  remove: noop,
}

export const Toast: Toast = window.Toast ?? defaultToast

export interface User {
  language: string
}

export const User: User | undefined = window.User

export interface PageMain {
  blockManager: {
    /**
     * @deprecated
     */
    model?: {
      rootBlockModel: import('./docx').PageBlock
    }
    rootBlockModel: import('./docx').PageBlock
  }

  locateBlockWithRecordIdImpl(
    recordId: string,
    options?: Record<string, unknown>,
  ): Promise<boolean>
}

export const PageMain: PageMain | undefined = window.PageMain
