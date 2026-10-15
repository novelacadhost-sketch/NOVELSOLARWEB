import { filterXSS } from 'xss'
import { normalizeProperty } from './normalizeProperty'

/**
 * Reading and writing the product fields an admin edits: specs, gallery,
 * description. One place, used by the admin save endpoints, the editor's search
 * and the storefront, so the shapes cannot drift apart again.
 *
 * Why this exists: the save endpoints HTML-escaped every form field with
 * sanitizePayload() — the treatment meant for enquiry text bound for Bitrix
 * comments — BEFORE parsing the specs and gallery JSON. Quotes became &quot;,
 * JSON.parse failed, and the catch saved them as empty: every product save
 * wiped its specs and gallery, and double-escaped its name ("&amp;amp;").
 */

export interface ProductSpec {
  label: string
  value: string
}

/** Undo sanitizePayload()'s escaping, to read values that bug already stored. */
function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** JSON from a Bitrix property or a form field, tolerating the escaped copies the old bug wrote. */
function parseJsonish(raw: unknown): unknown {
  const value = normalizeProperty(raw)
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    try {
      return JSON.parse(decodeEntities(text))
    } catch {
      return null
    }
  }
}

const MAX_SPECS = 50
const MAX_GALLERY = 10

/**
 * The text of a Bitrix string property. HTML-type properties ("Specification")
 * arrive as { TEXT, TYPE } rather than a string.
 */
export function propertyText(raw: unknown): string {
  const value = normalizeProperty(raw)
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { TEXT?: unknown }).TEXT === 'string') {
    return (value as { TEXT: string }).TEXT
  }
  return ''
}

/**
 * Specs written in Bitrix as a list, `<li><strong>Label:</strong> value</li>`,
 * which is how the enriched catalogue import (2026-10-15) stores them so staff
 * can read and edit them there. The admin editor still writes JSON.
 */
function parseSpecList(html: string): ProductSpec[] | null {
  // Tags are stripped before entities are decoded, so an escaped "&lt;15ms"
  // stays text instead of turning into a tag that eats the rest of the value.
  const source = /<li/i.test(html) ? html : decodeEntities(html)
  const items = [...source.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  if (!items.length) return null
  const text = (s: string) =>
    decodeEntities(s.replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
  return items.map(([, inner = '']) => {
    const labelled = inner.match(/^\s*<(strong|b)>([\s\S]*?)<\/\1>([\s\S]*)$/i)
    return labelled
      ? { label: text(labelled[2] ?? '').replace(/:$/, ''), value: text(labelled[3] ?? '') }
      : { label: '', value: text(inner) }
  })
}

/** Label/value pairs, trimmed, empties dropped. Anything unreadable is an empty list. */
export function parseSpecs(raw: unknown): ProductSpec[] {
  const text = propertyText(raw)
  const parsed = (text && parseSpecList(text)) || parseJsonish(text || raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((entry) => {
      const spec = (entry ?? {}) as { label?: unknown; value?: unknown }
      return {
        label: String(spec.label ?? '').trim().slice(0, 120),
        value: String(spec.value ?? '').trim().slice(0, 500),
      }
    })
    .filter((spec) => spec.label || spec.value)
    .slice(0, MAX_SPECS)
}

/** Web addresses only — a gallery entry is rendered as an <img src>. */
export function parseGallery(raw: unknown): string[] {
  const parsed = parseJsonish(raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((url) => String(url ?? '').trim())
    .filter((url) => /^https:\/\/\S+$/i.test(url))
    .slice(0, MAX_GALLERY)
}

/**
 * Description HTML made safe to render with v-html: formatting tags kept,
 * scripts, styles, event handlers and javascript: links removed.
 *
 * Applied when an admin saves AND when the shop serves a product, because
 * descriptions can also be written in Bitrix directly, where nothing of ours
 * runs.
 */
/**
 * The "Detailed Description" property, ready for v-html. HTML is cleaned; plain
 * text typed into Bitrix is escaped and its line breaks become paragraphs.
 */
export function productDescriptionHtml(raw: unknown): string {
  const value = propertyText(raw).trim()
  if (!value) return ''
  if (/<\/?(?:[bipu]|br|[ou]l|li|strong|em|h[1-6])\b/i.test(value)) return sanitizeRichText(value)
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .split(/\n\s*\n/)
    .map((para) => `<p>${para.trim().replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function sanitizeRichText(html: unknown): string {
  if (typeof html !== 'string' || !html.trim()) return ''
  return filterXSS(html, { stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] })
}

/**
 * A plain-text field as typed: trimmed, control characters removed, capped.
 * Not HTML-escaped — Vue escapes on render, and escaping here is what made
 * every save turn "&" into "&amp;", then "&amp;amp;".
 */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  return value.replace(/[\u0000-\u0008\v\f\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
}
