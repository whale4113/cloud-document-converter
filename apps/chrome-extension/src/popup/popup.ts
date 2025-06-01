document.querySelectorAll<HTMLElement>('[data-locale]').forEach(elem => {
  elem.innerText = chrome.i18n.getMessage(elem.dataset['locale'] ?? '')
})

const copyButton: HTMLElement | null = document.getElementById(
  'copy_docx_as_markdown',
)
if (copyButton) {
  const handleCopy = async () => {
    await chrome.runtime.sendMessage({ flag: 'copy_docx_as_markdown' })

    window.close()
  }

  copyButton.addEventListener('click', () => {
    handleCopy().catch(console.error)
  })
}

const downloadButton: HTMLElement | null = document.getElementById(
  'download_docx_as_markdown',
)
if (downloadButton) {
  const handleDownload = async () => {
    await chrome.runtime.sendMessage({ flag: 'download_docx_as_markdown' })

    window.close()
  }

  downloadButton.addEventListener('click', () => {
    handleDownload().catch(console.error)
  })
}
