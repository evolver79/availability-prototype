import { reactive, computed } from 'vue'
import { DEVICES, GROUPS, LAYOUT_COLORS } from './data.js'
import { detectConflicts } from '../composables/conflictEngine.js'

const DEFAULT_LAYOUT_ID = 'l-default'

let nextLayoutId = 2
let nextSlotId = 2

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

// Only check conflicts between enabled, non-default layouts
export const conflicts = computed(() => {
  const active = store.layouts.filter((l) => !l.isDefault && l.enabled)
  return detectConflicts(active, store.groups, store.devices)
})

// Check conflicts that WOULD exist if a specific layout were enabled
export function getConflictsIfEnabled(layoutId) {
  const layout = store.layouts.find((l) => l.id === layoutId)
  if (!layout) return []
  const active = store.layouts.filter((l) => !l.isDefault && (l.enabled || l.id === layoutId))
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
        startHour: 9,
        endHour: 17,
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
