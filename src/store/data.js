// Mock data for the prototype
// Devices represent individual TV setup boxes / screens
// Groups bundle multiple devices (a device can be in multiple groups)
// Layouts are content assignments that get scheduled on devices/groups

export const DEVICES = [
  { id: 'd1', name: 'stb-1', location: 'Building A' },
  { id: 'd2', name: 'stb-2', location: 'Building A' },
  { id: 'd3', name: 'stb-3', location: 'Building B' },
  { id: 'd4', name: 'stb-4', location: 'Building B' },
  { id: 'd5', name: 'stb-5', location: 'Building B' },
  { id: 'd6', name: 'stb-6', location: 'Building A' },
  { id: 'd7', name: 'stb-7', location: 'Exterior' },
  { id: 'd8', name: 'stb-8', location: 'Building C' },
]

export const GROUPS = [
  { id: 'g1', name: 'group-1', deviceIds: ['d1', 'd2', 'd6'] },
  { id: 'g2', name: 'group-2', deviceIds: ['d3', 'd4', 'd5'] },
  { id: 'g3', name: 'group-3', deviceIds: ['d4', 'd5'] },
  { id: 'g4', name: 'group-4', deviceIds: ['d1', 'd3', 'd7', 'd8'] },
  { id: 'g5', name: 'group-5', deviceIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'] },
  { id: 'g6', name: 'group-6', deviceIds: ['d7', 'd8'] },
]

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Date boundary modes for availability rules
export const DATE_MODES = [
  { value: 'forever', label: 'Always (now → forever)' },
  { value: 'untilDate', label: 'Now → end date' },
  { value: 'dateRange', label: 'Start date → end date' },
  { value: 'fromDate', label: 'Start date → forever' },
]

// Repeat pattern modes
export const REPEAT_MODES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Weekly (specific days)' },
  { value: 'everyOtherDay', label: 'Every other day' },
  { value: 'everyNDays', label: 'Every N days' },
  { value: 'duration', label: 'Lasts N days' },
]

// Layout colors for visual distinction
export const LAYOUT_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', hex: '#3b82f6' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', hex: '#10b981' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', hex: '#8b5cf6' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', hex: '#f59e0b' },
  { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-800', hex: '#f43f5e' },
  { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800', hex: '#06b6d4' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800', hex: '#f97316' },
  { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800', hex: '#6366f1' },
]
