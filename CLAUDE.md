# Layout Availability Prototype

## What is this?

A Vue 3 frontend-only prototype for managing "layouts" with time-based availability and conflict detection. Layouts are content configurations assigned to TV set-top boxes (STBs) and/or WEB, scheduled with flexible date/time rules. The system detects and surfaces conflicts when two layouts target the same devices during overlapping time windows.

This is a **UX prototype** — no backend, no persistence. All state is reactive and in-memory.

## Tech stack

- **Vue 3** (Composition API, `<script setup>`)
- **Vite** for dev/build
- **Tailwind CSS v4** via `@tailwindcss/vite`
- No Nuxt, no Pinia (uses `reactive()` store)
- No component library — all components are custom

## Run

```bash
npm install
npm run dev
```

## Project structure

```
src/
├── App.vue                        # Shell: header, layout strip, modal, timeline toggle
├── main.js                        # Entry point
├── style.css                      # Tailwind import + custom animations
├── store/
│   ├── data.js                    # Mock devices, groups, color palette, dropdown options
│   └── index.js                   # Reactive store, all actions, conflict getters
├── composables/
│   └── conflictEngine.js          # Conflict detection + resolution suggestions + date helpers
└── components/
    ├── LayoutStrip.vue            # Horizontal pill bar: layout list + New button + enable/disable/delete
    ├── LayoutEditor.vue           # Modal form: name, target (TV/WEB), devices/groups, availability
    ├── AvailabilityEditor.vue     # Date range, time of day, repeat pattern, day-of-week
    ├── DateRangePicker.vue        # Calendar dropdown for selecting start/end dates
    ├── MultiSelect.vue            # Searchable dropdown multi-select with chips, grouping, ALL badge
    ├── TimelineView.vue           # Horizontal Gantt-style timeline (day/week/month zoom)
    ├── ConflictPanel.vue          # Compact conflict cards with detail chips + expandable quick fixes
    └── LayoutList.vue             # (unused legacy file — card grid, superseded by LayoutStrip)
```

## Domain model

- **Device** — a TV set-top box (e.g. `stb-1`). Has id, name, location.
- **Group** — a named collection of devices (e.g. `group-1`). A device can be in multiple groups.
- **Layout** — a content configuration with:
  - `name` — user-editable
  - `targetTv` / `targetWeb` — boolean flags, at least one required to save
  - `deviceIds` / `groupIds` — which TV devices/groups. Empty = ALL devices.
  - `enabled` — can be toggled on/off. Disabled layouts are excluded from conflict checks.
  - `isDefault` — the "Default" layout is a fallback, always enabled, cannot be deleted.
  - `slots[]` — exactly one availability rule per layout (enforced)
- **Slot** (availability rule):
  - `dateMode`: `forever` | `untilDate` | `dateRange` | `fromDate`
  - `startDate` / `endDate`: ISO date strings or null
  - `startHour` / `endHour`: 0–24
  - `repeatMode`: `daily` | `weekly` | `everyOtherDay` | `everyNDays` | `duration`
  - `days[]`: for weekly mode
  - `repeatInterval`: for everyNDays
  - `durationDays`: for duration mode

## Key behaviors

### Conflict detection
Two layouts conflict when ALL of these overlap:
1. **Target overlap** — both target WEB, or both target at least one shared TV device (directly or via groups). TV with no selection = ALL devices.
2. **Date range overlap** — their date boundaries intersect (null = unbounded).
3. **Day pattern overlap** — shared days (weekly) or conservatively assumed (non-weekly patterns).
4. **Time-of-day overlap** — their hour ranges intersect.

Only **enabled, non-default** layouts participate in conflict detection.

### Default layout
- Always present, cannot be deleted
- Acts as fallback for when no other layout is active on a device
- Excluded from conflict detection

### Save / discard
- Save is blocked when: conflicts exist OR no target selected
- Creating a new layout opens the modal; closing without saving discards it
- Editing an existing layout: cancel just closes (changes are live in reactive state)

### Enable / disable
- Layouts can be toggled on/off from the strip
- Re-enabling is blocked if it would create conflicts with currently active layouts

## Code conventions

- All state lives in `src/store/index.js` as a single `reactive()` object
- Actions are exported functions that mutate the store
- Computed getters are exported `computed()` refs
- Components use `<script setup>` with `defineProps` / `defineEmits`
- Tailwind classes inline, no separate CSS files per component
- SVG icons inline (no icon library)

## What is NOT implemented (prototype scope)

- No backend / persistence
- No auth
- No drag-to-reorder layouts
- No undo/redo
- Exact calendar math for `everyNDays` conflict detection uses conservative assumption
- No timezone handling
- No validation on date ranges (start < end)
- `LayoutList.vue` is unused — can be deleted
