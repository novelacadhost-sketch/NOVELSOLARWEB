// filepath: server/api/log-error.post.ts
import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { logger } from '../utils/logger'

interface ErrorLogEntry {
  message: string
  stack?: string
  context?: Record<string, unknown>
  url?: string
  timestamp: string
  userAgent?: string
  level: 'error' | 'warning' | 'info'
}

export default defineEventHandler(async (event) => {
  // Browser callers are gated by the global CSRF middleware (2.csrf.ts), which
  // requires a same-origin cookie + matching header on POSTs. No pre-shared
  // token is needed: a "secret" that has to ship to the browser would be
  // public anyway.
  const webhookUrl = process.env.ERROR_LOGGING_WEBHOOK_URL
  const authHeader = process.env.ERROR_LOGGING_WEBHOOK_AUTH_HEADER
  const webhookToken = process.env.ERROR_LOGGING_WEBHOOK_TOKEN
  const appVersion = process.env.npm_package_version || process.env.NUXT_PUBLIC_APP_VERSION || '1.0.0'

  try {
    const body = await readBody<ErrorLogEntry>(event)

    if (!body?.message || !body?.timestamp || !body?.level) {
      throw createError({
        statusCode: 400,
        message: 'Invalid error log entry',
      })
    }

    const logEntry = {
      ...body,
      receivedAt: new Date().toISOString(),
      serverVersion: appVersion,
      request: {
        path: event.path,
        ipAddress: getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip'),
        userAgent: body.userAgent || getHeader(event, 'user-agent'),
      },
    }

    // Logged in production too: with no forwarding webhook configured, this was
    // the only record of a browser-side error, and it was being dropped.
    logger.warn('ErrorLog', 'Browser error', logEntry)

    let forwarded = false

    if (webhookUrl) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        if (authHeader && webhookToken) {
          headers[authHeader] = webhookToken
        }

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(logEntry),
        })

        forwarded = response.ok

        if (!response.ok) {
          logger.error('ErrorLog', 'Webhook forwarding failed', {
            status: response.status,
            statusText: response.statusText,
          })
        }
      } catch (forwardError) {
        logger.error('ErrorLog', 'Failed to forward error log', { error: forwardError })
      }
    }

    return {
      success: true,
      id: `err_${Date.now()}`,
      forwarded,
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    logger.error('ErrorLog', 'Failed to process error log', { error })

    throw createError({
      statusCode: 500,
      message: 'Failed to log error',
    })
  }
})
