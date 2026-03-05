import { NextRequest, NextResponse } from 'next/server'
import { signSuperAdminToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const validUsername = process.env.SUPER_ADMIN_USERNAME
  const validPassword = process.env.SUPER_ADMIN_PASSWORD

  if (!validUsername || !validPassword) {
    return NextResponse.json({ error: 'Super admin not configured' }, { status: 500 })
  }

  if (username !== validUsername || password !== validPassword) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = signSuperAdminToken()
  return NextResponse.json({ token })
}
