const DAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type Slot = { day: string; start: string; end: string }
export type BatchWithSlots = { id: string; schedule_slots?: Slot[] }

function nextOccurrenceMs(slots: Slot[] | undefined): number {
  if (!slots?.length) return Infinity
  const now = new Date()
  const nowMs = now.getTime()
  let nearest = Infinity
  for (const slot of slots) {
    const dayIndex = DAY_ORDER.indexOf(slot.day)
    if (dayIndex === -1) continue
    const [sh, sm] = slot.start.split(':').map(Number)
    const [eh, em] = slot.end.split(':').map(Number)
    const diff = (dayIndex - now.getDay() + 7) % 7
    const startCandidate = new Date(now)
    startCandidate.setDate(now.getDate() + diff)
    startCandidate.setHours(sh, sm, 0, 0)
    const endCandidate = new Date(startCandidate)
    endCandidate.setHours(eh, em, 0, 0)
    endCandidate.setMinutes(endCandidate.getMinutes() + 30) // 30-min buffer
    if (endCandidate.getTime() <= nowMs) startCandidate.setDate(startCandidate.getDate() + 7)
    if (startCandidate.getTime() < nearest) nearest = startCandidate.getTime()
  }
  return nearest
}

export function sortBatches<T extends BatchWithSlots>(batches: T[]): T[] {
  return [...batches].sort((a, b) => nextOccurrenceMs(a.schedule_slots) - nextOccurrenceMs(b.schedule_slots))
}
