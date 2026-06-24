<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { FolderPlus, Search, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { useInitLocale } from '../../shared/i18n'
import FileTreeNode, {
  type TreeNode,
  type FolderNode,
  type FileNode,
} from './FileTreeNode.vue'
import { cn } from '@/lib/utils'

const { t } = useInitLocale()

const props = defineProps<{
  rootNode: FolderNode
  selectedNodeId: string
}>()

const emit = defineEmits<{
  (e: 'update:rootNode', val: FolderNode): void
  (e: 'update:selectedNodeId', val: string): void
}>()

const searchQuery = ref('')
const expandedIds = ref<Set<string>>(new Set(['root']))

// Helper to toggle expand
const handleToggleExpand = (id: string) => {
  const next = new Set(expandedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedIds.value = next
}

// Find a node by ID in the tree
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

// Find parent folder of a node
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

// Handle Select
const handleSelect = (node: TreeNode) => {
  emit('update:selectedNodeId', node.id)
}

// Add a folder under the currently selected node
const addFolder = () => {
  let targetFolderId = props.selectedNodeId || 'root'
  let targetFolder = findNodeById(props.rootNode, targetFolderId)

  // If selected node is a file, add it to its parent folder
  if (targetFolder && targetFolder.type === 'file') {
    const parent = findParentFolder(props.rootNode, targetFolderId)
    if (parent) {
      targetFolder = parent
      targetFolderId = parent.id
    }
  }

  if (!targetFolder || targetFolder.type !== 'folder') {
    targetFolder = props.rootNode
    targetFolderId = 'root'
  }

  // Create unique folder name
  const existingFolderNames = targetFolder.children
    .filter(c => c.type === 'folder')
    .map(c => c.name)

  let name = t('batch_download.new_folder')
  let counter = 1
  while (existingFolderNames.includes(name)) {
    name = `${t('batch_download.new_folder')} (${counter})`
    counter++
  }

  const newFolder: FolderNode = {
    id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'folder',
    children: [],
  }

  targetFolder.children.push(newFolder)
  expandedIds.value.add(targetFolderId)
  expandedIds.value.add(newFolder.id)

  emit('update:rootNode', { ...props.rootNode })
  emit('update:selectedNodeId', newFolder.id)
}

// Handle Delete Node
const handleDeleteNode = (nodeToDelete: TreeNode) => {
  if (nodeToDelete.id === 'root') return // Cannot delete root

  const parent = findParentFolder(props.rootNode, nodeToDelete.id)
  if (parent) {
    parent.children = parent.children.filter(c => c.id !== nodeToDelete.id)

    // If deleted node was selected, select the parent folder
    if (props.selectedNodeId === nodeToDelete.id) {
      emit('update:selectedNodeId', parent.id)
    }

    emit('update:rootNode', { ...props.rootNode })
  }
}

// Handle Rename Node
const handleRenameNode = (node: TreeNode, newName: string) => {
  const target = findNodeById(props.rootNode, node.id)
  if (target) {
    target.name = newName
    emit('update:rootNode', { ...props.rootNode })
  }
}

// Expand all folders helper
const expandAll = () => {
  const ids = new Set<string>()
  const collectFolderIds = (n: TreeNode) => {
    if (n.type === 'folder') {
      ids.add(n.id)
      n.children.forEach(collectFolderIds)
    }
  }
  collectFolderIds(props.rootNode)
  expandedIds.value = ids
}

// Collapse all folders helper
const collapseAll = () => {
  expandedIds.value = new Set(['root'])
}

// Filtered tree based on search query
const filteredRootNode = computed(() => {
  if (!searchQuery.value.trim()) return props.rootNode

  const query = searchQuery.value.toLowerCase().trim()

  const filterTree = (node: TreeNode): TreeNode | null => {
    if (node.name.toLowerCase().includes(query)) {
      // If folder or file matches, return it fully
      return node
    }

    if (node.type === 'folder') {
      const matchedChildren = node.children
        .map(filterTree)
        .filter((c): c is TreeNode => c !== null)

      if (matchedChildren.length > 0) {
        return {
          ...node,
          children: matchedChildren,
        } as FolderNode
      }
    }

    return null
  }

  const result = filterTree(props.rootNode)
  return (
    (result as FolderNode) || {
      id: 'root',
      name: props.rootNode.name,
      type: 'folder',
      children: [],
    }
  )
})

// Auto expand nodes on search
watch(searchQuery, newVal => {
  if (newVal.trim()) {
    expandAll()
  }
})
</script>

<template>
  <div
    class="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm"
  >
    <!-- Explorer Header -->
    <div class="p-3 border-b border-border flex items-center justify-between">
      <h3
        class="font-medium text-sm text-foreground/80 flex items-center gap-1.5"
      >
        CDC EXPLORER
      </h3>
      <div class="flex items-center gap-1">
        <button
          class="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
          :title="t('batch_download.new_folder')"
          @click="addFolder"
        >
          <FolderPlus class="h-4 w-4" />
        </button>
        <button
          class="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground text-[10px] font-semibold transition-colors"
          title="Expand All"
          @click="expandAll"
        >
          Expand
        </button>
        <button
          class="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground text-[10px] font-semibold transition-colors"
          title="Collapse All"
          @click="collapseAll"
        >
          Collapse
        </button>
      </div>
    </div>

    <!-- Search Input -->
    <div class="p-2 border-b border-border">
      <div class="relative flex items-center">
        <Search class="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('batch_download.search')"
          class="w-full bg-muted/50 border border-input rounded-md pl-8 pr-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-colors"
        />
      </div>
    </div>

    <!-- Tree Content -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- Root Node Details -->
      <div
        :class="
          cn(
            'group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer text-sm font-medium transition-colors',
            selectedNodeId === 'root'
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'hover:bg-muted text-foreground/80 hover:text-foreground',
          )
        "
        @click="handleSelect(rootNode)"
      >
        <div class="flex items-center gap-1.5">
          <span
            class="p-0.5 hover:bg-muted-foreground/10 rounded transition-colors"
            @click.stop="handleToggleExpand('root')"
          >
            <ChevronDown
              v-if="expandedIds.has('root')"
              class="h-3.5 w-3.5 text-muted-foreground"
            />
            <ChevronRight v-else class="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <FolderOpen
            v-if="expandedIds.has('root')"
            class="h-4.5 w-4.5 text-blue-500 flex-shrink-0"
          />
          <Folder v-else class="h-4.5 w-4.5 text-blue-500 flex-shrink-0" />
          <span class="truncate">{{ t('batch_download.root_folder') }}</span>
        </div>
      </div>

      <!-- Root Children Recurse -->
      <div
        v-if="expandedIds.has('root') && filteredRootNode.children.length > 0"
        class="mt-1"
      >
        <FileTreeNode
          v-for="child in filteredRootNode.children"
          :key="child.id"
          :node="child"
          :depth="1"
          :selected-node-id="selectedNodeId"
          :expanded-ids="expandedIds"
          @select="handleSelect"
          @toggle-expand="handleToggleExpand"
          @delete="handleDeleteNode"
          @rename="handleRenameNode"
        />
      </div>
      <div
        v-else-if="filteredRootNode.children.length === 0"
        class="text-xs text-muted-foreground text-center py-8 px-4"
      >
        {{ t('batch_download.no_files') }}
      </div>
    </div>
  </div>
</template>
