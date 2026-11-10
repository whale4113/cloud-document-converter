<p align="center">
  <p align="center">
   <img width="150" height="150" src="apps/chrome-extension/design/logo.svg" alt="Logo">
  </p>
	<h1 align="center"><b>Cloud Document Converter</b></h1>
</p>

Cloud Document Converter 是一个浏览器扩展， 支持下载、复制飞书云文档为 Markdown。

[English](./README.md) · **简体中文**

# 安装

从 [Chrome 应用商店](https://chromewebstore.google.com/detail/cloud-document-converter/ehkomhhcinhikfddnmklbloahaakploh)、[Microsoft Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/pcjebkebnehplnpkpnhipagefaffiopp) 和 [Firefox 附加组件](https://addons.mozilla.org/addon/cloud-document-converter) 安装 Cloud Document Converter。

# 功能

- 下载飞书云文档为 Markdown

- 复制飞书云文档为 Markdown

  > ❗注意: 通过这种方式生成的图像 URL 只有两个小时的访问时间。这意味着两小时后，将无法再访问图像资源。

- 批量下载多篇飞书云文档为 Markdown，打包成一个 ZIP（扩展弹窗 → **批量下载**）

  - **从飞书知识库刷新**：粘贴知识库页面链接，点击 **立即刷新**。扩展会按侧边栏顺序读取该页面及其下所有页面，生成下载目录树：每个页面命名为 `001 - 标题`，有子页面的页面后面跟一个同名文件夹。刷新后先显示新增、删除、改名和移动的页面，点击 **应用** 后才会替换目录树。
  - **每次导出前刷新**（默认关闭）：知识库没有变化时直接开始导出；有变化时可选择 **应用并导出**、**按当前目录树导出** 或 **取消导出**。
  - 页面按知识库 ID 匹配，本次会话中已导出的页面保留原有结果。上传的文件（如 `.py`、`.pdf` 附件）会被跳过，并附链接列出。
  - **高级选项**按知识库分别保存：放在根页面之前的页面、标题覆盖、仅保留部分顶级章节（编号仍与完整目录树一致）。
  - 需要在同一浏览器中登录飞书。不需要额外权限。

# 兼容性

## 块级元素

| **飞书云文档**        | **支持情况** | **Markdown**                      |
| --------------------- | ------------ | --------------------------------- |
| 分割线                | ✅            | Thematic Break                    |
| 标题 (一级至六级)     | ✅            | ATX Headings (Level 1 to level 6) |
| 标题 (七级至九级)     | ✅            | Paragraph                         |
| 代码块                | ✅            | Code Block                        |
| 引用                  | ✅            | Blockquote                        |
| 无序列表              | ✅            | Bullet list                       |
| 有序列表              | ✅            | Ordered list                      |
| 任务列表              | ✅            | Task list                         |
| 表格                  | ✅            | Table                             |
| 图片                  | ✅            | Image                             |
| 公示                  | ✅            | Math Block                        |
| 高亮块                | ❌            | Blockquote                        |
| 引用块                | ✅            |                                   |
| 图表 (流程图、UML 图) | ❌            | Image（仅下载支持）               |
| 分栏                  | ✅            | Flatten/Table/HTML               |
| 多维表格              | 待定         |                                   |
| 群名片                | 待定         |                                   |
| 文件                  | ❌            | Link（仅下载支持）                |
| 内嵌网页              | ✅            | HTML                              |
| 小组件                | 待定         | 文本绘图 -> Code Block ✅          |
| 思维笔记              | 待定         |                                   |
| 电子表格              | 待定         |                                   |

## 行内元素

| **飞书云文档** | **支持情况** | **Markdown** |
| -------------- | ------------ | ------------ |
| 加粗           | ✅            | Bold         |
| 删除线         | ✅            | Delete       |
| 倾斜           | ✅            | Italic       |
| 行内代码       | ✅            | Inline Code  |
| 链接           | ✅            | Link         |
| 字体颜色       | ✅            | HTML         |
| 字体背景色     | ✅            | HTML         |
| 下划线        | ✅            | HTML (`<u>`) |

## 其它

- 缩进和对齐：待定

# 贡献

如果你有兴趣修复问题并直接为代码库做出贡献，请参阅文档 [如何贡献](./contributing.md)。

# 支持我

如果你喜欢这个项目，欢迎你请我喝杯咖啡！你的支持将帮助我继续改进和维护这个项目。

[请我喝咖啡 ☕](https://lujunji.vercel.app/about)

# 免责声明

本项目（以下简称“项目”）仅供参考和学习使用。作者尽力确保项目的准确性和可靠性，但不提供任何明示或暗示的保证，包括但不限于对项目的适销性、特定用途的适用性或无侵权的保证。

作者不对因使用本项目而产生的任何直接、间接、偶然、特殊、惩罚性或结果性损害承担任何责任，包括但不限于因使用、误用、或依赖项目中的信息而导致的利润损失、业务中断或数据丢失。

本项目中的所有内容均基于作者的个人见解和经验，不代表任何组织或公司的观点。

使用者应自行承担使用本项目所产生的一切风险。在任何情况下，作者均不对使用本项目而导致的任何损失或损害承担责任。
