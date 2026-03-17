<script setup>
/**
 * App shell — form-first, modal-based editing.
 *
 * Key behavior: creating a new layout opens the modal immediately,
 * but the layout is only kept if the user clicks Save.
 * Cancel / Escape / backdrop click discards unsaved new layouts.
 */
import { computed, ref } from 'vue'
import LayoutEditor from './components/LayoutEditor.vue'
import LayoutStrip from './components/LayoutStrip.vue'
import TimelineView from './components/TimelineView.vue'
import ConflictPanel from './components/ConflictPanel.vue'
import { selectedLayout, conflicts, createLayout, selectLayout, deleteLayout } from './store/index.js'
import { getConflictsForLayout } from './composables/conflictEngine.js'

const isModalOpen = computed(() => selectedLayout.value !== null)

// Track the id of a newly created layout that hasn't been saved yet.
// If the modal is closed without saving, we delete it.
const unsavedNewLayoutId = ref(null)

const selectedLayoutConflicts = computed(() => {
  if (!selectedLayout.value) return []
  return getConflictsForLayout(conflicts.value, selectedLayout.value.id)
})

const hasTarget = computed(() => {
  if (!selectedLayout.value) return false
  return selectedLayout.value.targetTv || selectedLayout.value.targetWeb
})

const canSave = computed(() => selectedLayoutConflicts.value.length === 0 && hasTarget.value)

const saveFlash = ref(false)
const showTimeline = ref(false)

function openNewLayout() {
  const layout = createLayout()
  unsavedNewLayoutId.value = layout.id
}

function saveLayout() {
  if (!canSave.value) return
  // Mark as saved — no longer unsaved
  unsavedNewLayoutId.value = null
  saveFlash.value = true
  setTimeout(() => {
    saveFlash.value = false
    selectLayout(null)
  }, 600)
}

function closeModal() {
  // If the current layout was newly created and not saved, discard it
  if (unsavedNewLayoutId.value) {
    deleteLayout(unsavedNewLayoutId.value)
    unsavedNewLayoutId.value = null
  }
  selectLayout(null)
}

function openExistingLayout(id) {
  // Opening an existing layout — not unsaved
  unsavedNewLayoutId.value = null
  selectLayout(id)
}

function onKeydown(e) {
  if (e.key === 'Escape' && isModalOpen.value) closeModal()
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50" @keydown="onKeydown" tabindex="-1">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
      <h1 class="text-lg font-semibold text-gray-900">Layout Availability</h1>
      <div class="flex items-center gap-3">
        <!-- Timeline toggle -->
        <button
          @click="showTimeline = !showTimeline"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
          :class="showTimeline ? 'bg-gray-900 text-white' : 'text-gray-600 border border-gray-300 hover:bg-gray-50'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
          </svg>
          Timeline
        </button>
      </div>
    </header>

    <!-- Main page timeline (toggled) -->
    <div v-if="showTimeline && !isModalOpen" class="bg-white border-b border-gray-200">
      <TimelineView />
    </div>

    <!-- Horizontal layout strip -->
    <LayoutStrip @create="openNewLayout" />

    <!-- Empty state -->
    <div v-if="!isModalOpen" class="flex-1 flex flex-col items-center justify-center py-24 text-gray-400">
      <svg class="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"/>
      </svg>
      <p class="text-sm">Select a layout above, or create a new one</p>
    </div>

    <!-- Modal overlay -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="isModalOpen"
          class="fixed inset-0 z-40 flex items-start justify-center pt-10 px-4 pb-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/30 backdrop-blur-sm"
            @click="closeModal"
          ></div>

          <!-- Modal panel -->
          <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden z-50">
            <!-- Modal header -->
            <div class="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-gray-700">
                  {{ unsavedNewLayoutId ? 'New Layout' : 'Edit Layout' }}
                </span>
                <span
                  v-if="selectedLayout && !selectedLayout.enabled && !selectedLayout.isDefault"
                  class="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-500 rounded-full"
                >Disabled</span>
              </div>
              <button
                @click="closeModal"
                class="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Modal body (scrollable) -->
            <div class="flex-1 overflow-y-auto">
              <LayoutEditor v-if="selectedLayout" :layout="selectedLayout" />

              <!-- Compact horizontal timeline -->
              <div class="border-t border-gray-200 bg-gray-50">
                <div class="px-5 py-2">
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule Preview</h3>
                </div>
                <TimelineView />
              </div>

              <!-- Conflict panel -->
              <div v-if="selectedLayoutConflicts.length > 0" class="border-t border-gray-200">
                <ConflictPanel />
              </div>
            </div>

            <!-- Modal footer -->
            <div class="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
              <div>
                <span
                  v-if="!hasTarget"
                  class="flex items-center gap-1.5 text-xs text-red-600"
                >
                  <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  Select at least one target (TV or WEB)
                </span>
                <span
                  v-else-if="selectedLayoutConflicts.length > 0"
                  class="flex items-center gap-1.5 text-xs text-amber-600"
                >
                  <svg class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
                  </svg>
                  Resolve {{ selectedLayoutConflicts.length }} conflict{{ selectedLayoutConflicts.length !== 1 ? 's' : '' }} before saving
                </span>
              </div>

              <div class="flex items-center gap-2">
                <button
                  @click="closeModal"
                  class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {{ unsavedNewLayoutId ? 'Discard' : 'Cancel' }}
                </button>
                <button
                  @click="saveLayout"
                  :disabled="!canSave"
                  class="px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                  :class="[
                    saveFlash
                      ? 'bg-green-500 text-white'
                      : canSave
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                  ]"
                >
                  <svg v-if="saveFlash" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <template v-if="saveFlash">Saved</template>
                  <template v-else>Save</template>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: translateY(10px) scale(0.98);
}
</style>
