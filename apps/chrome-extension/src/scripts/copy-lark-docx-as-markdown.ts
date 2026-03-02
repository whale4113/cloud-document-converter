import i18next from 'i18next'
import { Docx, docx, Toast } from '@dolphin/lark'
import { generatePublicUrl, makePublicUrlEffective } from '@dolphin/lark/image'
import { isDefined } from '@dolphin/common'
import { CommonTranslationKey, en, Namespace, zh } from '../common/i18n'
import { confirm } from '../common/notification'
import { reportBug } from '../common/issue'
import {
  transformInvalidTablesToHtml,
  transformGridToHtml,
  transformMentionUsers,
} from '../common/utils'
import {
  getSettings,
  SettingKey,
  TableWithNonPhrasingContent,
  Grid,
} from '../common/settings'

const enum TranslationKey {
  FAILED_TO_COPY_IMAGES = 'failed_to_copy_images',
  UNKNOWN_ERROR = 'unknown_error',
  CONTENT_LOADING = 'content_loading',
  NOT_SUPPORT = 'not_support',
  NOT_SUPPORT_DOC_1_0 = 'not_support_doc_1_0',
}

i18next
  .init({
    lng: docx.language,
    resources: {
      en: {
        translation: {
          [TranslationKey.FAILED_TO_COPY_IMAGES]: 'Failed to copy images',
          [TranslationKey.UNKNOWN_ERROR]: 'Unknown error during download',
          [TranslationKey.CONTENT_LOADING]:
            'Part of the content is still loading and cannot be copied at the moment. Please wait for loading to complete and retry',
          [TranslationKey.NOT_SUPPORT]:
            'This is not a lark document page and cannot be copied as Markdown',
          [TranslationKey.NOT_SUPPORT_DOC_1_0]:
            'This is a old version lark document page and cannot be copied as Markdown',
        },
        ...en,
      },
      zh: {
        translation: {
          [TranslationKey.FAILED_TO_COPY_IMAGES]: '复制图片失败',
          [TranslationKey.UNKNOWN_ERROR]: '下载过程中出现未知错误',
          [TranslationKey.CONTENT_LOADING]:
            '部分内容仍在加载中，暂时无法复制。请等待加载完成后重试',
          [TranslationKey.NOT_SUPPORT]:
            '这不是一个飞书文档页面，无法复制为 Markdown',
          [TranslationKey.NOT_SUPPORT_DOC_1_0]:
            '这是一个旧版飞书文档页面，无法复制为 Markdown',
        },
        ...zh,
      },
    },
  })
  .catch(console.error)

const main = async () => {
  if (docx.isDoc) {
    Toast.warning({ content: i18next.t(TranslationKey.NOT_SUPPORT_DOC_1_0) })

    return
  }

  if (!docx.isDocx) {
    Toast.warning({ content: i18next.t(TranslationKey.NOT_SUPPORT) })

    return
  }

  if (!docx.isReady()) {
    Toast.warning({
      content: i18next.t(TranslationKey.CONTENT_LOADING),
    })

    return
  }

  const settings = await getSettings([
    SettingKey.TableWithNonPhrasingContent,
    SettingKey.Grid,
    SettingKey.TextHighlight,
  ])

  const { root, images, invalidTables, mentionUsers } = docx.intoMarkdownAST({
    highlight: settings[SettingKey.TextHighlight],
    flatGrid: settings[SettingKey.Grid] === Grid.Flatten,
  })

  await transformMentionUsers(mentionUsers)

  const tokens = images
    .map(image => {
      if (!image.data?.token) return null

      const { token } = image.data
      const publicUrl = generatePublicUrl(token)
      const code = new URL(publicUrl).searchParams.get('code')
      if (!code) return null

      image.url = publicUrl

      return [token, code]
    })
    .filter(isDefined)

  if (
    settings[SettingKey.TableWithNonPhrasingContent] ===
    TableWithNonPhrasingContent.ToHTML
  ) {
    transformInvalidTablesToHtml(invalidTables, {
      allowDangerousHtml: true,
    })
  }

  if (settings[SettingKey.Grid] === Grid.ToHTML) {
    transformGridToHtml(root, {
      allowDangerousHtml: true,
    })
  }

  const markdown = Docx.stringify(root)

  if (!window.document.hasFocus()) {
    const confirmed = await confirm()
    if (!confirmed) {
      return
    }
  }

  // clipboard.write() method may be intercepted and overridden by websites
  const writeToClipboard = (
    Object.getPrototypeOf(window.navigator.clipboard) as Clipboard
  ).write.bind(window.navigator.clipboard)

  await writeToClipboard([
    new ClipboardItem({
      'text/plain': new Blob([markdown], { type: 'text/plain' }),
    }),
  ])

  if (tokens.length > 0) {
    const isSuccess = await makePublicUrlEffective(
      Object.fromEntries(tokens) as Record<string, string>,
    )
    if (!isSuccess) {
      Toast.error({
        content: i18next.t(TranslationKey.FAILED_TO_COPY_IMAGES),
      })
    }
  }
}

main().catch((error: unknown) => {
  Toast.error({
    content: i18next.t(TranslationKey.UNKNOWN_ERROR),
    actionText: i18next.t(CommonTranslationKey.CONFIRM_REPORT_BUG, {
      ns: Namespace.COMMON,
    }),
    onActionClick: () => {
      reportBug(error)
    },
  })
})
