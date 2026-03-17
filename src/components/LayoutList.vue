<script setup>
/**
 * Layout List — main view showing all layouts as a card grid.
 * Click a card to open the editor modal.
 * Conflict badges show inline without blocking.
 */
import { computed } from 'vue'
import {
  store,
  selectedLayout,
  conflicts,
  selectLayout,
  createLayout,
  deleteLayout,
  getLayoutColor,
  resolveDeviceIds,
} from '../store/index.js'
import { getConflictsForLayout } from '../composables/conflictEngine.js'

const layouts = computed(() => store.layouts)

function layoutConflictCount(layoutId) {
  return getConflictsForLayout(conflicts.value, layoutId).length
}

function deviceCount(layout) {
  return resolveDeviceIds(layout).size
}

function dateSummary(layout) {
  if (layout.slots.length === 0) return 'No schedule'
  const slot = layout.slots[0]
  const modeLabels = { forever: 'Always', untilDate: 'Until ' + (slot.endDate || '—'), fromDate: 'From ' + (slot.startDate || '—'), dateRange: (slot.startDate || '—') + ' → ' + (slot.endDate || '—') }
  const base = modeLabels[slot.dateMode] || 'Custom'
  return layout.slots.length > 1 ? `${base} (+${layout.slots.length - 1} more)` : base
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Layouts</h2>
      <button
        @click="createLayout"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue rounded-lg hover:bg-blue/90 transition-colors shadow-sm"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        New Layout
      </button>
    </div>

    <!-- Card grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div
        v-for="layout in layouts"
        :key="layout.id"
        @click="selectLayout(layout.id)"
        class="group relative bg-white rounded-lg border cursor-pointer transition-all hover:shadow-md"
        :class="[
          layoutConflictCount(layout.id) > 0
            ? 'border-amber-300 hover:border-amber-400'
            : 'border-gray-200 hover:border-gray-300',
        ]"
      >
        <!-- Color bar top -->
        <div
          class="h-1 rounded-t-lg"
          :style="{ backgroundColor: getLayoutColor(layout).hex }"
        ></div>

        <div class="p-4">
          <!-- Name + conflict badge -->
          <div class="flex items-center gap-2 mb-2">
            <h3 class="text-sm font-semibold text-gray-900 truncate">{{ layout.name }}</h3>
            <span
              v-if="layoutConflictCount(layout.id) > 0"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 conflict-pulse shrink-0"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
              </svg>
              {{ layoutConflictCount(layout.id) }}
            </span>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-3 text-xs text-gray-400">
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              {{ deviceCount(layout) }} device{{ deviceCount(layout) !== 1 ? 's' : '' }}
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {{ layout.slots.length }} rule{{ layout.slots.length !== 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Date summary -->
          <div class="mt-2 text-xs text-gray-500 truncate">{{ dateSummary(layout) }}</div>
        </div>

        <!-- Delete button (top right, on hover) -->
        <button
          @click.stop="deleteLayout(layout.id)"
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 bg-white rounded transition-all"
          title="Delete layout"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="layouts.length === 0" class="py-16 text-center">
      <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
      </svg>
      <p class="text-sm text-gray-400">No layouts yet. Create one to get started.</p>
    </div>
  </div>
</template>
