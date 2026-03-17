<script setup>
import { computed } from 'vue'
import {
  store,
  updateLayout,
  getLayoutColor,
  conflicts,
} from '../store/index.js'
import { getConflictsForLayout } from '../composables/conflictEngine.js'
import AvailabilityEditor from './AvailabilityEditor.vue'
import MultiSelect from './MultiSelect.vue'

const props = defineProps({
  layout: { type: Object, required: true },
})

const color = computed(() => getLayoutColor(props.layout))

const layoutConflicts = computed(() =>
  getConflictsForLayout(conflicts.value, props.layout.id)
)

const conflictingDeviceIds = computed(() => {
  const ids = new Set()
  for (const c of layoutConflicts.value) {
    c.overlappingDevices.forEach((d) => ids.add(d))
  }
  return ids
})

const hasWebConflict = computed(() =>
  layoutConflicts.value.some((c) => c.webOverlap)
)

const combinedOptions = computed(() => {
  const opts = []
  for (const g of store.groups) {
    opts.push({ id: g.id, label: g.name, sublabel: `${g.deviceIds.length} device${g.deviceIds.length !== 1 ? 's' : ''}`, type: 'group' })
  }
  for (const d of store.devices) {
    opts.push({ id: d.id, label: d.name, sublabel: d.location, type: 'device' })
  }
  return opts
})

const combinedSelected = computed(() => [...props.layout.groupIds, ...props.layout.deviceIds])

function onCombinedChange(ids) {
  const groupIds = ids.filter((id) => store.groups.some((g) => g.id === id))
  const deviceIds = ids.filter((id) => store.devices.some((d) => d.id === id))
  updateLayout(props.layout.id, { groupIds, deviceIds })
}

function toggleWeb() { updateLayout(props.layout.id, { targetWeb: !props.layout.targetWeb }) }

function toggleTv() {
  const newVal = !props.layout.targetTv
  const updates = { targetTv: newVal }
  if (!newVal) { updates.deviceIds = []; updates.groupIds = [] }
  updateLayout(props.layout.id, updates)
}

function updateName(e) { updateLayout(props.layout.id, { name: e.target.value }) }

const noTarget = computed(() => !props.layout.targetTv && !props.layout.targetWeb)

// Live conflict hints: which layouts conflict and on what
const deviceConflictHints = computed(() => {
  const hints = []
  for (const c of layoutConflicts.value) {
    if (c.overlappingDevices.length === 0) continue
    const other = c.layoutA.id === props.layout.id ? c.layoutB : c.layoutA
    const deviceNames = c.overlappingDevices
      .map((id) => store.devices.find((d) => d.id === id)?.name || id)
      .slice(0, 3)
    const extra = c.overlappingDevices.length > 3 ? ` +${c.overlappingDevices.length - 3}` : ''
    hints.push(`Overlaps with "${other.name}" on ${deviceNames.join(', ')}${extra}`)
  }
  return [...new Set(hints)]
})

const timeConflictHints = computed(() => {
  const hints = []
  for (const c of layoutConflicts.value) {
    const other = c.layoutA.id === props.layout.id ? c.layoutB : c.layoutA
    const fh = (h) => `${String(h).padStart(2, '0')}:00`
    hints.push(`Time overlap with "${other.name}" (${fh(c.overlapStart)}–${fh(c.overlapEnd)})`)
  }
  return [...new Set(hints)]
})
</script>

<template>
  <div class="px-5 py-4 space-y-3">
    <!-- Row 1: Name + Target toggles on one line -->
    <div class="flex items-center gap-3">
      <input
        :value="layout.name"
        @input="updateName"
        class="text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors py-0.5 flex-1 min-w-0"
        placeholder="Layout name..."
      />

      <!-- Target toggles inline -->
      <div class="flex items-center gap-1.5 shrink-0" :class="noTarget ? 'ring-2 ring-red-200 rounded-lg px-1 py-0.5' : ''">
        <button
          @click="toggleTv"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all"
          :class="layout.targetTv ? 'bg-blue-light border-blue text-blue' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          TV
        </button>
        <button
          @click="toggleWeb"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all"
          :class="layout.targetWeb
            ? hasWebConflict ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-highlight border-deep-blue text-deep-blue'
            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
          </svg>
          WEB
          <span v-if="layout.targetWeb && hasWebConflict" class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        </button>
      </div>
    </div>

    <!-- Conflict warning (compact) -->
    <div
      v-if="layoutConflicts.length > 0"
      class="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs"
    >
      <svg class="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
      </svg>
      <span class="text-amber-800">
        {{ layoutConflicts.length }} conflict{{ layoutConflicts.length !== 1 ? 's' : '' }} — toggle conflicts in header to resolve
      </span>
    </div>

    <!-- TV device select (only when TV on) -->
    <div v-if="layout.targetTv">
      <label class="text-xs text-gray-500 mb-1 block">Devices & groups</label>
      <MultiSelect
        :options="combinedOptions"
        :modelValue="combinedSelected"
        @update:modelValue="onCombinedChange"
        :placeholder="combinedSelected.length === 0 ? 'Select to narrow down...' : 'Search...'"
        :warningIds="conflictingDeviceIds"
        grouped
        allBadge
      />
      <!-- Live device conflict hints -->
      <p
        v-for="hint in deviceConflictHints"
        :key="hint"
        class="text-xs text-amber-600 mt-1 flex items-center gap-1"
      >
        <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
        </svg>
        {{ hint }}
      </p>
    </div>

    <!-- Availability (inline, no wrapper card) -->
    <AvailabilityEditor :layout="layout" />
    <!-- Live time conflict hints -->
    <p
      v-for="hint in timeConflictHints"
      :key="hint"
      class="text-xs text-amber-600 mt-1 flex items-center gap-1"
    >
      <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
      </svg>
      {{ hint }}
    </p>
  </div>
</template>
