import { test, describe, expect } from 'vitest'
import { BlockType, Docx, Transformer } from '../../src/docx'

const transformer = new Transformer()

describe('hr', () => {
  test('hr after iframe', () => {
    const { root } = transformer.transform({
      id: 1,
      type: BlockType.PAGE,
      snapshot: {
        type: BlockType.PAGE,
      },
      children: [
        {
          id: 2,
          type: BlockType.IFRAME,
          snapshot: {
            type: BlockType.IFRAME,
            iframe: {
              resize_type: 1,
              component: {
                original_text:
                  'https%3A%2F%2Fwaytoagi.feishu.cn%2Fshare%2Fbase%2Fform%2FshrcndlVeIpGvhhWvnsVfMhuFbf',
                url: 'https://waytoagi.feishu.cn/share/base/form/shrcndlVeIpGvhhWvnsVfMhuFbf?iframeFrom=docx&ccm_open=iframe',
                type: 'byte_base_form',
              },
              width: 730,
              height: 460,
              original_height: 460,
              original_width: 730,
              is_modified: false,
            },
          },
          children: [],
        },
        {
          id: 3,
          type: BlockType.DIVIDER,
          snapshot: {
            type: BlockType.DIVIDER,
          },
          children: [],
        },
      ],
    })

    expect(root).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "type": "html",
            "value": "<iframe src="https://waytoagi.feishu.cn/share/base/form/shrcndlVeIpGvhhWvnsVfMhuFbf?iframeFrom=docx&ccm_open=iframe" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-downloads" allowfullscreen allow="encrypted-media; fullscreen; autoplay" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" style="width: 100%; min-height: 460px; border-radius: 8px;"></iframe>",
          },
          {
            "type": "thematicBreak",
          },
        ],
        "type": "root",
      }
    `)

    expect(Docx.stringify(root)).toMatchInlineSnapshot(`
      "<iframe src="https://waytoagi.feishu.cn/share/base/form/shrcndlVeIpGvhhWvnsVfMhuFbf?iframeFrom=docx&ccm_open=iframe" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-downloads" allowfullscreen allow="encrypted-media; fullscreen; autoplay" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" style="width: 100%; min-height: 460px; border-radius: 8px;"></iframe>

      ***
      "
    `)
  })
})
