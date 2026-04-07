import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface TelegramUser {
  id: number
  username?: string
  first_name?: string
}

interface TelegramMessage {
  text?: string
  from?: TelegramUser
  chat?: { id: number }
}

interface TelegramUpdate {
  message?: TelegramMessage
}

async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

export async function POST(req: Request) {
  try {
    // Optional: verify secret token header
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token')
    if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: TelegramUpdate = await req.json()
    const message = body?.message
    if (!message) return NextResponse.json({ ok: true })

    const text = message.text?.trim() || ''
    const from = message.from
    const chatId = message.chat?.id

    if (!from || !chatId) return NextResponse.json({ ok: true })

    // Handle /start CODE
    if (text.startsWith('/start ')) {
      const code = text.slice('/start '.length).trim().toUpperCase()

      if (!code) {
        await sendTelegramMessage(chatId, '👋 Welcome to Polnation Bot!\n\nTo verify your account, go to the Tasks page and click "Verify with Telegram".')
        return NextResponse.json({ ok: true })
      }

      // Find profile with this code that hasn't expired
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, telegram_verify_expires_at')
        .eq('telegram_verify_code', code)
        .single()

      if (!profile) {
        await sendTelegramMessage(chatId, '❌ Invalid or expired verification code.\n\nPlease return to Polnation and generate a new code.')
        return NextResponse.json({ ok: true })
      }

      const expiresAt = new Date(profile.telegram_verify_expires_at)
      if (expiresAt < new Date()) {
        await sendTelegramMessage(chatId, '⏱ Verification code has expired.\n\nPlease return to Polnation and generate a new code.')
        return NextResponse.json({ ok: true })
      }

      // Mark as verified
      await supabaseAdmin
        .from('profiles')
        .update({
          telegram_verified: true,
          telegram_chat_id: from.id,
          telegram_username: from.username || from.first_name || String(from.id),
          telegram_verify_code: null,
          telegram_verify_expires_at: null,
        })
        .eq('id', profile.id)

      await sendTelegramMessage(chatId, `✅ *Verification successful!*\n\nYour Polnation account has been verified. You can now access all tasks. Welcome to the community! 🚀`)
      return NextResponse.json({ ok: true })
    }

    // Handle /start (no code — new user)
    if (text === '/start') {
      await sendTelegramMessage(chatId, '👋 Welcome to Polnation Bot!\n\nTo verify your account, go to the *Tasks* page on Polnation and click *"Verify with Telegram"*.')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
