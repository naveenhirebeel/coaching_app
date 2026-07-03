// Lightweight audit-trail writer for the activity_logs table. Fire-and-forget:
// a logging failure must never break the primary action, so errors are logged
// to the console rather than thrown.

type ActivityInput = {
  instituteId: string
  eventType: string
  actorType: 'admin' | 'teacher' | 'system'
  actorId?: string | null
  entityType?: string
  entityId?: string
  entityName?: string
  details?: Record<string, unknown>
}

export async function logActivity(input: ActivityInput): Promise<void> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const { error } = await supabaseAdmin.from('activity_logs').insert({
    institute_id: input.instituteId,
    event_type: input.eventType,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    entity_name: input.entityName ?? null,
    details: input.details ?? null,
  })
  if (error) console.error('Activity log insert error:', error)
}
