<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw, X, ExternalLink } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import {
  buildTree,
  carryOverStatuses,
  defaultRefreshSettings,
  diffTrees,
  getWikiInfo,
  isEmptyDiff,
  parseLines,
  parsePairs,
  parseWikiUrl,
  validateTree,
  walkWiki,
  type BuildResult,
  type HierarchyFolder,
  type RefreshSettings,
  type TreeDiff,
} from '../wiki-hierarchy'
import { createWikiFetcher } from '../wiki-fetch'

type LogType = 'info' | 'success' | 'warn' | 'error'

const props = defineProps<{
  tree: HierarchyFolder
  /** A run is active or paused; refreshing now would change files under it. */
  busy: boolean
  hasResult: (id: string) => boolean
}>()

const emit = defineEmits<{
  apply: [tree: HierarchyFolder]
  log: [message: string, type: LogType]
}>()

const { t: translate } = useI18n()

/**
 * vue-i18n can't compile messages at runtime under the extension's CSP, so
 * `{name}` placeholders are filled here instead of by vue-i18n.
 */
const t = (key: string, params: Record<string, string | number> = {}) =>
  translate(key).replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  )

const STORAGE_KEY = 'batch_download_wiki_refresh'
interface StoredSettings {
  lastRoot?: string
  byRoot: Record<string, RefreshSettings>
}

const settings = ref<RefreshSettings>(defaultRefreshSettings())
const stored = ref<StoredSettings>({ byRoot: {} })
const loaded = ref(false)

const rootToken = computed(() => parseWikiUrl(settings.value.rootUrl)?.token)
const urlInvalid = computed(
  () => settings.value.rootUrl.trim() !== '' && !rootToken.value,
)

onMounted(async () => {
  try {
    const { [STORAGE_KEY]: saved } = await chrome.storage.local.get(STORAGE_KEY)
    if (saved && typeof saved === 'object' && saved.byRoot) {
      stored.value = saved as StoredSettings
      const last = stored.value.lastRoot
      if (last && stored.value.byRoot[last]) {
        settings.value = {
          ...defaultRefreshSettings(),
          ...stored.value.byRoot[last],
        }
      }
    }
  } catch (err) {
    console.error('Failed to load wiki refresh settings:', err)
  }
  loaded.value = true
})

// Switching to a wiki seen before restores that wiki's own options.
watch(rootToken, (token, prev) => {
  if (!loaded.value || !token || token === prev) return
  const saved = stored.value.byRoot[token]
  if (saved) {
    settings.value = {
      ...defaultRefreshSettings(),
      ...saved,
      rootUrl: settings.value.rootUrl,
    }
  }
})

watch(
  settings,
  async s => {
    if (!loaded.value || !rootToken.value) return
    stored.value.lastRoot = rootToken.value
    stored.value.byRoot[rootToken.value] = { ...s }
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: JSON.parse(JSON.stringify(stored.value)),
      })
    } catch (err) {
      console.error('Failed to save wiki refresh settings:', err)
    }
  },
  { deep: true },
)

// ---------------------------------------------------------------------------
// Refresh: walk -> build -> preview -> apply
// ---------------------------------------------------------------------------

interface Preview {
  build: BuildResult
  merged: HierarchyFolder
  kept: number
  diff: TreeDiff
}

const walking = ref(false)
const pagesFound = ref(0)
const preview = ref<Preview | null>(null)
let abort: AbortController | null = null
/** Set while a run waits for the user to decide on the preview. */
let pendingRun: ((proceed: boolean) => void) | null = null
const waitingForRun = ref(false)

const unchanged = computed(() =>
  preview.value ? isEmptyDiff(preview.value.diff) : false,
)

const log = (m: string, type: LogType = 'info') => emit('log', m, type)

async function computePreview(): Promise<Preview | null> {
  const s = settings.value
  const parsed = parseWikiUrl(s.rootUrl)
  if (!parsed) {
    log(t('batch_download.refresh.invalid_url'), 'error')
    return null
  }
  const leads = parsePairs(s.leads)
  const renames = parsePairs(s.renames)
  for (const bad of [...leads.invalid, ...renames.invalid])
    log(t('batch_download.refresh.bad_line', { line: bad }), 'warn')

  walking.value = true
  pagesFound.value = 0
  abort = new AbortController()
  const fetcher = createWikiFetcher(parsed.origin, s.rootUrl.trim())
  log(t('batch_download.refresh.walking_log', { url: s.rootUrl.trim() }))
  try {
    const opts = {
      fetchJson: fetcher.fetchJson,
      signal: abort.signal,
      onProgress: (n: number) => (pagesFound.value = n),
    }
    const walk = await walkWiki(s.rootUrl, opts)
    // Leads without a title: ask Feishu once, fall back to the token.
    for (const lead of leads.pairs) {
      if (lead.title) continue
      try {
        lead.title = (await getWikiInfo(walk.origin, lead.token, opts, 1)).title
      } catch {
        lead.title = lead.token
        log(
          t('batch_download.refresh.lead_no_title', { token: lead.token }),
          'warn',
        )
      }
    }
    log(
      t('batch_download.refresh.walked', {
        count: walk.nodes.length + 1,
        mode: fetcher.mode(),
      }),
      'success',
    )

    const build = buildTree(walk, {
      leads: leads.pairs,
      renames: Object.fromEntries(renames.pairs.map(p => [p.token, p.title])),
      only: parseLines(s.only),
      numbering: s.numbering,
    })
    for (const d of build.dropped)
      log(
        t('batch_download.refresh.dropped', { title: d.title, url: d.url }),
        'warn',
      )
    for (const r of build.unusedRenames)
      log(t('batch_download.refresh.unused_rename', { token: r }), 'warn')

    const { tree: merged, kept } = carryOverStatuses(
      props.tree,
      build.tree,
      props.hasResult,
    )
    build.problems.push(...validateTree(merged, null))
    for (const p of build.problems) log(p, 'error')
    if (build.fileCount === 0)
      build.problems.push(t('batch_download.refresh.empty'))
    return { build, merged, kept, diff: diffTrees(props.tree, build.tree) }
  } catch (err) {
    if (!abort?.signal.aborted)
      log(
        t('batch_download.refresh.failed', {
          error: err instanceof Error ? err.message : String(err),
        }),
        'error',
      )
    else log(t('batch_download.refresh.cancelled'), 'warn')
    return null
  } finally {
    walking.value = false
    abort = null
    await fetcher.dispose()
  }
}

/** "Refresh now": always show the preview, even when nothing changed. */
async function refreshNow() {
  if (props.busy || walking.value || waitingForRun.value) return
  preview.value = await computePreview()
}

function cancelWalk() {
  abort?.abort()
}

function apply() {
  const p = preview.value
  if (!p || p.build.problems.length) return
  emit('apply', p.merged)
  log(
    t('batch_download.refresh.applied', {
      files: p.build.fileCount,
      folders: p.build.folderCount,
      kept: p.kept,
    }),
    'success',
  )
  preview.value = null
  finishRun(true)
}

function discard() {
  preview.value = null
  finishRun(false)
}

function finishRun(proceed: boolean) {
  waitingForRun.value = false
  const resolve = pendingRun
  pendingRun = null
  resolve?.(proceed)
}

/**
 * Called by the page before Export/Resume. Resolves true to start the run.
 * Off: start immediately. On: refresh; an unchanged tree starts at once,
 * a changed one waits for Apply (start with new tree) / Keep current (start
 * with old tree) / Cancel.
 */
async function prepareRun(): Promise<boolean> {
  if (!settings.value.beforeEachRun) return true
  if (!rootToken.value) {
    log(t('batch_download.refresh.invalid_url'), 'error')
    return false
  }
  const p = await computePreview()
  if (!p) return false // the walk failed; never export a stale tree silently
  if (isEmptyDiff(p.diff) && !p.build.problems.length) {
    emit('apply', p.merged) // same pages; pick up statuses/ids consistently
    log(t('batch_download.refresh.no_changes'), 'success')
    return true
  }
  preview.value = p
  waitingForRun.value = true
  return new Promise<boolean>(resolve => (pendingRun = resolve))
}

function keepCurrentAndRun() {
  preview.value = null
  log(t('batch_download.refresh.kept_current'), 'warn')
  finishRun(true)
}

defineExpose({ prepareRun })

const LIST_LIMIT = 100
const sections = computed(() => {
  const d = preview.value?.diff
  if (!d) return []
  return [
    {
      key: 'added',
      sign: '+',
      cls: 'text-emerald-600',
      rows: d.added.map(p => `${p.title}  [${p.path || 'Root'}]`),
    },
    {
      key: 'removed',
      sign: '−',
      cls: 'text-rose-600',
      rows: d.removed.map(p => `${p.title}  [${p.path || 'Root'}]`),
    },
    {
      key: 'renamed',
      sign: '~',
      cls: 'text-amber-600',
      rows: d.renamed.map(r => `${r.from}  →  ${r.to}`),
    },
    {
      key: 'moved',
      sign: '>',
      cls: 'text-blue-600',
      rows: d.moved.map(
        m => `${m.title}  [${m.from || 'Root'}] → [${m.to || 'Root'}]`,
      ),
    },
  ].filter(s => s.rows.length)
})
</script>

<template>
  <div
    class="md:col-span-2 border border-border rounded-lg p-5 bg-muted/20 flex flex-col gap-3"
    data-testid="wiki-refresh-card"
  >
    <div>
      <h3 class="font-medium text-sm flex items-center gap-1.5">
        <RefreshCw class="h-4 w-4 text-violet-500" />
        {{ t('batch_download.refresh.title') }}
      </h3>
      <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
        {{ t('batch_download.refresh.desc') }}
      </p>
    </div>

    <label class="flex flex-col gap-1 text-xs">
      <span class="font-medium">{{
        t('batch_download.refresh.root_url')
      }}</span>
      <input
        v-model.trim="settings.rootUrl"
        type="url"
        :placeholder="t('batch_download.refresh.root_url.placeholder')"
        :aria-invalid="urlInvalid"
        :class="
          cn(
            'w-full rounded-md border bg-background px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
            urlInvalid ? 'border-rose-500' : 'border-border',
          )
        "
      />
      <span v-if="urlInvalid" class="text-rose-600">
        {{ t('batch_download.refresh.invalid_url') }}
      </span>
    </label>

    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <label class="flex items-center gap-1.5 cursor-pointer">
        <input
          v-model="settings.beforeEachRun"
          type="checkbox"
          data-testid="refresh-before-run"
        />
        {{ t('batch_download.refresh.before_each_run') }}
      </label>
      <label class="flex items-center gap-1.5 cursor-pointer">
        <input v-model="settings.numbering" type="checkbox" />
        {{ t('batch_download.refresh.numbering') }}
      </label>
    </div>

    <details class="text-xs">
      <summary class="cursor-pointer text-muted-foreground select-none">
        {{ t('batch_download.refresh.advanced') }}
      </summary>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
        <label class="flex flex-col gap-1">
          <span class="font-medium">{{
            t('batch_download.refresh.leads')
          }}</span>
          <textarea
            v-model="settings.leads"
            rows="3"
            spellcheck="false"
            :placeholder="t('batch_download.refresh.pairs.placeholder')"
            class="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span class="text-muted-foreground">
            {{ t('batch_download.refresh.leads.hint') }}
          </span>
        </label>
        <label class="flex flex-col gap-1">
          <span class="font-medium">{{
            t('batch_download.refresh.renames')
          }}</span>
          <textarea
            v-model="settings.renames"
            rows="3"
            spellcheck="false"
            :placeholder="t('batch_download.refresh.pairs.placeholder')"
            class="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span class="text-muted-foreground">
            {{ t('batch_download.refresh.renames.hint') }}
          </span>
        </label>
        <label class="flex flex-col gap-1">
          <span class="font-medium">{{
            t('batch_download.refresh.only')
          }}</span>
          <textarea
            v-model="settings.only"
            rows="3"
            spellcheck="false"
            :placeholder="t('batch_download.refresh.only.placeholder')"
            class="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span class="text-muted-foreground">
            {{ t('batch_download.refresh.only.hint') }}
          </span>
        </label>
      </div>
    </details>

    <div class="flex items-center justify-between gap-4">
      <span class="text-xs text-muted-foreground" aria-live="polite">
        <template v-if="walking">
          {{ t('batch_download.refresh.walking', { count: pagesFound }) }}
        </template>
        <template v-else-if="busy">
          {{ t('batch_download.refresh.busy') }}
        </template>
      </span>
      <div class="flex items-center gap-2">
        <button
          v-if="walking"
          class="bg-muted hover:bg-muted/80 text-foreground border border-border px-3 py-2 rounded-md font-medium text-xs flex items-center gap-1.5 cursor-pointer"
          @click="cancelWalk"
        >
          <X class="h-3.5 w-3.5" />
          {{ t('batch_download.refresh.cancel') }}
        </button>
        <button
          class="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          :disabled="busy || walking || waitingForRun || !rootToken"
          data-testid="refresh-now"
          @click="refreshNow"
        >
          <RefreshCw :class="cn('h-3.5 w-3.5', walking && 'animate-spin')" />
          {{ t('batch_download.refresh.now') }}
        </button>
      </div>
    </div>

    <!-- Preview -->
    <div
      v-if="preview"
      class="border border-border rounded-md bg-background p-3 flex flex-col gap-2 text-xs"
      role="region"
      :aria-label="t('batch_download.refresh.preview')"
      data-testid="refresh-preview"
    >
      <div class="font-medium">
        {{
          t('batch_download.refresh.summary', {
            before: preview.diff.before,
            after: preview.diff.after,
            added: preview.diff.added.length,
            removed: preview.diff.removed.length,
            renamed: preview.diff.renamed.length,
            moved: preview.diff.moved.length,
          })
        }}
        <span v-if="preview.diff.reordered" class="text-amber-600">
          · {{ t('batch_download.refresh.reordered') }}
        </span>
      </div>
      <div v-if="unchanged" class="text-emerald-600">
        {{ t('batch_download.refresh.no_changes') }}
      </div>
      <div v-if="preview.kept" class="text-muted-foreground">
        {{ t('batch_download.refresh.kept', { count: preview.kept }) }}
      </div>

      <div class="max-h-56 overflow-y-auto font-mono text-[11px] leading-snug">
        <div v-for="s in sections" :key="s.key" class="mb-1.5">
          <div
            v-for="(row, i) in s.rows.slice(0, LIST_LIMIT)"
            :key="i"
            :class="cn('break-all', s.cls)"
          >
            {{ s.sign }} {{ row }}
          </div>
          <div v-if="s.rows.length > LIST_LIMIT" class="text-muted-foreground">
            … {{ s.rows.length - LIST_LIMIT }}
          </div>
        </div>
        <div
          v-for="d in preview.build.dropped"
          :key="d.token"
          class="text-muted-foreground break-all"
        >
          {{ t('batch_download.refresh.dropped_short', { title: d.title }) }}
          <a
            :href="d.url"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center underline"
            ><ExternalLink class="h-3 w-3"
          /></a>
        </div>
        <div
          v-for="(p, i) in preview.build.problems"
          :key="'p' + i"
          class="text-rose-600 font-semibold"
        >
          {{ p }}
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          class="bg-muted hover:bg-muted/80 text-foreground border border-border px-3 py-2 rounded-md font-medium text-xs cursor-pointer"
          @click="discard"
        >
          {{
            waitingForRun
              ? t('batch_download.refresh.cancel_run')
              : t('batch_download.refresh.discard')
          }}
        </button>
        <button
          v-if="waitingForRun"
          class="bg-muted hover:bg-muted/80 text-foreground border border-border px-3 py-2 rounded-md font-medium text-xs cursor-pointer"
          @click="keepCurrentAndRun"
        >
          {{ t('batch_download.refresh.keep_current') }}
        </button>
        <button
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          :disabled="preview.build.problems.length > 0"
          data-testid="refresh-apply"
          @click="apply"
        >
          {{
            waitingForRun
              ? t('batch_download.refresh.apply_run')
              : t('batch_download.refresh.apply')
          }}
        </button>
      </div>
    </div>
  </div>
</template>
