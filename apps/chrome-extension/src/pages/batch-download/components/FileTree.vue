<script setup lang="ts">
import { ref, watch, computed, provide } from 'vue'
import { FolderPlus, Search, ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-vue-next'
import { useInitLocale } from '../../shared/i18n'
import FileTreeNode, {
  type TreeNode,
  type FolderNode,
  type FileNode,
  DragDropKey,
  type DragDropContext,
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

// Drag and Drop implementation
const draggedNodeId = ref<string | null>(null)
const draggedNode = ref<TreeNode | null>(null)
const dragOverNodeId = ref<string | null>(null)
const expandTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Helper: Check if childId is a descendant of parent
const isDescendant = (parent: FolderNode, childId: string): boolean => {
  for (const child of parent.children) {
    if (child.id === childId) return true
    if (child.type === 'folder') {
      if (isDescendant(child, childId)) return true
    }
  }
  return false
}

// Helper: Check if a drop target is valid
const isDropTargetValid = (targetNode: TreeNode): boolean => {
  if (!draggedNode.value) return false
  if (targetNode.type !== 'folder') return false
  if (draggedNode.value.id === targetNode.id) return false
  
  // A folder cannot be dropped into its own descendant
  if (
    draggedNode.value.type === 'folder' &&
    isDescendant(draggedNode.value as FolderNode, targetNode.id)
  ) {
    return false
  }
  return true
}

const handleDragStart = (e: DragEvent, node: TreeNode) => {
  // Disallow dragging the root node
  if (node.id === 'root') {
    e.preventDefault()
    return
  }
  draggedNodeId.value = node.id
  draggedNode.value = node
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
  }
}

const handleDragEnd = (e: DragEvent) => {
  cleanupDrag()
}

const handleDragOver = (e: DragEvent, targetNode: TreeNode) => {
  if (!isDropTargetValid(targetNode)) {
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'none'
    }
    return
  }

  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  if (dragOverNodeId.value !== targetNode.id) {
    dragOverNodeId.value = targetNode.id

    // Auto-expand folder after hovering for 800ms
    if (expandTimeout.value) {
      clearTimeout(expandTimeout.value)
      expandTimeout.value = null
    }

    if (targetNode.type === 'folder' && !expandedIds.value.has(targetNode.id)) {
      expandTimeout.value = setTimeout(() => {
        if (dragOverNodeId.value === targetNode.id) {
          expandedIds.value.add(targetNode.id)
        }
      }, 800)
    }
  }
}

const handleDragLeave = (e: DragEvent, targetNode: TreeNode) => {
  if (dragOverNodeId.value === targetNode.id) {
    dragOverNodeId.value = null
    if (expandTimeout.value) {
      clearTimeout(expandTimeout.value)
      expandTimeout.value = null
    }
  }
}

const handleDrop = (e: DragEvent, targetNode: FolderNode) => {
  e.preventDefault()
  if (!draggedNode.value || !isDropTargetValid(targetNode)) {
    cleanupDrag()
    return
  }

  // 1. Find and remove from current parent
  const parent = findParentFolder(props.rootNode, draggedNode.value.id)
  if (parent) {
    parent.children = parent.children.filter(c => c.id !== draggedNode.value!.id)
  }

  // 2. Add to target folder children
  targetNode.children.push(draggedNode.value)

  // 3. Auto-expand target folder to show items
  expandedIds.value.add(targetNode.id)

  // 4. Trigger deep reactivity/saving
  emit('update:rootNode', { ...props.rootNode })

  cleanupDrag()
}

const cleanupDrag = () => {
  draggedNodeId.value = null
  draggedNode.value = null
  dragOverNodeId.value = null
  if (expandTimeout.value) {
    clearTimeout(expandTimeout.value)
    expandTimeout.value = null
  }
}

// Provide Drag and Drop Context
provide(DragDropKey, {
  draggedNodeId,
  dragOverNodeId,
  onDragStart: handleDragStart,
  onDragEnd: handleDragEnd,
  onDragOver: handleDragOver,
  onDragLeave: handleDragLeave,
  onDrop: handleDrop,
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
            'group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer text-sm font-medium transition-colors border border-transparent',
            selectedNodeId === 'root'
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'hover:bg-muted text-foreground/80 hover:text-foreground',
            dragOverNodeId === 'root' && 'bg-primary/20 border-dashed border-primary/50'
          )
        "
        @click="handleSelect(rootNode)"
        @dragover.prevent="handleDragOver($event, rootNode)"
        @dragenter.prevent="handleDragOver($event, rootNode)"
        @dragleave="handleDragLeave($event, rootNode)"
        @drop="handleDrop($event, rootNode)"
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
