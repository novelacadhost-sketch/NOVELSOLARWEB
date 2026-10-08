/**
 * The staff code a customer arrived with, from a `?ref=DAFO12` link.
 *
 * Kept for 30 days in this browser and filled in at checkout. The most recent
 * link wins: someone who clicks two staff members' links credits the second.
 * A code typed at checkout replaces it.
 *
 * Browser storage is enough here: losing it costs a pre-filled box, not the
 * credit, because the customer can still type the code. Checkout decides on
 * the server whether a code is real; nothing stored here is trusted.
 */

const STORAGE_KEY = 'novel-staff-ref'
const TTL_MS = 30 * 24 * 60 * 60 * 1000
const CODE_PATTERN = /^[A-Z]{2,4}\d{1,6}$/

interface StoredRef {
  code: string
  savedAt: number
}

export function normaliseStaffCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.replace(/[\s-]/g, '').toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export function useStaffRef() {
  const read = (): string | null => {
    if (import.meta.server) return null
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as StoredRef | null
      if (!stored?.code || Date.now() - stored.savedAt > TTL_MS) return null
      return normaliseStaffCode(stored.code)
    } catch {
      return null
    }
  }

  const save = (raw: unknown): boolean => {
    const code = normaliseStaffCode(raw)
    if (!code || import.meta.server) return false
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() } satisfies StoredRef))
      return true
    } catch {
      return false
    }
  }

  return { read, save }
}
