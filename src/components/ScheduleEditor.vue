<script setup>
/**
 * Schedule Editor — modal form for assigning a layout to devices + time.
 * Receives a schedule object, shows TV/WEB toggle, device picker, availability.
 */
import { computed } from 'vue'
import {
  store,
  updateSchedule,
  updateScheduleSlot,
  getLayoutForSchedule,
  getLayoutColor,
  getConflictsForSchedule,
  resolveScheduleDeviceIds,
  isScheduleExpired,
  toggleScheduleEnabled,
  deleteSchedule,
} from '../store/index.js'
import AvailabilityEditor from './AvailabilityEditor.vue'
import MultiSelect from './MultiSelect.vue'

const props = defineProps({
  schedule: { type: Object, required: true },
})

const layout = computed(() => getLayoutForSchedule(props.schedule))
const color = computed(() => layout.value ? getLayoutColor(layout.value) : null)

// Only show conflicts when the schedule is meaningfully configured:
// needs a target, actual time range, AND at least one device/group (or WEB)
const isConfigured = computed(() => {
  const s = props.schedule
  if (!s.targetTv && !s.targetWeb) return false
  const hasTvDevices = s.targetTv && (s.deviceIds.length > 0 || s.groupIds.length > 0)
  if (!hasTvDevices && !s.targetWeb) return false
  return true
})

const scheduleConflicts = computed(() => isConfigured.value ? getConflictsForSchedule(props.schedule.id) : [])

const conflictingDeviceIds = computed(() => {
  const ids = new Set()
  for (const c of scheduleConflicts.value) {
    c.overlappingDevices.forEach((d) => ids.add(d))
  }
  return ids
})

const ALL_DEVICES_ID = '__all__'
const allDeviceIds = computed(() => store.devices.map((d) => d.id))

const isAllSelected = computed(() => {
  if (props.schedule.groupIds.length > 0) return false
  return allDeviceIds.value.length > 0 && allDeviceIds.value.every((id) => props.schedule.deviceIds.includes(id))
})

// Which devices/groups are used by OTHER active schedules (for "in use" indicators)
const deviceUsage = computed(() => {
  const usage = {} // deviceId/groupId → [{ layoutName, time }]
  for (const sch of store.schedules) {
    if (sch.id === props.schedule.id || sch.isDefault || !sch.enabled || isScheduleExpired(sch)) continue
    const layout = getLayoutForSchedule(sch)
    const name = layout?.name || 'Unknown'
    const fh = (h) => `${String(h).padStart(2, '0')}:00`
    const time = `${fh(sch.slot.startHour)}–${fh(sch.slot.endHour)}`
    // Track group usage
    for (const gid of sch.groupIds) {
      if (!usage[gid]) usage[gid] = []
      usage[gid].push({ name, time })
    }
    // Track device usage (resolved from groups too)
    const resolved = resolveScheduleDeviceIds(sch)
    for (const did of resolved) {
      if (!usage[did]) usage[did] = []
      usage[did].push({ name, time })
    }
  }
  return usage
})

function usageSublabel(id, fallback) {
  const u = deviceUsage.value[id]
  if (!u || u.length === 0) return fallback
  return `${fallback} · in use by ${u.map(x => x.name).join(', ')}`
}

function usageTooltip(id) {
  const u = deviceUsage.value[id]
  if (!u || u.length === 0) return null
  return u.map(x => `${x.name} (${x.time})`).join('\n')
}

const inUseIds = computed(() => new Set(Object.keys(deviceUsage.value).filter(id => deviceUsage.value[id]?.length > 0)))

const combinedOptions = computed(() => {
  const opts = []
  opts.push({ id: ALL_DEVICES_ID, label: 'All devices', sublabel: `${store.devices.length} devices`, type: 'wildcard' })
  for (const g of store.groups) {
    const inUse = inUseIds.value.has(g.id)
    opts.push({
      id: g.id,
      label: g.name + (inUse ? ' (in use)' : ''),
      sublabel: usageSublabel(g.id, `${g.deviceIds.length} device${g.deviceIds.length !== 1 ? 's' : ''}`),
      type: 'group',
      inUse,
    })
  }
  for (const d of store.devices) {
    const inUse = inUseIds.value.has(d.id)
    opts.push({
      id: d.id,
      label: d.name + (inUse ? ' (in use)' : ''),
      sublabel: usageSublabel(d.id, d.location),
      type: 'device',
      inUse,
    })
  }
  return opts
})

const combinedSelected = computed(() => {
  if (isAllSelected.value) return [ALL_DEVICES_ID]
  return [...props.schedule.groupIds, ...props.schedule.deviceIds]
})

function onCombinedChange(ids) {
  const wasAll = isAllSelected.value
  const nowHasAll = ids.includes(ALL_DEVICES_ID)

  if (nowHasAll && !wasAll) {
    // User just selected "All" — set all device IDs, clear groups
    updateSchedule(props.schedule.id, { deviceIds: [...allDeviceIds.value], groupIds: [] })
    return
  }

  if (wasAll && !nowHasAll) {
    // User deselected "All" — clear everything
    updateSchedule(props.schedule.id, { deviceIds: [], groupIds: [] })
    return
  }

  if (wasAll && nowHasAll) {
    // User picked something specific while "All" was on — switch to that specific selection
    const specificIds = ids.filter((id) => id !== ALL_DEVICES_ID)
    const groupIds = specificIds.filter((id) => store.groups.some((g) => g.id === id))
    const deviceIds = specificIds.filter((id) => store.devices.some((d) => d.id === id))
    updateSchedule(props.schedule.id, { groupIds, deviceIds })
    return
  }

  // Normal: no "All" involved
  const groupIds = ids.filter((id) => store.groups.some((g) => g.id === id))
  const deviceIds = ids.filter((id) => store.devices.some((d) => d.id === id))
  updateSchedule(props.schedule.id, { groupIds, deviceIds })
}

function toggleWeb() { updateSchedule(props.schedule.id, { targetWeb: !props.schedule.targetWeb }) }

function toggleTv() {
  const newVal = !props.schedule.targetTv
  const updates = { targetTv: newVal }
  if (!newVal) { updates.deviceIds = []; updates.groupIds = [] }
  updateSchedule(props.schedule.id, updates)
}

const noTarget = computed(() => !props.schedule.targetTv && !props.schedule.targetWeb)
const isDisabled = computed(() => !props.schedule.enabled)



// Live conflict hints
const deviceConflictHints = computed(() => {
  const hints = []
  for (const c of scheduleConflicts.value) {
    if (c.overlappingDevices.length === 0) continue
    const otherSch = c.scheduleA.id === props.schedule.id ? c.scheduleB : c.scheduleA
    const otherLayout = c.scheduleA.id === props.schedule.id ? c.layoutB : c.layoutA
    const deviceNames = c.overlappingDevices
      .map((id) => store.devices.find((d) => d.id === id)?.name || id)
      .slice(0, 3)
    const extra = c.overlappingDevices.length > 3 ? ` +${c.overlappingDevices.length - 3}` : ''

    // Check if overlap is via a group
    const viaGroups = []
    for (const gid of [...props.schedule.groupIds, ...otherSch.groupIds]) {
      const group = store.groups.find((g) => g.id === gid)
      if (group && group.deviceIds.some((did) => c.overlappingDevices.includes(did))) {
        viaGroups.push(group.name)
      }
    }
    const viaText = viaGroups.length > 0 ? ` (via ${[...new Set(viaGroups)].join(', ')})` : ''
    hints.push(`Overlaps with "${otherLayout?.name}" on ${deviceNames.join(', ')}${extra}${viaText}`)
  }
  return [...new Set(hints)]
})

const timeConflictHints = computed(() => {
  const hints = []
  for (const c of scheduleConflicts.value) {
    const otherLayout = c.scheduleA.id === props.schedule.id ? c.layoutB : c.layoutA
    const fh = (h) => `${String(h).padStart(2, '0')}:00`
    hints.push(`Time overlap with "${otherLayout?.name}" (${fh(c.overlapStart)}–${fh(c.overlapEnd)})`)
  }
  return [...new Set(hints)]
})
</script>

<template>
  <div class="px-5 py-4 space-y-3">
    <!-- Header: layout name + schedule actions -->
    <div class="flex items-center gap-2 pb-2 border-b border-gray-200">
      <div v-if="color" class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: color.hex }"></div>
      <span class="text-sm font-semibold text-gray-900 flex-1">{{ layout?.name || 'Unknown Layout' }}</span>

      <!-- Enabled/disabled toggle -->
      <button
        @click="toggleScheduleEnabled(schedule.id)"
        class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors"
        :class="schedule.enabled
          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/>
        </svg>
        {{ schedule.enabled ? 'Enabled' : 'Disabled' }}
      </button>

      <!-- Delete schedule -->
      <button
        @click="deleteSchedule(schedule.id)"
        class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
        title="Delete this schedule permanently"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        Delete
      </button>
    </div>

    <!-- Disabled notice -->
    <div v-if="isDisabled" class="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-xs text-gray-500">
      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
      </svg>
      This schedule is disabled — enable it to edit settings
    </div>

    <!-- Everything below is disabled when schedule is off -->
    <div :class="isDisabled ? 'opacity-40 pointer-events-none select-none' : ''">

    <!-- Conflict warning -->
    <div
      v-if="scheduleConflicts.length > 0"
      class="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs"
    >
      <svg class="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
      </svg>
      <span class="text-amber-800">
        {{ scheduleConflicts.length }} conflict{{ scheduleConflicts.length !== 1 ? 's' : '' }} — toggle conflicts in header to resolve
      </span>
    </div>

    <!-- Target: TV / WEB -->
    <div class="flex items-center gap-1.5" :class="noTarget ? 'ring-2 ring-red-200 rounded-lg px-1 py-0.5' : ''">
      <button
        @click="toggleTv"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all"
        :class="schedule.targetTv ? 'bg-blue-light border-blue text-blue' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        TV
      </button>
      <button
        @click="toggleWeb"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all"
        :class="schedule.targetWeb ? 'bg-highlight border-deep-blue text-deep-blue' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
        </svg>
        WEB
      </button>
    </div>

    <!-- TV device select -->
    <div v-if="schedule.targetTv">
      <label class="text-xs text-gray-500 mb-1 block">Devices & groups</label>
      <MultiSelect
        :options="combinedOptions"
        :modelValue="combinedSelected"
        @update:modelValue="onCombinedChange"
        :placeholder="combinedSelected.length === 0 ? 'Select devices or groups...' : 'Search...'"
        :warningIds="conflictingDeviceIds"
        grouped
      />
      <p v-for="hint in deviceConflictHints" :key="hint" class="text-xs text-amber-600 mt-1 flex items-center gap-1">
        <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
        {{ hint }}
      </p>
    </div>

    <!-- Availability -->
    <AvailabilityEditor :schedule="schedule" />
    <p v-for="hint in timeConflictHints" :key="hint" class="text-xs text-amber-600 flex items-center gap-1">
      <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
      {{ hint }}
    </p>

    </div><!-- end disabled wrapper -->
  </div>
</template>
