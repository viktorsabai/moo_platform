import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware'

export const safeStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis?.localStorage?.getItem(name) ?? null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      globalThis?.localStorage?.setItem(name, value)
    } catch {
      // ignore (quota/denied in some webviews)
    }
  },
  removeItem: (name) => {
    try {
      globalThis?.localStorage?.removeItem(name)
    } catch {
      // ignore
    }
  },
}

/**
 * Safe persist storage for WebViews:
 * - wraps localStorage access in try/catch
 * - wraps JSON.parse / JSON.stringify in try/catch (important: stringify can throw)
 */
export function safePersistStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name) => {
      try {
        const raw = safeStateStorage.getItem(name)
        if (!raw || typeof raw !== 'string') return null
        const parsed = JSON.parse(raw) as StorageValue<T>
        if (!parsed || typeof parsed !== 'object') return null
        if (!('state' in (parsed as any))) return null
        return parsed
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      try {
        const raw = JSON.stringify(value)
        return safeStateStorage.setItem(name, raw)
      } catch {
        // ignore stringify/storage errors
        return
      }
    },
    removeItem: (name) => {
      try {
        return safeStateStorage.removeItem(name)
      } catch {
        return
      }
    },
  }
}

