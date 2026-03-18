/**
 * Conflict Detection Engine — schedule-based.
 *
 * Two schedules conflict when they share at least one device
 * (or both target web) AND have overlapping availability.
 */

import { DAYS } from '../store/data.js'

function resolveDevices(schedule, groups, allDevices) {
  if (!schedule.targetTv) return new Set()
  if (schedule.deviceIds.length === 0 && schedule.groupIds.length === 0) {
    return new Set(allDevices.map((d) => d.id))
  }
  const deviceIds = new Set(schedule.deviceIds)
  for (const gid of schedule.groupIds) {
    const group = groups.find((g) => g.id === gid)
    if (group) group.deviceIds.forEach((did) => deviceIds.add(did))
  }
  return deviceIds
}

function dateRangesOverlap(slotA, slotB) {
  const startA = getEffectiveStartDate(slotA)
  const endA = getEffectiveEndDate(slotA)
  const startB = getEffectiveStartDate(slotB)
  const endB = getEffectiveEndDate(slotB)
  const aBeforeB = startA === null || endB === null || startA <= endB
  const bBeforeA = startB === null || endA === null || startB <= endA
  return aBeforeB && bBeforeA
}

function getEffectiveStartDate(slot) {
  if (slot.dateMode === 'forever' || slot.dateMode === 'untilDate') return null
  return slot.startDate
}

function getEffectiveEndDate(slot) {
  if (slot.dateMode === 'forever' || slot.dateMode === 'fromDate') return null
  return slot.endDate
}

function timeOverlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

function couldShareDays(slotA, slotB) {
  if (slotA.repeatMode === 'weekly' && slotB.repeatMode === 'weekly') {
    return slotA.days.some((d) => slotB.days.includes(d))
  }
  return true
}

function getOverlappingDayInfo(slotA, slotB) {
  if (slotA.repeatMode === 'weekly' && slotB.repeatMode === 'weekly') {
    return { type: 'specific', days: slotA.days.filter((d) => slotB.days.includes(d)) }
  }
  return { type: 'pattern', description: 'Repeating patterns may overlap' }
}

/**
 * Detect conflicts between schedules.
 * @param {Array} schedules - active schedules to check
 * @param {Array} groups - device groups
 * @param {Array} devices - all devices
 * @param {Array} layouts - for looking up layout names/colors
 */
export function detectConflicts(schedules, groups, devices, layouts = []) {
  const conflicts = []

  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const a = schedules[i]
      const b = schedules[j]

      const devicesA = resolveDevices(a, groups, devices)
      const devicesB = resolveDevices(b, groups, devices)
      const overlappingDevices = [...devicesA].filter((d) => devicesB.has(d))
      const webOverlap = a.targetWeb && b.targetWeb

      if (overlappingDevices.length === 0 && !webOverlap) continue

      const slotA = a.slot
      const slotB = b.slot

      if (!dateRangesOverlap(slotA, slotB)) continue
      if (!couldShareDays(slotA, slotB)) continue
      if (!timeOverlaps(slotA.startHour, slotA.endHour, slotB.startHour, slotB.endHour)) continue

      const layoutA = layouts.find((l) => l.id === a.layoutId)
      const layoutB = layouts.find((l) => l.id === b.layoutId)

      conflicts.push({
        id: `${a.id}-${b.id}`,
        scheduleA: a,
        scheduleB: b,
        layoutA,
        layoutB,
        slotA,
        slotB,
        overlappingDevices,
        webOverlap,
        dayInfo: getOverlappingDayInfo(slotA, slotB),
        overlapStart: Math.max(slotA.startHour, slotB.startHour),
        overlapEnd: Math.min(slotA.endHour, slotB.endHour),
        dateDescription: describeDateOverlap(slotA, slotB),
      })
    }
  }

  return conflicts
}

function describeDateOverlap(slotA, slotB) {
  const startA = getEffectiveStartDate(slotA)
  const endA = getEffectiveEndDate(slotA)
  const startB = getEffectiveStartDate(slotB)
  const endB = getEffectiveEndDate(slotB)
  const overlapStart = startA && startB ? (startA > startB ? startA : startB) : startA || startB || null
  const overlapEnd = endA && endB ? (endA < endB ? endA : endB) : endA || endB || null
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

export function isSlotActiveOnDate(slot, dateStr) {
  const start = getEffectiveStartDate(slot)
  const end = getEffectiveEndDate(slot)
  if (start && dateStr < start) return false
  if (end && dateStr > end) return false

  const date = new Date(dateStr + 'T00:00:00')
  const dayOfWeek = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]

  switch (slot.repeatMode) {
    case 'weekly':
      return slot.days.includes(dayOfWeek)
    case 'daily':
      return true
    case 'everyOtherDay': {
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
      const n = slot.durationDays || 7
      const origin = start ? new Date(start + 'T00:00:00') : new Date('2026-01-01T00:00:00')
      const diffDays = Math.round((date - origin) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays < n
    }
    default:
      return true
  }
}

export function getSuggestions(conflict, devices, groups) {
  const suggestions = []
  const { scheduleA, scheduleB, overlappingDevices, slotA, slotB, layoutA, layoutB } = conflict
  const nameA = layoutA?.name || 'Layout A'
  const nameB = layoutB?.name || 'Layout B'

  for (const deviceId of overlappingDevices) {
    const device = devices.find((d) => d.id === deviceId)
    if (!device) continue
    if (scheduleA.deviceIds.includes(deviceId)) {
      suggestions.push({ type: 'remove-device', label: `Remove "${device.name}" from "${nameA}" schedule`, action: { scheduleId: scheduleA.id, deviceId } })
    }
    if (scheduleB.deviceIds.includes(deviceId)) {
      suggestions.push({ type: 'remove-device', label: `Remove "${device.name}" from "${nameB}" schedule`, action: { scheduleId: scheduleB.id, deviceId } })
    }
  }

  for (const gid of scheduleA.groupIds) {
    const group = groups.find((g) => g.id === gid)
    if (group && group.deviceIds.some((d) => overlappingDevices.includes(d))) {
      suggestions.push({ type: 'remove-group', label: `Remove group "${group.name}" from "${nameA}" schedule`, action: { scheduleId: scheduleA.id, groupId: gid } })
    }
  }
  for (const gid of scheduleB.groupIds) {
    const group = groups.find((g) => g.id === gid)
    if (group && group.deviceIds.some((d) => overlappingDevices.includes(d))) {
      suggestions.push({ type: 'remove-group', label: `Remove group "${group.name}" from "${nameB}" schedule`, action: { scheduleId: scheduleB.id, groupId: gid } })
    }
  }

  if (slotA.startHour < slotB.startHour) {
    suggestions.push({ type: 'adjust-time', label: `End "${nameA}" at ${slotB.startHour}:00`, action: { scheduleId: scheduleA.id, updates: { endHour: slotB.startHour } } })
  }
  if (slotB.startHour < slotA.startHour) {
    suggestions.push({ type: 'adjust-time', label: `End "${nameB}" at ${slotA.startHour}:00`, action: { scheduleId: scheduleB.id, updates: { endHour: slotA.startHour } } })
  }

  return suggestions
}
