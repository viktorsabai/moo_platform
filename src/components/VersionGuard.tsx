'use client'

import { useEffect } from 'react'

/**
 * Telegram держит мини-апп «свёрнутым» и при следующем открытии показывает
 * уже загруженную страницу — то есть сборку до последнего деплоя. Сверяем
 * вшитый при сборке коммит с тем, что сейчас на сервере, и перезагружаемся,
 * если они разошлись: при старте и при каждом возврате в приложение.
 */
const BUILD = process.env.NEXT_PUBLIC_SUB_BUILD_TAG || 'local'
const RELOADED_KEY = 'ufo:version-reload'
const MIN_INTERVAL_MS = 30_000
/** экраны, где пользователь что-то вводит: перезагрузка при возврате потеряла бы ввод */
const NO_RELOAD_ON_RETURN = ['/checkout', '/subscriptions/new', '/admin']

export function VersionGuard() {
  useEffect(() => {
    if (BUILD === 'local') return
    let lastCheck = 0

    const check = async (onReturn: boolean) => {
      const now = Date.now()
      if (now - lastCheck < MIN_INTERVAL_MS) return
      lastCheck = now
      try {
        const res = await fetch('/api/app-version', { cache: 'no-store' })
        const data = await res.json()
        const server = typeof data?.sha === 'string' ? data.sha.slice(0, 7) : ''
        if (!server || server === BUILD) return
        if (onReturn && NO_RELOAD_ON_RETURN.some((p) => window.location.pathname.startsWith(p))) return
        // не больше одной перезагрузки на одну новую сборку — защита от цикла
        let already: string | null = null
        try { already = window.sessionStorage.getItem(RELOADED_KEY) } catch {}
        if (already === server) return
        try { window.sessionStorage.setItem(RELOADED_KEY, server) } catch {}
        window.location.reload()
      } catch {
        // офлайн или сервер недоступен — работаем на текущей сборке
      }
    }

    void check(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return null
}
