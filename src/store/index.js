import { reactive, computed } from 'vue'
import { DEVICES, GROUPS, LAYOUT_COLORS } from './data.js'
import { detectConflicts, isSlotActiveOnDate } from '../composables/conflictEngine.js'

const DEFAULT_LAYOUT_ID = 'l-default'
const DEFAULT_SCHEDULE_ID = 'sch-default'
const TODAY = '2026-03-18'
const NOW_HOUR = 9

let nextLayoutId = 7
let nextScheduleId = 6

const store = reactive({
  devices: [...DEVICES],
  groups: [...GROUPS],

  // Layouts are just content containers — no scheduling info
  layouts: [
    { id: DEFAULT_LAYOUT_ID, name: 'Default', colorIndex: 0, isDefault: true },
    { id: 'l2', name: 'Påske', colorIndex: 1, isDefault: false },
    { id: 'l3', name: 'Bryllup', colorIndex: 2, isDefault: false },
    { id: 'l4', name: 'Sandefjord Bredbånd', colorIndex: 3, isDefault: false },
    { id: 'l5', name: 'Vinterkampanje', colorIndex: 4, isDefault: false },
    { id: 'l6', name: 'My new campaign', colorIndex: 5, isDefault: false },
  ],

  // Schedules connect layouts to devices + time
  schedules: [
    {
      id: DEFAULT_SCHEDULE_ID,
      layoutId: DEFAULT_LAYOUT_ID,
      targetTv: true,
      targetWeb: true,
      deviceIds: [],
      groupIds: [],
      enabled: true,
      isDefault: true,
      slot: {
        dateMode: 'forever', startDate: null, endDate: null,
        startHour: 0, endHour: 24,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        repeatMode: 'daily', repeatInterval: null, durationDays: null,
      },
    },
    {
      id: 'sch2',
      layoutId: 'l2',
      targetTv: true,
      targetWeb: false,
      deviceIds: ['d1', 'd2'],
      groupIds: [],
      enabled: true,
      isDefault: false,
      slot: {
        dateMode: 'forever', startDate: null, endDate: null,
        startHour: 6, endHour: 9,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        repeatMode: 'weekly', repeatInterval: null, durationDays: null,
      },
    },
    {
      id: 'sch3',
      layoutId: 'l3',
      targetTv: true,
      targetWeb: true,
      deviceIds: ['d3'],
      groupIds: [],
      enabled: true,
      isDefault: false,
      slot: {
        dateMode: 'forever', startDate: null, endDate: null,
        startHour: 11, endHour: 14,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        repeatMode: 'weekly', repeatInterval: null, durationDays: null,
      },
    },
    {
      id: 'sch4',
      layoutId: 'l4',
      targetTv: true,
      targetWeb: false,
      deviceIds: [],
      groupIds: ['g2'],
      enabled: true,
      isDefault: false,
      slot: {
        dateMode: 'forever', startDate: null, endDate: null,
        startHour: 10, endHour: 18,
        days: ['Sat', 'Sun'],
        repeatMode: 'weekly', repeatInterval: null, durationDays: null,
      },
    },
    {
      id: 'sch5',
      layoutId: 'l5',
      targetTv: true,
      targetWeb: true,
      deviceIds: ['d1', 'd3'],
      groupIds: [],
      enabled: false,
      isDefault: false,
      slot: {
        dateMode: 'dateRange', startDate: '2026-02-01', endDate: '2026-03-17',
        startHour: 8, endHour: 20,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        repeatMode: 'daily', repeatInterval: null, durationDays: null,
      },
    },
  ],

  // UI state
  editingScheduleId: null,
  isNewSchedule: false,
  timelineView: 'week',
  timelineDate: TODAY,
})

// --- Getters ---

export const editingSchedule = computed(() =>
  store.schedules.find((s) => s.id === store.editingScheduleId) || null
)

export function getLayout(id) {
  return store.layouts.find((l) => l.id === id)
}

export function getLayoutColor(layout) {
  return LAYOUT_COLORS[layout.colorIndex % LAYOUT_COLORS.length]
}

export function getLayoutForSchedule(schedule) {
  return store.layouts.find((l) => l.id === schedule.layoutId)
}

export function schedulesForLayout(layoutId) {
  return store.schedules.filter((s) => s.layoutId === layoutId)
}

export function activeScheduleCount(layoutId) {
  return store.schedules.filter((s) => s.layoutId === layoutId && s.enabled && !s.isDefault && !isScheduleExpired(s)).length
}

export function isLayoutScheduled(layoutId) {
  return store.schedules.some((s) => s.layoutId === layoutId && !s.isDefault)
}

export function isLayoutActiveNow(layoutId) {
  return store.schedules.some((s) => {
    if (s.layoutId !== layoutId || !s.enabled || s.isDefault || isScheduleExpired(s)) return false
    if (!isSlotActiveOnDate(s.slot, TODAY)) return false
    return NOW_HOUR >= s.slot.startHour && NOW_HOUR < s.slot.endHour
  })
}

export function isScheduleExpired(schedule) {
  if (schedule.isDefault) return false
  const slot = schedule.slot
  if (slot.dateMode === 'forever' || slot.dateMode === 'fromDate') return false
  if (!slot.endDate) return false
  return slot.endDate < TODAY
}

export function resolveScheduleDeviceIds(schedule) {
  if (!schedule.targetTv) return new Set()
  if (schedule.deviceIds.length === 0 && schedule.groupIds.length === 0) {
    return new Set(store.devices.map((d) => d.id))
  }
  const ids = new Set(schedule.deviceIds)
  for (const gid of schedule.groupIds) {
    const group = store.groups.find((g) => g.id === gid)
    if (group) group.deviceIds.forEach((did) => ids.add(did))
  }
  return ids
}

// A schedule is "complete" enough to participate in conflict checks
function isScheduleConfigured(s) {
  if (!s.targetTv && !s.targetWeb) return false
  const hasTvDevices = s.targetTv && (s.deviceIds.length > 0 || s.groupIds.length > 0)
  if (!hasTvDevices && !s.targetWeb) return false
  return true
}

// Conflicts between enabled, non-default, non-expired, configured schedules
export const conflicts = computed(() => {
  const active = store.schedules.filter((s) => !s.isDefault && s.enabled && !isScheduleExpired(s) && isScheduleConfigured(s))
  return detectConflicts(active, store.groups, store.devices, store.layouts)
})

export function getConflictsForSchedule(scheduleId) {
  return conflicts.value.filter(
    (c) => c.scheduleA.id === scheduleId || c.scheduleB.id === scheduleId
  )
}

// --- Layout Actions ---

export function createLayout() {
  const id = `l${nextLayoutId++}`
  const layout = {
    id,
    name: 'New Layout',
    colorIndex: store.layouts.length % LAYOUT_COLORS.length,
    isDefault: false,
  }
  store.layouts.push(layout)
  return layout
}

export function deleteLayout(id) {
  if (id === DEFAULT_LAYOUT_ID) return
  const idx = store.layouts.findIndex((l) => l.id === id)
  if (idx !== -1) store.layouts.splice(idx, 1)
  // Also delete all schedules for this layout
  store.schedules = store.schedules.filter((s) => s.layoutId !== id)
  if (store.editingScheduleId) {
    const sch = store.schedules.find((s) => s.id === store.editingScheduleId)
    if (!sch) store.editingScheduleId = null
  }
}

export function updateLayout(id, updates) {
  const layout = store.layouts.find((l) => l.id === id)
  if (layout) Object.assign(layout, updates)
}

// --- Schedule Actions ---

export function createSchedule(layoutId) {
  const id = `sch${nextScheduleId++}`
  const schedule = {
    id,
    layoutId,
    targetTv: false,
    targetWeb: false,
    deviceIds: [],
    groupIds: [],
    enabled: true,
    isDefault: false,
    slot: {
      dateMode: 'forever', startDate: null, endDate: null,
      startHour: 0, endHour: 24,
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      repeatMode: 'daily', repeatInterval: null, durationDays: null,
    },
  }
  store.schedules.push(schedule)
  store.editingScheduleId = id
  store.isNewSchedule = true
  return schedule
}

export function deleteSchedule(id) {
  if (id === DEFAULT_SCHEDULE_ID) return
  store.schedules = store.schedules.filter((s) => s.id !== id)
  if (store.editingScheduleId === id) store.editingScheduleId = null
}

export function updateSchedule(id, updates) {
  const schedule = store.schedules.find((s) => s.id === id)
  if (schedule) Object.assign(schedule, updates)
}

export function updateScheduleSlot(id, slotUpdates) {
  const schedule = store.schedules.find((s) => s.id === id)
  if (schedule) Object.assign(schedule.slot, slotUpdates)
}

export function restoreSchedule(id, snapshot) {
  const schedule = store.schedules.find((s) => s.id === id)
  if (schedule) Object.assign(schedule, snapshot)
}

export function openScheduleModal(scheduleId) {
  store.editingScheduleId = scheduleId
  store.isNewSchedule = false
}

export function closeScheduleModal() {
  store.editingScheduleId = null
  store.isNewSchedule = false
}

export function toggleScheduleEnabled(id) {
  const schedule = store.schedules.find((s) => s.id === id)
  if (schedule && !schedule.isDefault) schedule.enabled = !schedule.enabled
}

// --- Timeline ---

export function setTimelineView(view) {
  store.timelineView = view
}

export function setTimelineDate(dateStr) {
  store.timelineDate = dateStr
}

export function navigateTimeline(days) {
  const d = new Date(store.timelineDate)
  d.setDate(d.getDate() + days)
  store.timelineDate = d.toISOString().slice(0, 10)
}

export { store, TODAY, NOW_HOUR, DEFAULT_LAYOUT_ID, DEFAULT_SCHEDULE_ID }
