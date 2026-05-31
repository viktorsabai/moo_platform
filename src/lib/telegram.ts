import axios from 'axios'
import FormData from 'form-data'

/** Demo bot link for "open in Telegram" when not in venue context. Configure via NEXT_PUBLIC_DEMO_BOT and NEXT_PUBLIC_DEMO_STARTAPP. */
export function getDemoBotLink(): { tg: string; tme: string } {
  const bot = process.env.NEXT_PUBLIC_DEMO_BOT || 'topka_demo_bot'
  const start = process.env.NEXT_PUBLIC_DEMO_STARTAPP || 'topka'
  return {
    tg: `tg://resolve?domain=${bot}&startapp=${start}`,
    tme: `https://t.me/${bot}?startapp=${start}`,
  }
}

type TelegramReplyMarkup = {
  inline_keyboard?: Array<
    Array<
      | { text: string; url: string }
      | { text: string; callback_data: string }
      | { text: string; web_app: { url: string } }
    >
  >
}

export type TelegramSendMessageOptions = {
  text: string
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  reply_markup?: TelegramReplyMarkup
}

function getPublicBaseUrl(): string {
  const sanitizeBase = (value: string) =>
    String(value || '')
      .replace(/\s+/g, '')
      .replace(/\/+$/, '')
  const sanitizePath = (value: string) => String(value || '').replace(/[\r\n\t]/g, '')
  // Prefer explicit app url, then NextAuth, then Vercel runtime env.
  const direct = process.env.APP_URL || process.env.NEXTAUTH_URL
  if (direct) return sanitizeBase(sanitizePath(direct))
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return sanitizeBase(`https://${sanitizePath(vercelUrl)}`)
  return 'https://ufo-delivery.vercel.app'
}

export function buildWebAppUrl(pathname: string = '/'): string {
  const base = getPublicBaseUrl()
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  const version =
    process.env.WEBAPP_VERSION ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA
  if (!version) return `${base}${p}`
  const [pathOnly, hash = ''] = p.split('#')
  const hasQuery = pathOnly.includes('?')
  const withVersion = `${pathOnly}${hasQuery ? '&' : '?'}v=${encodeURIComponent(version)}`
  return hash ? `${base}${withVersion}#${hash}` : `${base}${withVersion}`
}

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendTelegramMessage(
  chatId: string,
  textOrOptions: string | TelegramSendMessageOptions,
  botTokenOverride?: string | null
) {
  const token = botTokenOverride || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, error: 'missing_bot_token' as const }
  if (!chatId) return { ok: false, error: 'missing_chat_id' as const }

  const payload: TelegramSendMessageOptions =
    typeof textOrOptions === 'string' ? { text: textOrOptions } : textOrOptions

  try {
    const call = async (body: Record<string, unknown>) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

    const baseBody: Record<string, unknown> = {
      chat_id: chatId,
      text: payload.text,
      parse_mode: payload.parse_mode,
      reply_markup: payload.reply_markup,
      disable_web_page_preview: true,
    }

    let res = await call(baseBody)
    if (!res.ok) {
      const raw = await res.text().catch(() => '')
      const lowered = raw.toLowerCase()
      const parseIssue =
        lowered.includes('parse entities') ||
        lowered.includes("can't parse") ||
        lowered.includes('entity')
      if (parseIssue) {
        const plainText = String(payload.text || '').replace(/<[^>]*>/g, '')
        res = await call({
          chat_id: chatId,
          text: plainText,
          reply_markup: payload.reply_markup,
          disable_web_page_preview: true,
        })
      }
      if (!res.ok) {
        console.error('[telegram:sendMessage:failed]', {
          chatId,
          status: res.status,
          body: raw.slice(0, 300),
        })
      }
    }
    return { ok: res.ok }
  } catch {
    return { ok: false as const, error: 'network_error' as const }
  }
}

/** Answer a callback query (inline button click). Must use the same bot token that sent the message. */
/** Отправить фото по публичному URL (Telegram скачает сам). */
export async function sendTelegramPhotoUrl(
  chatId: string,
  photoUrl: string,
  options?: { caption?: string; parse_mode?: 'HTML'; reply_markup?: TelegramReplyMarkup },
  botTokenOverride?: string | null
): Promise<{ ok: boolean }> {
  const token = botTokenOverride || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId || !photoUrl) return { ok: false }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: options?.caption,
        parse_mode: options?.parse_mode,
        reply_markup: options?.reply_markup,
      }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  options?: { text?: string; show_alert?: boolean },
  botTokenOverride?: string | null
): Promise<{ ok: boolean }> {
  const token = botTokenOverride || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: options?.text,
        show_alert: options?.show_alert ?? false,
      }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}

export type SendDocumentOptions = {
  caption?: string
  parse_mode?: 'HTML' | 'Markdown'
}

function parseTelegramError(body: string): string {
  try {
    const j = JSON.parse(body)
    const desc = j?.description || j?.error_description || ''
    if (desc.includes('chat not found') || desc.includes('user not found')) {
      return 'Чат не найден. Напишите боту /start в Telegram и попробуйте снова.'
    }
    if (desc.includes('Unauthorized') || desc.includes('invalid token')) {
      return 'Неверный токен бота. Проверьте BOT_TOKEN.'
    }
    if (desc.includes('blocked') || desc.includes('bot was blocked')) {
      return 'Бот заблокирован. Разблокируйте бота в Telegram.'
    }
    if (desc.includes('Bad Request')) return desc.replace('Bad Request: ', '') || 'Ошибка Telegram'
    return desc || body.slice(0, 120)
  } catch {
    return body.slice(0, 120) || 'Ошибка отправки'
  }
}

/** Send a document (e.g. CSV) to a Telegram chat. Used for LK export → bot. */
export async function sendTelegramDocument(
  chatId: string,
  fileBuffer: Buffer,
  filename: string,
  options?: SendDocumentOptions,
  botTokenOverride?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const token = botTokenOverride || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, error: 'Нет токена бота (BOT_TOKEN в .env)' }
  if (!chatId) return { ok: false, error: 'Нет chat_id' }

  try {
    const form = new FormData()
    form.append('chat_id', String(chatId))
    form.append('document', fileBuffer, { filename })
    if (options?.caption) form.append('caption', options.caption)

    const res = await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    })
    const body = res.data
    const status = res.status
    if (status >= 400 || (typeof body === 'object' && body?.ok === false)) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      return { ok: false, error: parseTelegramError(bodyStr) }
    }
    return { ok: true }
  } catch (e: any) {
    const data = e?.response?.data
    const msg = data != null
      ? parseTelegramError(typeof data === 'string' ? data : JSON.stringify(data))
      : e?.message || 'Сетевая ошибка'
    return { ok: false, error: msg }
  }
}

