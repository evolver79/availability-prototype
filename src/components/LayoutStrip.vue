<script setup>
import { computed } from 'vue'
import {
  store,
  selectedLayout,
  selectLayout,
  deleteLayout,
  getLayoutColor,
  toggleEnabled,
  canEnable,
  isExpired,
} from '../store/index.js'

const emit = defineEmits(['create'])

const layouts = computed(() => store.layouts)
</script>

<template>
  <div class="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
    <div class="flex items-center gap-2 overflow-x-auto">
      <div
        v-for="layout in layouts"
        :key="layout.id"
        @click="selectLayout(layout.id)"
        class="group flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg border cursor-pointer transition-all whitespace-nowrap shrink-0"
        :class="[
          selectedLayout?.id === layout.id
            ? 'border-blue bg-blue-light shadow-sm'
            : isExpired(layout)
              ? 'border-red-200 bg-red-50 opacity-70 hover:opacity-90'
              : !layout.enabled && !layout.isDefault
                ? 'border-gray-200 bg-gray-100 opacity-60 hover:opacity-80'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
        ]"
      >
        <span class="text-sm font-medium" :class="layout.enabled || layout.isDefault ? 'text-gray-700' : 'text-gray-400 line-through'">
          {{ layout.name }}
        </span>
        <span v-if="layout.isDefault" class="text-xs text-gray-400">(fallback)</span>
        <span v-else-if="isExpired(layout)" class="text-xs text-red-400">(expired)</span>
        <span v-else-if="!layout.enabled" class="text-xs text-gray-400">(disabled)</span>

        <!-- Enable/disable toggle (not for default) -->
        <button
          v-if="!layout.isDefault"
          @click.stop="layout.enabled ? toggleEnabled(layout.id) : (canEnable(layout.id) ? toggleEnabled(layout.id) : selectLayout(layout.id))"
          class="p-0.5 rounded transition-all"
          :class="[
            layout.enabled
              ? 'text-green-500 hover:text-gray-400'
              : canEnable(layout.id)
                ? 'text-gray-400 hover:text-green-500'
                : 'text-red-400 cursor-not-allowed',
          ]"
          :title="layout.enabled ? 'Disable layout' : canEnable(layout.id) ? 'Enable layout' : 'Cannot enable — conflicts with active layouts'"
        >
          <!-- Power/toggle icon -->
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/>
          </svg>
        </button>

        <!-- Delete on hover (not for default) -->
        <button
          v-if="!layout.isDefault"
          @click.stop="deleteLayout(layout.id)"
          class="hidden group-hover:block p-0.5 text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- New Layout button -->
      <button
        @click="emit('create')"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-blue hover:text-blue hover:bg-blue-light transition-all whitespace-nowrap shrink-0"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        New
      </button>
    </div>
  </div>
</template>
