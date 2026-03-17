<script setup>
/**
 * Availability Editor — single availability rule per layout.
 * Date range scope + time of day + repeat pattern.
 * Uses DateRangePicker for calendar-based date selection.
 */
import { computed, watchEffect } from 'vue'
import { addSlot, updateSlot } from '../store/index.js'
import { DAYS, DATE_MODES, REPEAT_MODES } from '../store/data.js'
import DateRangePicker from './DateRangePicker.vue'

const props = defineProps({
  layout: { type: Object, required: true },
})

// Auto-create a slot if this layout has none
watchEffect(() => {
  if (props.layout.slots.length === 0) {
    addSlot(props.layout.id)
  }
})

const slot = computed(() => props.layout.slots[0])

function toggleDay(day) {
  if (!slot.value) return
  const days = [...slot.value.days]
  const idx = days.indexOf(day)
  if (idx === -1) days.push(day)
  else if (days.length > 1) days.splice(idx, 1)
  updateSlot(props.layout.id, slot.value.id, { days })
}

function setStartHour(value) {
  const h = parseInt(value)
  if (slot.value && h < slot.value.endHour) updateSlot(props.layout.id, slot.value.id, { startHour: h })
}

function setEndHour(value) {
  const h = parseInt(value)
  if (slot.value && h > slot.value.startHour) updateSlot(props.layout.id, slot.value.id, { endHour: h })
}

function setDateMode(value) {
  if (!slot.value) return
  const updates = { dateMode: value }
  if (value === 'forever') {
    updates.startDate = null
    updates.endDate = null
  } else if (value === 'untilDate') {
    updates.startDate = null
    if (!slot.value.endDate) updates.endDate = '2026-06-30'
  } else if (value === 'fromDate') {
    updates.endDate = null
    if (!slot.value.startDate) updates.startDate = '2026-03-17'
  } else if (value === 'dateRange') {
    if (!slot.value.startDate) updates.startDate = '2026-03-17'
    if (!slot.value.endDate) updates.endDate = '2026-06-30'
  }
  updateSlot(props.layout.id, slot.value.id, updates)
}

function setRepeatMode(value) {
  if (!slot.value) return
  const updates = { repeatMode: value }
  if (value === 'everyNDays' && !slot.value.repeatInterval) updates.repeatInterval = 3
  if (value === 'duration' && !slot.value.durationDays) updates.durationDays = 7
  if (value === 'weekly' && slot.value.days.length === 0) updates.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  updateSlot(props.layout.id, slot.value.id, updates)
}

function onStartDate(val) {
  if (slot.value) updateSlot(props.layout.id, slot.value.id, { startDate: val })
}

function onEndDate(val) {
  if (slot.value) updateSlot(props.layout.id, slot.value.id, { endDate: val })
}

function formatHour(h) {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}

// Whether the date picker needs to show start, end, or both
const showStart = computed(() => slot.value && (slot.value.dateMode === 'fromDate' || slot.value.dateMode === 'dateRange'))
const showEnd = computed(() => slot.value && (slot.value.dateMode === 'untilDate' || slot.value.dateMode === 'dateRange'))
const showDatePicker = computed(() => showStart.value || showEnd.value)
</script>

<template>
  <div>
    <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Availability</h3>

    <div v-if="slot" class="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2.5">
      <!-- Date range scope -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs text-gray-400">Date range</label>
          <button
            v-if="slot.dateMode !== 'forever'"
            @click="setDateMode('forever')"
            class="text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >Reset to always</button>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <select
            :value="slot.dateMode"
            @change="setDateMode($event.target.value)"
            class="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option v-for="opt in DATE_MODES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <DateRangePicker
            v-if="showDatePicker"
            :startDate="slot.startDate"
            :endDate="slot.endDate"
            :showStart="showStart"
            :showEnd="showEnd"
            @update:startDate="onStartDate"
            @update:endDate="onEndDate"
          />
        </div>
      </div>

      <!-- Time range -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs text-gray-400">Time of day</label>
          <button
            v-if="slot.startHour !== 0 || slot.endHour !== 24"
            @click="updateSlot(layout.id, slot.id, { startHour: 0, endHour: 24 })"
            class="text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >Reset to all day</button>
        </div>
        <div class="flex items-center gap-2">
          <select
            :value="slot.startHour"
            @change="setStartHour($event.target.value)"
            class="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option v-for="h in 24" :key="h - 1" :value="h - 1">{{ formatHour(h - 1) }}</option>
          </select>
          <span class="text-gray-400 text-sm">→</span>
          <select
            :value="slot.endHour"
            @change="setEndHour($event.target.value)"
            class="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option v-for="h in 24" :key="h" :value="h">{{ formatHour(h) }}</option>
          </select>
        </div>
      </div>

      <!-- Repeat pattern -->
      <div>
        <label class="block text-xs text-gray-400 mb-1">Repeat pattern</label>
        <div class="flex items-center gap-2 flex-wrap">
          <select
            :value="slot.repeatMode"
            @change="setRepeatMode($event.target.value)"
            class="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option v-for="opt in REPEAT_MODES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <template v-if="slot.repeatMode === 'everyNDays'">
            <span class="text-sm text-gray-500">every</span>
            <input
              type="number"
              :value="slot.repeatInterval"
              @input="updateSlot(layout.id, slot.id, { repeatInterval: parseInt($event.target.value) || 1 })"
              min="1" max="365"
              class="w-16 text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span class="text-sm text-gray-500">days</span>
          </template>

          <template v-if="slot.repeatMode === 'duration'">
            <span class="text-sm text-gray-500">for</span>
            <input
              type="number"
              :value="slot.durationDays"
              @input="updateSlot(layout.id, slot.id, { durationDays: parseInt($event.target.value) || 1 })"
              min="1" max="365"
              class="w-16 text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span class="text-sm text-gray-500">days from start</span>
          </template>
        </div>
      </div>

      <!-- Day-of-week selector (weekly mode only) -->
      <div v-if="slot.repeatMode === 'weekly'">
        <label class="block text-xs text-gray-400 mb-1">Days</label>
        <div class="flex gap-1">
          <button
            v-for="day in DAYS"
            :key="day"
            @click="toggleDay(day)"
            class="w-9 h-7 rounded text-xs font-medium transition-colors"
            :class="[
              slot.days.includes(day)
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
            ]"
          >
            {{ day.charAt(0) }}{{ day.charAt(1) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
