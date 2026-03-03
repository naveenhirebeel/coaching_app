import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('batches')
    .select('*, teachers(name)')
    .eq('institute_id', user.institute_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, subject, schedule, teacher_id } = await req.json()

  if (!name || !subject) {
    return NextResponse.json({ error: 'Name and subject are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('batches')
    .insert({ name, subject, schedule, teacher_id, institute_id: user.institute_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
