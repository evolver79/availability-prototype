<script setup>
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  store,
  createLayout,
  deleteLayout,
  updateLayout,
  getLayoutColor,
  isLayoutScheduled,
  isLayoutActiveNow,
  createSchedule,
  schedulesForLayout,
  openScheduleModal,
  toggleScheduleEnabled,
} from '../store/index.js'

const hoveredId = ref(null)
const editingNameId = ref(null)
const showNameModal = ref(false)
const newLayoutName = ref('')

// Action menu
const menuLayoutId = ref(null)
const menuRef = ref(null)

function openMenu(e, layout) {
  e.preventDefault()
  e.stopPropagation()
  menuLayoutId.value = layout.id
  nextTick(() => {
    if (!menuRef.value) return
    try { menuRef.value.showPopover() } catch {}
    const rect = e.currentTarget.getBoundingClientRect()
    Object.assign(menuRef.value.style, {
      top: (rect.bottom + 4) + 'px',
      left: rect.left + 'px',
    })
  })
}

function closeMenu() {
  try { menuRef.value?.hidePopover() } catch {}
  menuLayoutId.value = null
}

function menuAction(action) {
  const id = menuLayoutId.value
  closeMenu()
  if (!id) return
  if (action === 'schedule') createSchedule(id)
  else if (action === 'rename') editingNameId.value = id
  else if (action === 'delete') deleteLayout(id)
}

function menuScheduleAction(action, schId) {
  closeMenu()
  if (action === 'edit') openScheduleModal(schId)
  else if (action === 'toggle') toggleScheduleEnabled(schId)
}

// Tooltip
const tooltipRef = ref(null)
const tooltipData = ref(null)
let tooltipTimer = null

function fmtH(h) { return `${String(h).padStart(2, '0')}:00` }

function showTooltip(event, layout) {
  clearTimeout(tooltipTimer)
  const rect = event.currentTarget.getBoundingClientRect()
  const scheds = schedulesForLayout(layout.id).filter(s => !s.isDefault)
  tooltipData.value = {
    name: layout.name,
    schedules: scheds.map(s => ({
      time: `${fmtH(s.slot.startHour)}–${fmtH(s.slot.endHour)}`,
      target: [s.targetTv ? 'TV' : '', s.targetWeb ? 'WEB' : ''].filter(Boolean).join('+'),
      enabled: s.enabled,
    })),
    isDefault: layout.isDefault,
  }
  nextTick(() => {
    if (!tooltipRef.value) return
    try { tooltipRef.value.showPopover() } catch {}
    Object.assign(tooltipRef.value.style, { top: (rect.bottom + 6) + 'px', left: rect.left + 'px' })
  })
}

function hideTooltip() {
  tooltipTimer = setTimeout(() => { try { tooltipRef.value?.hidePopover() } catch {}; tooltipData.value = null }, 100)
}

function startRename(layout, e) { e.stopPropagation(); editingNameId.value = layout.id }
function finishRename(layout, e) { const val = e.target.value.trim(); if (val) updateLayout(layout.id, { name: val }); editingNameId.value = null }

function openNewLayoutModal() { newLayoutName.value = ''; showNameModal.value = true }
function confirmNewLayout() { const name = newLayoutName.value.trim() || 'New Layout'; const l = createLayout(); updateLayout(l.id, { name }); showNameModal.value = false }
function cancelNewLayout() { showNameModal.value = false }

// Close menu on outside click
function onClickOutside(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) closeMenu()
}
onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))

const menuLayout = computed(() => store.layouts.find(l => l.id === menuLayoutId.value))
const menuSchedules = computed(() => menuLayoutId.value ? schedulesForLayout(menuLayoutId.value).filter(s => !s.isDefault) : [])
</script>

<template>
  <div class="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
    <div class="flex items-center gap-1.5 overflow-x-auto">
      <div
        v-for="layout in store.layouts"
        :key="layout.id"
        @mouseenter="hoveredId = layout.id; showTooltip($event, layout)"
        @mouseleave="hoveredId = null; hideTooltip()"
        @contextmenu="!layout.isDefault && openMenu($event, layout)"
        class="group relative flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg border cursor-pointer transition-all whitespace-nowrap shrink-0"
        :class="[
          isLayoutActiveNow(layout.id)
            ? 'border-green-300 bg-green-50'
            : isLayoutScheduled(layout.id)
              ? 'border-blue/30 bg-blue-light/20'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
        ]"
      >
        <div class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: getLayoutColor(layout).hex }"></div>
        <span v-if="isLayoutActiveNow(layout.id)" class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>

        <input v-if="editingNameId === layout.id" :value="layout.name" @blur="finishRename(layout, $event)" @keydown.enter="finishRename(layout, $event)" @keydown.escape="editingNameId = null"
          class="text-xs font-medium text-gray-700 bg-transparent border-b border-blue focus:outline-none w-20" autofocus />
        <span v-else class="text-xs font-medium text-gray-700 truncate max-w-[120px]">{{ layout.name }}</span>

        <span v-if="layout.isDefault" class="text-[9px] text-gray-400">(fallback)</span>

        <svg v-if="isLayoutScheduled(layout.id) && !layout.isDefault" class="w-3 h-3 text-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>

        <!-- "..." menu button (non-default, always visible) -->
        <button
          v-if="!layout.isDefault"
          @click.stop="openMenu($event, layout)"
          class="p-0.5 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/>
          </svg>
        </button>
      </div>

      <!-- New Layout -->
      <button @click="openNewLayoutModal"
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-blue hover:text-blue hover:bg-blue-light/30 transition-all whitespace-nowrap shrink-0">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        New
      </button>
    </div>

    <!-- Action menu (popover) -->
    <div
      ref="menuRef"
      popover="manual"
      class="m-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
    >
      <template v-if="menuLayout && !menuLayout.isDefault">
        <!-- Schedule: add or edit (one schedule per layout) -->
        <button v-if="menuSchedules.length === 0" @click="menuAction('schedule')" class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
          <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 11v6m3-3H9"/>
          </svg>
          Add schedule
        </button>
        <button v-else @click="menuScheduleAction('edit', menuSchedules[0].id)" class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
          <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          Edit schedule
          <span class="ml-auto text-[10px] text-gray-400">{{ fmtH(menuSchedules[0].slot.startHour) }}–{{ fmtH(menuSchedules[0].slot.endHour) }}</span>
        </button>

        <!-- Enable/disable schedule (if exists) -->
        <button v-if="menuSchedules.length > 0" @click="menuScheduleAction('toggle', menuSchedules[0].id)"
          class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
          :class="menuSchedules[0].enabled ? 'text-gray-700' : 'text-gray-500'">
          <svg class="w-3.5 h-3.5" :class="menuSchedules[0].enabled ? 'text-green-500' : 'text-gray-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/>
          </svg>
          {{ menuSchedules[0].enabled ? 'Disable schedule' : 'Enable schedule' }}
        </button>

        <div class="border-t border-gray-100 my-1"></div>

        <!-- Rename -->
        <button @click="menuAction('rename')" class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
          <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Rename
        </button>

        <!-- Delete -->
        <div class="border-t border-gray-100 my-1"></div>
        <button @click="menuAction('delete')" class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          Delete layout
        </button>
      </template>
    </div>

    <!-- Tooltip -->
    <div ref="tooltipRef" popover="manual" class="m-0 px-3 py-2 bg-gray-900 text-white rounded-lg shadow-lg pointer-events-none" style="max-width: 280px;">
      <template v-if="tooltipData">
        <div class="text-xs font-semibold mb-1">{{ tooltipData.name }}</div>
        <div v-if="tooltipData.isDefault" class="text-[10px] text-gray-300">Fallback — always active</div>
        <div v-else-if="tooltipData.schedules.length === 0" class="text-[10px] text-gray-400">Not scheduled — right-click for options</div>
        <div v-else class="space-y-0.5">
          <div v-for="(s, i) in tooltipData.schedules" :key="i" class="text-[10px] text-gray-300 flex items-center gap-2">
            <span>{{ s.time }}</span>
            <span>{{ s.target }}</span>
            <span v-if="!s.enabled" class="text-amber-300">disabled</span>
          </div>
        </div>
      </template>
    </div>

    <!-- New Layout name modal -->
    <Teleport to="body">
      <div v-if="showNameModal" class="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/30" @click="cancelNewLayout"></div>
        <div class="relative bg-white rounded-lg shadow-xl p-5 w-full max-w-sm z-50">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">New Layout</h3>
          <input v-model="newLayoutName" @keydown.enter="confirmNewLayout" @keydown.escape="cancelNewLayout"
            class="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue focus:border-blue"
            placeholder="Layout name..." autofocus />
          <div class="flex justify-end gap-2 mt-4">
            <button @click="cancelNewLayout" class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">Cancel</button>
            <button @click="confirmNewLayout" class="px-3 py-1.5 text-sm font-medium text-white bg-blue rounded-md hover:bg-blue/90 transition-colors">Create</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
