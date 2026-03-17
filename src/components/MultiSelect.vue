<script setup>
/**
 * MultiSelect — dropdown multi-select with search, selected chips,
 * optional section headers (grouped mode), and conflict indicators.
 *
 * Props:
 *   options  — array of { id, label, sublabel?, type? }
 *   modelValue — array of selected ids
 *   placeholder — input placeholder text
 *   warningIds — Set of ids to highlight with a conflict indicator
 *   grouped — when true, options with a `type` field are grouped under section headers
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select...' },
  warningIds: { type: Set, default: () => new Set() },
  grouped: { type: Boolean, default: false },
  allBadge: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const search = ref('')
const containerRef = ref(null)
const inputRef = ref(null)

const filteredOptions = computed(() => {
  const q = search.value.toLowerCase()
  const filtered = q
    ? props.options.filter(
        (o) => o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q))
      )
    : props.options
  return filtered
})

// Group filtered options by type for section headers
const groupedOptions = computed(() => {
  if (!props.grouped) return [{ label: null, items: filteredOptions.value }]

  const typeOrder = ['group', 'device']
  const typeLabels = { group: 'Groups', device: 'Devices' }
  const groups = []

  for (const type of typeOrder) {
    const items = filteredOptions.value.filter((o) => o.type === type)
    if (items.length > 0) {
      groups.push({ label: typeLabels[type] || type, items })
    }
  }
  // Any items without a type
  const ungrouped = filteredOptions.value.filter((o) => !o.type)
  if (ungrouped.length > 0) {
    groups.push({ label: null, items: ungrouped })
  }
  return groups
})

const selectedOptions = computed(() =>
  props.options.filter((o) => props.modelValue.includes(o.id))
)

function chipColor(opt) {
  if (props.warningIds.has(opt.id)) return 'bg-amber-100 text-amber-800 border border-amber-300'
  if (opt.type === 'group') return 'bg-highlight text-deep-blue border border-highlight'
  return 'bg-blue-light text-blue border border-blue-light'
}

function toggle(id) {
  const current = [...props.modelValue]
  const idx = current.indexOf(id)
  if (idx === -1) current.push(id)
  else current.splice(idx, 1)
  emit('update:modelValue', current)
}

function remove(id) {
  emit('update:modelValue', props.modelValue.filter((v) => v !== id))
}

function openDropdown() {
  isOpen.value = true
  nextTick(() => inputRef.value?.focus())
}

function closeDropdown() {
  isOpen.value = false
  search.value = ''
}

function onClickOutside(e) {
  if (containerRef.value && !containerRef.value.contains(e.target)) {
    closeDropdown()
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="containerRef" class="relative">
    <!-- Trigger area: selected chips + input -->
    <div
      @click="openDropdown"
      class="min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1.5 bg-white border rounded-lg cursor-text transition-colors"
      :class="isOpen ? 'border-blue ring-1 ring-blue' : 'border-gray-300 hover:border-gray-400'"
    >
      <!-- "ALL" badge when nothing selected and allBadge is on -->
      <span
        v-if="allBadge && selectedOptions.length === 0"
        class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-light text-blue border border-blue-light"
      >ALL</span>

      <!-- Selected chips -->
      <span
        v-for="opt in selectedOptions"
        :key="opt.id"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium max-w-[160px]"
        :class="chipColor(opt)"
      >
        <span
          v-if="warningIds.has(opt.id)"
          class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
        ></span>
        <span class="truncate">{{ opt.label }}</span>
        <button
          @click.stop="remove(opt.id)"
          class="ml-0.5 text-current opacity-50 hover:opacity-100 transition-opacity"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </span>

      <!-- Search input -->
      <input
        ref="inputRef"
        v-model="search"
        :placeholder="selectedOptions.length === 0 ? placeholder : ''"
        class="flex-1 min-w-[60px] text-sm bg-transparent outline-none placeholder-gray-400 py-0.5"
        @focus="isOpen = true"
        @keydown.escape="closeDropdown"
      />

      <!-- Dropdown chevron -->
      <svg
        class="w-4 h-4 text-gray-400 shrink-0 ml-auto transition-transform"
        :class="isOpen ? 'rotate-180' : ''"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </div>

    <!-- Dropdown panel -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
      >
        <div v-if="filteredOptions.length === 0" class="px-3 py-4 text-sm text-gray-400 text-center">
          No matches
        </div>

        <template v-for="group in groupedOptions" :key="group.label">
          <!-- Section header -->
          <div
            v-if="group.label"
            class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 sticky top-0"
          >
            {{ group.label }}
          </div>

          <!-- Options -->
          <div
            v-for="option in group.items"
            :key="option.id"
            @click.stop="toggle(option.id)"
            class="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-gray-50"
          >
            <!-- Checkbox -->
            <div
              class="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
              :class="modelValue.includes(option.id)
                ? option.type === 'group' ? 'bg-blue border-blue' : 'bg-blue border-blue-600'
                : 'border-gray-300'"
            >
              <svg
                v-if="modelValue.includes(option.id)"
                class="w-3 h-3 text-white"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
              </svg>
            </div>

            <!-- Label + sublabel -->
            <div class="flex-1 min-w-0">
              <div class="text-sm text-gray-800 truncate">{{ option.label }}</div>
              <div v-if="option.sublabel" class="text-xs text-gray-400 truncate">{{ option.sublabel }}</div>
            </div>

            <!-- Warning indicator -->
            <span
              v-if="warningIds.has(option.id) && modelValue.includes(option.id)"
              class="shrink-0"
              title="Involved in a conflict"
            >
              <svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
              </svg>
            </span>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>
