import { logger } from './logger'
import { bitrixFetch } from './bitrixAuth'

/**
 * Message a member of staff in Bitrix: a notification AND a chat message.
 *
 * They are different things and land in different places.
 * `im.notify.personal.add` puts an entry in the bell/Notifications tab;
 * `im.message.add` with the user id as DIALOG_ID opens a real DM that sits in
 * Messenger until it is read. Branch managers were getting only the first and
 * reasonably reporting "no message", because there was none.
 *
 * Both are sent on purpose rather than one as a fallback: everything that
 * calls this is asking a person to act, and a missed prompt looks identical to
 * nothing having happened. Counts as reached if either lands.
 *
 * Never throws.
 */
export async function messageStaff(userId: number, message: string): Promise<boolean> {
  const attempt = async (method: string, body: Record<string, unknown>): Promise<boolean> => {
    try {
      const response = await bitrixFetch<{ result?: number; error?: string; error_description?: string }>(method, {
        method: 'POST',
        body,
      })
      if (response.error) throw new Error(response.error_description || String(response.error))
      return true
    } catch (err) {
      logger.warn('StaffMessage', `${method} failed`, {
        error: err instanceof Error ? err.message : String(err),
        userId,
      })
      return false
    }
  }

  const notified = await attempt('im.notify.personal.add', { USER_ID: userId, MESSAGE: message })
  const messaged = await attempt('im.message.add', { DIALOG_ID: userId, MESSAGE: message })

  return notified || messaged
}
