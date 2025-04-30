import i18next from 'i18next'
import { Toast, docx } from '@dolphin/lark'
import { CommonTranslationKey, en, Namespace, zh } from '../common/i18n'
import { reportBug } from '../common/issue'

const enum TranslationKey {
  NOT_SUPPORT = 'not_support',
  UNKNOWN_ERROR = 'unknown_error',
  NO_REFERENCES = 'no_references',
  REFERENCES_FOUND = 'references_found',
}

// 初始化 i18n
i18next.init({
  lng: document.documentElement.lang.includes('zh') ? 'zh' : 'en',
  resources: {
    en: {
      translation: {
        [TranslationKey.NOT_SUPPORT]:
          'This is not a Lark document page',
        [TranslationKey.UNKNOWN_ERROR]:
          'An error occurred while parsing references',
        [TranslationKey.NO_REFERENCES]:
          'No document references found in this page',
        [TranslationKey.REFERENCES_FOUND]:
          'Document References',
      },
      ...en,
    },
    zh: {
      translation: {
        [TranslationKey.NOT_SUPPORT]:
          '这不是一个飞书文档页面',
        [TranslationKey.UNKNOWN_ERROR]:
          '解析引用时发生错误',
        [TranslationKey.NO_REFERENCES]:
          '本页面未找到文档引用',
        [TranslationKey.REFERENCES_FOUND]:
          '文档引用列表',
      },
      ...zh,
    },
  },
})

interface DocReference {
  title: string;
  url: string;
}

const parseDocReferences = (): DocReference[] => {
  const references: DocReference[] = [];
  
  if (!docx.rootBlock) {
    console.error("No root block found");
    return references;
  }

  const rootBlock = docx.rootBlock;

  const traverseBlock = (block: any) => {
    if (block.zoneState?.content?.ops) {
      const operations = block.zoneState.content.ops.filter((op: any) => {
        if (!op.attributes && op.insert === '\n') {
          return false;
        }
        if (op.attributes?.fixEnter) {
          return false;
        }
        return true;
      });

      operations.forEach((op: any) => {
        if (op.attributes?.['inline-component']) {
          try {
            const inlineComponent = JSON.parse(op.attributes['inline-component']);
            if (inlineComponent.type === 'mention_doc') {
              references.push({
                title: inlineComponent.data.title,
                url: inlineComponent.data.raw_url
              });
            }
          } catch (e) {
            console.warn('Failed to parse inline component:', e);
          }
        }
      });
    }

    if (block.children) {
      block.children.forEach((child: any) => {
        if (child.type === 'grid') {
          child.children.forEach((column: any) => {
            column.children.forEach(traverseBlock);
          });
        } else if (child.type?.startsWith('heading')) {
          traverseBlock(child);
          child.children.forEach(traverseBlock);
        } else if (child.type === 'synced_source') {
          child.children.forEach(traverseBlock);
        } else {
          traverseBlock(child);
        }
      });
    }
  };

  traverseBlock(rootBlock);
  return references;
};

const createReferencesModal = (references: DocReference[]) => {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
  `;
  
  const title = document.createElement('h3');
  title.textContent = i18next.t(TranslationKey.REFERENCES_FOUND);
  title.style.margin = '0';
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '✕';
  closeButton.style.cssText = `
    border: none;
    background: none;
    cursor: pointer;
    font-size: 20px;
    padding: 4px;
  `;
  closeButton.onclick = () => {
    modal.remove();
    overlay.remove();
  };
  
  header.appendChild(title);
  header.appendChild(closeButton);
  modal.appendChild(header);

  if (references.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = i18next.t(TranslationKey.NO_REFERENCES);
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.color = '#666';
    modal.appendChild(emptyMessage);
  } else {
    const list = document.createElement('ul');
    list.style.cssText = `
      list-style: none;
      padding: 0;
      margin: 0;
    `;

    references.forEach((ref, index) => {
      const item = document.createElement('li');
      item.style.cssText = `
        padding: 12px;
        border-bottom: 1px solid #eee;
        ${index === references.length - 1 ? 'border-bottom: none;' : ''}
      `;

      const link = document.createElement('a');
      link.href = ref.url;
      link.target = '_blank';
      link.textContent = ref.title;
      link.style.cssText = `
        color: #3370ff;
        text-decoration: none;
        display: block;
        &:hover {
          text-decoration: underline;
        }
      `;

      item.appendChild(link);
      list.appendChild(item);
    });

    modal.appendChild(list);
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 9999;
  `;
  overlay.onclick = () => {
    overlay.remove();
    modal.remove();
  };

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
};

const main = () => {
  if (!docx.rootBlock) {
    Toast.warning({ content: i18next.t(TranslationKey.NOT_SUPPORT) });
    return;
  }

  try {
    const references = parseDocReferences();
    console.log("all-links",references);
    createReferencesModal(references);
  } catch (error) {
    Toast.error({
      content: i18next.t(TranslationKey.UNKNOWN_ERROR),
      actionText: i18next.t(CommonTranslationKey.CONFIRM_REPORT_BUG, {
        ns: Namespace.COMMON,
      }),
      onActionClick: () => {
        reportBug(error);
      },
    });
  }
};

main();
