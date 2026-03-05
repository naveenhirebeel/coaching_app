import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    const { data: institute, error } = await supabaseAdmin
      .from('institutes')
      .select('*')
      .eq('email', email)
      .single()

    if (error || !institute) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, institute.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const statusMessages: Record<string, string> = {
      pending: 'Your account is under review. You will be notified once approved.',
      revoked: 'Your account access has been revoked. Please contact support.',
      suspended: 'Your account has been suspended. Please contact support.',
      archived: 'This account no longer exists.',
    }
    if (institute.status !== 'approved') {
      return NextResponse.json({ error: statusMessages[institute.status] || 'Account not active.' }, { status: 403 })
    }

    const token = signToken({ id: institute.id, role: 'admin', institute_id: institute.id })

    return NextResponse.json({
      token,
      institute: { id: institute.id, name: institute.name },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
