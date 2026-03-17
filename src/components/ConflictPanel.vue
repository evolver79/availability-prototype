<script setup>
/**
 * Conflict Panel — compact but readable conflict cards.
 * Shows summary + detail chips always visible, quick fixes behind a toggle.
 */
import { computed, ref } from 'vue'
import {
  store,
  conflicts,
  getLayoutColor,
  removeDeviceFromLayout,
  removeGroupFromLayout,
  updateSlot,
  selectLayout,
} from '../store/index.js'
import { getSuggestions } from '../composables/conflictEngine.js'

const sortedConflicts = computed(() => [...conflicts.value])
const expandedId = ref(null)

function toggle(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function suggestionsFor(conflict) {
  return getSuggestions(conflict, store.devices, store.groups)
}

function applySuggestion(suggestion) {
  switch (suggestion.type) {
    case 'remove-device':
      removeDeviceFromLayout(suggestion.action.layoutId, suggestion.action.deviceId)
      break
    case 'remove-group':
      removeGroupFromLayout(suggestion.action.layoutId, suggestion.action.groupId)
      break
    case 'adjust-time':
    case 'adjust-dates':
      updateSlot(suggestion.action.layoutId, suggestion.action.slotId, suggestion.action.updates)
      break
  }
}

function deviceName(id) {
  return store.devices.find((d) => d.id === id)?.name || id
}

function formatHour(h) {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  if (h < 12) return `${h}a`
  return `${h - 12}p`
}
</script>

<template>
  <div class="p-4">
    <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <svg class="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
      </svg>
      {{ sortedConflicts.length }} Conflict{{ sortedConflicts.length !== 1 ? 's' : '' }}
    </h2>

    <div class="space-y-2">
      <div
        v-for="conflict in sortedConflicts"
        :key="conflict.id"
        class="bg-amber-50 border border-amber-200 rounded-lg p-2.5"
      >
        <!-- Header row: layout names -->
        <div class="flex items-center gap-1.5 mb-1.5">
          <div class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: getLayoutColor(conflict.layoutA).hex }"></div>
          <button
            @click="selectLayout(conflict.layoutA.id)"
            class="text-xs font-semibold text-gray-800 hover:text-blue transition-colors truncate"
          >{{ conflict.layoutA.name }}</button>
          <span class="text-xs text-gray-400">vs</span>
          <div class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: getLayoutColor(conflict.layoutB).hex }"></div>
          <button
            @click="selectLayout(conflict.layoutB.id)"
            class="text-xs font-semibold text-gray-800 hover:text-blue transition-colors truncate"
          >{{ conflict.layoutB.name }}</button>
        </div>

        <!-- Detail chips — always visible, compact -->
        <div class="flex flex-wrap gap-1 mb-1.5">
          <span class="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-700">
            {{ formatHour(conflict.overlapStart) }}–{{ formatHour(conflict.overlapEnd) }}
          </span>
          <span class="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-700">
            {{ conflict.dateDescription }}
          </span>
          <span v-if="conflict.dayInfo.type === 'specific'" class="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-700">
            {{ conflict.dayInfo.days.join(', ') }}
          </span>
          <span v-if="conflict.overlappingDevices.length > 0" class="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-700">
            TV: {{ conflict.overlappingDevices.length > 3 ? conflict.overlappingDevices.slice(0, 3).map(deviceName).join(', ') + ` +${conflict.overlappingDevices.length - 3}` : conflict.overlappingDevices.map(deviceName).join(', ') }}
          </span>
          <span v-if="conflict.webOverlap" class="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-700">
            WEB
          </span>
        </div>

        <!-- Quick fixes toggle -->
        <button
          @click="toggle(conflict.id)"
          class="text-xs text-amber-600 hover:text-amber-800 transition-colors flex items-center gap-1"
        >
          <svg
            class="w-3 h-3 transition-transform"
            :class="expandedId === conflict.id ? 'rotate-90' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
          {{ expandedId === conflict.id ? 'Hide fixes' : 'Quick fixes' }}
        </button>

        <!-- Expanded quick fixes -->
        <div v-if="expandedId === conflict.id" class="mt-1.5 flex flex-wrap gap-1">
          <button
            v-for="(suggestion, idx) in suggestionsFor(conflict).slice(0, 5)"
            :key="idx"
            @click="applySuggestion(suggestion)"
            class="px-2 py-1 text-xs bg-white border border-amber-200 rounded-md hover:bg-amber-100 hover:border-amber-300 transition-colors text-gray-700"
          >
            {{ suggestion.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
