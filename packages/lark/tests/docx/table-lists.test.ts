import { describe, expect, it } from 'vitest'
import { BlockType, Transformer } from '../../src/docx'

const transformer = new Transformer()

describe('table with lists', () => {
  describe('table cell containing list with formatted content', () => {
    it('should convert list to HTML tags and preserve formatting', () => {
      const result = transformer.transform({
        id: 1,
        type: BlockType.PAGE,
        snapshot: {
          type: BlockType.PAGE,
        },
        children: [
          {
            id: 2,
            type: BlockType.TABLE,
            snapshot: {
              type: BlockType.TABLE,
              rows_id: ['row1'],
              columns_id: ['col1', 'col2'],
            },
            children: [
              {
                id: 3,
                type: BlockType.CELL,
                snapshot: {
                  type: BlockType.CELL,
                },
                children: [
                  {
                    id: 4,
                    type: BlockType.TEXT,
                    snapshot: {
                      type: BlockType.TEXT,
                    },
                    zoneState: {
                      allText: '',
                      content: {
                        ops: [
                          {
                            insert: 'header',
                            attributes: {},
                          },
                        ],
                      },
                    },
                    children: [],
                  },
                ],
              },
              {
                id: 5,
                type: BlockType.CELL,
                snapshot: {
                  type: BlockType.CELL,
                },
                children: [
                  {
                    id: 6,
                    type: BlockType.BULLET,
                    snapshot: {
                      type: BlockType.BULLET,
                    },
                    zoneState: {
                      allText: '',
                      content: {
                        ops: [
                          {
                            insert: 'plain text',
                            attributes: {},
                          },
                        ],
                      },
                    },
                    children: [],
                  },
                  {
                    id: 7,
                    type: BlockType.BULLET,
                    snapshot: {
                      type: BlockType.BULLET,
                    },
                    zoneState: {
                      allText: '',
                      content: {
                        ops: [
                          {
                            insert: 'bold text',
                            attributes: {
                              bold: 'true',
                            },
                          },
                        ],
                      },
                    },
                    children: [],
                  },
                  {
                    id: 8,
                    type: BlockType.BULLET,
                    snapshot: {
                      type: BlockType.BULLET,
                    },
                    zoneState: {
                      allText: '',
                      content: {
                        ops: [
                          {
                            insert: 'italic text',
                            attributes: {
                              italic: 'true',
                            },
                          },
                        ],
                      },
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(result.root).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'table',
            children: [
              {
                type: 'tableRow',
                children: [
                  {
                    type: 'tableCell',
                    children: [
                      {
                        type: 'text',
                        value: 'header',
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    children: [
                      {
                        type: 'html',
                        value:
                          '<ul><li>plain text</li><li><strong>bold text</strong></li><li><em>italic text</em></li></ul>',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
    })

    it('should handle nested lists in table cells', () => {
      const result = transformer.transform({
        id: 1,
        type: BlockType.PAGE,
        snapshot: {
          type: BlockType.PAGE,
        },
        children: [
          {
            id: 2,
            type: BlockType.TABLE,
            snapshot: {
              type: BlockType.TABLE,
              rows_id: ['row1'],
              columns_id: ['col1'],
            },
            children: [
              {
                id: 3,
                type: BlockType.CELL,
                snapshot: {
                  type: BlockType.CELL,
                },
                children: [
                  {
                    id: 4,
                    type: BlockType.BULLET,
                    snapshot: {
                      type: BlockType.BULLET,
                    },
                    zoneState: {
                      allText: '',
                      content: {
                        ops: [
                          {
                            insert: 'parent item',
                            attributes: {},
                          },
                        ],
                      },
                    },
                    children: [
                      {
                        id: 5,
                        type: BlockType.BULLET,
                        snapshot: {
                          type: BlockType.BULLET,
                        },
                        zoneState: {
                          allText: '',
                          content: {
                            ops: [
                              {
                                insert: 'child item',
                                attributes: {},
                              },
                            ],
                          },
                        },
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(result.root).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'table',
            children: [
              {
                type: 'tableRow',
                children: [
                  {
                    type: 'tableCell',
                    children: [
                      {
                        type: 'html',
                        value:
                          '<ul><li>parent item<ul><li>child item</li></ul></li></ul>',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
    })

    it('should handle deeply nested lists in table cells', () => {
      const result = transformer.transform({
        id: 1,
        type: BlockType.PAGE,
        snapshot: {
          type: BlockType.PAGE,
        },
        children: [
          {
            id: 2,
            type: BlockType.TABLE,
            snapshot: {
              type: BlockType.TABLE,
              rows_id: ['row1'],
              columns_id: ['col1'],
            },
            children: [
              {
                id: 3,
                type: BlockType.CELL,
                snapshot: {
                  type: BlockType.CELL,
                },
                children: [
                  {
                    id: 4,
                    type: BlockType.BULLET,
                    snapshot: {
                      type: BlockType.BULLET,
                    },
                    zoneState: {
                      allText: '',
                      content: {
                        ops: [
                          {
                            insert: '条件4：单选，枚举值如下',
                            attributes: {
                              bold: 'true',
                            },
                          },
                        ],
                      },
                    },
                    children: [
                      {
                        id: 5,
                        type: BlockType.BULLET,
                        snapshot: {
                          type: BlockType.BULLET,
                        },
                        zoneState: {
                          allText: '',
                          content: {
                            ops: [
                              {
                                insert: '货单节点',
                                attributes: {},
                              },
                            ],
                          },
                        },
                        children: [
                          {
                            id: 6,
                            type: BlockType.BULLET,
                            snapshot: {
                              type: BlockType.BULLET,
                            },
                            zoneState: {
                              allText: '',
                              content: {
                                ops: [
                                  {
                                    insert: '接单完成',
                                    attributes: {},
                                  },
                                ],
                              },
                            },
                            children: [],
                          },
                          {
                            id: 7,
                            type: BlockType.BULLET,
                            snapshot: {
                              type: BlockType.BULLET,
                            },
                            zoneState: {
                              allText: '',
                              content: {
                                ops: [
                                  {
                                    insert: '备货完成',
                                    attributes: {},
                                  },
                                ],
                              },
                            },
                            children: [],
                          },
                          {
                            id: 8,
                            type: BlockType.BULLET,
                            snapshot: {
                              type: BlockType.BULLET,
                            },
                            zoneState: {
                              allText: '',
                              content: {
                                ops: [
                                  {
                                    insert: '进仓完成',
                                    attributes: {},
                                  },
                                ],
                              },
                            },
                            children: [
                              {
                                id: 9,
                                type: BlockType.BULLET,
                                snapshot: {
                                  type: BlockType.BULLET,
                                },
                                zoneState: {
                                  allText: '',
                                  content: {
                                    ops: [
                                      {
                                        insert: '之前x天',
                                        attributes: {},
                                      },
                                    ],
                                  },
                                },
                                children: [],
                              },
                              {
                                id: 10,
                                type: BlockType.BULLET,
                                snapshot: {
                                  type: BlockType.BULLET,
                                },
                                zoneState: {
                                  allText: '',
                                  content: {
                                    ops: [
                                      {
                                        insert: '当天',
                                        attributes: {},
                                      },
                                    ],
                                  },
                                },
                                children: [],
                              },
                              {
                                id: 11,
                                type: BlockType.BULLET,
                                snapshot: {
                                  type: BlockType.BULLET,
                                },
                                zoneState: {
                                  allText: '',
                                  content: {
                                    ops: [
                                      {
                                        insert: '之后x天',
                                        attributes: {},
                                      },
                                    ],
                                  },
                                },
                                children: [],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(result.root).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'table',
            children: [
              {
                type: 'tableRow',
                children: [
                  {
                    type: 'tableCell',
                    children: [
                      {
                        type: 'html',
                        value:
                          '<ul><li><strong>条件4：单选，枚举值如下</strong><ul><li>货单节点<ul><li>接单完成</li><li>备货完成</li><li>进仓完成<ul><li>之前x天</li><li>当天</li><li>之后x天</li></ul></li></ul></li></ul></li></ul>',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
    })

    it('should handle ordered lists in table cells', () => {
      const result = transformer.transform({
        id: 1,
        type: BlockType.PAGE,
        snapshot: {
          type: BlockType.PAGE,
        },
        children: [
          {
            id: 2,
            type: BlockType.TABLE,
            snapshot: {
              type: BlockType.TABLE,
              rows_id: ['row1'],
              columns_id: ['col1'],
            },
            children: [
              {
                id: 3,
                type: BlockType.CELL,
                snapshot: {
                  type: BlockType.CELL,
                },
                children: [
                  {
                    id: 4,
                    type: BlockType.ORDERED,
                    snapshot: {
                      type: BlockType.ORDERED,
                      seq: '1',
                    },
                    zoneState: {
                      allText: '',
                      content: {
                        ops: [
                          {
                            insert: 'first',
                            attributes: {},
                          },
                        ],
                      },
                    },
                    children: [],
                  },
                  {
                    id: 5,
                    type: BlockType.ORDERED,
                    snapshot: {
                      type: BlockType.ORDERED,
                      seq: '2',
                    },
                    zoneState: {
                      allText: '',
                      content: {
                        ops: [
                          {
                            insert: 'second',
                            attributes: {},
                          },
                        ],
                      },
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(result.root).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'table',
            children: [
              {
                type: 'tableRow',
                children: [
                  {
                    type: 'tableCell',
                    children: [
                      {
                        type: 'html',
                        value: '<ol><li>first</li><li>second</li></ol>',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
    })
  })
})
