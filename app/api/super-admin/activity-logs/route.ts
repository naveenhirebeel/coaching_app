import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSuperAdminUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const instituteId = searchParams.get('institute_id')
  const eventType = searchParams.get('event_type')
  const actorType = searchParams.get('actor_type')
  const entityType = searchParams.get('entity_type')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = 50

  if (!instituteId) return NextResponse.json({ error: 'institute_id required' }, { status: 400 })

  let query = supabaseAdmin
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .eq('institute_id', instituteId)
    .order('created_at', { ascending: false })

  if (eventType) query = query.eq('event_type', eventType)
  if (actorType) query = query.eq('actor_type', actorType)
  if (entityType) query = query.eq('entity_type', entityType)
  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate) query = query.lte('created_at', toDate)

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    logs: data || [],
    total: count || 0,
    page,
    pageSize,
  })
}

export async function POST(req: NextRequest) {
  const { instituteId, eventType, actorType, actorId, entityType, entityId, entityName, details } = await req.json()

  if (!instituteId || !eventType || !actorType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('activity_logs')
    .insert({
      institute_id: instituteId,
      event_type: eventType,
      actor_type: actorType,
      actor_id: actorId || null,
      entity_type: entityType || null,
      entity_id: entityId || null,
      entity_name: entityName || null,
      details: details || null,
    })

  if (error) {
    console.error('Activity log insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
