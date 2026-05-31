export function slugifyOption(input: string): string {
  const fallback = 'option'
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ы: 'y', э: 'e', ю: 'yu', я: 'ya',
  }
  const slug = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, (c) => map[c.toLowerCase()] ?? '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || fallback
}

export type PublicDishOptionValue = {
  id: string
  name: string
  priceAdjust: number
  order?: number
}

export type PublicDishOptionGroup = {
  id: string
  name: string
  order?: number
  values: PublicDishOptionValue[]
}
