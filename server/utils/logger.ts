// Logger utility for centralized structured logging
// Provides consistent logging across client and server with proper levels

/**
 * A failed Bitrix call's error message carries the full webhook URL, whose
 * path segment after /rest/<user>/ is the credential, and the Bitrix callback
 * URL carries its shared secret as ?t=. Masked here so no call site can leak
 * either into retained function logs.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/\/rest\/(\d+)\/[\w-]+/g, '/rest/$1/<redacted>')
    .replace(/([?&]t=)[^&\s"'\\]+/g, '$1<redacted>')
}

export class Logger {
  private static instance: Logger
  private readonly isServer: boolean
  private readonly isDev: boolean

  private constructor() {
    // Detect if we're on server or client
    this.isServer = typeof window === 'undefined'
    // Check if we're in development mode
    this.isDev = this.isServer ? process.env.NODE_ENV === 'development' : import.meta.env?.DEV || false
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private formatMessage(context: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] ${context}`

    if (!meta) return redactSecrets(`${prefix} ${message}`)

    try {
      const metaStr = JSON.stringify(meta)
      return redactSecrets(`${prefix} ${message} ${metaStr}`)
    } catch (e) {
      return redactSecrets(`${prefix} ${message} ${String(meta)}`)
    }
  }

  debug(context: string, message: string, meta?: Record<string, unknown>): void {
    if (!this.isDev) return
    console.debug(this.formatMessage(context, message, meta))
  }

  info(context: string, message: string, meta?: Record<string, unknown>): void {
    console.info(this.formatMessage(context, message, meta))
  }

  warn(context: string, message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage(context, message, meta))
  }

  error(context: string, message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage(context, message, meta))
  }
}

// Create and export a singleton instance
export const logger = Logger.getInstance()

// Helper functions for easier usage
export function logDebug(context: string, message: string, meta?: Record<string, unknown>) {
  logger.debug(context, message, meta)
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  logger.info(context, message, meta)
}

export function logWarn(context: string, message: string, meta?: Record<string, unknown>) {
  logger.warn(context, message, meta)
}

export function logError(context: string, message: string, meta?: Record<string, unknown>) {
  logger.error(context, message, meta)
}
