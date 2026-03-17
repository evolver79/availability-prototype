<script setup>
/**
 * DateRangePicker — uses native Popover API for the calendar dropdown.
 * No Teleport needed — popover lives in the top layer automatically.
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  startDate: { type: String, default: null },
  endDate: { type: String, default: null },
  showStart: { type: Boolean, default: true },
  showEnd: { type: Boolean, default: true },
})

const emit = defineEmits(['update:startDate', 'update:endDate'])

const isOpen = ref(false)
const triggerRef = ref(null)
const popoverRef = ref(null)
const selecting = ref('start')
const viewDate = ref(new Date(props.startDate || props.endDate || '2026-03-17'))

const viewYear = computed(() => viewDate.value.getFullYear())
const viewMonth = computed(() => viewDate.value.getMonth())
const viewMonthName = computed(() =>
  viewDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const calendarDays = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days = []
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, dateStr: toStr(d), isCurrentMonth: false })
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    days.push({ date: d, dateStr: toStr(d), isCurrentMonth: true })
  }
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({ date: d, dateStr: toStr(d), isCurrentMonth: false })
    }
  }
  return days
})

function toStr(d) { return d.toISOString().slice(0, 10) }
function isInRange(dateStr) { return props.startDate && props.endDate && dateStr >= props.startDate && dateStr <= props.endDate }
function isStart(dateStr) { return dateStr === props.startDate }
function isEnd(dateStr) { return dateStr === props.endDate }
function isToday(dateStr) { return dateStr === '2026-03-17' }

function selectDay(dateStr) {
  if (selecting.value === 'start') {
    emit('update:startDate', dateStr)
    if (props.endDate && dateStr > props.endDate) emit('update:endDate', null)
    if (props.showEnd) { selecting.value = 'end' } else { closePicker() }
  } else {
    if (props.startDate && dateStr < props.startDate) {
      emit('update:startDate', dateStr)
      selecting.value = 'end'
    } else {
      emit('update:endDate', dateStr)
      selecting.value = 'start'
      closePicker()
    }
  }
}

function prevMonth() { const d = new Date(viewDate.value); d.setMonth(d.getMonth() - 1); viewDate.value = d }
function nextMonth() { const d = new Date(viewDate.value); d.setMonth(d.getMonth() + 1); viewDate.value = d }

function positionPopover() {
  if (!triggerRef.value || !popoverRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  Object.assign(popoverRef.value.style, {
    top: rect.bottom + 4 + 'px',
    left: rect.left + 'px',
  })
}

function openPicker() {
  if (props.showStart && !props.startDate) selecting.value = 'start'
  else if (props.showEnd && !props.endDate) selecting.value = 'end'
  else selecting.value = 'start'

  const focusDate = props.startDate || props.endDate || '2026-03-17'
  viewDate.value = new Date(focusDate + 'T00:00:00')
  isOpen.value = true
  nextTick(() => {
    popoverRef.value?.showPopover()
    positionPopover()
  })
}

function closePicker() {
  isOpen.value = false
  try { popoverRef.value?.hidePopover() } catch {}
}

function formatDisplay(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function onClickOutside(e) {
  if (triggerRef.value?.contains(e.target)) return
  if (popoverRef.value?.contains(e.target)) return
  if (isOpen.value) closePicker()
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  try { popoverRef.value?.hidePopover() } catch {}
})
</script>

<template>
  <div class="relative inline-block">
    <!-- Trigger button -->
    <button
      ref="triggerRef"
      @click="openPicker"
      class="flex items-center gap-2 px-2 py-1 bg-white border rounded-md text-sm transition-colors h-[30px]"
      :class="isOpen ? 'border-blue ring-1 ring-blue' : 'border-gray-200 hover:border-gray-300'"
    >
      <svg class="w-4 h-4 text-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>

      <template v-if="showStart && showEnd">
        <span class="px-2 py-0.5 bg-blue-light text-blue text-sm font-medium rounded">{{ formatDisplay(startDate) }}</span>
        <span class="text-gray-400 text-xs">→</span>
        <span class="px-2 py-0.5 bg-blue-light text-blue text-sm font-medium rounded">{{ formatDisplay(endDate) }}</span>
      </template>
      <template v-else-if="showStart">
        <span class="text-xs text-gray-400 mr-0.5">from</span>
        <span class="px-2 py-0.5 bg-blue-light text-blue text-sm font-medium rounded">{{ formatDisplay(startDate) }}</span>
      </template>
      <template v-else-if="showEnd">
        <span class="text-xs text-gray-400 mr-0.5">until</span>
        <span class="px-2 py-0.5 bg-blue-light text-blue text-sm font-medium rounded">{{ formatDisplay(endDate) }}</span>
      </template>
    </button>

    <!-- Calendar dropdown: native popover, top layer -->
    <div
      ref="popoverRef"
      popover="manual"
      class="m-0 p-3 bg-white border border-gray-200 rounded-lg shadow-lg"
      style="width: 280px;"
    >
      <div class="text-xs text-gray-400 mb-2">
        Selecting: <span class="font-medium text-gray-600">{{ selecting === 'start' ? 'start date' : 'end date' }}</span>
      </div>

      <div class="flex items-center justify-between mb-2">
        <button @click="prevMonth" class="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span class="text-sm font-medium text-gray-700">{{ viewMonthName }}</span>
        <button @click="nextMonth" class="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div class="grid grid-cols-7 mb-1">
        <div v-for="wd in WEEKDAYS" :key="wd" class="text-center text-xs text-gray-400 font-medium py-1">{{ wd }}</div>
      </div>

      <div class="grid grid-cols-7">
        <button
          v-for="day in calendarDays"
          :key="day.dateStr"
          @click="selectDay(day.dateStr)"
          class="h-8 text-xs rounded-sm transition-colors relative flex items-center justify-center"
          :class="[
            !day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100',
            isInRange(day.dateStr) && !isStart(day.dateStr) && !isEnd(day.dateStr) ? 'bg-blue-light' : '',
            isStart(day.dateStr) ? 'bg-blue text-white font-semibold rounded-l-md' : '',
            isEnd(day.dateStr) ? 'bg-blue text-white font-semibold rounded-r-md' : '',
            isToday(day.dateStr) && !isStart(day.dateStr) && !isEnd(day.dateStr) ? 'font-semibold ring-1 ring-blue' : '',
          ]"
        >
          {{ day.date.getDate() }}
        </button>
      </div>
    </div>
  </div>
</template>
