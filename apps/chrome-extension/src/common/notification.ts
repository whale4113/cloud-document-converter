import i18next from 'i18next'
import { Toast } from '@dolphin/lark/env'
import { Minute } from '@dolphin/common'
import { CommonTranslationKey, Namespace } from './i18n'

export const confirm = (): Promise<boolean> => {
  return new Promise<boolean>(resolve => {
    let confirmed = false

    Toast.info({
      closable: true,
      duration: Minute,
      content: i18next.t(CommonTranslationKey.CONTINUE, {
        ns: Namespace.COMMON,
      }),
      actionText: i18next.t(CommonTranslationKey.CONFIRM_TEXT, {
        ns: Namespace.COMMON,
      }),
      onActionClick: () => {
        confirmed = true
      },
      onClose: () => {
        resolve(confirmed)
      },
    })
  })
}
