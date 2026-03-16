import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSuperAdminUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, institute_id } = await req.json()
  if (!action || !institute_id) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const userAgent = req.headers.get('user-agent') || ''

  const { error } = await supabaseAdmin
    .from('audit_logs')
    .insert({
      super_admin_id: 'super_admin',
      action,
      institute_id,
      ip_address: ip,
      user_agent: userAgent,
    })

  if (error) console.error('Audit log error:', error)
  // Fire-and-forget: always return 200
  return NextResponse.json({ logged: true })
}

export async function GET(req: NextRequest) {
  const user = getSuperAdminUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const instituteId = searchParams.get('institute_id')
  const action = searchParams.get('action')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = 50

  if (!instituteId) return NextResponse.json({ error: 'institute_id required' }, { status: 400 })

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('institute_id', instituteId)
    .order('created_at', { ascending: false })

  if (action) query = query.eq('action', action)
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
