/**
 * Conflict Detection Engine
 *
 * Core rule: Two layouts conflict when they share at least one device
 * (directly or via groups) AND have overlapping availability
 * (date range + time-of-day + day pattern).
 *
 * For the prototype, we use a conservative approach for non-weekly patterns:
 * if date ranges and time-of-day overlap, we assume day-pattern overlap is possible.
 * This avoids complex calendar expansion math while still surfacing real conflicts.
 */

import { DAYS } from '../store/data.js'

// --- Device resolution ---

/**
 * Resolve effective device IDs for a layout.
 * If targetTv is on but no devices/groups are selected → means ALL devices.
 */
function resolveDevices(layout, groups, allDevices) {
  // TV not targeted → no devices
  if (!layout.targetTv) return new Set()

  // TV targeted but nothing specific selected → ALL devices
  if (layout.deviceIds.length === 0 && layout.groupIds.length === 0) {
    return new Set(allDevices.map((d) => d.id))
  }

  const deviceIds = new Set(layout.deviceIds)
  for (const gid of layout.groupIds) {
    const group = groups.find((g) => g.id === gid)
    if (group) group.deviceIds.forEach((did) => deviceIds.add(did))
  }
  return deviceIds
}

// --- Date range overlap ---

/**
 * Check if two availability slots overlap in their date ranges.
 * Each slot has a dateMode and optional startDate/endDate.
 * null boundaries mean "unbounded" (now or forever).
 */
function dateRangesOverlap(slotA, slotB) {
  const startA = getEffectiveStartDate(slotA)
  const endA = getEffectiveEndDate(slotA)
  const startB = getEffectiveStartDate(slotB)
  const endB = getEffectiveEndDate(slotB)

  // Two ranges overlap if: startA <= endB AND startB <= endA
  // null means unbounded, so null is always "satisfies the condition"
  const aStartBeforeBEnd = startA === null || endB === null || startA <= endB
  const bStartBeforeAEnd = startB === null || endA === null || startB <= endA

  return aStartBeforeBEnd && bStartBeforeAEnd
}

function getEffectiveStartDate(slot) {
  if (slot.dateMode === 'forever' || slot.dateMode === 'untilDate') return null
  return slot.startDate
}

function getEffectiveEndDate(slot) {
  if (slot.dateMode === 'forever' || slot.dateMode === 'fromDate') return null
  return slot.endDate
}

// --- Time overlap ---

function timeOverlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

// --- Day pattern overlap ---

/**
 * Determine if two slots could be active on the same day.
 * For weekly slots, we compare explicit day lists.
 * For other repeat modes, we conservatively assume overlap is possible
 * (exact calendar math is out of scope for the prototype).
 */
function couldShareDays(slotA, slotB) {
  if (slotA.repeatMode === 'weekly' && slotB.repeatMode === 'weekly') {
    return slotA.days.some((d) => slotB.days.includes(d))
  }
  // Conservative: if either uses a non-weekly pattern, assume days could overlap
  return true
}

/**
 * Get the specific overlapping days for display purposes.
 * Returns day names when both are weekly, or a descriptive string otherwise.
 */
function getOverlappingDayInfo(slotA, slotB) {
  if (slotA.repeatMode === 'weekly' && slotB.repeatMode === 'weekly') {
    return {
      type: 'specific',
      days: slotA.days.filter((d) => slotB.days.includes(d)),
    }
  }
  return {
    type: 'pattern',
    description: 'Repeating patterns may overlap',
  }
}

// --- Main conflict detection ---

export function detectConflicts(layouts, groups, devices = []) {
  const conflicts = []

  for (let i = 0; i < layouts.length; i++) {
    for (let j = i + 1; j < layouts.length; j++) {
      const a = layouts[i]
      const b = layouts[j]

      // Step 1: Check target overlap (devices/groups OR web)
      const devicesA = resolveDevices(a, groups, devices)
      const devicesB = resolveDevices(b, groups, devices)
      const overlappingDevices = [...devicesA].filter((d) => devicesB.has(d))
      const webOverlap = a.targetWeb && b.targetWeb

      // Must share at least one device or both target web
      if (overlappingDevices.length === 0 && !webOverlap) continue

      // Step 2: Check each slot pair
      for (const slotA of a.slots) {
        for (const slotB of b.slots) {
          // 2a: Date ranges must overlap
          if (!dateRangesOverlap(slotA, slotB)) continue

          // 2b: Day patterns must potentially overlap
          if (!couldShareDays(slotA, slotB)) continue

          // 2c: Time of day must overlap
          if (!timeOverlaps(slotA.startHour, slotA.endHour, slotB.startHour, slotB.endHour)) continue

          const dayInfo = getOverlappingDayInfo(slotA, slotB)

          conflicts.push({
            id: `${a.id}-${slotA.id}-${b.id}-${slotB.id}`,
            layoutA: a,
            layoutB: b,
            slotA,
            slotB,
            overlappingDevices,
            webOverlap,
            dayInfo,
            overlapStart: Math.max(slotA.startHour, slotB.startHour),
            overlapEnd: Math.min(slotA.endHour, slotB.endHour),
            // Date range description for the conflict panel
            dateDescription: describeDateOverlap(slotA, slotB),
          })
        }
      }
    }
  }

  return conflicts
}

/**
 * Build a human-readable description of the date overlap between two slots
 */
function describeDateOverlap(slotA, slotB) {
  const startA = getEffectiveStartDate(slotA)
  const endA = getEffectiveEndDate(slotA)
  const startB = getEffectiveStartDate(slotB)
  const endB = getEffectiveEndDate(slotB)

  const overlapStart = startA && startB ? (startA > startB ? startA : startB)
    : startA || startB || null
  const overlapEnd = endA && endB ? (endA < endB ? endA : endB)
    : endA || endB || null

  if (!overlapStart && !overlapEnd) return 'Always'
  if (!overlapStart) return `Until ${formatDate(overlapEnd)}`
  if (!overlapEnd) return `From ${formatDate(overlapStart)}`
  return `${formatDate(overlapStart)} – ${formatDate(overlapEnd)}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- Per-layout conflict lookup ---

export function getConflictsForLayout(allConflicts, layoutId) {
  return allConflicts.filter(
    (c) => c.layoutA.id === layoutId || c.layoutB.id === layoutId
  )
}

// --- Resolution suggestions ---

export function getSuggestions(conflict, devices, groups) {
  const suggestions = []
  const { layoutA, layoutB, overlappingDevices, slotA, slotB } = conflict

  // Suggest removing overlapping devices (only if directly assigned)
  for (const deviceId of overlappingDevices) {
    const device = devices.find((d) => d.id === deviceId)
    if (!device) continue
    if (layoutA.deviceIds.includes(deviceId)) {
      suggestions.push({
        type: 'remove-device',
        label: `Remove "${device.name}" from "${layoutA.name}"`,
        action: { layoutId: layoutA.id, deviceId },
      })
    }
    if (layoutB.deviceIds.includes(deviceId)) {
      suggestions.push({
        type: 'remove-device',
        label: `Remove "${device.name}" from "${layoutB.name}"`,
        action: { layoutId: layoutB.id, deviceId },
      })
    }
  }

  // Suggest removing groups that cause the overlap
  for (const gid of layoutA.groupIds) {
    const group = groups.find((g) => g.id === gid)
    if (group && group.deviceIds.some((d) => overlappingDevices.includes(d))) {
      suggestions.push({
        type: 'remove-group',
        label: `Remove group "${group.name}" from "${layoutA.name}"`,
        action: { layoutId: layoutA.id, groupId: gid },
      })
    }
  }
  for (const gid of layoutB.groupIds) {
    const group = groups.find((g) => g.id === gid)
    if (group && group.deviceIds.some((d) => overlappingDevices.includes(d))) {
      suggestions.push({
        type: 'remove-group',
        label: `Remove group "${group.name}" from "${layoutB.name}"`,
        action: { layoutId: layoutB.id, groupId: gid },
      })
    }
  }

  // Suggest adjusting time to avoid overlap
  if (slotA.startHour < slotB.startHour) {
    suggestions.push({
      type: 'adjust-time',
      label: `End "${layoutA.name}" at ${slotB.startHour}:00 (before "${layoutB.name}")`,
      action: { layoutId: layoutA.id, slotId: slotA.id, updates: { endHour: slotB.startHour } },
    })
  }
  if (slotB.startHour < slotA.startHour) {
    suggestions.push({
      type: 'adjust-time',
      label: `End "${layoutB.name}" at ${slotA.startHour}:00 (before "${layoutA.name}")`,
      action: { layoutId: layoutB.id, slotId: slotB.id, updates: { endHour: slotA.startHour } },
    })
  }

  // Suggest adjusting date ranges
  const startA = getEffectiveStartDate(slotA)
  const endB = getEffectiveEndDate(slotB)
  const startB = getEffectiveStartDate(slotB)
  const endA = getEffectiveEndDate(slotA)

  if (startB && slotA.dateMode !== 'forever') {
    // Suggest ending layout A before layout B starts
    const dayBefore = new Date(startB + 'T00:00:00')
    dayBefore.setDate(dayBefore.getDate() - 1)
    const endStr = dayBefore.toISOString().slice(0, 10)
    suggestions.push({
      type: 'adjust-dates',
      label: `End "${layoutA.name}" on ${formatDate(endStr)} (before "${layoutB.name}" starts)`,
      action: { layoutId: layoutA.id, slotId: slotA.id, updates: { dateMode: slotA.startDate ? 'dateRange' : 'untilDate', endDate: endStr } },
    })
  }

  if (startA && slotB.dateMode !== 'forever') {
    const dayBefore = new Date(startA + 'T00:00:00')
    dayBefore.setDate(dayBefore.getDate() - 1)
    const endStr = dayBefore.toISOString().slice(0, 10)
    suggestions.push({
      type: 'adjust-dates',
      label: `End "${layoutB.name}" on ${formatDate(endStr)} (before "${layoutA.name}" starts)`,
      action: { layoutId: layoutB.id, slotId: slotB.id, updates: { dateMode: slotB.startDate ? 'dateRange' : 'untilDate', endDate: endStr } },
    })
  }

  return suggestions
}

// --- Utility: check if a slot is active on a specific calendar date ---

export function isSlotActiveOnDate(slot, dateStr) {
  // 1. Check date range
  const start = getEffectiveStartDate(slot)
  const end = getEffectiveEndDate(slot)
  if (start && dateStr < start) return false
  if (end && dateStr > end) return false

  // 2. Check day/repeat pattern
  const date = new Date(dateStr + 'T00:00:00')
  const dayOfWeek = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1] // JS Sunday=0 → our index 6

  switch (slot.repeatMode) {
    case 'weekly':
      return slot.days.includes(dayOfWeek)

    case 'daily':
      return true

    case 'everyOtherDay': {
      // Count days from slot start (or epoch) and check if even
      const origin = start ? new Date(start + 'T00:00:00') : new Date('2026-01-01T00:00:00')
      const diffDays = Math.round((date - origin) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays % 2 === 0
    }

    case 'everyNDays': {
      const n = slot.repeatInterval || 3
      const origin = start ? new Date(start + 'T00:00:00') : new Date('2026-01-01T00:00:00')
      const diffDays = Math.round((date - origin) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays % n === 0
    }

    case 'duration': {
      // Active for the first N days from start date
      const n = slot.durationDays || 7
      const origin = start ? new Date(start + 'T00:00:00') : new Date('2026-01-01T00:00:00')
      const diffDays = Math.round((date - origin) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays < n
    }

    default:
      return true
  }
}
