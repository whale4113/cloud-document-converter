import { injectReferencesButton } from './all_links_content';
import { injectDownloadButton } from './download_content';

const COMMENT_BUTTON_CLASS = '.docx-comment__first-comment-btn'
const HELP_BLOCK_CLASS = '.help-block'

let disposables: (() => void)[] = []

const dispose = () => {
  disposables.forEach(disposable => disposable())

  disposables = []
}

interface Button {
  element: HTMLElement
  width: number
  height: number
}

const initButtons = () => {
  const root = document.body

  const isReady = () => {
    // Comment button may not be displayed
    for (const selector of [HELP_BLOCK_CLASS]) {
      if (!root.querySelector(selector)) {
        return false
      }
    }
    return true
  }

  const render = () => {
    const style = document.createElement('style')
    style.innerHTML = `
  [data-CDC-button-type] {
    position: fixed;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid var(--line-border-card);
    border-radius: 50%;
    background-color: var(--bg-body);
    box-shadow: var(--shadow-s4-down);
    cursor: pointer;
    text-align: center;
    color: var(--text-title);
    z-index: 3;
  }

  [data-CDC-button-type]:hover {
    color: var(--colorful-blue);
  }
  `

    const operates = [
      {
        type: 'copy',
        innerHtml: `<svg aria-hidden="true" focusable="false" role="img" class="octicon octicon-copy" viewBox="0 0 16 16" width="16"
          height="16" fill="currentColor">
          <path
              d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z">
          </path>
          <path
              d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z">
          </path>
          </svg>`,
        action: () => {
          chrome.runtime.sendMessage({ flag: 'copy_docx_as_markdown' })
        },
      },
      {
        type: 'download',
        innerHtml: `<svg aria-hidden="true" focusable="false" role="img" class="octicon octicon-download" viewBox="0 0 16 16"
        width="16" height="16" fill="currentColor">
        <path
          d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z">
        </path>
        <path
          d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z">
        </path>
      </svg>`,
        action: () => {
          chrome.runtime.sendMessage({ flag: 'download_docx_as_markdown' })
        },
      },
    ]

    const buttons = operates.map<Button>(({ type, innerHtml, action }) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-CDC-button-type', type)
      btn.innerHTML = innerHtml

      btn.style.width = '36px'
      btn.style.height = '36px'

      btn.addEventListener('click', action)

      return {
        element: btn,
        width: 36,
        height: 36,
      }
    })

    const getOriginalBtnPos = () => {
      const helpBlock: HTMLDivElement | null =
        root.querySelector(HELP_BLOCK_CLASS)
      if (!helpBlock) {
        return
      }

      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      const helpBlockRect = helpBlock.getBoundingClientRect()

      const commentButton: HTMLDivElement | null =
        root.querySelector(COMMENT_BUTTON_CLASS)

      // Comment button may not be displayed
      if (!commentButton) {
        const startBottom = windowHeight - helpBlockRect.bottom
        const right = windowWidth - helpBlockRect.right
        const btnHeight = 36
        const gap = 14
        const itemHeight = gap + btnHeight

        return [
          {
            right,
            bottom: startBottom + 1 * itemHeight,
          },
          {
            right,
            bottom: startBottom + 2 * itemHeight,
          },
        ]
      }

      const commentButtonRect = commentButton.getBoundingClientRect()

      if (commentButtonRect.right === helpBlockRect.right) {
        const btnHeight = commentButtonRect.height
        const gap =
          Math.abs(helpBlockRect.bottom - commentButtonRect.bottom) - btnHeight
        const min = Math.min(
          windowHeight - commentButtonRect.bottom,
          windowHeight - helpBlockRect.bottom,
        )

        return [
          {
            right: windowWidth - commentButtonRect.right,
            bottom: min + 2 * gap + 2 * btnHeight,
          },
          {
            right: windowWidth - helpBlockRect.right,
            bottom: min + 3 * gap + 3 * btnHeight,
          },
        ]
      } else if (commentButtonRect.bottom === helpBlockRect.bottom) {
        return [
          { right: windowWidth - commentButtonRect.right, bottom: 90 },
          { right: windowWidth - helpBlockRect.right, bottom: 90 },
        ]
      }
    }

    const layout = (buttons: Button[]) => {
      const pos = getOriginalBtnPos()
      if (!pos) return

      buttons.forEach((button, index) => {
        button.element.style.right = pos[index].right + 'px'
        button.element.style.bottom = pos[index].bottom + 'px'
      })
    }

    // When the width of the docx's visible content is too narrow, the position of the comment button changes.
    const autoLayoutObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          layout(buttons)
        }
      }
    })
    const autoLayout = () => {
      const commentButton = root.querySelector(COMMENT_BUTTON_CLASS)
      if (!commentButton) {
        return
      }

      autoLayoutObserver.observe(commentButton, {
        attributes: true,
        attributeFilter: ['class'],
      })
    }

    layout(buttons)
    autoLayout()

    root.appendChild(style)
    buttons.forEach(button => {
      root.appendChild(button.element)
    })

    const unmount = () => {
      autoLayoutObserver.disconnect()

      buttons.forEach(button => {
        if (root.contains(button.element)) {
          root.removeChild(button.element)
        }
      })

      if (root.contains(style)) {
        root.removeChild(style)
      }
    }

    disposables.push(unmount)

    return unmount
  }

  let unmount: (() => void) | null = null
  const init = () => {
    // Rendering may be called multiple times
    if (unmount) {
      unmount()

      unmount = null
    }

    unmount = render()
  }

  const initObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.matches(COMMENT_BUTTON_CLASS) ||
              node.matches(HELP_BLOCK_CLASS)) &&
            isReady()
          ) {
            init()
          }
        }
      }
    }
  })

  isReady() && init()

  initObserver.observe(root, {
    childList: true,
    subtree: true,
  })

  disposables.push(() => {
    initObserver.disconnect()
  })
}

function initContent() {
  initButtons()
}

window.addEventListener('load', initContent, false)

// For SPA, some page content updates do not trigger page reloads
let lastPathname: string = location.pathname
const urlChangeObserver = new MutationObserver(() => {
  const pathname = location.pathname

  if (pathname !== lastPathname) {
    lastPathname = pathname

    dispose()

    initContent()
  }
})
urlChangeObserver.observe(document.body, { childList: true })

const main = async () => {
  // ... 现有的代码 ...

  // 注入下载按钮
  injectDownloadButton();
  injectReferencesButton(); // 添加引用列表按钮
  
  // ... 现有的代码 ...
};

main();
