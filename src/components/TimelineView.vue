<script setup>
/**
 * Device Timeline — horizontal Gantt with rows = devices.
 * Each row shows schedule bars colored by their parent layout.
 * Default layout fills as a faded background.
 */
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  store,
  conflicts,
  getLayout,
  getLayoutColor,
  resolveScheduleDeviceIds,
  openScheduleModal,
  setTimelineView,
  navigateTimeline,
  TODAY,
  NOW_HOUR,
  DEFAULT_SCHEDULE_ID,
} from '../store/index.js'
import { DAYS } from '../store/data.js'
import { isSlotActiveOnDate } from '../composables/conflictEngine.js'

const ROW_HEIGHT = 28
const ROW_GAP = 4
const HEADER_HEIGHT = 24
const HOUR_WIDTH = 40
const DAY_WIDTH_WEEK = 80
const DAY_WIDTH_MONTH = 28
const OPEN_END_HORIZON_DAYS = 90

const scrollContainer = ref(null)
const zoomLevels = ['day', 'week', 'month']

// --- Date range ---
const dateRange = computed(() => {
  const today = new Date(TODAY + 'T00:00:00')
  let earliest = new Date(today)
  let latest = new Date(today)

  for (const sch of store.schedules) {
    if (sch.isDefault) continue
    const slot = sch.slot
    const start = getSlotStart(slot, today)
    const end = getSlotEnd(slot, today)
    if (start < earliest) earliest = new Date(start)
    if (end > latest) latest = new Date(end)
  }

  earliest.setDate(earliest.getDate() - 7)
  latest.setDate(latest.getDate() + 7)
  const dayIdx = earliest.getDay() === 0 ? 6 : earliest.getDay() - 1
  earliest.setDate(earliest.getDate() - dayIdx)

  const dates = []
  const cursor = new Date(earliest)
  while (cursor <= latest) {
    dates.push(makeDateInfo(new Date(cursor)))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
})

function getSlotStart(slot, today) {
  if (slot.dateMode === 'forever' || slot.dateMode === 'untilDate') return today
  return slot.startDate ? new Date(slot.startDate + 'T00:00:00') : today
}

function getSlotEnd(slot, today) {
  if (slot.dateMode === 'forever' || slot.dateMode === 'fromDate') {
    const h = new Date(today); h.setDate(h.getDate() + OPEN_END_HORIZON_DAYS); return h
  }
  return slot.endDate ? new Date(slot.endDate + 'T00:00:00') : new Date(today)
}

const focusedDateStr = computed(() => store.timelineDate)

const visibleDates = computed(() => {
  if (store.timelineView === 'day') return [makeDateInfo(new Date(focusedDateStr.value + 'T00:00:00'))]
  return dateRange.value
})

function makeDateInfo(date) {
  const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1
  return {
    dateStr: date.toISOString().slice(0, 10),
    dayName: DAYS[dayIdx],
    dayNum: date.getDate(),
    monthStr: date.toLocaleDateString('en-US', { month: 'short' }),
    isToday: date.toISOString().slice(0, 10) === TODAY,
    isMonday: dayIdx === 0,
    isFirstOfMonth: date.getDate() === 1,
  }
}

const cellWidth = computed(() => {
  if (store.timelineView === 'day') return HOUR_WIDTH
  if (store.timelineView === 'month') return DAY_WIDTH_MONTH
  return DAY_WIDTH_WEEK
})

const timelineWidth = computed(() => {
  if (store.timelineView === 'day') return 24 * HOUR_WIDTH
  return visibleDates.value.length * cellWidth.value
})

// --- Header ticks ---
const headerTicks = computed(() => {
  if (store.timelineView === 'day') {
    const ticks = []
    for (let h = 0; h < 24; h += 2) ticks.push({ label: formatHour(h), x: h * HOUR_WIDTH, isToday: false, isMajor: h % 6 === 0 })
    return ticks
  }
  return visibleDates.value.map((d, i) => {
    let label
    if (store.timelineView === 'month') {
      label = d.isFirstOfMonth || i === 0 ? `${d.monthStr} ${d.dayNum}` : (d.isMonday ? `${d.dayNum}` : '')
    } else {
      label = `${d.dayName.slice(0, 2)} ${d.dayNum}`
    }
    return { label, x: i * cellWidth.value, isToday: d.isToday, isMajor: store.timelineView === 'month' ? (d.isFirstOfMonth || d.isMonday) : true }
  })
})

// --- Group rows ---
const groupRows = computed(() => {
  return store.groups.map((group) => {
    const schedules = store.schedules.filter((sch) => {
      if (sch.isDefault || !sch.enabled) return false
      return sch.groupIds.includes(group.id)
    })
    const bars = []
    for (const sch of schedules) {
      const layout = getLayout(sch.layoutId)
      if (!layout) continue
      bars.push(...buildBarsForSchedule(sch, layout, getLayoutColor(layout)))
    }
    const laneCount = assignLanes(bars)
    return { id: group.id, name: group.name, isGroup: true, bars, laneCount }
  })
})

// Assign lanes to bars so overlapping ones don't stack on top of each other
function assignLanes(bars) {
  // Sort by left position
  const sorted = [...bars].sort((a, b) => a.left - b.left)
  const lanes = [] // each lane is { end: rightmost x of last bar in this lane }
  for (const bar of sorted) {
    let placed = false
    for (let i = 0; i < lanes.length; i++) {
      if (bar.left >= lanes[i].end) {
        bar.lane = i
        lanes[i].end = bar.left + bar.width
        placed = true
        break
      }
    }
    if (!placed) {
      bar.lane = lanes.length
      lanes.push({ end: bar.left + bar.width })
    }
  }
  return lanes.length
}

// --- Device rows ---
const deviceRows = computed(() => {
  return store.devices.map((device) => {
    const schedules = store.schedules.filter((sch) => {
      if (sch.isDefault || !sch.enabled) return false
      return resolveScheduleDeviceIds(sch).has(device.id)
    })
    const bars = []
    for (const sch of schedules) {
      const layout = getLayout(sch.layoutId)
      if (!layout) continue
      bars.push(...buildBarsForSchedule(sch, layout, getLayoutColor(layout)))
    }
    const laneCount = assignLanes(bars)
    return { id: device.id, name: device.name, isGroup: false, bars, laneCount }
  })
})

function isRowTargeted(row) {
  const editingSch = store.schedules.find(s => s.id === store.editingScheduleId)
  if (!editingSch) return false
  if (row.isGroup) return editingSch.groupIds.includes(row.id)
  return resolveScheduleDeviceIds(editingSch).has(row.id)
}

// Combined: groups first, then devices. Targeted rows float to top.
const allRows = computed(() => {
  const editingSch = store.schedules.find(s => s.id === store.editingScheduleId)
  const targetedIds = editingSch ? resolveScheduleDeviceIds(editingSch) : new Set()
  const targetedGroupIds = editingSch ? new Set(editingSch.groupIds) : new Set()

  const sortedGroups = [...groupRows.value].sort((a, b) => {
    const aTarget = targetedGroupIds.has(a.id) ? 0 : 1
    const bTarget = targetedGroupIds.has(b.id) ? 0 : 1
    return aTarget - bTarget
  })

  const sortedDevices = [...deviceRows.value].sort((a, b) => {
    const aTarget = targetedIds.has(a.id) ? 0 : 1
    const bTarget = targetedIds.has(b.id) ? 0 : 1
    return aTarget - bTarget
  })

  return [...sortedGroups, ...sortedDevices]
})

function buildBarsForSchedule(schedule, layout, color) {
  const bars = []
  const slot = schedule.slot

  if (store.timelineView === 'day') {
    const dateStr = visibleDates.value[0]?.dateStr
    if (!dateStr || !isSlotActiveOnDate(slot, dateStr)) return bars
    bars.push({
      key: `${schedule.id}-day`,
      scheduleId: schedule.id,
      layoutName: layout.name,
      color,
      left: slot.startHour * HOUR_WIDTH,
      width: (slot.endHour - slot.startHour) * HOUR_WIDTH,
      label: `${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`,
      isOpenEnd: false,
      isOpenStart: false,
    })
  } else {
    let runStart = null
    for (let i = 0; i <= visibleDates.value.length; i++) {
      const d = visibleDates.value[i]
      const active = d ? isSlotActiveOnDate(slot, d.dateStr) : false
      if (active && runStart === null) runStart = i
      else if (!active && runStart !== null) {
        bars.push(makeBar(schedule, layout, color, runStart, i - 1))
        runStart = null
      }
    }
  }
  return bars
}

function makeBar(schedule, layout, color, startIdx, endIdx) {
  const cw = cellWidth.value
  const slot = schedule.slot
  const firstDate = visibleDates.value[0].dateStr
  const lastDate = visibleDates.value[visibleDates.value.length - 1].dateStr
  return {
    key: `${schedule.id}-${startIdx}-${endIdx}`,
    scheduleId: schedule.id,
    layoutName: layout.name,
    color,
    left: startIdx * cw,
    width: (endIdx - startIdx + 1) * cw,
    label: `${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`,
    isOpenStart: startIdx === 0 && isSlotActiveOnDate(slot, shiftDate(firstDate, -1)),
    isOpenEnd: endIdx === visibleDates.value.length - 1 && isSlotActiveOnDate(slot, shiftDate(lastDate, 1)),
  }
}

// --- Scroll tracking for sticky labels ---
const scrollLeft = ref(0)
function onScroll() { if (scrollContainer.value) scrollLeft.value = scrollContainer.value.scrollLeft }
onMounted(() => scrollContainer.value?.addEventListener('scroll', onScroll))
onBeforeUnmount(() => scrollContainer.value?.removeEventListener('scroll', onScroll))

function barLabelLeft(bar) {
  return Math.max(bar.left, Math.min(scrollLeft.value, bar.left + bar.width - 120))
}

const SUB_ROW_HEIGHT = 22 // height per lane when multiple lanes

function rowHeight(row) {
  if (!row.laneCount || row.laneCount <= 1) return ROW_HEIGHT
  return row.laneCount * SUB_ROW_HEIGHT + 4 // padding
}

const totalHeight = computed(() => {
  let h = HEADER_HEIGHT + ROW_GAP
  for (const row of allRows.value) h += rowHeight(row) + ROW_GAP
  return h
})

// --- Scroll to today ---
watch(() => store.timelineView, () => nextTick(scrollToToday), { immediate: true })
function scrollToToday() {
  if (!scrollContainer.value || store.timelineView === 'day') return
  const todayIdx = visibleDates.value.findIndex((d) => d.isToday)
  if (todayIdx === -1) return
  const offset = Math.max(0, todayIdx * cellWidth.value - scrollContainer.value.clientWidth / 3)
  scrollContainer.value.scrollLeft = offset
}

function navigateDay(delta) {
  const d = new Date(store.timelineDate + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  store.timelineDate = d.toISOString().slice(0, 10)
}

function formatHour(h) { return `${String(h).padStart(2, '0')}:00` }
function shiftDate(dateStr, days) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }

// --- Tooltip ---
const tooltipRef = ref(null)
const tooltipData = ref(null)
let tooltipTimer = null

function showTooltip(event, bar) {
  clearTimeout(tooltipTimer)
  const rect = event.currentTarget.getBoundingClientRect()
  tooltipData.value = { name: bar.layoutName, time: bar.label }
  nextTick(() => {
    if (!tooltipRef.value) return
    try { tooltipRef.value.showPopover() } catch {}
    Object.assign(tooltipRef.value.style, { top: (rect.top - 8) + 'px', left: (rect.left + rect.width / 2) + 'px' })
  })
}

function hideTooltip() {
  tooltipTimer = setTimeout(() => { try { tooltipRef.value?.hidePopover() } catch {}; tooltipData.value = null }, 50)
}
</script>

<template>
  <div class="flex flex-col">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center gap-1.5">
        <button v-for="z in zoomLevels" :key="z" @click="setTimelineView(z)"
          class="px-2 py-1 text-xs font-medium rounded transition-colors capitalize"
          :class="store.timelineView === z ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-200'"
        >{{ z }}</button>

        <template v-if="store.timelineView === 'day'">
          <div class="w-px h-4 bg-gray-300 mx-1"></div>
          <button @click="navigateDay(-1)" class="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="text-xs text-gray-500 mx-1">{{ visibleDates[0]?.dayName }} {{ visibleDates[0]?.monthStr }} {{ visibleDates[0]?.dayNum }}</span>
          <button @click="navigateDay(1)" class="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </template>
      </div>
      <span class="text-xs text-gray-400">{{ store.timelineView === 'day' ? 'Hover for details' : 'Scroll to see all dates' }}</span>
    </div>

    <!-- Timeline -->
    <div ref="scrollContainer" class="overflow-x-auto timeline-scroll bg-white" style="min-height: 80px; max-height: 400px;">
      <div class="flex" :style="{ minWidth: (timelineWidth + 120) + 'px', height: totalHeight + 'px' }">
        <!-- Device labels (sticky left) -->
        <div class="w-[120px] shrink-0 border-r border-gray-200 bg-white sticky left-0 z-40">
          <div :style="{ height: HEADER_HEIGHT + 'px' }" class="border-b border-gray-100 flex items-center px-2 text-[10px] text-gray-400 font-medium">DEVICES</div>
          <div
            v-for="row in allRows"
            :key="row.id"
            class="flex items-start gap-1.5 px-2 border-b border-gray-50 text-xs font-medium pt-1"
            :class="[
              isRowTargeted(row)
                ? 'text-blue bg-blue-light/30 font-semibold'
                : row.isGroup ? 'text-gray-500 bg-gray-50 italic' : 'text-gray-700',
            ]"
            :style="{ height: rowHeight(row) + 'px', marginTop: ROW_GAP + 'px' }"
          >
            <!-- Targeted indicator dot -->
            <span v-if="isRowTargeted(row)" class="w-1.5 h-1.5 rounded-full bg-blue shrink-0 mt-1"></span>
            <svg v-else-if="row.isGroup" class="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <span class="truncate">{{ row.name }}</span>
          </div>
        </div>

        <!-- Scrollable area -->
        <div class="relative flex-1">
          <!-- Header -->
          <div class="relative border-b border-gray-200 sticky top-0 bg-white z-10" :style="{ height: HEADER_HEIGHT + 'px', width: timelineWidth + 'px' }">
            <template v-for="tick in headerTicks" :key="tick.label + tick.x">
              <div v-if="tick.label" class="absolute top-0 bottom-0 flex items-center text-xs border-l"
                :class="tick.isToday ? 'border-blue text-blue font-semibold' : tick.isMajor ? 'border-gray-200 text-gray-500' : 'border-gray-100 text-gray-400'"
                :style="{ left: tick.x + 'px', paddingLeft: '4px' }">{{ tick.label }}</div>
              <div v-else class="absolute top-0 bottom-0 border-l border-gray-50" :style="{ left: tick.x + 'px' }"></div>
            </template>
          </div>

          <!-- Rows -->
          <div class="relative" :style="{ width: timelineWidth + 'px' }">
            <!-- Grid lines -->
            <template v-for="tick in headerTicks" :key="'grid-' + tick.x">
              <div v-if="tick.isMajor" class="absolute top-0 border-l" :class="tick.isToday ? 'border-blue-100' : 'border-gray-50'"
                :style="{ left: tick.x + 'px', height: (totalHeight - HEADER_HEIGHT) + 'px' }"></div>
            </template>

            <!-- Now line (day view) -->
            <div v-if="store.timelineView === 'day' && visibleDates.some(d => d.isToday)"
              class="absolute top-0 w-[2px] bg-red-500 z-30 pointer-events-none"
              :style="{ left: (NOW_HOUR * HOUR_WIDTH) + 'px', height: (allRows.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP + 4) + 'px' }">
              <div class="absolute -top-3 -left-[13px] px-1 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded whitespace-nowrap">{{ formatHour(NOW_HOUR) }}</div>
            </div>

            <!-- Today line (week/month) -->
            <div v-if="store.timelineView !== 'day' && visibleDates.some(d => d.isToday)"
              class="absolute top-0 w-[2px] bg-blue z-30 pointer-events-none"
              :style="{ left: (visibleDates.findIndex(d => d.isToday) * cellWidth) + 'px', height: (totalHeight - HEADER_HEIGHT) + 'px' }"></div>

            <!-- Device rows -->
            <div v-for="row in allRows" :key="row.id" class="relative" :style="{ height: rowHeight(row) + 'px', marginTop: ROW_GAP + 'px' }">
              <!-- Conflict background: subtle red when row has multiple lanes -->
              <div v-if="row.laneCount > 1" class="absolute inset-0 bg-red-50 rounded-sm pointer-events-none z-0"></div>

              <!-- Schedule bars — positioned by lane -->
              <div v-for="bar in row.bars" :key="bar.key"
                @mouseenter="showTooltip($event, bar)"
                @mouseleave="hideTooltip"
                class="absolute rounded-sm transition-shadow hover:shadow-md z-10"
                :style="{
                  left: bar.left + 'px',
                  width: bar.width + 'px',
                  top: (row.laneCount > 1 ? bar.lane * SUB_ROW_HEIGHT + 2 : 2) + 'px',
                  height: (row.laneCount > 1 ? SUB_ROW_HEIGHT - 2 : rowHeight(row) - 4) + 'px',
                  backgroundColor: bar.color.hex + (row.laneCount > 1 ? '60' : '30'),
                  borderLeft: bar.isOpenStart ? 'none' : '3px solid ' + bar.color.hex,
                }"
              >
                <div v-if="bar.isOpenEnd" class="absolute right-0 top-0 bottom-0 w-8 flex items-center justify-end pr-1 pointer-events-none"
                  :style="{ background: `linear-gradient(to right, transparent, ${bar.color.hex}20)` }">
                  <svg class="w-3 h-3 opacity-50" :style="{ color: bar.color.hex }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                </div>
              </div>

              <!-- Sticky bar labels — positioned by lane -->
              <div v-for="bar in row.bars" :key="'label-' + bar.key" v-show="bar.width > 40"
                class="absolute overflow-hidden pointer-events-none z-20"
                :style="{
                  left: bar.left + 'px',
                  width: bar.width + 'px',
                  top: (row.laneCount > 1 ? bar.lane * SUB_ROW_HEIGHT + 2 : 2) + 'px',
                  height: (row.laneCount > 1 ? SUB_ROW_HEIGHT - 2 : rowHeight(row) - 4) + 'px',
                }">
                <div class="absolute top-0 bottom-0 flex items-center" :style="{ left: (barLabelLeft(bar) - bar.left) + 'px' }">
                  <div class="flex items-center gap-1 px-1.5 overflow-hidden" :style="{ maxWidth: Math.min(bar.width, 200) + 'px' }">
                    <span class="text-[10px] font-medium truncate" :style="{ color: bar.color.hex }">{{ bar.layoutName }}</span>
                    <span v-if="bar.width > 80" class="text-[10px] opacity-50 whitespace-nowrap" :style="{ color: bar.color.hex }">{{ bar.label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <div ref="tooltipRef" popover="manual" class="m-0 px-3 py-2 bg-gray-900 text-white rounded-lg shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full" style="max-width: 260px;">
      <template v-if="tooltipData">
        <div class="text-xs font-semibold mb-0.5">{{ tooltipData.name }}</div>
        <div class="text-[10px] text-gray-300">{{ tooltipData.time }}</div>
      </template>
    </div>
  </div>
</template>
