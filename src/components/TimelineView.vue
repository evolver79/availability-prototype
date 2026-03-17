<script setup>
/**
 * Horizontal Timeline — compact Gantt-style schedule view.
 *
 * Key UX: the timeline always covers ALL dates where any layout has availability.
 * You scroll horizontally to reach any date. No content is ever clipped or hidden.
 *
 * - Day zoom: x-axis = full 24 hours, scrollable
 * - Week zoom: x-axis = all relevant dates at 80px/day
 * - Month zoom: x-axis = all relevant dates at 28px/day (compact)
 * - Open-ended layouts extend to a sensible horizon (90 days out)
 */
import { computed, ref, watch, nextTick } from 'vue'
import {
  store,
  conflicts,
  selectLayout,
  getLayoutColor,
  resolveDeviceIds,
  updateSlot,
  setTimelineView,
} from '../store/index.js'
import { DAYS } from '../store/data.js'
import { isSlotActiveOnDate, getConflictsForLayout } from '../composables/conflictEngine.js'

// --- Constants ---
const ROW_HEIGHT = 28
const ROW_GAP = 4
const HEADER_HEIGHT = 24
const HOUR_WIDTH = 40
const DAY_WIDTH_WEEK = 80
const DAY_WIDTH_MONTH = 28
const OPEN_END_HORIZON_DAYS = 90 // how far out to render open-ended schedules
const TODAY = '2026-03-17'        // mocked "today"

const props = defineProps({
  compact: { type: Boolean, default: false },
})

const scrollContainer = ref(null)

const zoomLevels = ['day', 'week', 'month']

// --- Compute the full date range across all layouts ---
// Finds the earliest and latest dates any slot is active,
// then generates the complete array of dates between them.
const dateRange = computed(() => {
  const today = new Date(TODAY + 'T00:00:00')
  let earliest = new Date(today)
  let latest = new Date(today)

  // Expand range based on all slots across all layouts
  for (const layout of store.layouts) {
    for (const slot of layout.slots) {
      const start = getSlotEarliestDate(slot, today)
      const end = getSlotLatestDate(slot, today)
      if (start < earliest) earliest = new Date(start)
      if (end > latest) latest = new Date(end)
    }
  }

  // Add some padding: 7 days before earliest, 7 after latest
  earliest.setDate(earliest.getDate() - 7)
  latest.setDate(latest.getDate() + 7)

  // Align earliest to Monday
  const dayIdx = earliest.getDay() === 0 ? 6 : earliest.getDay() - 1
  earliest.setDate(earliest.getDate() - dayIdx)

  // Build the full date array
  const dates = []
  const cursor = new Date(earliest)
  while (cursor <= latest) {
    dates.push(makeDateInfo(new Date(cursor)))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
})

function getSlotEarliestDate(slot, today) {
  if (slot.dateMode === 'forever' || slot.dateMode === 'untilDate') return today
  if (slot.startDate) return new Date(slot.startDate + 'T00:00:00')
  return today
}

function getSlotLatestDate(slot, today) {
  if (slot.dateMode === 'forever' || slot.dateMode === 'fromDate') {
    // Open-ended: use horizon
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + OPEN_END_HORIZON_DAYS)
    return horizon
  }
  if (slot.endDate) return new Date(slot.endDate + 'T00:00:00')
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + OPEN_END_HORIZON_DAYS)
  return horizon
}

// For day view, we show a single day's 24 hours — pick the focused date
const focusedDateStr = computed(() => store.timelineDate)

// The dates shown in week/month view = the full computed range
const visibleDates = computed(() => {
  if (store.timelineView === 'day') {
    return [makeDateInfo(new Date(focusedDateStr.value + 'T00:00:00'))]
  }
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

// --- Timeline dimensions ---
const cellWidth = computed(() => {
  if (store.timelineView === 'day') return HOUR_WIDTH
  if (store.timelineView === 'month') return DAY_WIDTH_MONTH
  return DAY_WIDTH_WEEK
})

const timelineWidth = computed(() => {
  if (store.timelineView === 'day') return 24 * HOUR_WIDTH
  return visibleDates.value.length * cellWidth.value
})

// --- Header tick marks ---
const headerTicks = computed(() => {
  if (store.timelineView === 'day') {
    const ticks = []
    for (let h = 0; h < 24; h += 2) {
      ticks.push({ label: formatHour(h), x: h * HOUR_WIDTH, isToday: false, isMajor: h % 6 === 0 })
    }
    return ticks
  }

  return visibleDates.value.map((d, i) => {
    let label
    if (store.timelineView === 'month') {
      // Show month name on 1st of month or first visible date, otherwise just day number
      label = d.isFirstOfMonth || i === 0 ? `${d.monthStr} ${d.dayNum}` : (d.isMonday ? `${d.dayNum}` : '')
    } else {
      // Week zoom: show day name + number
      label = `${d.dayName.slice(0, 2)} ${d.dayNum}`
    }
    return {
      label,
      x: i * cellWidth.value,
      isToday: d.isToday,
      isMajor: store.timelineView === 'month' ? (d.isFirstOfMonth || d.isMonday) : true,
    }
  })
})

// --- Layout rows ---
const layoutRows = computed(() => {
  return store.layouts.map((layout) => {
    const color = getLayoutColor(layout)
    const deviceCount = resolveDeviceIds(layout).size
    const hasConflict = getConflictsForLayout(conflicts.value, layout.id).length > 0
    const bars = buildBarsForLayout(layout, color)
    return { layout, color, deviceCount, hasConflict, bars }
  })
})

function buildBarsForLayout(layout, color) {
  const bars = []

  for (const slot of layout.slots) {
    if (store.timelineView === 'day') {
      const dateStr = visibleDates.value[0]?.dateStr
      if (!dateStr || !isSlotActiveOnDate(slot, dateStr)) continue
      const left = slot.startHour * HOUR_WIDTH
      const right = slot.endHour * HOUR_WIDTH
      bars.push({
        key: `${layout.id}-${slot.id}-day`,
        slotId: slot.id,
        left,
        width: right - left,
        isOpenEnd: false,
        isOpenStart: false,
        label: `${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`,
      })
    } else {
      // Find contiguous runs of active dates
      let runStart = null
      for (let i = 0; i <= visibleDates.value.length; i++) {
        const d = visibleDates.value[i]
        const active = d ? isSlotActiveOnDate(slot, d.dateStr) : false

        if (active && runStart === null) {
          runStart = i
        } else if (!active && runStart !== null) {
          bars.push(makeBar(layout, slot, runStart, i - 1))
          runStart = null
        }
      }
    }
  }
  return bars
}

function makeBar(layout, slot, startIdx, endIdx) {
  const cw = cellWidth.value
  const left = startIdx * cw
  const width = (endIdx - startIdx + 1) * cw

  // Check if schedule extends beyond visible range
  const firstDate = visibleDates.value[0].dateStr
  const lastDate = visibleDates.value[visibleDates.value.length - 1].dateStr
  const isOpenStart = startIdx === 0 && isSlotActiveOnDate(slot, shiftDate(firstDate, -1))
  const isOpenEnd = endIdx === visibleDates.value.length - 1 && isSlotActiveOnDate(slot, shiftDate(lastDate, 1))

  return {
    key: `${layout.id}-${slot.id}-${startIdx}-${endIdx}`,
    slotId: slot.id,
    left,
    width,
    isOpenStart,
    isOpenEnd,
    label: `${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`,
  }
}

// --- Conflict zones ---
const conflictBars = computed(() => {
  const bars = []
  for (const c of conflicts.value) {
    if (store.timelineView === 'day') {
      const dateStr = visibleDates.value[0]?.dateStr
      if (!dateStr) continue
      if (!isSlotActiveOnDate(c.slotA, dateStr) || !isSlotActiveOnDate(c.slotB, dateStr)) continue
      bars.push({
        key: `conflict-${c.id}-day`,
        left: c.overlapStart * HOUR_WIDTH,
        width: (c.overlapEnd - c.overlapStart) * HOUR_WIDTH,
        layoutAId: c.layoutA.id,
        layoutBId: c.layoutB.id,
      })
    } else {
      for (let i = 0; i < visibleDates.value.length; i++) {
        const d = visibleDates.value[i]
        if (!isSlotActiveOnDate(c.slotA, d.dateStr) || !isSlotActiveOnDate(c.slotB, d.dateStr)) continue
        bars.push({
          key: `conflict-${c.id}-${d.dateStr}`,
          left: i * cellWidth.value,
          width: cellWidth.value,
          layoutAId: c.layoutA.id,
          layoutBId: c.layoutB.id,
        })
      }
    }
  }
  return bars
})

function conflictBarsForLayout(layoutId) {
  return conflictBars.value.filter(
    (b) => b.layoutAId === layoutId || b.layoutBId === layoutId
  )
}

// --- Total height ---
const totalHeight = computed(() => {
  return HEADER_HEIGHT + layoutRows.value.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP
})

// --- Scroll to "today" on mount and when zoom changes ---
watch(
  () => store.timelineView,
  () => nextTick(scrollToToday),
  { immediate: true }
)

function scrollToToday() {
  if (!scrollContainer.value) return
  if (store.timelineView === 'day') return // day view is small enough

  const todayIdx = visibleDates.value.findIndex((d) => d.isToday)
  if (todayIdx === -1) return
  const todayX = todayIdx * cellWidth.value
  // Scroll so "today" is roughly 1/3 from the left
  const offset = Math.max(0, todayX - scrollContainer.value.clientWidth / 3)
  scrollContainer.value.scrollLeft = offset
}

// --- Day navigation (day view only) ---
function navigateDay(delta) {
  const d = new Date(store.timelineDate + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  store.timelineDate = d.toISOString().slice(0, 10)
}

// --- Helpers ---
function formatHour(h) {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  if (h < 12) return `${h}a`
  return `${h - 12}p`
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// --- Drag to resize (day view) ---
const dragging = ref(null)

function startDragRight(layoutId, slotId, endHour, event) {
  if (store.timelineView !== 'day') return
  event.preventDefault()
  event.stopPropagation()
  dragging.value = { layoutId, slotId, startX: event.clientX, original: endHour }

  const onMove = (e) => {
    if (!dragging.value) return
    const dx = e.clientX - dragging.value.startX
    const newEnd = Math.max(dragging.value.original + Math.round(dx / HOUR_WIDTH), 1)
    updateSlot(layoutId, slotId, { endHour: Math.min(newEnd, 24) })
  }
  const onUp = () => {
    dragging.value = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function startDragLeft(layoutId, slotId, startHour, event) {
  if (store.timelineView !== 'day') return
  event.preventDefault()
  event.stopPropagation()
  dragging.value = { layoutId, slotId, startX: event.clientX, original: startHour }

  const onMove = (e) => {
    if (!dragging.value) return
    const dx = e.clientX - dragging.value.startX
    const newStart = Math.max(dragging.value.original + Math.round(dx / HOUR_WIDTH), 0)
    updateSlot(layoutId, slotId, { startHour: Math.min(newStart, 23) })
  }
  const onUp = () => {
    dragging.value = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// --- Tooltip ---
const tooltip = ref(null)

function showTooltip(event, layout, bar) {
  const rect = event.currentTarget.getBoundingClientRect()
  tooltip.value = {
    x: rect.left + rect.width / 2,
    y: rect.top - 4,
    text: `${layout.name} · ${bar.label} · ${resolveDeviceIds(layout).size} devices`,
  }
}

function hideTooltip() {
  tooltip.value = null
}
</script>

<template>
  <div class="flex flex-col">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50">
      <div class="flex items-center gap-1.5">
        <!-- Zoom level toggle -->
        <button
          v-for="z in zoomLevels"
          :key="z"
          @click="setTimelineView(z)"
          class="px-2 py-1 text-xs font-medium rounded transition-colors capitalize"
          :class="store.timelineView === z ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-200'"
        >{{ z }}</button>

        <!-- Day-view date navigation -->
        <template v-if="store.timelineView === 'day'">
          <div class="w-px h-4 bg-gray-300 mx-1"></div>
          <button
            @click="navigateDay(-1)"
            class="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <span class="text-xs text-gray-500 mx-1">
            {{ visibleDates[0]?.dayName }} {{ visibleDates[0]?.monthStr }} {{ visibleDates[0]?.dayNum }}
          </span>
          <button
            @click="navigateDay(1)"
            class="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </template>
      </div>

      <span v-if="store.timelineView === 'day'" class="text-xs text-gray-400">Drag edges to resize</span>
      <span v-else class="text-xs text-gray-400">Scroll to see all dates</span>
    </div>

    <!-- Horizontal timeline -->
    <div ref="scrollContainer" class="overflow-x-auto timeline-scroll bg-white" style="min-height: 80px; max-height: 200px;">
      <div class="flex" :style="{ minWidth: (timelineWidth + 120) + 'px', height: totalHeight + 'px' }">
        <!-- Layout labels (sticky left) -->
        <div class="w-[120px] shrink-0 border-r border-gray-200 bg-white sticky left-0 z-20">
          <div :style="{ height: HEADER_HEIGHT + 'px' }" class="border-b border-gray-100"></div>
          <div
            v-for="(row, idx) in layoutRows"
            :key="row.layout.id"
            @click="selectLayout(row.layout.id)"
            class="flex items-center gap-1.5 px-2 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50"
            :class="store.selectedLayoutId === row.layout.id ? 'bg-blue-light' : ''"
            :style="{ height: ROW_HEIGHT + 'px', marginTop: ROW_GAP + 'px' }"
          >
            <div class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: row.color.hex }"></div>
            <span class="text-xs font-medium text-gray-700 truncate">{{ row.layout.name }}</span>
            <span
              v-if="row.hasConflict"
              class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 conflict-pulse"
            ></span>
          </div>
        </div>

        <!-- Scrollable timeline area -->
        <div class="relative flex-1">
          <!-- Time header row -->
          <div class="relative border-b border-gray-200 sticky top-0 bg-white z-10" :style="{ height: HEADER_HEIGHT + 'px', width: timelineWidth + 'px' }">
            <template v-for="tick in headerTicks" :key="tick.label + tick.x">
              <div
                v-if="tick.label"
                class="absolute top-0 bottom-0 flex items-center text-xs border-l"
                :class="[
                  tick.isToday ? 'border-blue text-blue font-semibold' : tick.isMajor ? 'border-gray-200 text-gray-500' : 'border-gray-100 text-gray-400',
                ]"
                :style="{ left: tick.x + 'px', paddingLeft: '4px' }"
              >
                {{ tick.label }}
              </div>
              <!-- Minor tick lines (no label, month view) -->
              <div
                v-else
                class="absolute top-0 bottom-0 border-l border-gray-50"
                :style="{ left: tick.x + 'px' }"
              ></div>
            </template>
          </div>

          <!-- Layout rows + bars -->
          <div class="relative" :style="{ width: timelineWidth + 'px' }">
            <!-- Vertical grid lines -->
            <template v-for="tick in headerTicks" :key="'grid-' + tick.x">
              <div
                v-if="tick.isMajor"
                class="absolute top-0 border-l"
                :class="tick.isToday ? 'border-blue-100' : 'border-gray-50'"
                :style="{ left: tick.x + 'px', height: (layoutRows.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP) + 'px' }"
              ></div>
            </template>

            <!-- Today line -->
            <div
              v-if="visibleDates.some(d => d.isToday)"
              class="absolute top-0 w-0.5 bg-blue-400 z-30 pointer-events-none"
              :style="{
                left: (store.timelineView === 'day' ? 9 * HOUR_WIDTH : visibleDates.findIndex(d => d.isToday) * cellWidth) + 'px',
                height: (layoutRows.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP) + 'px',
              }"
            ></div>

            <!-- Rows -->
            <div
              v-for="(row, idx) in layoutRows"
              :key="row.layout.id"
              class="relative"
              :style="{ height: ROW_HEIGHT + 'px', marginTop: ROW_GAP + 'px' }"
            >
              <!-- Conflict highlight bars -->
              <div
                v-for="cb in conflictBarsForLayout(row.layout.id)"
                :key="cb.key"
                class="absolute top-0 bottom-0 bg-red-50 pointer-events-none z-0"
                :style="{ left: cb.left + 'px', width: cb.width + 'px' }"
              >
                <div class="w-full h-full opacity-40" style="background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(239,68,68,0.15) 3px, rgba(239,68,68,0.15) 6px)"></div>
              </div>

              <!-- Layout bars -->
              <div
                v-for="bar in row.bars"
                :key="bar.key"
                @click.stop="selectLayout(row.layout.id)"
                @mouseenter="showTooltip($event, row.layout, bar)"
                @mouseleave="hideTooltip"
                class="absolute top-0.5 bottom-0.5 rounded-sm cursor-pointer transition-shadow hover:shadow-md flex items-center overflow-hidden z-10"
                :class="[
                  row.hasConflict ? 'ring-1 ring-amber-400' : '',
                  store.selectedLayoutId === row.layout.id ? 'ring-2 ring-blue' : '',
                ]"
                :style="{
                  left: bar.left + 'px',
                  width: bar.width + 'px',
                  backgroundColor: row.color.hex + '30',
                  borderLeft: bar.isOpenStart ? 'none' : '3px solid ' + row.color.hex,
                }"
              >
                <!-- Left drag handle (day view only) -->
                <div
                  v-if="store.timelineView === 'day'"
                  @mousedown="startDragLeft(row.layout.id, bar.slotId, row.layout.slots.find(s => s.id === bar.slotId)?.startHour || 0, $event)"
                  class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/10 z-20"
                ></div>

                <div v-if="bar.isOpenStart" class="text-xs px-0.5 opacity-50 shrink-0">...</div>

                <div class="flex items-center gap-1 px-1.5 min-w-0 flex-1 overflow-hidden">
                  <span class="text-xs font-medium truncate" :style="{ color: row.color.hex }">
                    {{ bar.width > 60 ? row.layout.name : '' }}
                  </span>
                  <span v-if="bar.width > 120" class="text-xs opacity-50 truncate" :style="{ color: row.color.hex }">
                    {{ bar.label }}
                  </span>
                </div>

                <svg v-if="row.hasConflict && bar.width > 30" class="w-3 h-3 text-amber-500 shrink-0 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
                </svg>

                <!-- Open-end fade + arrow -->
                <div
                  v-if="bar.isOpenEnd"
                  class="absolute right-0 top-0 bottom-0 w-8 flex items-center justify-end pr-1 pointer-events-none"
                  :style="{ background: `linear-gradient(to right, transparent, ${row.color.hex}20)` }"
                >
                  <svg class="w-3 h-3 opacity-50" :style="{ color: row.color.hex }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>

                <!-- Right drag handle (day view only) -->
                <div
                  v-if="store.timelineView === 'day'"
                  @mousedown="startDragRight(row.layout.id, bar.slotId, row.layout.slots.find(s => s.id === bar.slotId)?.endHour || 24, $event)"
                  class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/10 z-20"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating tooltip -->
    <Teleport to="body">
      <div
        v-if="tooltip"
        class="fixed z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        {{ tooltip.text }}
      </div>
    </Teleport>
  </div>
</template>
