// Fire-and-forget activity logging for institutes
// Called automatically after key events (attendance, student enrollment, batch creation, etc.)

export async function logActivity(
  instituteId: string,
  eventType: string,
  actorType: 'admin' | 'teacher' | 'system',
  actorId: string | null,
  entityType: string | null,
  entityId: string | null,
  entityName: string | null,
  details?: Record<string, any>
) {
  fetch(typeof window === 'undefined' ? new URL('/api/super-admin/activity-logs', process.env.NEXTAUTH_URL).toString() : '/api/super-admin/activity-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instituteId, eventType, actorType, actorId, entityType, entityId, entityName, details })
  }).catch(console.error)
}
