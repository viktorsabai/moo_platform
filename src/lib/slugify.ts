/**
 * Транслитерация кириллицы в латиницу и генерация slug.
 * Используется для авто-заполнения slug по названию.
 */
const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function slugify(text: string): string {
  const s = String(text ?? '').trim().toLowerCase()
  if (!s) return ''
  return s
    .split('')
    .map((c) => {
      const tr = CYR_TO_LAT[c]
      if (tr !== undefined) return tr
      if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) return c
      if (c === ' ' || c === '-') return '-'
      return ''
    })
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
