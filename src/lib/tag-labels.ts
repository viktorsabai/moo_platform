/** Slug → emoji + label for dish/product tags */
export const TAG_LABELS: Record<string, string> = {
  hit: 'хит',
  new: 'новинка',
  popular: 'популярное',
  vegan: 'веган',
  vegetarian: 'вегетарианское',
  healthy: 'лайт',
  spicy: 'острое',
  'chef-choice': 'выбор шефа',
  heavy: 'тяжёлое', // used by Fit plan to exclude
  'pickup-only': 'только самовывоз',
  'no-delivery': 'не в доставку',
  'not-delivery': 'не в доставку',
  'no-order': 'без онлайн-заказа',
}

export const TAG_EMOJI: Record<string, string> = {
  hit: '🔥',
  new: '✨',
  popular: '⭐',
  vegan: '🌱',
  vegetarian: '🥗',
  healthy: '💚',
  spicy: '🌶️',
  'chef-choice': '👨‍🍳',
  heavy: '🥘',
  'pickup-only': '🏪',
  'no-delivery': '🚫',
  'not-delivery': '🚫',
  'no-order': '⏸️',
}

export function tagLabel(slug: string): string {
  return TAG_LABELS[slug] ?? slug
}

export function tagWithEmoji(slug: string): string {
  const emoji = TAG_EMOJI[slug] ?? ''
  const label = TAG_LABELS[slug] ?? slug
  return emoji ? `${emoji} ${label}` : label
}
