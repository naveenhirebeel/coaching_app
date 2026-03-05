import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const user = getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { chat_id, name } = await req.json()
  if (!chat_id || !name) return NextResponse.json({ error: 'Missing chat_id or name' }, { status: 400 })

  const message = `🔔 <b>Test message from CoachingBuddy!</b>\n\nHi <b>${name}</b>, your Telegram notifications are working correctly. ✅`
  const result = await sendTelegramMessage(chat_id, message)

  if (!result.ok) return NextResponse.json({ error: result.error || 'Failed to send message.' }, { status: 400 })
  return NextResponse.json({ success: true, message: 'Test message sent successfully!' })
}
