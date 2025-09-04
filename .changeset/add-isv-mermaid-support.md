---
'@dolphin/lark': minor
'@dolphin/chrome-extension': patch
---

Add support for Feishu text drawing (Mermaid diagrams) in ISV blocks

- Add ISVBlock interface to support document widgets
- Remove ISV from NotSupportedBlock and add proper handling
- Detect Mermaid diagrams by content keywords instead of block_type_id
- Support 12 types of Mermaid diagrams: mindmap, flowchart, graph, sequenceDiagram, classDiagram, stateDiagram, erDiagram, journey, gantt, pie, gitgraph, timeline
- Convert ISV text drawing widgets to Markdown code blocks with preserved metadata
