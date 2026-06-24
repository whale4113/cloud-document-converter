<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  Settings,
  FolderDown,
  Play,
  Pause,
  ArrowLeft,
  Terminal,
  RotateCcw,
  Sparkles,
} from 'lucide-vue-next'
import { useInitLocale } from '../shared/i18n'
import { useInitTheme } from '../shared/theme'
import FileTree from './components/FileTree.vue'
import type {
  TreeNode,
  FolderNode,
  FileNode,
} from './components/FileTreeNode.vue'
import { fs, configure } from '@zip.js/zip.js'
import { cn } from '@/lib/utils'

configure({ useWebWorkers: false })

const { t } = useInitLocale()
useInitTheme()

// Tree States
const rootNode = ref<FolderNode>({
  id: 'root',
  name: 'Root',
  type: 'folder',
  children: [],
})
const selectedNodeId = ref<string>('root')

// Manual Capture State
const manualCaptureActive = ref(false)

// Export Status
const exporting = ref(false)
const logs = ref<
  {
    time: string
    type: 'info' | 'success' | 'warn' | 'error'
    message: string
  }[]
>([])

// Helper: Get timestamp
const getTimestamp = () => {
  const d = new Date()
  return d.toTimeString().slice(0, 8)
}

// Add Log Entry
const addLog = (
  message: string,
  type: 'info' | 'success' | 'warn' | 'error' = 'info',
) => {
  logs.value.push({
    time: getTimestamp(),
    type,
    message,
  })
}

// Clear Logs
const clearLogs = () => {
  logs.value = []
}

// Load persisted data
onMounted(async () => {
  addLog('Initializing Batch Download Workbench...', 'info')
  try {
    const { batch_download_tree, manualCaptureActive: captureActive } =
      await chrome.storage.local.get([
        'batch_download_tree',
        'manualCaptureActive',
      ])

    if (batch_download_tree && batch_download_tree.id === 'root') {
      rootNode.value = batch_download_tree
      addLog('Loaded saved file explorer structure.', 'success')
    } else {
      addLog(
        'No saved explorer structure found. Initialized empty root.',
        'info',
      )
    }

    if (captureActive !== undefined) {
      manualCaptureActive.value = captureActive
    }
  } catch (err) {
    console.error('Failed to load storage data:', err)
    addLog('Failed to load explorer structure from extension storage.', 'error')
  }

  // Register capture listener
  chrome.runtime.onMessage.addListener(handleCapturedDocument as any)
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleCapturedDocument as any)
})

// Persist tree structure
watch(
  rootNode,
  async newTree => {
    try {
      await chrome.storage.local.set({
        batch_download_tree: JSON.parse(JSON.stringify(newTree)),
      })
    } catch (err) {
      console.error('Failed to save tree structure:', err)
    }
  },
  { deep: true },
)

// Persist capture state
watch(manualCaptureActive, async active => {
  try {
    await chrome.storage.local.set({ manualCaptureActive: active })
    if (active) {
      addLog(
        'Manual capture mode enabled. Listening for Feishu/Lark document links.',
        'success',
      )
    } else {
      addLog('Manual capture mode disabled.', 'info')
    }
  } catch (err) {
    console.error('Failed to save capture state:', err)
  }
})

// Handle captured documents from content script
const handleCapturedDocument = (message: any) => {
  if (message.type === 'CDC_CAPTURED_DOCUMENT') {
    const { url, title } = message

    // Check if URL is already in the explorer
    const isUrlCaptured = (node: TreeNode): boolean => {
      if (node.type === 'file' && node.url === url) return true
      if (node.type === 'folder') {
        return node.children.some(isUrlCaptured)
      }
      return false
    }

    if (isUrlCaptured(rootNode.value)) {
      addLog(`Skipped: document already in explorer: "${title}"`, 'warn')
      return
    }

    // Locate target folder node
    const findNodeById = (node: TreeNode, id: string): TreeNode | null => {
      if (node.id === id) return node
      if (node.type === 'folder') {
        for (const child of node.children) {
          const found = findNodeById(child, id)
          if (found) return found
        }
      }
      return null
    }

    const findParentFolder = (
      node: FolderNode,
      childId: string,
    ): FolderNode | null => {
      if (node.children.some(c => c.id === childId)) return node
      for (const child of node.children) {
        if (child.type === 'folder') {
          const found = findParentFolder(child, childId)
          if (found) return found
        }
      }
      return null
    }

    let targetFolderId = selectedNodeId.value || 'root'
    let targetFolder = findNodeById(rootNode.value, targetFolderId)

    if (targetFolder && targetFolder.type === 'file') {
      const parent = findParentFolder(rootNode.value, targetFolderId)
      if (parent) {
        targetFolder = parent
        targetFolderId = parent.id
      }
    }

    if (!targetFolder || targetFolder.type !== 'folder') {
      targetFolder = rootNode.value
      targetFolderId = 'root'
    }

    // Generate unique name for file node
    const siblings = targetFolder.children
    let name = title
    let counter = 1
    while (siblings.some(s => s.name === name)) {
      name = `${title} (${counter})`
      counter++
    }

    const newFile: FileNode = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'file',
      url,
      status: 'pending',
    }

    targetFolder.children.push(newFile)
    rootNode.value = { ...rootNode.value } // Trigger deep watcher

    addLog(
      `Captured document: "${name}" -> added to folder "${targetFolder.name}"`,
      'success',
    )
  }
}

// Toggle manual capture mode
const toggleManualCapture = () => {
  manualCaptureActive.value = !manualCaptureActive.value
}

// Open Options Page
const handleOpenOptionsPage = () => {
  if (import.meta.env.DEV) {
    window.open('/pages/options', '_blank')
  } else {
    chrome.runtime.openOptionsPage()
  }
}

// Helper: Normalize URLs for tab matching
const normalizeUrl = (url: string) => {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return url
  }
}

// Promise helper to wait for tab loading completion
const waitTabLoaded = (tabId: number): Promise<void> => {
  return new Promise(resolve => {
    const listener = (tid: number, changeInfo: any) => {
      if (tid === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

// Helper to wait for the Feishu document compiler to initialize on the page
const waitDocxReady = async (tabId: number): Promise<boolean> => {
  const maxTries = 30
  addLog(
    `[Diagnostic] Starting docx ready check for tabId ${tabId}. Max tries: ${maxTries}`,
    'info',
  )
  for (let i = 0; i < maxTries; i++) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const PageMain = (window as any).PageMain
          const editor = (window as any).editor
          return {
            url: window.location.href,
            title: document.title,
            hasPageMain: typeof PageMain !== 'undefined',
            hasBlockManager:
              typeof PageMain !== 'undefined' &&
              typeof PageMain.blockManager !== 'undefined',
            hasRootBlockModel:
              typeof PageMain !== 'undefined' &&
              typeof PageMain.blockManager !== 'undefined' &&
              typeof PageMain.blockManager.rootBlockModel !== 'undefined',
            hasEditor: typeof editor !== 'undefined',
          }
        },
        world: 'MAIN',
      })

      if (results && results[0]?.result) {
        const status = results[0].result
        const isReady = status.hasRootBlockModel || status.hasEditor

        addLog(
          `[Diagnostic] Try ${i + 1}/${maxTries}: URL="${status.url}", Title="${status.title}", PageMain=${status.hasPageMain}, BlockManager=${status.hasBlockManager}, RootBlockModel=${status.hasRootBlockModel}, Editor=${status.hasEditor} => Ready=${isReady}`,
          isReady ? 'success' : 'info',
        )

        if (isReady) {
          return true
        }
      } else {
        addLog(
          `[Diagnostic] Try ${i + 1}/${maxTries}: No result returned from script execution`,
          'warn',
        )
      }
    } catch (err: any) {
      addLog(
        `[Diagnostic] Try ${i + 1}/${maxTries} execution failed: ${err.message || String(err)}`,
        'warn',
      )
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  return false
}

// Recursive function to collect all FileNodes from the tree
const collectFileNodes = (node: TreeNode): FileNode[] => {
  if (node.type === 'file') return [node]
  return node.children.flatMap(collectFileNodes)
}

// Recursive zip path mapping helper
interface ExtractedFile {
  path: string
  content: ArrayBuffer | string
  isBinary: boolean
}

interface ExtractionResult {
  title: string
  files: ExtractedFile[]
}

const getZipEntries = (
  node: TreeNode,
  parentPath: string,
  downloadResults: Map<string, ExtractionResult>,
): { zipPath: string; content: ArrayBuffer | string; isBinary: boolean }[] => {
  const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name

  if (node.type === 'folder') {
    return node.children.flatMap(child =>
      getZipEntries(
        child,
        parentPath ? currentPath : node.id === 'root' ? '' : node.name,
        downloadResults,
      ),
    )
  } else {
    const result = downloadResults.get(node.id)
    if (!result) return []

    return result.files.map(file => {
      let relativePath = file.path
      if (file.path.endsWith('.md')) {
        const nameWithExt = node.name.endsWith('.md')
          ? node.name
          : `${node.name}.md`
        relativePath = nameWithExt
      }

      const zipPath = parentPath
        ? `${parentPath}/${relativePath}`
        : relativePath
      return {
        zipPath,
        content: file.content,
        isBinary: file.isBinary,
      }
    })
  }
}

// Execute batch download
const runBatchDownload = async () => {
  const files = collectFileNodes(rootNode.value)
  if (files.length === 0) {
    addLog(
      'No documents to download. Please capture some documents first.',
      'warn',
    )
    return
  }

  exporting.value = true
  clearLogs()
  addLog(`Starting batch download of ${files.length} documents...`, 'info')

  const downloadResults = new Map<string, ExtractionResult>()

  try {
    for (const file of files) {
      addLog(`Processing document: "${file.name}"`, 'info')
      file.status = 'loading'
      file.progress = 0
      file.error = undefined

      let tabId: number | undefined
      let openedWindowId: number | undefined

      try {
        // Step 1: Find or open tab/window
        const allTabs = await chrome.tabs.query({})
        const existingTab = allTabs.find(
          t => t.url && normalizeUrl(t.url) === normalizeUrl(file.url),
        )

        if (existingTab && existingTab.id !== undefined) {
          tabId = existingTab.id
          file.tabId = tabId
          addLog(
            `Found open tab for "${file.name}". Injecting extraction script...`,
            'info',
          )
        } else {
          addLog(
            `[Diagnostic] Creating background window for URL: ${file.url}`,
            'info',
          )
          const win = await chrome.windows.create({
            url: file.url,
            focused: false,
            width: 1024,
            height: 768,
          })
          if (!win || win.id === undefined) {
            throw new Error('Failed to create background window')
          }
          openedWindowId = win.id
          addLog(`[Diagnostic] Created background window ID: ${win.id}`, 'info')

          if (win.tabs && win.tabs.length > 0) {
            tabId = win.tabs[0]?.id
          } else {
            const tabs = await chrome.tabs.query({ windowId: win.id })
            tabId = tabs[0]?.id
          }

          if (tabId === undefined) {
            throw new Error(
              'Failed to retrieve tab ID for the background window',
            )
          }

          file.tabId = tabId
          addLog(
            `[Diagnostic] Waiting for tab ID ${tabId} loading status to be 'complete'...`,
            'info',
          )
          await waitTabLoaded(tabId)
          addLog(
            `Background window loaded (status 'complete'). Waiting for docx compiler to initialize...`,
            'info',
          )
        }

        // Wait for docx component on the page
        const ready = await waitDocxReady(tabId!)
        if (!ready) {
          throw new Error(
            'Feishu document compiler did not load in time. Please check your network.',
          )
        }

        // Step 2: Inject extraction script
        await chrome.scripting.executeScript({
          files: ['bundles/scripts/extract-lark-docx.js'],
          target: { tabId: tabId! },
          world: 'MAIN',
        })

        // Step 3: Wait for extraction complete message
        const extractionPromise = new Promise<ExtractionResult>(
          (resolve, reject) => {
            const listener = (message: any, sender: any) => {
              if (sender.tab?.id === tabId) {
                if (message.type === 'CDC_EXTRACTION_SUCCESS') {
                  chrome.runtime.onMessage.removeListener(listener as any)
                  resolve(message.data)
                } else if (message.type === 'CDC_EXTRACTION_ERROR') {
                  chrome.runtime.onMessage.removeListener(listener as any)
                  reject(new Error(message.error))
                }
              }
            }
            chrome.runtime.onMessage.addListener(listener as any)
          },
        )

        const result = await extractionPromise
        downloadResults.set(file.id, result)

        file.status = 'success'
        file.progress = 1
        addLog(`Successfully extracted "${file.name}".`, 'success')
      } catch (err: any) {
        console.error(`Failed to process ${file.name}:`, err)
        file.status = 'failed'
        file.error = err.message || String(err)
        addLog(`Failed to download "${file.name}": ${file.error}`, 'error')
      } finally {
        if (openedWindowId !== undefined) {
          try {
            await chrome.windows.remove(openedWindowId)
          } catch {
            // window might have been closed by user
          }
        }
      }
    }

    // Step 4: Bundle ZIP
    const successCount = downloadResults.size
    if (successCount === 0) {
      addLog('All document extractions failed. ZIP export cancelled.', 'error')
      return
    }

    addLog(`Packaging ${successCount} successful documents into ZIP...`, 'info')

    const zipFs = new fs.FS()
    const zipEntries = getZipEntries(rootNode.value, '', downloadResults)

    for (const entry of zipEntries) {
      if (entry.isBinary) {
        zipFs.addBlob(entry.zipPath, new Blob([entry.content]))
      } else {
        zipFs.addText(entry.zipPath, entry.content as string)
      }
    }

    const zipBlob = await zipFs.exportBlob()
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CDC-Batch-Export-${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    URL.revokeObjectURL(url)

    addLog('Export complete! ZIP file initiated download.', 'success')
  } catch (globalErr: any) {
    console.error('Batch download error:', globalErr)
    addLog(
      `Critical error during batch export: ${globalErr.message || String(globalErr)}`,
      'error',
    )
  } finally {
    exporting.value = false
    // reset tabIds
    files.forEach(f => {
      f.tabId = undefined
    })
  }
}
</script>

<template>
  <div
    class="w-full min-h-screen bg-background text-foreground flex flex-col antialiased"
  >
    <!-- Header -->
    <header
      class="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <a
          href="#"
          class="p-2 hover:bg-muted rounded-lg transition-colors border border-border"
          @click.prevent="handleOpenOptionsPage"
        >
          <ArrowLeft class="h-4 w-4" />
        </a>
        <div class="flex items-center gap-2">
          <img class="w-6" src="/logo.svg" />
          <h1 class="text-lg font-semibold tracking-tight">
            {{ t('batch_download.title') }}
          </h1>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="p-2 hover:bg-muted rounded-lg transition-colors border border-border"
          @click="handleOpenOptionsPage"
        >
          <Settings class="h-4 w-4" />
        </button>
      </div>
    </header>

    <!-- Main Container -->
    <main
      class="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 grid grid-cols-12 gap-6 min-h-[calc(100vh-73px)]"
    >
      <!-- Left Panel: VSCode Explorer Tree -->
      <section
        class="col-span-12 lg:col-span-4 flex flex-col h-[calc(100vh-120px)]"
      >
        <FileTree
          v-model:rootNode="rootNode"
          v-model:selectedNodeId="selectedNodeId"
          class="flex-1"
        />
      </section>

      <!-- Right Panel: Operations -->
      <section
        class="col-span-12 lg:col-span-8 flex flex-col gap-6 h-[calc(100vh-120px)]"
      >
        <!-- Actions Card -->
        <div
          class="bg-card rounded-lg border border-border p-6 shadow-sm flex flex-col gap-6"
        >
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-base flex items-center gap-2">
              <Sparkles class="h-4 w-4 text-primary" />
              Controls & Actions
            </h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Capture Button Card -->
            <div
              :class="
                cn(
                  'border rounded-lg p-5 flex flex-col justify-between transition-all duration-200',
                  manualCaptureActive
                    ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                    : 'border-border bg-muted/20 hover:bg-muted/40',
                )
              "
            >
              <div>
                <h3 class="font-medium text-sm flex items-center gap-1.5">
                  <span
                    v-if="manualCaptureActive"
                    class="relative flex h-2 w-2"
                  >
                    <span
                      class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
                    ></span>
                    <span
                      class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"
                    ></span>
                  </span>
                  {{ t('batch_download.manual_capture') }}
                </h3>
                <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {{ t('batch_download.manual_capture.desc') }}
                </p>
              </div>

              <div class="mt-4 flex items-center justify-between gap-4">
                <span class="text-xs text-muted-foreground">
                  Status:
                  <span
                    :class="
                      manualCaptureActive
                        ? 'text-emerald-600 font-semibold'
                        : 'text-foreground/60'
                    "
                  >
                    {{
                      manualCaptureActive
                        ? t('batch_download.manual_capture.active')
                        : 'Idle'
                    }}
                  </span>
                </span>
                <button
                  :class="
                    cn(
                      'px-4 py-2 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer',
                      manualCaptureActive
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                        : 'bg-primary text-primary-foreground hover:bg-primary/95',
                    )
                  "
                  @click="toggleManualCapture"
                >
                  <Pause v-if="manualCaptureActive" class="h-3.5 w-3.5" />
                  <Play v-else class="h-3.5 w-3.5" />
                  {{ manualCaptureActive ? 'Stop Capture' : 'Start Capture' }}
                </button>
              </div>
            </div>

            <!-- Export Button Card -->
            <div
              class="border border-border rounded-lg p-5 bg-muted/20 hover:bg-muted/40 flex flex-col justify-between transition-all duration-200"
            >
              <div>
                <h3 class="font-medium text-sm flex items-center gap-1.5">
                  <FolderDown class="h-4.5 w-4.5 text-blue-500" />
                  {{ t('batch_download.download_export') }}
                </h3>
                <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Extracts Markdown and downloads resources for all listed
                  pages, packaging them in the structured ZIP format.
                </p>
              </div>

              <div class="mt-4 flex items-center justify-between gap-4">
                <span class="text-xs text-muted-foreground">
                  Ready to download:
                  {{ collectFileNodes(rootNode).length }} documents
                </span>
                <button
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  :disabled="
                    exporting || collectFileNodes(rootNode).length === 0
                  "
                  @click="runBatchDownload"
                >
                  <FolderDown class="h-3.5 w-3.5" />
                  {{ exporting ? 'Exporting...' : 'Export ZIP' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Terminal Console Logs Card -->
        <div
          class="flex-1 bg-card rounded-lg border border-border shadow-sm flex flex-col overflow-hidden min-h-[300px]"
        >
          <!-- Logs Header -->
          <div
            class="p-4 border-b border-border flex items-center justify-between"
          >
            <h2 class="font-semibold text-sm flex items-center gap-2">
              <Terminal class="h-4 w-4 text-muted-foreground" />
              Process Log & Output
            </h2>
            <button
              class="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Clear Logs"
              @click="clearLogs"
            >
              <RotateCcw class="h-3.5 w-3.5" />
            </button>
          </div>

          <!-- Logs Body -->
          <div
            class="flex-1 bg-black/90 p-4 font-mono text-[11px] leading-normal overflow-y-auto max-h-[450px]"
          >
            <div v-if="logs.length === 0" class="text-zinc-500 italic">
              No logs recorded. Select a command or start links capture.
            </div>
            <div
              v-for="(log, idx) in logs"
              :key="idx"
              class="mb-1 flex items-start gap-2"
            >
              <span class="text-zinc-500 flex-shrink-0 select-none"
                >[{{ log.time }}]</span
              >
              <span
                :class="
                  cn('break-all', {
                    'text-zinc-300': log.type === 'info',
                    'text-emerald-400': log.type === 'success',
                    'text-amber-400': log.type === 'warn',
                    'text-rose-400 font-bold': log.type === 'error',
                  })
                "
              >
                {{ log.message }}
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
