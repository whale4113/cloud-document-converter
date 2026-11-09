import { watch } from 'vue'
import { createI18n, useI18n } from 'vue-i18n'
import { SettingKey } from '@/common/settings'
import { defaultSettings, useSettings } from './settings'

export const i18n = createI18n({
  locale:
    localStorage.getItem('cache.locale') ?? defaultSettings[SettingKey.Locale],
  fallbackLocale: 'en-US',
  messages: {
    'en-US': {
      general: 'General',
      save: 'Save',
      settings: 'Settings',
      home: 'Home',
      download: 'Download',
      'language.en-US': 'English (American)',
      'language.zh-CN': 'Chinese (simplified)',
      'general.language': 'Language',
      'general.language.placeholder': 'Select language',
      'general.theme': 'Theme',
      'general.theme.placeholder': 'Select theme',
      'general.theme.light': 'Light',
      'general.theme.dark': 'Dark',
      'general.theme.system': 'System',
      'general.table': 'Handling of tables',
      'general.table.placeholder': 'Select handling',
      'general.table.filtered': 'Filter non-phrasing content',
      'general.table.non_phrasing_content_to_html':
        'Convert table with non-phrasing content to HTML',
      'general.table.to_html': 'Convert all tables to HTML',
      'general.grid': 'Handling of grids',
      'general.grid.placeholder': 'Select handling',
      'general.grid.flatten': 'Flatten',
      'general.grid.to_table': 'To Table',
      'general.grid.to_html': 'To HTML',
      'general.text_highlight':
        'Preserve text highlighting (font color, font background color)',
      'download.file_with_unique_name':
        'Use UUID for image and diagram filenames',
      'download.method': 'Download Method',
      'download.method.placeholder': 'Select download method',
      'download.method.direct': 'Direct Download',
      'download.method.showSaveFilePicker': 'Show Save File Picker',
      'download.method.direct.description':
        'How browsers treat downloads varies by browser, user settings, and other factors.The user may be prompted before a download starts, or the file may be saved automatically, or it may open automatically, either in an external application or in the browser itself.',
      'download.method.showSaveFilePicker.description':
        'Shows a file picker that allows a user to save a file. Either by selecting an existing file, or entering a name for a new file.',
      'lark.docx.download': 'Download as Markdown',
      'lark.docx.copy': 'Copy as Markdown',
      'lark.docx.view': 'View as Markdown',
      'lark.docx.batch_download': 'Batch Download',
      'help.and.feedback': 'Help and Feedback',
      'batch_download.title': 'Batch Download Workbench',
      'batch_download.manual_capture': 'Manual Capture Links',
      'batch_download.manual_capture.active': 'Capturing Link...',
      'batch_download.manual_capture.desc':
        'In capture mode, clicking Feishu/Lark links on any Feishu page will automatically open them in a new tab and capture them.',
      'batch_download.download_export': 'Download & Export',
      'batch_download.new_folder': 'New Folder',
      'batch_download.delete': 'Delete',
      'batch_download.rename': 'Rename',
      'batch_download.search': 'Search files/folders...',
      'batch_download.no_files':
        'No files added yet. Toggle "Manual Capture Links" to capture documents.',
      'batch_download.root_folder': 'Root',
      'batch_download.status.pending': 'Pending',
      'batch_download.status.loading': 'Extracting...',
      'batch_download.status.success': 'Success',
      'batch_download.status.failed': 'Failed',
      'batch_download.downloading':
        'Exporting... please do not close this tab.',
      'batch_download.complete': 'Export complete!',
      'batch_download.export_state': 'Export Preview State',
      'batch_download.import_state': 'Import Preview State',
      'batch_download.import_state.success':
        'Successfully imported preview state.',
      'batch_download.import_state.invalid':
        'Invalid preview state file format.',
      'batch_download.refresh.title': 'Refresh from Feishu wiki',
      'batch_download.refresh.desc':
        'Rebuild the tree from a wiki page and everything under it, in sidebar order. You see what changed before anything is replaced; pages already exported this session are kept.',
      'batch_download.refresh.root_url': 'Wiki root page URL',
      'batch_download.refresh.root_url.placeholder':
        'https://xxx.feishu.cn/wiki/...',
      'batch_download.refresh.invalid_url':
        'Enter a wiki page URL, e.g. https://xxx.feishu.cn/wiki/<token>.',
      'batch_download.refresh.before_each_run': 'Refresh before each export',
      'batch_download.refresh.numbering':
        'Number names (001 - …) to keep sidebar order in the ZIP',
      'batch_download.refresh.advanced': 'Advanced options',
      'batch_download.refresh.leads': 'Pages before the root',
      'batch_download.refresh.leads.hint':
        'Pages outside this wiki tree to put first. Title optional.',
      'batch_download.refresh.renames': 'Title overrides',
      'batch_download.refresh.renames.hint':
        'Use your own title for a page, e.g. to fix a typo.',
      'batch_download.refresh.only': 'Only these sections',
      'batch_download.refresh.only.hint':
        'Keep top-level sections whose title starts with a line here. Numbers stay as in the full tree.',
      'batch_download.refresh.pairs.placeholder':
        'https://xxx.feishu.cn/wiki/<token> = Title',
      'batch_download.refresh.only.placeholder': '1.\n2.',
      'batch_download.refresh.now': 'Refresh now',
      'batch_download.refresh.cancel': 'Cancel',
      'batch_download.refresh.walking': 'Reading wiki… {count} pages',
      'batch_download.refresh.busy':
        'Refresh is unavailable while an export is running or paused.',
      'batch_download.refresh.preview': 'Refresh preview',
      'batch_download.refresh.summary':
        '{before} → {after} pages: {added} added, {removed} removed, {renamed} renamed, {moved} moved',
      'batch_download.refresh.reordered': 'order changed',
      'batch_download.refresh.no_changes': 'The wiki matches the current tree.',
      'batch_download.refresh.kept':
        '{count} pages already exported this session will be kept.',
      'batch_download.refresh.apply': 'Apply',
      'batch_download.refresh.discard': 'Discard',
      'batch_download.refresh.apply_run': 'Apply and export',
      'batch_download.refresh.keep_current': 'Export current tree',
      'batch_download.refresh.cancel_run': 'Cancel export',
      'batch_download.refresh.walking_log': 'Reading wiki tree from {url}',
      'batch_download.refresh.walked':
        'Read {count} pages from Feishu (via {mode}).',
      'batch_download.refresh.failed':
        'Wiki refresh failed; the current tree is unchanged. {error}',
      'batch_download.refresh.cancelled':
        'Wiki refresh cancelled; the current tree is unchanged.',
      'batch_download.refresh.bad_line':
        'Ignored a line that is not "<wiki URL or token> = <title>": {line}',
      'batch_download.refresh.lead_no_title':
        'Could not read the title of {token}; using the token. Add "= Title" to that line.',
      'batch_download.refresh.dropped':
        'Skipped non-document page (download it directly): {title} {url}',
      'batch_download.refresh.dropped_short': 'Skipped non-document: {title}',
      'batch_download.refresh.unused_rename':
        'Title override matched no page: {token}',
      'batch_download.refresh.empty': 'The wiki returned no pages to export.',
      'batch_download.refresh.applied':
        'Applied refreshed tree: {files} files, {folders} folders ({kept} kept).',
      'batch_download.refresh.kept_current':
        'Exporting the current tree without the wiki changes.',
    },
    'zh-CN': {
      general: '通用',
      save: '保存',
      settings: '设置',
      home: '首页',
      download: '下载',
      'language.en-US': '英语（美式）',
      'language.zh-CN': '中文（简体）',
      'general.language': '语言',
      'general.language.placeholder': '选择语言',
      'general.theme': '主题',
      'general.theme.placeholder': '选择主题',
      'general.theme.light': '浅色',
      'general.theme.dark': '深色',
      'general.theme.system': '跟随系统',
      'general.table': '如何处理表格',
      'general.table.placeholder': '选择处理方式',
      'general.table.filtered': '过滤块级内容',
      'general.table.non_phrasing_content_to_html':
        '将含有块级内容的表格转换为 HTML',
      'general.table.to_html': '所有表格都转换为 HTML',
      'general.grid': '分栏的处理方式',
      'general.grid.placeholder': '选择处理方式',
      'general.grid.flatten': '平铺分栏',
      'general.grid.to_table': '转换成表格',
      'general.grid.to_html': '转换成 HTML',
      'general.text_highlight': '保留文本高亮（字体颜色、字体背景颜色）',
      'download.file_with_unique_name': '图片和图表文件使用 UUID 命名',
      'download.method': '下载方式',
      'download.method.placeholder': '选择下载方式',
      'download.method.direct': '直接下载',
      'download.method.showSaveFilePicker': '显示保存文件选择器',
      'download.method.direct.description':
        '浏览器对下载文件的处理方式因浏览器类型、用户设置及其他因素而异。下载开始前可能出现用户确认提示，文件也可能自动保存，或直接在外部应用程序或浏览器本身中自动打开。',
      'download.method.showSaveFilePicker.description':
        '显示一个文件选择器，允许用户保存文件。用户既可选择现有文件，也可输入新文件的名称。',
      'lark.docx.download': '下载为 Markdown',
      'lark.docx.copy': '复制为 Markdown',
      'lark.docx.view': '查看为 Markdown',
      'lark.docx.batch_download': '批量下载',
      'help.and.feedback': '帮助和反馈',
      'batch_download.title': '批量下载工作台',
      'batch_download.manual_capture': '手动捕捉链接',
      'batch_download.manual_capture.active': '链接捕捉中...',
      'batch_download.manual_capture.desc':
        '在捕捉模式下，在任何飞书界面点击的文档链接都会自动在新标签页打开并被捕捉。',
      'batch_download.download_export': '下载并导出',
      'batch_download.new_folder': '新建文件夹',
      'batch_download.delete': '删除',
      'batch_download.rename': '重命名',
      'batch_download.search': '搜索文件/文件夹...',
      'batch_download.no_files':
        '暂未添加文件。开启“手动捕捉链接”后，在飞书界面点击链接即可捕获文档。',
      'batch_download.root_folder': '根目录',
      'batch_download.status.pending': '等待中',
      'batch_download.status.loading': '解析中...',
      'batch_download.status.success': '成功',
      'batch_download.status.failed': '失败',
      'batch_download.downloading': '正在导出，请勿关闭本页面。',
      'batch_download.complete': '导出完成！',
      'batch_download.export_state': '导出预览状态',
      'batch_download.import_state': '导入预览状态',
      'batch_download.import_state.success': '已成功导入预览状态。',
      'batch_download.import_state.invalid': '导入的文件格式不正确。',
      'batch_download.refresh.title': '从飞书知识库刷新',
      'batch_download.refresh.desc':
        '按侧边栏顺序，从一个知识库页面及其所有子页面重建目录树。替换前会先展示改动；本次已导出的页面会保留。',
      'batch_download.refresh.root_url': '知识库根页面链接',
      'batch_download.refresh.root_url.placeholder':
        'https://xxx.feishu.cn/wiki/...',
      'batch_download.refresh.invalid_url':
        '请输入知识库页面链接，例如 https://xxx.feishu.cn/wiki/<token>。',
      'batch_download.refresh.before_each_run': '每次导出前刷新',
      'batch_download.refresh.numbering':
        '名称加编号（001 - …），在 ZIP 中保持侧边栏顺序',
      'batch_download.refresh.advanced': '高级选项',
      'batch_download.refresh.leads': '放在根页面之前的页面',
      'batch_download.refresh.leads.hint':
        '不在该知识库树中、需要排在最前的页面。标题可省略。',
      'batch_download.refresh.renames': '标题覆盖',
      'batch_download.refresh.renames.hint':
        '为页面使用自定义标题，例如修正错别字。',
      'batch_download.refresh.only': '仅保留这些章节',
      'batch_download.refresh.only.hint':
        '只保留标题以某一行开头的顶层章节。编号与完整树保持一致。',
      'batch_download.refresh.pairs.placeholder':
        'https://xxx.feishu.cn/wiki/<token> = 标题',
      'batch_download.refresh.only.placeholder': '1.\n2.',
      'batch_download.refresh.now': '立即刷新',
      'batch_download.refresh.cancel': '取消',
      'batch_download.refresh.walking': '正在读取知识库… 已找到 {count} 个页面',
      'batch_download.refresh.busy': '导出进行中或已暂停时无法刷新。',
      'batch_download.refresh.preview': '刷新预览',
      'batch_download.refresh.summary':
        '{before} → {after} 个页面：新增 {added}，删除 {removed}，改名 {renamed}，移动 {moved}',
      'batch_download.refresh.reordered': '顺序有变化',
      'batch_download.refresh.no_changes': '知识库与当前目录树一致。',
      'batch_download.refresh.kept': '将保留本次已导出的 {count} 个页面。',
      'batch_download.refresh.apply': '应用',
      'batch_download.refresh.discard': '放弃',
      'batch_download.refresh.apply_run': '应用并导出',
      'batch_download.refresh.keep_current': '按当前目录树导出',
      'batch_download.refresh.cancel_run': '取消导出',
      'batch_download.refresh.walking_log': '正在从 {url} 读取知识库目录',
      'batch_download.refresh.walked':
        '已从飞书读取 {count} 个页面（方式：{mode}）。',
      'batch_download.refresh.failed':
        '知识库刷新失败，当前目录树未改变。{error}',
      'batch_download.refresh.cancelled':
        '已取消知识库刷新，当前目录树未改变。',
      'batch_download.refresh.bad_line':
        '已忽略格式不是 “<知识库链接或 token> = <标题>” 的行：{line}',
      'batch_download.refresh.lead_no_title':
        '无法读取 {token} 的标题，暂用 token。请在该行补上 “= 标题”。',
      'batch_download.refresh.dropped':
        '已跳过非文档页面（请直接下载）：{title} {url}',
      'batch_download.refresh.dropped_short': '已跳过非文档：{title}',
      'batch_download.refresh.unused_rename': '标题覆盖未匹配任何页面：{token}',
      'batch_download.refresh.empty': '知识库没有可导出的页面。',
      'batch_download.refresh.applied':
        '已应用刷新后的目录树：{files} 个文件，{folders} 个文件夹（保留 {kept} 个）。',
      'batch_download.refresh.kept_current':
        '按当前目录树导出，不应用知识库的改动。',
    },
  },
})

export const useInitLocale = () => {
  const i18n = useI18n()
  const { locale, availableLocales } = i18n

  const { query } = useSettings()
  watch(query.data, newSettings => {
    if (newSettings !== undefined) {
      const newLocale = newSettings[SettingKey.Locale]
      const isAvailable = (
        input: string,
      ): input is (typeof availableLocales.value)[number] =>
        availableLocales.value.includes(input)

      locale.value = isAvailable(newLocale)
        ? newLocale
        : defaultSettings[SettingKey.Locale]
    }
  })

  return i18n
}
