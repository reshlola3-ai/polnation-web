import { NextResponse } from 'next/server'

// Telegram webhook handler — receives updates from TG and dispatches them.
// Runs as a serverless function on Vercel: never sleeps, scales automatically,
// no separate bot process to keep alive.
//
// CRITICAL CONTRACT WITH TELEGRAM:
//   1. Respond with HTTP 200 within ~1 second.
//   2. If we don't, TG retries; after repeated failures it pauses the webhook
//      and we have to re-register manually.
//   3. Therefore: validate cheaply, ack immediately, and do any TG API calls
//      asynchronously (fire-and-forget) outside the response path.

interface TgUser {
  id: number
  is_bot?: boolean
  first_name?: string
  username?: string
}

interface TgChat {
  id: number
  type: string
}

interface TgMessage {
  message_id: number
  from?: TgUser
  chat: TgChat
  text?: string
}

interface TgUpdate {
  update_id: number
  message?: TgMessage
  // We only handle message updates in MVP; expand here later (callback_query, etc).
}

const TG_API = 'https://api.telegram.org'

export async function POST(request: Request) {
  // 1. Verify the secret token TG sends with each webhook call.
  // This was set by the one-time setWebhook bootstrap and protects us
  // from anyone who learns our webhook URL.
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  let update: TgUpdate
  try {
    update = await request.json()
  } catch {
    // Malformed body — ack and drop. Don't let TG retry a non-recoverable bad payload.
    return NextResponse.json({ ok: true })
  }

  // 2. Dispatch known commands. Errors are logged and swallowed so we always 200.
  try {
    if (update.message?.text?.startsWith('/start')) {
      // Await the short Bot API call. Vercel may stop background work after
      // the response returns, so fire-and-forget can silently drop replies.
      await handleStart(update.message)
    }
    // Future: callback_query, /help, /balance, etc.
  } catch (err) {
    console.error('TG webhook dispatch error:', err)
  }

  return NextResponse.json({ ok: true })
}

// ── /start handler ────────────────────────────────────────────────────────────
// "/start"          → plain welcome
// "/start ref_ABCD" → welcome that forwards the ref code into the Mini App
//                    via the startapp parameter so /api/auth/telegram can read it.

async function handleStart(message: TgMessage) {
  const chatId = message.chat.id
  const tokens = message.text?.split(/\s+/) || []
  const startParam = tokens[1] // e.g. "ref_ABCD" or undefined

  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!botUsername) {
    console.error('TELEGRAM_BOT_USERNAME env var not set')
    return
  }

  // BotFather Mini App short-name. Set this to whatever you registered via
  // /newapp in BotFather. Defaults to "lottery" but can be overridden.
  const miniAppShortName = process.env.TELEGRAM_MINI_APP_SHORT_NAME || 'lottery'

  // Mini App link — opens our /lottery-mini URL inside Telegram and forwards
  // start_param so the auth handler can resolve the referrer.
  const startAppParam = startParam ? `?startapp=${encodeURIComponent(startParam)}` : ''
  const miniAppUrl = `https://t.me/${botUsername}/${miniAppShortName}${startAppParam}`

  await sendMessage(chatId, {
    text: [
      '🎰 *Welcome to Polnation Lottery*',
      '',
      'Spin the wheel to win USDC and bonus rewards.',
      '',
      'Tap the button below to open the lottery:',
    ].join('\n'),
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Open Lottery', url: miniAppUrl }],
      ],
    },
  }).catch((err) => console.error('TG sendMessage error:', err))
}

// ── Telegram Bot API helper ──────────────────────────────────────────────────

async function sendMessage(
  chatId: number,
  payload: {
    text: string
    parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML'
    reply_markup?: unknown
  }
) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN env var not set')
    return
  }
  const response = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...payload }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('TG sendMessage API error:', response.status, detail)
  }
}

// ── GET probe (for UptimeRobot) ──────────────────────────────────────────────
// Does NOT require the secret header so external monitors can ping it.
// Returns 200 with a body that proves the route is alive but reveals nothing.

export async function GET() {
  return NextResponse.json({ ok: true, service: 'tg-webhook' })
}
