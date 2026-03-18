<script setup>
/**
 * App shell — layout library + device timeline + schedule modal.
 *
 * Layouts are content-only. Scheduling happens via a separate modal
 * that connects a layout to devices + time. Timeline rows = devices.
 */
import { computed, ref, watch } from 'vue'
import LayoutStrip from './components/LayoutStrip.vue'
import ScheduleEditor from './components/ScheduleEditor.vue'
import TimelineView from './components/TimelineView.vue'
import ConflictPanel from './components/ConflictPanel.vue'
import {
  store,
  editingSchedule,
  conflicts,
  getConflictsForSchedule,
  getLayoutForSchedule,
  closeScheduleModal,
  deleteSchedule,
  restoreSchedule,
} from './store/index.js'

const isModalOpen = computed(() => editingSchedule.value !== null)

const scheduleConflicts = computed(() => {
  if (!editingSchedule.value) return []
  return getConflictsForSchedule(editingSchedule.value.id)
})

const hasTarget = computed(() => {
  if (!editingSchedule.value) return false
  return editingSchedule.value.targetTv || editingSchedule.value.targetWeb
})

const hasDevices = computed(() => {
  if (!editingSchedule.value) return false
  const s = editingSchedule.value
  if (s.targetTv && (s.deviceIds.length > 0 || s.groupIds.length > 0)) return true
  if (s.targetWeb) return true // WEB doesn't need device selection
  return false
})

const canSave = computed(() => scheduleConflicts.value.length === 0 && hasTarget.value && hasDevices.value)

const saveFlash = ref(false)
const showTimeline = ref(false)
const showModalTimeline = ref(false)
const showModalConflicts = ref(false)

// Snapshot for cancel/restore
const scheduleSnapshot = ref(null)
const hasAttemptedSave = ref(false)

const isNewSchedule = computed(() => store.isNewSchedule)

// Watch for modal open — snapshot the schedule
watch(editingSchedule, (sch) => {
  if (sch && !scheduleSnapshot.value) {
    scheduleSnapshot.value = JSON.parse(JSON.stringify(sch))
    hasAttemptedSave.value = false
  }
})

function saveSchedule() {
  hasAttemptedSave.value = true
  if (!canSave.value) return
  scheduleSnapshot.value = null
  hasAttemptedSave.value = false
  store.isNewSchedule = false
  saveFlash.value = true
  setTimeout(() => {
    saveFlash.value = false
    closeScheduleModal()
  }, 600)
}

function cancelModal() {
  if (store.isNewSchedule && editingSchedule.value) {
    deleteSchedule(editingSchedule.value.id)
  } else if (scheduleSnapshot.value && editingSchedule.value) {
    restoreSchedule(editingSchedule.value.id, scheduleSnapshot.value)
  }
  scheduleSnapshot.value = null
  hasAttemptedSave.value = false
  closeScheduleModal()
}

function onKeydown(e) {
  if (e.key === 'Escape' && isModalOpen.value) cancelModal()
}

const modalTitle = computed(() => {
  if (!editingSchedule.value) return ''
  const layout = getLayoutForSchedule(editingSchedule.value)
  return isNewSchedule.value
    ? `Schedule "${layout?.name || 'Layout'}"`
    : `Edit schedule for "${layout?.name || 'Layout'}"`
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50" @keydown="onKeydown" tabindex="-1">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
      <h1 class="text-lg font-semibold text-gray-900">Layout Availability</h1>
      <div class="flex items-center gap-3">
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
        <div v-if="conflicts.length > 0" class="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-700">
          <svg class="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
          </svg>
          {{ conflicts.length }} conflict{{ conflicts.length !== 1 ? 's' : '' }}
        </div>
      </div>
    </header>

    <!-- Layout library -->
    <LayoutStrip />

    <!-- Device timeline -->
    <div v-if="showTimeline" class="bg-white border-b border-gray-200">
      <TimelineView />
    </div>

    <!-- Empty area -->
    <div v-if="!showTimeline" class="flex-1"></div>

    <!-- Schedule modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="isModalOpen" class="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div class="absolute inset-0 bg-black/30" @click="cancelModal"></div>

          <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden z-50">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
              <span class="text-sm font-semibold text-gray-700">{{ modalTitle }}</span>
              <div class="flex items-center gap-2">
                <button v-if="scheduleConflicts.length > 0"
                  @click="showModalConflicts = !showModalConflicts"
                  class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                  :class="showModalConflicts ? 'bg-amber-100 text-amber-700' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'">
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
                  {{ scheduleConflicts.length }} conflict{{ scheduleConflicts.length !== 1 ? 's' : '' }}
                </button>
                <button @click="cancelModal" class="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Body -->
            <div class="flex-1 flex overflow-hidden">
              <div class="flex-1 overflow-y-auto">
                <ScheduleEditor v-if="editingSchedule" :schedule="editingSchedule" />

                <div class="border-t border-gray-200">
                  <button @click="showModalTimeline = !showModalTimeline"
                    class="w-full flex items-center justify-between px-5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                    <span>Schedule preview</span>
                    <svg class="w-3.5 h-3.5 transition-transform" :class="showModalTimeline ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  <TimelineView v-if="showModalTimeline" />
                </div>
              </div>

              <div v-if="showModalConflicts && scheduleConflicts.length > 0" class="w-72 border-l border-gray-200 overflow-y-auto shrink-0 bg-gray-50">
                <ConflictPanel />
              </div>
            </div>

            <!-- Footer -->
            <div class="px-5 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
              <div v-if="hasAttemptedSave && (!hasTarget || !hasDevices || scheduleConflicts.length > 0)" class="mb-2">
                <p v-if="!hasTarget" class="text-xs text-red-600 flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                  Select at least one target (TV or WEB)
                </p>
                <p v-else-if="!hasDevices" class="text-xs text-red-600 flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                  Select at least one device or group
                </p>
                <p v-else class="text-xs text-amber-600 flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
                  Resolve conflicts before saving
                </p>
              </div>
              <div class="flex items-center justify-end gap-2">
                <button @click="cancelModal" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                  {{ isNewSchedule ? 'Discard' : 'Cancel' }}
                </button>
                <button @click="saveSchedule" :disabled="!canSave"
                  class="px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                  :class="saveFlash ? 'bg-green-500 text-white' : canSave ? 'bg-blue text-white hover:bg-blue/90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
                  <svg v-if="saveFlash" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  {{ saveFlash ? 'Saved' : 'Save' }}
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
.modal-enter-active, .modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative, .modal-leave-to .relative { transform: translateY(10px) scale(0.98); }
</style>
