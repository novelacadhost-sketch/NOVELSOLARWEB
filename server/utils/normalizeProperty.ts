/**
 * Normalize Bitrix custom properties down to a scalar.
 *
 * Bitrix returns PROPERTY_* in several shapes depending on the property type:
 *   [{ valueId, value: "text" }]                      — plain text property
 *   [{ valueId, value: { id, showUrl, downloadUrl } }] — FILE property
 *   { value: "text" }                                  — single-value object
 *   { "1234": "150000" }                               — id-keyed scalar map
 *   { "1234": { value: "..." } }                       — id-keyed object map
 *
 * The contract is "give me the usable value", so a FILE property resolves to
 * its URL rather than the file descriptor object. Callers treat the result as
 * a scalar — `normalizeBitrixProduct` interpolates it straight into
 * `/api/bitrix-image?url=`, which produced "[object Object]" for every product
 * carrying a legacy PROPERTY_44 image before file unwrapping was handled.
 */

interface BitrixFileValue {
  id?: number | string
  showUrl?: string
  downloadUrl?: string
}

/** A Bitrix FILE descriptor resolves to its URL; anything else passes through. */
function unwrapFileValue(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val

  const file = val as BitrixFileValue
  // downloadUrl carries an `auth=` placeholder; showUrl is the canonical form
  // and is what /api/bitrix-image parses productId/fieldName out of.
  if (typeof file.showUrl === 'string' && file.showUrl) return file.showUrl
  if (typeof file.downloadUrl === 'string' && file.downloadUrl) return file.downloadUrl

  return val
}

// Return type stays `any` deliberately: ~30 call sites assign the result
// straight into typed fields, and widening it to `unknown` adds typecheck
// errors unrelated to the behaviour being fixed here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProperty(val: unknown): any {
  if (!val) return null

  if (Array.isArray(val)) {
    if (val.length === 0) return null
    const firstItem = val[0]
    if (firstItem === null || firstItem === undefined) return null

    if (typeof firstItem === 'object' && 'value' in (firstItem as Record<string, unknown>)) {
      return unwrapFileValue((firstItem as Record<string, unknown>).value) ?? null
    }
    return unwrapFileValue(firstItem) ?? null
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>

    if ('value' in obj) {
      return unwrapFileValue(obj.value) ?? null
    }

    // A FILE descriptor can arrive unwrapped, without the { value } envelope.
    const asFile = unwrapFileValue(obj)
    if (asFile !== obj) return asFile

    // Bitrix objects keyed by an internal id, e.g. { "1234": "150000" }.
    // NOTE: returning the first value here is deliberate, not a bug — a
    // deleted unit test asserted such objects should pass through unchanged,
    // which contradicted this branch. The branch is correct; the test was not.
    const values = Object.values(obj)
    if (values.length > 0) {
      const firstVal = values[0]
      if (firstVal && typeof firstVal === 'object' && 'value' in (firstVal as Record<string, unknown>)) {
        return unwrapFileValue((firstVal as Record<string, unknown>).value) ?? null
      }
      return unwrapFileValue(firstVal) ?? null
    }
    return null
  }

  return val
}
