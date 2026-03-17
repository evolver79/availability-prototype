import { reactive, computed } from 'vue'
import { DEVICES, GROUPS, LAYOUT_COLORS } from './data.js'
import { detectConflicts } from '../composables/conflictEngine.js'

const DEFAULT_LAYOUT_ID = 'l-default'

let nextLayoutId = 6
let nextSlotId = 6

const store = reactive({
  devices: [...DEVICES],
  groups: [...GROUPS],

  layouts: [
    {
      id: DEFAULT_LAYOUT_ID,
      name: 'Default',
      colorIndex: 0,
      isDefault: true, // cannot be deleted; acts as fallback
      enabled: true,   // default is always enabled
      targetTv: true,
      targetWeb: true,
      deviceIds: [],
      groupIds: [],
      slots: [
        {
          id: 's1',
          dateMode: 'forever',
          startDate: null,
          endDate: null,
          startHour: 0,
          endHour: 24,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          repeatMode: 'daily',
          repeatInterval: null,
          durationDays: null,
        },
      ],
    },
    {
      id: 'l2',
      name: 'Påske',
      colorIndex: 1,
      isDefault: false,
      enabled: true,
      targetTv: true,
      targetWeb: false,
      deviceIds: ['d1', 'd2'],
      groupIds: [],
      slots: [
        {
          id: 's2',
          dateMode: 'forever',
          startDate: null,
          endDate: null,
          startHour: 6,
          endHour: 9,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          repeatMode: 'weekly',
          repeatInterval: null,
          durationDays: null,
        },
      ],
    },
    {
      id: 'l3',
      name: 'Bryllup',
      colorIndex: 2,
      isDefault: false,
      enabled: true,
      targetTv: true,
      targetWeb: true,
      deviceIds: ['d3'],
      groupIds: [],
      slots: [
        {
          id: 's3',
          dateMode: 'forever',
          startDate: null,
          endDate: null,
          startHour: 11,
          endHour: 14,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          repeatMode: 'weekly',
          repeatInterval: null,
          durationDays: null,
        },
      ],
    },
    {
      id: 'l4',
      name: 'Sandefjord Bredbånd',
      colorIndex: 3,
      isDefault: false,
      enabled: true,
      targetTv: true,
      targetWeb: false,
      deviceIds: [],
      groupIds: ['g2'],
      slots: [
        {
          id: 's4',
          dateMode: 'forever',
          startDate: null,
          endDate: null,
          startHour: 10,
          endHour: 18,
          days: ['Sat', 'Sun'],
          repeatMode: 'weekly',
          repeatInterval: null,
          durationDays: null,
        },
      ],
    },
    {
      id: 'l5',
      name: 'Vinterkampanje',
      colorIndex: 4,
      isDefault: false,
      enabled: true,
      targetTv: true,
      targetWeb: true,
      deviceIds: ['d1', 'd3'],
      groupIds: [],
      slots: [
        {
          id: 's5',
          dateMode: 'dateRange',
          startDate: '2026-02-01',
          endDate: '2026-03-16', // expired yesterday
          startHour: 8,
          endHour: 20,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          repeatMode: 'daily',
          repeatInterval: null,
          durationDays: null,
        },
      ],
    },
  ],

  selectedLayoutId: null,

  // Timeline navigation
  timelineView: 'week',
  timelineDate: '2026-03-17',
})

// --- Getters ---

export const selectedLayout = computed(() =>
  store.layouts.find((l) => l.id === store.selectedLayoutId) || null
)

// Only check conflicts between enabled, non-default, non-expired layouts
export const conflicts = computed(() => {
  const active = store.layouts.filter((l) => !l.isDefault && l.enabled && !isExpired(l))
  return detectConflicts(active, store.groups, store.devices)
})

// Check conflicts that WOULD exist if a specific layout were enabled
export function getConflictsIfEnabled(layoutId) {
  const layout = store.layouts.find((l) => l.id === layoutId)
  if (!layout) return []
  const active = store.layouts.filter((l) => !l.isDefault && !isExpired(l) && (l.enabled || l.id === layoutId))
  const all = detectConflicts(active, store.groups, store.devices)
  return all.filter((c) => c.layoutA.id === layoutId || c.layoutB.id === layoutId)
}

export function toggleEnabled(id) {
  const layout = store.layouts.find((l) => l.id === id)
  if (!layout || layout.isDefault) return
  layout.enabled = !layout.enabled
}

// Check if enabling a layout would cause conflicts
export function canEnable(id) {
  return getConflictsIfEnabled(id).length === 0
}

export function getLayoutColor(layout) {
  return LAYOUT_COLORS[layout.colorIndex % LAYOUT_COLORS.length]
}

export function resolveDeviceIds(layout) {
  if (!layout.targetTv) return new Set()
  // No specific selection = all devices
  if (layout.deviceIds.length === 0 && layout.groupIds.length === 0) {
    return new Set(store.devices.map((d) => d.id))
  }
  const ids = new Set(layout.deviceIds)
  for (const gid of layout.groupIds) {
    const group = store.groups.find((g) => g.id === gid)
    if (group) group.deviceIds.forEach((did) => ids.add(did))
  }
  return ids
}

export function isDefaultLayout(id) {
  return id === DEFAULT_LAYOUT_ID
}

// Check if a layout's availability has fully expired (end date in the past)
export function isExpired(layout) {
  if (layout.isDefault) return false
  if (layout.slots.length === 0) return false
  const slot = layout.slots[0]
  if (slot.dateMode === 'forever' || slot.dateMode === 'fromDate') return false
  if (!slot.endDate) return false
  return slot.endDate < '2026-03-17' // today
}

// --- Actions ---

export function selectLayout(id) {
  store.selectedLayoutId = id
}

export function createLayout() {
  const id = `l${nextLayoutId++}`
  const layout = {
    id,
    name: 'New Layout',
    colorIndex: store.layouts.length % LAYOUT_COLORS.length,
    isDefault: false,
    enabled: true,
    targetTv: false,
    targetWeb: false,
    deviceIds: [],
    groupIds: [],
    slots: [
      {
        id: `s${nextSlotId++}`,
        dateMode: 'forever',
        startDate: null,
        endDate: null,
        startHour: 12,
        endHour: 12,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        repeatMode: 'daily',
        repeatInterval: null,
        durationDays: null,
      },
    ],
  }
  store.layouts.push(layout)
  store.selectedLayoutId = id
  return layout
}

export function deleteLayout(id) {
  // Cannot delete the default layout
  if (id === DEFAULT_LAYOUT_ID) return
  const idx = store.layouts.findIndex((l) => l.id === id)
  if (idx !== -1) store.layouts.splice(idx, 1)
  if (store.selectedLayoutId === id) store.selectedLayoutId = null
}

// Replace a layout's data with a snapshot (for cancel/undo)
export function restoreLayout(id, snapshot) {
  const layout = store.layouts.find((l) => l.id === id)
  if (!layout) return
  Object.assign(layout, snapshot)
}

export function updateLayout(id, updates) {
  const layout = store.layouts.find((l) => l.id === id)
  if (layout) Object.assign(layout, updates)
}

export function addSlot(layoutId) {
  const layout = store.layouts.find((l) => l.id === layoutId)
  if (!layout) return
  const slot = {
    id: `s${nextSlotId++}`,
    dateMode: 'forever',
    startDate: null,
    endDate: null,
    startHour: 9,
    endHour: 17,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    repeatMode: 'daily',
    repeatInterval: null,
    durationDays: null,
  }
  layout.slots.push(slot)
  return slot
}

export function removeSlot(layoutId, slotId) {
  const layout = store.layouts.find((l) => l.id === layoutId)
  if (!layout) return
  const idx = layout.slots.findIndex((s) => s.id === slotId)
  if (idx !== -1) layout.slots.splice(idx, 1)
}

export function updateSlot(layoutId, slotId, updates) {
  const layout = store.layouts.find((l) => l.id === layoutId)
  if (!layout) return
  const slot = layout.slots.find((s) => s.id === slotId)
  if (slot) Object.assign(slot, updates)
}

export function removeDeviceFromLayout(layoutId, deviceId) {
  const layout = store.layouts.find((l) => l.id === layoutId)
  if (!layout) return
  layout.deviceIds = layout.deviceIds.filter((id) => id !== deviceId)
}

export function removeGroupFromLayout(layoutId, groupId) {
  const layout = store.layouts.find((l) => l.id === layoutId)
  if (!layout) return
  layout.groupIds = layout.groupIds.filter((id) => id !== groupId)
}

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

export { store }
