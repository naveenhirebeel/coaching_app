import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSuperAdminUser } from '@/lib/auth'

type InstituteStatus = 'pending' | 'approved' | 'revoked' | 'suspended' | 'archived'

function auth(req: NextRequest) {
  const user = getSuperAdminUser(req)
  if (!user) return null
  return user
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('institutes')
    .select('id, name, phone, email, address, status, status_reason, status_updated_at, created_at')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, reason } = await req.json()

  const validStatuses: InstituteStatus[] = ['pending', 'approved', 'revoked', 'suspended', 'archived']
  if (!id || !status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('institutes')
    .update({ status, status_reason: reason || null, status_updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Only allow deletion of archived institutes
  const { data: institute } = await supabaseAdmin
    .from('institutes')
    .select('status')
    .eq('id', id)
    .single()

  if (!institute) return NextResponse.json({ error: 'Institute not found' }, { status: 404 })
  if (institute.status !== 'archived') {
    return NextResponse.json({ error: 'Only archived institutes can be permanently deleted' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('institutes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
