/** Extract User contact fields from Telegram WebApp user object. */
export function fieldsFromTelegramWebAppUser(tgUser: {
  id?: number | string
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
}) {
  const telegramId = String(tgUser.id ?? '')
  const username = typeof tgUser.username === 'string' ? tgUser.username.replace(/^@/, '').trim() : ''
  const name =
    [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || 'Telegram user'
  return {
    telegramId,
    name,
    telegramUsername: username || null,
    telegramFirstName: tgUser.first_name ?? null,
    telegramLastName: tgUser.last_name ?? null,
    telegramPhotoUrl: tgUser.photo_url ?? null,
  }
}
