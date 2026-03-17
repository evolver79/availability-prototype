# Layout Availability System — Specification & AI Prompt

Use this document as a prompt or specification to rebuild, extend, or reimplement this system in any framework or language.

---

## System Overview

A scheduling system for managing "layouts" (content configurations) with time-based availability across TV set-top boxes and web. The core challenge is **conflict detection and resolution** — two layouts must never be active simultaneously on the same target.

## Domain Model

### Devices
- Represent physical TV set-top boxes (named `stb-1`, `stb-2`, etc.)
- Each has an id, name, and location

### Groups
- Named collections of devices (e.g. `group-1` contains `stb-1`, `stb-2`, `stb-6`)
- A device can belong to multiple groups
- Groups are predefined (not user-created in this prototype)

### Layouts
A layout is a content configuration with the following properties:

| Field | Type | Description |
|-------|------|-------------|
| name | string | User-editable display name |
| targetTv | boolean | Whether this layout targets TV devices |
| targetWeb | boolean | Whether this layout targets WEB |
| deviceIds | string[] | Specific TV devices. Empty + targetTv = ALL devices |
| groupIds | string[] | Device groups. Resolved to individual devices for conflict checks |
| enabled | boolean | Active/inactive toggle. Disabled layouts skip conflict detection |
| isDefault | boolean | The fallback layout. Always enabled, cannot be deleted |
| slots | Slot[] | Exactly one availability rule per layout |

**Rules:**
- At least one target (TV or WEB) must be selected to save
- TV with no specific devices/groups selected means "all devices"
- The default layout is a permanent fallback — it fills gaps when no other layout is active

### Availability Rule (Slot)

Each layout has exactly one availability rule defining when it is active:

**Date range scope** (when across calendar days):
- `forever` — always active, no date boundaries
- `untilDate` — active from now until a specific end date
- `fromDate` — active from a specific start date onward, no end
- `dateRange` — active between a specific start and end date

**Time of day:**
- Start hour (0–23) and end hour (1–24)
- Default: 0–24 (all day)

**Repeat pattern** (which days within the date range):
- `daily` — every day (default)
- `weekly` — specific days of the week (Mon, Tue, etc.)
- `everyOtherDay` — alternating days from the start date
- `everyNDays` — every N days from the start date
- `duration` — active for the first N days from the start date, then stops

## Conflict Detection

Two layouts **conflict** when ALL of these conditions are true simultaneously:

1. **Target overlap**: both target WEB, OR both target at least one shared TV device (resolved through groups). TV with empty device selection = all devices.
2. **Date range overlap**: their date boundaries intersect. Null/open boundaries mean unbounded (always satisfies the overlap condition).
3. **Day pattern overlap**: for two weekly layouts, they share at least one day. For non-weekly patterns, conservatively assume overlap is possible.
4. **Time-of-day overlap**: their hour ranges intersect (startA < endB AND startB < endA).

**Important:**
- Only **enabled, non-default** layouts participate in conflict detection
- The default layout is always excluded — it's a fallback, not a competitor

## UX Requirements

### Layout Management
- Horizontal strip showing all layouts as pills with color dots
- "New" button (dashed border) at the end of the strip
- Each pill shows: color dot, name, "(fallback)" for default, "(disabled)" for disabled
- Enable/disable toggle (power icon) per layout
- Delete button on hover (not for default)
- Re-enabling blocked when it would create conflicts

### Editor (Modal)
Clicking a layout or "New" opens a modal with:

1. **Name** — inline editable text field
2. **Target** — TV and WEB toggle buttons. At least one required (highlighted red if neither selected). TV shows an "ALL" badge in the device selector when nothing specific is chosen.
3. **TV Devices & Groups** — searchable multi-select dropdown (only shown when TV is on). Groups and devices in one dropdown with section headers. Selected items shown as colored chips (purple for groups, blue for devices). Conflict-involved devices get amber warning indicators.
4. **Availability** — single rule editor:
   - Date range: mode selector + calendar date picker
   - Time of day: hour dropdowns with "Reset to all day" link
   - Repeat pattern: mode selector + conditional inputs (N days, duration)
   - Day-of-week toggles (weekly mode only)
   - "Reset to always" link for date range
5. **Timeline** — compact horizontal Gantt chart (see below)
6. **Conflicts** — compact cards with detail chips + expandable quick fixes

### Modal Behavior
- **New layout**: created on open, **discarded** on Cancel/Escape/backdrop. Button says "Discard".
- **Existing layout**: Cancel just closes. Button says "Cancel".
- **Save**: blocked when conflicts exist or no target selected. Shows specific error message. Flashes green "Saved" on success.
- **Escape key** closes modal

### Timeline
Horizontal Gantt-style schedule view:
- Time flows left → right
- Each layout = one row with colored horizontal bars
- Three zoom levels: Day (hours on x-axis), Week (days), Month (days, compact)
- Auto-computes the full date range across all layouts — everything scrollable
- Open-ended schedules show fade-out with → arrow
- Conflict zones shown as red hatched overlays
- Day view: drag left/right edges to resize time range
- Hover tooltip with layout name, time, device count
- "Today" indicator line
- Scrolls to today on mount
- Available as toggle on the main page AND embedded in the modal

### Conflict Resolution
- Never block the user while editing — show warnings, don't prevent changes
- Save is the gate — must resolve before saving
- Conflict panel shows compact cards: layout names, detail chips (time, date, days, devices, WEB)
- Expandable "Quick fixes" per conflict:
  - Remove a device from one layout
  - Remove a group from one layout
  - Adjust end time to avoid overlap
  - Adjust end date to avoid overlap

## Visual Design Guidelines

- Clean, minimal UI with Tailwind CSS
- Color coding: each layout gets a distinct color from a palette
- Conflict indicators: amber/yellow palette (bg-amber-50, border-amber-200, text-amber-700)
- Validation errors: red palette
- Selected/active states: blue palette
- Disabled states: gray + opacity + strikethrough
- Transitions on all interactive elements
- No modals for conflicts — inline, non-blocking warnings
- Compact where possible — the timeline should support the form, not dominate it

## Defaults for New Layouts

- Target: neither TV nor WEB (user must choose)
- Date range: "Always (now → forever)"
- Time: 9 AM → 5 PM
- Repeat: "Every day"
- Enabled: true

## Mock Data

**8 devices:** stb-1 through stb-8, across buildings A, B, C and Exterior

**5 groups:**
- group-1: stb-1, stb-2, stb-6
- group-2: stb-3, stb-4, stb-5
- group-3: stb-4, stb-5
- group-4: stb-1, stb-3, stb-7, stb-8
- group-5: all 8 devices

**1 default layout:** "Default" — targets all TV + WEB, 24h daily forever, always enabled, cannot be deleted.
