export type TelegramContactSource = {
  telegramUsername?: string | null
  telegramId?: string | null
  name?: string | null
}

export function normalizeTelegramUsername(raw: string | null | undefined): string | null {
  const u = String(raw || '').trim().replace(/^@/, '')
  return u || null
}

/** Display handle: @username → tg id → name */
export function formatTelegramContact(user: TelegramContactSource): string {
  const username = normalizeTelegramUsername(user.telegramUsername)
  if (username) return `@${username}`
  const id = String(user.telegramId || '').trim()
  if (id) return `tg ${id}`
  return String(user.name || '').trim() || '—'
}

export function telegramUserUrl(telegramId: string | null | undefined): string | null {
  const id = String(telegramId || '').trim()
  if (!id) return null
  return `https://t.me/user?id=${id}`
}

export function isSyntheticTelegramEmail(email: string | null | undefined): boolean {
  return !!email && /@telegram\.local$/i.test(email)
}
