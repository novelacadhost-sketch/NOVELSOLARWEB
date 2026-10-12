/**
 * Validates that a string looks like a real email address.
 * Checks structure (local@domain.tld) and rejects obvious junk.
 */
export const isValidEmail = (email: unknown): boolean => {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length > 254) return false
  // RFC 5322 simplified: local part, @, domain with at least one dot in TLD
  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]{2,}$/
  return emailRegex.test(trimmed)
}

// Utility to escape potentially dangerous HTML characters
export const escapeHtml = (unsafe: string): string => {
  if (typeof unsafe !== 'string') return unsafe
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Recursively deep-sanitizes an object, array, or string.
 * This ensures that before saving payloads to the database or passing API data,
 * no malicious script payloads get processed.
 */
export const sanitizePayload = (payload: unknown): unknown => {
  if (typeof payload === 'string') {
    return escapeHtml(payload)
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item))
  }

  if (payload !== null && typeof payload === 'object') {
    const sanitizedObj: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      sanitizedObj[key] = sanitizePayload(value)
    }
    return sanitizedObj
  }

  return payload
}
