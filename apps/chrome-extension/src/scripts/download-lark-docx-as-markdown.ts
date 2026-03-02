import i18next from 'i18next'
import { Toast, Docx, docx, type mdast } from '@dolphin/lark'
import { Minute, OneHundred, Second, waitFor } from '@dolphin/common'
import { fileSave, supported } from 'browser-fs-access'
import { fs } from '@zip.js/zip.js'
import normalizeFileName from 'filenamify/browser'
import { cluster } from 'radash'
import { CommonTranslationKey, en, Namespace, zh } from '../common/i18n'
import { confirm } from '../common/notification'
import { legacyFileSave } from '../common/legacy'
import { reportBug } from '../common/issue'
import {
  transformInvalidTablesToHtml,
  transformGridToHtml,
  transformMentionUsers,
  UniqueFileName,
  withSignal,
} from '../common/utils'
import {
  getSettings,
  TableWithNonPhrasingContent,
  Grid,
} from '../common/settings'
import { DownloadMethod, SettingKey } from '@/common/settings'

const uniqueFileName = new UniqueFileName()

const DOWNLOAD_ABORTED = 'Download aborted'

const enum TranslationKey {
  CONTENT_LOADING = 'content_loading',
  UNKNOWN_ERROR = 'unknown_error',
  NOT_SUPPORT = 'not_support',
  NOT_SUPPORT_DOC_1_0 = 'not_support_doc_1_0',
  DOWNLOADING_FILE = 'downloading_file',
  FAILED_TO_DOWNLOAD = 'failed_to_download',
  DOWNLOAD_PROGRESS = 'download_progress',
  DOWNLOAD_COMPLETE = 'download_complete',
  STILL_SAVING = 'still_saving',
  IMAGE = 'image',
  FILE = 'file',
  CANCEL = 'cancel',
  SCROLL_DOCUMENT = 'scroll_document',
}

enum ToastKey {
  DOWNLOADING = 'downloading',
  REPORT_BUG = 'report_bug',
}

i18next
  .init({
    lng: docx.language,
    resources: {
      en: {
        translation: {
          [TranslationKey.CONTENT_LOADING]:
            'Part of the content is still loading and cannot be downloaded at the moment. Please wait for loading to complete and retry',
          [TranslationKey.UNKNOWN_ERROR]: 'Unknown error during download',
          [TranslationKey.NOT_SUPPORT]:
            'This is not a lark document page and cannot be downloaded as Markdown',
          [TranslationKey.NOT_SUPPORT_DOC_1_0]:
            'This is a old version lark document page and cannot be downloaded as Markdown',
          [TranslationKey.DOWNLOADING_FILE]:
            'Download {{name}} in: {{progress}}% (please do not refresh or close the page)',
          [TranslationKey.FAILED_TO_DOWNLOAD]: 'Failed to download {{name}}',
          [TranslationKey.STILL_SAVING]:
            'Still saving (please do not refresh or close the page)',
          [TranslationKey.DOWNLOAD_PROGRESS]:
            '{{name}} download progress: {{progress}} %',
          [TranslationKey.DOWNLOAD_COMPLETE]: 'Download complete',
          [TranslationKey.IMAGE]: 'Image',
          [TranslationKey.FILE]: 'File',
          [TranslationKey.CANCEL]: 'Cancel',
          [TranslationKey.SCROLL_DOCUMENT]: 'Scrolling to load document',
        },
        ...en,
      },
      zh: {
        translation: {
          [TranslationKey.CONTENT_LOADING]:
            '部分内容仍在加载中，暂时无法下载。请等待加载完成后重试',
          [TranslationKey.UNKNOWN_ERROR]: '下载过程中出现未知错误',
          [TranslationKey.NOT_SUPPORT]:
            '这不是一个飞书文档页面，无法下载为 Markdown',
          [TranslationKey.NOT_SUPPORT_DOC_1_0]:
            '这是一个旧版飞书文档页面，无法下载为 Markdown',
          [TranslationKey.DOWNLOADING_FILE]:
            '下载 {{name}} 中：{{progress}}%（请不要刷新或关闭页面）',
          [TranslationKey.FAILED_TO_DOWNLOAD]: '下载 {{name}} 失败',
          [TranslationKey.STILL_SAVING]: '仍在保存中（请不要刷新或关闭页面）',
          [TranslationKey.DOWNLOAD_PROGRESS]: '{{name}}下载进度：{{progress}}%',
          [TranslationKey.DOWNLOAD_COMPLETE]: '下载完成',
          [TranslationKey.IMAGE]: '图片',
          [TranslationKey.FILE]: '文件',
          [TranslationKey.CANCEL]: '取消',
          [TranslationKey.SCROLL_DOCUMENT]: '滚动中，以便加载文档',
        },
        ...zh,
      },
    },
  })
  .catch(console.error)

interface ProgressOptions {
  onProgress?: (progress: number) => void
  onComplete?: () => void
}

async function toBlob(
  response: Response,
  options: ProgressOptions = {},
): Promise<Blob> {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status.toFixed()}`)
  }

  if (!response.body) {
    throw new Error('This request has no response body.')
  }

  const { onProgress, onComplete } = options

  const reader = response.body.getReader()
  const contentLength = parseInt(
    response.headers.get('Content-Length') ?? '0',
    10,
  )

  let receivedLength = 0
  const chunks = []

  let _done = false
  while (!_done) {
    const { done, value } = await reader.read()

    _done = done

    if (done) {
      onComplete?.()

      break
    }

    chunks.push(value)
    receivedLength += value.length

    onProgress?.(receivedLength / contentLength)
  }

  const blob = new Blob(chunks)

  return blob
}

const downloadImage = async (
  image: mdast.Image,
  options: {
    signal?: AbortSignal
    useUUID?: boolean
    markdownFileName?: string
  } = {},
): Promise<DownloadResult | null> => {
  if (!image.data) return null

  const { signal, useUUID = false, markdownFileName = '' } = options

  const { name: originName, fetchSources, fetchBlob } = image.data

  const result = await withSignal(
    async isAborted => {
      try {
        // whiteboard
        if (fetchBlob) {
          if (isAborted()) {
            return null
          }

          const content = await fetchBlob()
          if (!content) return null

          const baseName = markdownFileName
            ? `${markdownFileName}-diagram.png`
            : 'diagram.png'
          const name = useUUID
            ? uniqueFileName.generateWithUUID(baseName)
            : uniqueFileName.generate(baseName)
          const filename = `images/${name}`

          image.url = filename

          return {
            filename,
            content,
          }
        }

        // image
        if (originName && fetchSources) {
          if (isAborted()) {
            return null
          }
          const sources = await fetchSources()
          if (!sources) return null

          const baseName = markdownFileName
            ? `${markdownFileName}-${originName}`
            : originName
          const name = useUUID
            ? uniqueFileName.generateWithUUID(baseName)
            : uniqueFileName.generate(baseName)
          const filename = `images/${name}`

          const { src } = sources
          if (isAborted()) {
            return null
          }
          const response = await fetch(src, {
            signal,
          })

          try {
            if (isAborted()) {
              return null
            }
            const blob = await toBlob(response, {
              onProgress: progress => {
                if (isAborted()) {
                  Toast.remove(filename)

                  return
                }

                Toast.loading({
                  content: i18next.t(TranslationKey.DOWNLOADING_FILE, {
                    name,
                    progress: Math.floor(progress * OneHundred),
                  }),
                  keepAlive: true,
                  key: filename,
                })
              },
            })

            image.url = filename

            return {
              filename,
              content: blob,
            }
          } finally {
            Toast.remove(filename)
          }
        }

        return null
      } catch (error) {
        const isAbortError =
          isAborted() ||
          (error instanceof DOMException && error.name === 'AbortError')

        if (!isAbortError) {
          Toast.error({
            content: i18next.t(TranslationKey.FAILED_TO_DOWNLOAD, {
              name: originName,
            }),
            actionText: i18next.t(CommonTranslationKey.CONFIRM_REPORT_BUG, {
              ns: Namespace.COMMON,
            }),
            onActionClick: () => {
              reportBug(error)
            },
          })
        }

        return null
      }
    },
    { signal },
  )

  return result
}

const downloadFile = async (
  file: mdast.Link,
  options: {
    signal?: AbortSignal
    useUUID?: boolean
    markdownFileName?: string
  } = {},
): Promise<DownloadResult | null> => {
  if (!file.data?.name || !file.data.fetchFile) return null

  const { signal, useUUID = false, markdownFileName = '' } = options

  const { name, fetchFile } = file.data

  let controller = new AbortController()

  const cancel = () => {
    controller.abort()
  }

  const result = await withSignal(
    async () => {
      try {
        const baseName = markdownFileName ? `${markdownFileName}-${name}` : name
        const filename = `files/${
          useUUID
            ? uniqueFileName.generateWithUUID(baseName)
            : uniqueFileName.generate(baseName)
        }`

        const response = await fetchFile({ signal: controller.signal })
        try {
          const blob = await toBlob(response, {
            onProgress: progress => {
              Toast.loading({
                content: i18next.t(TranslationKey.DOWNLOADING_FILE, {
                  name,
                  progress: Math.floor(progress * OneHundred),
                }),
                keepAlive: true,
                key: filename,
                actionText: i18next.t(TranslationKey.CANCEL),
                onActionClick: cancel,
              })
            },
          })

          file.url = filename

          return {
            filename,
            content: blob,
          }
        } finally {
          Toast.remove(filename)
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return null
        }

        Toast.error({
          content: i18next.t(TranslationKey.FAILED_TO_DOWNLOAD, {
            name,
          }),
          actionText: i18next.t(CommonTranslationKey.CONFIRM_REPORT_BUG, {
            ns: Namespace.COMMON,
          }),
          onActionClick: () => {
            reportBug(error)
          },
        })

        return null
      }
    },
    { signal, onAbort: cancel },
  )

  // @ts-expect-error remove reference
  controller = null

  return result
}

interface DownloadResult {
  filename: string
  content: Blob
}

type File = mdast.Image | mdast.Link

const downloadFiles = async (
  files: File[],
  options: ProgressOptions & {
    /**
     * @default 3
     */
    batchSize?: number
    signal?: AbortSignal
    useUUID?: boolean
    markdownFileName?: string
  } = {},
): Promise<DownloadResult[]> => {
  const {
    onProgress,
    onComplete,
    batchSize = 3,
    signal,
    useUUID = false,
    markdownFileName = '',
  } = options

  let completeEventCalled = false
  const onCompleteOnce = () => {
    if (!completeEventCalled) {
      completeEventCalled = true
      onComplete?.()
    }
  }

  const results = await withSignal(
    async isAborted => {
      const _results: DownloadResult[] = []

      const totalSize = files.length
      let downloadedSize = 0

      for (const batch of cluster(files, batchSize)) {
        if (isAborted()) {
          break
        }

        await Promise.allSettled(
          batch.map(async file => {
            if (isAborted()) {
              return
            }

            try {
              const result =
                file.type === 'image'
                  ? await downloadImage(file, {
                      signal,
                      useUUID,
                      markdownFileName,
                    })
                  : await downloadFile(file, {
                      signal,
                      useUUID,
                      markdownFileName,
                    })

              if (result) {
                _results.push(result)
              }
            } finally {
              downloadedSize++

              if (!isAborted()) {
                onProgress?.(downloadedSize / totalSize)
              }
            }
          }),
        )
      }

      onCompleteOnce()

      return _results
    },
    {
      signal,
      onAbort: onCompleteOnce,
    },
  )

  return results ?? []
}

interface PrepareResult {
  isReady: boolean
  recoverScrollTop?: () => void
}

const prepare = async (): Promise<PrepareResult> => {
  const checkIsReady = () => docx.isReady({ checkWhiteboard: true })

  let recoverScrollTop

  if (!checkIsReady()) {
    const initialScrollTop = docx.container?.scrollTop ?? 0
    recoverScrollTop = () => {
      docx.scrollTo({
        top: initialScrollTop,
        behavior: 'instant',
      })
    }

    let top = 0

    docx.scrollTo({
      top,
      behavior: 'instant',
    })

    const maxTryTimes = OneHundred
    let tryTimes = 0

    Toast.loading({
      content: i18next.t(TranslationKey.SCROLL_DOCUMENT),
      keepAlive: true,
      key: TranslationKey.SCROLL_DOCUMENT,
      actionText: i18next.t(TranslationKey.CANCEL),
      onActionClick: () => {
        tryTimes = maxTryTimes
      },
    })

    while (!checkIsReady() && tryTimes <= maxTryTimes) {
      docx.scrollTo({
        top,
        behavior: 'smooth',
      })

      await waitFor(0.4 * Second)

      tryTimes++

      top = docx.container?.scrollHeight ?? 0
    }

    Toast.remove(TranslationKey.SCROLL_DOCUMENT)
  }

  return {
    isReady: checkIsReady(),
    recoverScrollTop,
  }
}

const main = async (options: { signal?: AbortSignal } = {}) => {
  const { signal } = options

  if (docx.isDoc) {
    Toast.warning({ content: i18next.t(TranslationKey.NOT_SUPPORT_DOC_1_0) })

    throw new Error(DOWNLOAD_ABORTED)
  }

  if (!docx.isDocx) {
    Toast.warning({ content: i18next.t(TranslationKey.NOT_SUPPORT) })

    throw new Error(DOWNLOAD_ABORTED)
  }

  const { isReady, recoverScrollTop } = await prepare()

  if (!isReady) {
    Toast.warning({
      content: i18next.t(TranslationKey.CONTENT_LOADING),
    })

    throw new Error(DOWNLOAD_ABORTED)
  }

  const settings = await getSettings([
    SettingKey.DownloadMethod,
    SettingKey.TableWithNonPhrasingContent,
    SettingKey.Grid,
    SettingKey.TextHighlight,
    SettingKey.DownloadFileWithUniqueName,
  ])

  const { root, images, files, invalidTables, mentionUsers } =
    docx.intoMarkdownAST({
      whiteboard: true,
      diagram: true,
      file: true,
      highlight: settings[SettingKey.TextHighlight],
      flatGrid: settings[SettingKey.Grid] === Grid.Flatten,
    })

  await transformMentionUsers(mentionUsers)

  const recommendName = docx.pageTitle
    ? normalizeFileName(docx.pageTitle.slice(0, OneHundred))
    : 'doc'
  const isZip = images.length > 0 || files.length > 0
  const ext = isZip ? '.zip' : '.md'
  const filename = `${recommendName}${ext}`

  const toBlob = async () => {
    Toast.loading({
      content: i18next.t(TranslationKey.STILL_SAVING),
      keepAlive: true,
      key: ToastKey.DOWNLOADING,
    })

    const singleFileContent = () => {
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

      return new Blob([markdown])
    }

    const zipFileContent = async () => {
      const zipFs = new fs.FS()

      const imgs = images.filter(image => image.data?.fetchSources)
      const diagrams = images.filter(image => image.data?.fetchBlob)

      const results = await Promise.all([
        downloadFiles(imgs, {
          batchSize: 15,
          onProgress: progress => {
            Toast.loading({
              content: i18next.t(TranslationKey.DOWNLOAD_PROGRESS, {
                name: i18next.t(TranslationKey.IMAGE),
                progress: Math.floor(progress * OneHundred),
              }),
              keepAlive: true,
              key: TranslationKey.IMAGE,
            })
          },
          onComplete: () => {
            Toast.remove(TranslationKey.IMAGE)
          },
          signal,
          useUUID: settings[SettingKey.DownloadFileWithUniqueName],
          markdownFileName: recommendName,
        }),
        // Diagrams must be downloaded one by one
        downloadFiles(diagrams, {
          batchSize: 1,
          signal,
          useUUID: settings[SettingKey.DownloadFileWithUniqueName],
          markdownFileName: recommendName,
        }),
        downloadFiles(files, {
          onProgress: progress => {
            Toast.loading({
              content: i18next.t(TranslationKey.DOWNLOAD_PROGRESS, {
                name: i18next.t(TranslationKey.FILE),
                progress: Math.floor(progress * OneHundred),
              }),
              keepAlive: true,
              key: TranslationKey.FILE,
            })
          },
          onComplete: () => {
            Toast.remove(TranslationKey.FILE)
          },
          signal,
          useUUID: settings[SettingKey.DownloadFileWithUniqueName],
          markdownFileName: recommendName,
        }),
      ])
      results.flat(1).forEach(({ filename, content }) => {
        zipFs.addBlob(filename, content)
      })

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

      zipFs.addText(`${recommendName}.md`, markdown)

      return await zipFs.exportBlob()
    }

    const content = isZip ? await zipFileContent() : singleFileContent()

    recoverScrollTop?.()

    return content
  }

  if (
    settings[SettingKey.DownloadMethod] === DownloadMethod.ShowSaveFilePicker &&
    supported
  ) {
    if (!navigator.userActivation.isActive) {
      const confirmed = await confirm()
      if (!confirmed) {
        throw new Error(DOWNLOAD_ABORTED)
      }
    }

    await fileSave(toBlob(), {
      fileName: filename,
      extensions: [ext],
    })
  } else {
    const blob = await toBlob()

    legacyFileSave(blob, {
      fileName: filename,
    })
  }
}

let controller = new AbortController()
main({
  signal: controller.signal,
})
  .then(() => {
    Toast.success({
      content: i18next.t(TranslationKey.DOWNLOAD_COMPLETE),
    })
  })
  .catch((error: unknown) => {
    const aborted =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message === DOWNLOAD_ABORTED)

    if (aborted) {
      controller.abort()
    } else {
      Toast.error({
        key: ToastKey.REPORT_BUG,
        content: String(error),
        actionText: i18next.t(CommonTranslationKey.CONFIRM_REPORT_BUG, {
          ns: Namespace.COMMON,
        }),
        duration: Minute,
        onActionClick: () => {
          reportBug(error)

          Toast.remove(ToastKey.REPORT_BUG)
        },
      })
    }
  })
  .finally(() => {
    Toast.remove(ToastKey.DOWNLOADING)

    // @ts-expect-error remove reference
    controller = null
  })
