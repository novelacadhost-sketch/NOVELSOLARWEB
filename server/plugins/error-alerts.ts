import type { H3Event } from 'h3'
import { messageStaff } from '../utils/staffMessage'
import { logger } from '../utils/logger'
import { getSite } from '../utils/site'

/**
 * Tells a person when the server fails, instead of leaving it in Vercel's logs
 * (kept about an hour on this plan) for someone to happen to look.
 *
 * Every 5xx, and every unhandled throw, becomes a Bitrix message to the users
 * in ERROR_ALERT_BITRIX_USER_IDS (comma-separated; default 12, Davies). 4xx are
 * the caller's problem and are not sent.
 *
 * The same error is sent at most once per 30 minutes per server instance, with
 * a count of the repeats held back, so an outage is one message, not hundreds.
 */

const WINDOW_MS = 30 * 60_000
const recent = new Map<string, { sentAt: number; suppressed: number }>()

const recipients = (process.env.ERROR_ALERT_BITRIX_USER_IDS || '12')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0)

/** Strip anything that would be a credential if it reached a chat. */
function redact(text: string): string {
  return text
    .replace(/\/rest\/\d+\/[^/\s"]+\//g, '/rest/***/')
    .replace(/(token|secret|key|password|auth)=([^&\s"]+)/gi, '$1=***')
    .replace(/Bearer\s+[\w.-]+/gi, 'Bearer ***')
}

/** Group by route shape, so /shop/123 and /shop/456 count as one error. */
function routeShape(path: string): string {
  return path.split('?')[0]!.replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, '/:uuid')
}

export default defineNitroPlugin((nitro) => {
  if (!recipients.length || process.env.NODE_ENV !== 'production') return

  nitro.hooks.hook('error', (error, context) => {
    const event = context.event as H3Event | undefined
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status < 500) return

    const path = event?.path ?? '(no request)'
    const message = redact(String((error as Error).message || error).slice(0, 300))
    const key = `${status} ${event?.method ?? ''} ${routeShape(path)} ${message.slice(0, 120)}`

    const now = Date.now()
    const seen = recent.get(key)
    if (seen && now - seen.sentAt < WINDOW_MS) {
      seen.suppressed++
      return
    }
    const heldBack = seen?.suppressed ?? 0
    recent.set(key, { sentAt: now, suppressed: 0 })
    if (recent.size > 500) recent.delete(recent.keys().next().value!)

    let siteName = ''
    try {
      if (event) siteName = getSite(event).name
    } catch {
      // The alert matters more than the label.
    }

    const cause = (error as { cause?: unknown }).cause
    const text = [
      `[B]Website error ${status}[/B]${siteName ? ` on ${siteName}` : ''}`,
      `${event?.method ?? ''} ${redact(path.split('?')[0]!)}`,
      message,
      cause instanceof Error ? redact(`Cause: ${cause.message}`).slice(0, 300) : '',
      heldBack ? `(${heldBack} more of this error in the last 30 min were not sent separately.)` : '',
      `Time: ${new Date(now).toISOString()}`,
    ]
      .filter(Boolean)
      .join('\n')

    const send = Promise.all(recipients.map((id) => messageStaff(id, text))).catch((err) => {
      logger.warn('ErrorAlerts', 'Could not send alert', { error: err instanceof Error ? err.message : String(err) })
    })
    // Let the response go out first; on Vercel this keeps the function alive
    // until the message is sent.
    if (event && typeof event.waitUntil === 'function') event.waitUntil(send)
  })
})
