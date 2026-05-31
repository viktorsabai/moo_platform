/** Фон героя карточки плана в визарде (если нет coverImageUrl). */
export function subscriptionPlanPresetGradient(presetSlug: string | null | undefined): string {
  const slug = (presetSlug || '').toLowerCase()
  if (slug === 'fit')
    return 'linear-gradient(145deg, #ecfdf5 0%, #6ee7b7 42%, #0d9488 100%)'
  if (slug === 'family')
    return 'linear-gradient(145deg, #eef2ff 0%, #a5b4fc 45%, #4338ca 100%)'
  if (slug === 'standard')
    return 'linear-gradient(145deg, #fffbeb 0%, #fcd34d 40%, #ea580c 100%)'
  return 'linear-gradient(145deg, color-mix(in srgb, var(--accent) 22%, var(--surface-strong)) 0%, var(--surface-strong) 50%, color-mix(in srgb, var(--text) 12%, var(--surface-strong)) 100%)'
}
