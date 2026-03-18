<script setup>
import { computed, ref } from 'vue'
import { updateScheduleSlot } from '../store/index.js'
import { DAYS, DATE_MODES, REPEAT_MODES } from '../store/data.js'
import DateRangePicker from './DateRangePicker.vue'
import TimeRangeSlider from './TimeRangeSlider.vue'

const props = defineProps({
  schedule: { type: Object, required: true },
})

const slot = computed(() => props.schedule.slot)
const showRepeat = ref(false)
const isNonDefaultRepeat = computed(() => slot.value && slot.value.repeatMode !== 'daily')

function toggleDay(day) {
  const days = [...slot.value.days]
  const idx = days.indexOf(day)
  if (idx === -1) days.push(day)
  else if (days.length > 1) days.splice(idx, 1)
  updateScheduleSlot(props.schedule.id, { days })
}

function setDateMode(value) {
  const updates = { dateMode: value }
  if (value === 'forever') { updates.startDate = null; updates.endDate = null }
  else if (value === 'untilDate') { updates.startDate = null; if (!slot.value.endDate) updates.endDate = '2026-06-30' }
  else if (value === 'fromDate') { updates.endDate = null; if (!slot.value.startDate) updates.startDate = '2026-03-18' }
  else if (value === 'dateRange') { if (!slot.value.startDate) updates.startDate = '2026-03-18'; if (!slot.value.endDate) updates.endDate = '2026-06-30' }
  updateScheduleSlot(props.schedule.id, updates)
}

function setRepeatMode(value) {
  const updates = { repeatMode: value }
  if (value === 'everyNDays' && !slot.value.repeatInterval) updates.repeatInterval = 3
  if (value === 'duration' && !slot.value.durationDays) updates.durationDays = 7
  if (value === 'weekly' && slot.value.days.length === 0) updates.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  updateScheduleSlot(props.schedule.id, updates)
}

function resetAll() {
  updateScheduleSlot(props.schedule.id, { dateMode: 'forever', startDate: null, endDate: null, startHour: 0, endHour: 24, repeatMode: 'daily' })
  showRepeat.value = false
}

function formatHour(h) { return `${String(h).padStart(2, '0')}:00` }

const showStart = computed(() => slot.value && (slot.value.dateMode === 'fromDate' || slot.value.dateMode === 'dateRange'))
const showEnd = computed(() => slot.value && (slot.value.dateMode === 'untilDate' || slot.value.dateMode === 'dateRange'))
const showDatePicker = computed(() => showStart.value || showEnd.value)
const isAllDefaults = computed(() => slot.value && slot.value.dateMode === 'forever' && slot.value.startHour === 0 && slot.value.endHour === 24 && slot.value.repeatMode === 'daily')
</script>

<template>
  <div v-if="slot" class="space-y-4">
    <!-- Date range -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-xs text-gray-500">When</label>
        <button v-if="!isAllDefaults" @click="resetAll" class="text-xs text-blue hover:text-blue transition-colors">Reset all</button>
      </div>
      <div class="flex items-center gap-2">
        <select :value="slot.dateMode" @change="setDateMode($event.target.value)"
          class="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 h-[30px] focus:outline-none focus:ring-1 focus:ring-blue shrink-0">
          <option v-for="opt in DATE_MODES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <DateRangePicker v-if="showDatePicker"
          :startDate="slot.startDate" :endDate="slot.endDate" :showStart="showStart" :showEnd="showEnd"
          @update:startDate="(v) => updateScheduleSlot(schedule.id, { startDate: v })"
          @update:endDate="(v) => updateScheduleSlot(schedule.id, { endDate: v })"
        />
      </div>
    </div>

    <!-- Time -->
    <div>
      <label class="text-xs text-gray-500 mb-1 block">Time</label>
      <TimeRangeSlider
        :startHour="slot.startHour" :endHour="slot.endHour"
        @update:startHour="(h) => updateScheduleSlot(schedule.id, { startHour: h })"
        @update:endHour="(h) => updateScheduleSlot(schedule.id, { endHour: h })"
      />
    </div>

    <!-- Repeat -->
    <div v-if="isNonDefaultRepeat || showRepeat">
      <div class="flex items-center gap-2 flex-wrap">
        <label class="text-xs text-gray-500">Repeat</label>
        <select :value="slot.repeatMode" @change="setRepeatMode($event.target.value)"
          class="text-sm bg-white border border-gray-200 rounded-md px-2 py-1 h-[30px] focus:outline-none focus:ring-1 focus:ring-blue">
          <option v-for="opt in REPEAT_MODES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <template v-if="slot.repeatMode === 'everyNDays'">
          <span class="text-xs text-gray-500">every</span>
          <input type="number" :value="slot.repeatInterval"
            @input="updateScheduleSlot(schedule.id, { repeatInterval: parseInt($event.target.value) || 1 })"
            min="1" max="365" class="w-14 text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue" />
          <span class="text-xs text-gray-500">days</span>
        </template>
        <template v-if="slot.repeatMode === 'duration'">
          <span class="text-xs text-gray-500">for</span>
          <input type="number" :value="slot.durationDays"
            @input="updateScheduleSlot(schedule.id, { durationDays: parseInt($event.target.value) || 1 })"
            min="1" max="365" class="w-14 text-sm bg-white border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue" />
          <span class="text-xs text-gray-500">days</span>
        </template>
      </div>
      <div v-if="slot.repeatMode === 'weekly'" class="flex gap-1 mt-1.5">
        <button v-for="day in DAYS" :key="day" @click="toggleDay(day)"
          class="w-8 h-6 rounded text-xs font-medium transition-colors"
          :class="slot.days.includes(day) ? 'bg-blue text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
        >{{ day.slice(0, 2) }}</button>
      </div>
    </div>
    <button v-if="!isNonDefaultRepeat && !showRepeat" @click="showRepeat = true"
      class="text-xs text-blue hover:text-blue transition-colors">Customize repeat pattern...</button>
  </div>
</template>
