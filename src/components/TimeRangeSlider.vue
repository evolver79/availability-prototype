<script setup>
/**
 * TimeRangeSlider — double-ended slider for picking a time range (0–24h).
 * Drag the left handle for start, right handle for end.
 * Shows hour labels and a colored range bar between the handles.
 */
import { ref, computed } from 'vue'

const props = defineProps({
  startHour: { type: Number, default: 0 },
  endHour: { type: Number, default: 24 },
})

const emit = defineEmits(['update:startHour', 'update:endHour'])

const trackRef = ref(null)
const TOTAL = 24

// Positions as percentages
const startPct = computed(() => (props.startHour / TOTAL) * 100)
const endPct = computed(() => (props.endHour / TOTAL) * 100)

function fmtH(h) {
  return `${String(h).padStart(2, '0')}:00`
}

// Tick marks: every 3 hours
const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24]

function hourFromEvent(e) {
  if (!trackRef.value) return 0
  const rect = trackRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const raw = (x / rect.width) * TOTAL
  return Math.round(raw) // snap to whole hours
}

function startDrag(handle, e) {
  e.preventDefault()
  const onMove = (ev) => {
    const h = hourFromEvent(ev)
    if (handle === 'start') {
      if (h < props.endHour) emit('update:startHour', h)
    } else {
      if (h > props.startHour) emit('update:endHour', h)
    }
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Click on track to move nearest handle
function onTrackClick(e) {
  const h = hourFromEvent(e)
  const distToStart = Math.abs(h - props.startHour)
  const distToEnd = Math.abs(h - props.endHour)
  if (distToStart <= distToEnd) {
    if (h < props.endHour) emit('update:startHour', h)
  } else {
    if (h > props.startHour) emit('update:endHour', h)
  }
}
</script>

<template>
  <div class="w-full">
    <!-- Time labels -->
    <div class="flex items-center justify-between mb-1">
      <span class="text-xs font-medium text-blue">{{ fmtH(startHour) }}</span>
      <span class="text-xs text-gray-400">{{ endHour - startHour }}h</span>
      <span class="text-xs font-medium text-blue">{{ fmtH(endHour) }}</span>
    </div>

    <!-- Slider track -->
    <div
      ref="trackRef"
      @mousedown="onTrackClick"
      class="relative h-6 cursor-pointer select-none"
    >
      <!-- Background track -->
      <div class="absolute top-2.5 left-0 right-0 h-1.5 bg-gray-200 rounded-full"></div>

      <!-- Active range -->
      <div
        class="absolute top-2.5 h-1.5 bg-blue rounded-full"
        :style="{ left: startPct + '%', width: (endPct - startPct) + '%' }"
      ></div>

      <!-- Tick marks -->
      <div
        v-for="t in ticks"
        :key="t"
        class="absolute top-5 w-px h-1.5 bg-gray-300"
        :style="{ left: (t / TOTAL * 100) + '%' }"
      ></div>

      <!-- Start handle -->
      <div
        @mousedown.stop="startDrag('start', $event)"
        class="absolute top-0.5 w-4 h-4 bg-white border-2 border-blue rounded-full -ml-2 cursor-ew-resize hover:scale-125 transition-transform shadow-sm z-10"
        :style="{ left: startPct + '%' }"
      ></div>

      <!-- End handle -->
      <div
        @mousedown.stop="startDrag('end', $event)"
        class="absolute top-0.5 w-4 h-4 bg-white border-2 border-blue rounded-full -ml-2 cursor-ew-resize hover:scale-125 transition-transform shadow-sm z-10"
        :style="{ left: endPct + '%' }"
      ></div>
    </div>

    <!-- Hour scale -->
    <div class="relative h-3 mt-0.5">
      <span
        v-for="t in ticks"
        :key="t"
        class="absolute text-[9px] text-gray-400 -translate-x-1/2"
        :style="{ left: (t / TOTAL * 100) + '%' }"
      >{{ fmtH(t) }}</span>
    </div>
  </div>
</template>
