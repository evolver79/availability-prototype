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

// Combined options: devices + groups
const combinedOptions = computed(() => {
  const opts = []
  for (const g of store.groups) {
    opts.push({
      id: g.id,
      label: g.name,
      sublabel: `${g.deviceIds.length} device${g.deviceIds.length !== 1 ? 's' : ''}`,
      type: 'group',
    })
  }
  for (const d of store.devices) {
    opts.push({
      id: d.id,
      label: d.name,
      sublabel: d.location,
      type: 'device',
    })
  }
  return opts
})

const combinedSelected = computed(() => [
  ...props.layout.groupIds,
  ...props.layout.deviceIds,
])

function onCombinedChange(ids) {
  const groupIds = ids.filter((id) => store.groups.some((g) => g.id === id))
  const deviceIds = ids.filter((id) => store.devices.some((d) => d.id === id))
  updateLayout(props.layout.id, { groupIds, deviceIds })
}

function toggleWeb() {
  updateLayout(props.layout.id, { targetWeb: !props.layout.targetWeb })
}

function toggleTv() {
  const newVal = !props.layout.targetTv
  const updates = { targetTv: newVal }
  // Clear device/group selections when turning off TV
  if (!newVal) {
    updates.deviceIds = []
    updates.groupIds = []
  }
  updateLayout(props.layout.id, updates)
}

function updateName(e) {
  updateLayout(props.layout.id, { name: e.target.value })
}
</script>

<template>
  <div class="p-5">
    <!-- Header with name edit -->
    <div class="flex items-center gap-3 mb-4">
      <div class="w-4 h-4 rounded-full shrink-0" :style="{ backgroundColor: color.hex }" />
      <input
        :value="layout.name"
        @input="updateName"
        class="text-lg font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors px-1 py-0.5 -ml-1 w-full"
        placeholder="Layout name..."
      />
    </div>

    <!-- Inline conflict warning -->
    <div
      v-if="layoutConflicts.length > 0"
      class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2"
    >
      <svg class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
      </svg>
      <div class="text-sm">
        <span class="font-medium text-amber-800">
          {{ layoutConflicts.length }} scheduling conflict{{ layoutConflicts.length !== 1 ? 's' : '' }}
        </span>
        <span class="text-amber-600"> — see below for resolution options</span>
      </div>
    </div>

    <div class="space-y-5">
      <!-- Target: WEB and/or TV (required) -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider mb-2"
          :class="!layout.targetTv && !layout.targetWeb ? 'text-red-500' : 'text-gray-500'"
        >
          Target
          <span v-if="!layout.targetTv && !layout.targetWeb" class="normal-case font-normal text-red-400 ml-1">— required</span>
        </h3>
        <div class="flex items-center gap-2"
          :class="!layout.targetTv && !layout.targetWeb ? 'ring-2 ring-red-200 rounded-lg p-1 -m-1' : ''"
        >
          <!-- TV toggle -->
          <button
            @click="toggleTv"
            class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
            :class="[
              layout.targetTv
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
            ]"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            TV
          </button>

          <!-- WEB toggle -->
          <button
            @click="toggleWeb"
            class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
            :class="[
              layout.targetWeb
                ? hasWebConflict
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-indigo-50 border-indigo-300 text-indigo-800'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
            ]"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
            </svg>
            WEB
            <span
              v-if="layout.targetWeb && hasWebConflict"
              class="w-1.5 h-1.5 rounded-full bg-amber-500"
            ></span>
          </button>
        </div>
      </div>

      <!-- TV Devices & Groups (only when TV is targeted) -->
      <div v-if="layout.targetTv">
        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">TV Devices & Groups</h3>
        <MultiSelect
          :options="combinedOptions"
          :modelValue="combinedSelected"
          @update:modelValue="onCombinedChange"
          :placeholder="combinedSelected.length === 0 ? 'Select to narrow down...' : 'Search devices and groups...'"
          :warningIds="conflictingDeviceIds"
          grouped
          allBadge
        />
      </div>

      <!-- Availability rule -->
      <AvailabilityEditor :layout="layout" />
    </div>
  </div>
</template>
