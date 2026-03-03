import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, password, address } = await req.json()

    if (!name || !phone || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Check if institute already exists with this email
    const { data: existing } = await supabaseAdmin
      .from('institutes')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data: institute, error } = await supabaseAdmin
      .from('institutes')
      .insert({ name, phone, email, password: hashedPassword, address })
      .select()
      .single()

    if (error) throw error

    const token = signToken({ id: institute.id, role: 'admin', institute_id: institute.id })

    return NextResponse.json({ token, institute: { id: institute.id, name: institute.name } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
