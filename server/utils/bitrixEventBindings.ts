import { logger } from './logger'

/**
 * Register this app's product event handlers with Bitrix24.
 *
 * Bitrix does not infer event subscriptions from the local app's handler URL —
 * they must be created explicitly with `event.bind`, and that method is denied
 * to inbound-webhook auth (`WRONG_AUTH_TYPE`). It only works with an OAuth
 * access token, which we only ever hold during the install callback. Nothing
 * in this repo called it before 2026-09-07, so ONCRMPRODUCT* had never fired
 * and the Supabase mirror was populated solely by the daily CRON.
 */
export const PRODUCT_EVENTS = ['ONCRMPRODUCTADD', 'ONCRMPRODUCTUPDATE', 'ONCRMPRODUCTDELETE'] as const

export interface BindResult {
  event: string
  status: 'bound' | 'already' | 'failed'
  detail?: string
}

/**
 * The URL Bitrix will POST events to. Must carry the ?t= handler token when
 * one is configured, otherwise our own guard rejects every event with 403.
 */
export function buildHandlerUrl(baseUrl: string, handlerToken?: string): string {
  const base = `${baseUrl.replace(/\/$/, '')}/api/bitrix/handler`
  return handlerToken ? `${base}?t=${encodeURIComponent(handlerToken)}` : base
}

interface BitrixRestResponse {
  result?: unknown
  error?: string
  error_description?: string
}

export async function bindProductEvents(
  domain: string,
  authToken: string,
  handlerUrl: string,
): Promise<BindResult[]> {
  const results: BindResult[] = []

  for (const eventName of PRODUCT_EVENTS) {
    try {
      const res = await $fetch<BitrixRestResponse>(`https://${domain}/rest/event.bind`, {
        method: 'POST',
        body: { event: eventName, handler: handlerUrl, auth: authToken },
      })

      if (res.error) {
        // Re-installing an app replays the callback; an existing binding is a
        // success for our purposes, not a failure.
        const already = /exist|duplicate/i.test(`${res.error} ${res.error_description ?? ''}`)
        results.push({
          event: eventName,
          status: already ? 'already' : 'failed',
          detail: res.error_description || res.error,
        })
      } else {
        results.push({ event: eventName, status: 'bound' })
      }
    } catch (err) {
      results.push({ event: eventName, status: 'failed', detail: err instanceof Error ? err.message : String(err) })
    }
  }

  const failed = results.filter((r) => r.status === 'failed')
  if (failed.length) {
    logger.error('Bitrix Events', 'Some event bindings failed', { failed })
  } else {
    logger.info('Bitrix Events', 'Product event handlers registered', {
      handlerUrl: handlerUrl.replace(/([?&]t=)[^&]+/, '$1***'),
      results,
    })
  }

  return results
}
