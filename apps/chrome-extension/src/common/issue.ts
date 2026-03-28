import i18next from 'i18next'
import { serializeError } from 'serialize-error'
import { CommonTranslationKey, Namespace } from './i18n'
import { version } from '../../package.json'

interface Issue {
  /**
   * Title
   */
  title: string
  /**
   * Description
   */
  body: string
  /**
   * Labels
   */
  labels?: Label[]
  /**
   * Issue template
   */
  template: string
}

enum Label {
  /**
   * Something isn't working
   */
  Bug = 'bug',
}

function generateIssueUrl(issue: Issue): string {
  const { title, body, labels = [], template } = issue

  const url = new URL(
    'https://github.com/whale4113/cloud-document-converter/issues/new',
  )

  if (title) url.searchParams.set('title', title)
  if (body) url.searchParams.set('body', body)
  if (labels.length > 0) url.searchParams.set('labels', labels.join(','))
  if (template) url.searchParams.set('template', template)

  return url.toString()
}

export const reportBug = (error: unknown): void => {
  let errorInfo = JSON.stringify(serializeError(error), null, 2)
  const MAX_ERROR_LENGTH = 1000
  if (errorInfo.length > MAX_ERROR_LENGTH) {
    errorInfo =
      errorInfo.slice(0, MAX_ERROR_LENGTH) + '\n...[truncated due to length]'
  }

  const url = generateIssueUrl({
    title: '',
    body: i18next.t(CommonTranslationKey.ISSUE_TEMPLATE_BODY, {
      version,
      errorInfo,
      ns: Namespace.COMMON,
      interpolation: { escapeValue: false },
    }),
    labels: [Label.Bug],
    template: 'bug.md',
  })

  window.open(url, '__blank')
}
