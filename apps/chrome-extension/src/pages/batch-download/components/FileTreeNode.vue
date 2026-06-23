<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'

export interface FileNode {
  id: string
  name: string
  type: 'file'
  url: string
  status: 'pending' | 'loading' | 'success' | 'failed'
  progress?: number
  error?: string
  tabId?: number
}

export interface FolderNode {
  id: string
  name: string
  type: 'folder'
  children: (FileNode | FolderNode)[]
}

export type TreeNode = FileNode | FolderNode

const props = defineProps<{
  node: TreeNode
  depth: number
  selectedNodeId: string
  expandedIds: Set<string>
}>()

const emit = defineEmits<{
  (e: 'select', node: TreeNode): void
  (e: 'toggleExpand', id: string): void
  (e: 'delete', node: TreeNode): void
  (e: 'rename', node: TreeNode, newName: string): void
}>()

const isFolder = computed(() => props.node.type === 'folder')
const isExpanded = computed(() => props.expandedIds.has(props.node.id))
const isSelected = computed(() => props.selectedNodeId === props.node.id)

// Rename state
const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const startRename = (e: Event) => {
  e.stopPropagation()
  renameValue.value = props.node.name
  isRenaming.value = true
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

const saveRename = (e?: Event) => {
  e?.stopPropagation()
  const trimmed = renameValue.value.trim()
  if (trimmed && trimmed !== props.node.name) {
    emit('rename', props.node, trimmed)
  }
  isRenaming.value = false
}

const cancelRename = (e: Event) => {
  e.stopPropagation()
  isRenaming.value = false
}

const handleSelect = () => {
  if (isRenaming.value) return
  emit('select', props.node)
}

const handleToggleExpand = (e: Event) => {
  e.stopPropagation()
  if (isFolder.value) {
    emit('toggleExpand', props.node.id)
  }
}
</script>

<template>
  <div class="select-none">
    <!-- Node item -->
    <div
      :style="{ paddingLeft: `${depth * 12 + 6}px` }"
      :class="
        cn(
          'group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors duration-150',
          isSelected
            ? 'bg-primary/10 text-primary dark:bg-primary/20 font-medium'
            : 'hover:bg-muted text-foreground/80 hover:text-foreground',
        )
      "
      @click="handleSelect"
    >
      <div class="flex items-center gap-1.5 min-w-0 flex-1">
        <!-- Chevron -->
        <span
          v-if="isFolder"
          class="p-0.5 hover:bg-muted-foreground/10 rounded transition-colors"
          @click="handleToggleExpand"
        >
          <ChevronDown
            v-if="isExpanded"
            class="h-3.5 w-3.5 text-muted-foreground"
          />
          <ChevronRight v-else class="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        <span v-else class="w-4.5"></span>

        <!-- Icon -->
        <FolderOpen
          v-if="isFolder && isExpanded"
          class="h-4.5 w-4.5 text-blue-500 flex-shrink-0"
        />
        <Folder
          v-else-if="isFolder"
          class="h-4.5 w-4.5 text-blue-500 flex-shrink-0"
        />
        <FileText v-else class="h-4.5 w-4.5 text-emerald-500 flex-shrink-0" />

        <!-- Title / Input -->
        <div v-if="isRenaming" class="flex items-center gap-1 min-w-0 flex-1">
          <input
            ref="renameInputRef"
            v-model="renameValue"
            class="w-full bg-background border border-input rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            @keydown.enter="saveRename"
            @keydown.esc="cancelRename"
            @click.stop
          />
          <button
            class="p-0.5 hover:bg-muted rounded text-emerald-600"
            @click.stop="saveRename"
          >
            <Check class="h-3.5 w-3.5" />
          </button>
          <button
            class="p-0.5 hover:bg-muted rounded text-destructive"
            @click.stop="cancelRename"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
        <span v-else class="truncate min-w-0 pr-2">
          {{ node.name }}
        </span>

        <!-- File Status Badge -->
        <template v-if="!isFolder && !isRenaming">
          <span
            v-if="(node as FileNode).status === 'loading'"
            class="flex items-center gap-1 text-[10px] text-primary/70"
          >
            <Loader2 class="h-3 w-3 animate-spin" />
            <span v-if="(node as FileNode).progress !== undefined">
              {{ Math.floor(((node as FileNode).progress ?? 0) * 100) }}%
            </span>
          </span>
          <span
            v-else-if="(node as FileNode).status === 'success'"
            class="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 rounded"
          >
            ✓
          </span>
          <span
            v-else-if="(node as FileNode).status === 'failed'"
            class="text-[10px] bg-destructive/10 text-destructive px-1 rounded"
            :title="(node as FileNode).error"
          >
            ✗
          </span>
        </template>
      </div>

      <!-- Action Buttons (Visible on Hover) -->
      <div
        v-if="!isRenaming"
        class="hidden group-hover:flex items-center gap-1 flex-shrink-0"
      >
        <button
          class="p-1 hover:bg-muted-foreground/15 rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Rename"
          @click="startRename"
        >
          <Edit2 class="h-3.5 w-3.5" />
        </button>
        <button
          class="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
          @click.stop="emit('delete', node)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <!-- Children Nodes -->
    <div
      v-if="isFolder && isExpanded && (node as FolderNode).children.length > 0"
    >
      <FileTreeNode
        v-for="child in (node as FolderNode).children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-node-id="selectedNodeId"
        :expanded-ids="expandedIds"
        @select="n => emit('select', n)"
        @toggle-expand="id => emit('toggleExpand', id)"
        @delete="n => emit('delete', n)"
        @rename="(n, name) => emit('rename', n, name)"
      />
    </div>
  </div>
</template>
