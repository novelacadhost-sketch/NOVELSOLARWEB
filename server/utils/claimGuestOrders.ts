import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'

/**
 * Attach a customer's earlier guest orders to their account.
 *
 * A guest order is saved with user_id null, so it never shows in the account
 * the customer makes later, even with the same email. This claims those orders
 * once the customer is signed in.
 *
 * ONLY TO A CONFIRMED EMAIL. Checkout accepts any address without proof, so
 * the order's email proves nothing. The account's email does, once Supabase
 * has confirmed it. Claiming for an unconfirmed address would let anyone sign
 * up with a stranger's email and read that stranger's orders: name, phone,
 * address and what they bought. The confirmation is read from GoTrue, never
 * from the session's claims.
 *
 * The other direction is accepted: anyone can type your email at checkout, and
 * that order then shows in your account. That puts their details in front of
 * you, not yours in front of them, and the receipt already went to your inbox.
 *
 * Never throws. A failed claim costs nothing: the orders stay where they were
 * and the next sign-in or page load tries again.
 */

// The layout fetches the profile on every page. Check each user at most once
// per window per instance instead of querying on every navigation.
const RECHECK_MS = 10 * 60_000
const lastChecked = new Map<string, number>()

/** LIKE treats % and _ as wildcards, and an email can contain _. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export async function claimGuestOrders(userId: string, email: string | null | undefined): Promise<number> {
  const address = String(email ?? '').trim()
  if (!userId || !address) return 0

  const checkedAt = lastChecked.get(userId)
  if (checkedAt && Date.now() - checkedAt < RECHECK_MS) return 0
  lastChecked.set(userId, Date.now())

  try {
    const supabase = getSupabaseAdminClient()

    // Emails are case-insensitive but checkout stores what the customer typed.
    // PostgREST reads * as a wildcard and has no escape for it, so an address
    // containing one is matched exactly instead.
    const unclaimed = supabase.from('orders').select('id').is('user_id', null)
    const { data, error } = await (address.includes('*')
      ? unclaimed.eq('customer_email', address)
      : unclaimed.ilike('customer_email', escapeLike(address)))
    if (error) throw error

    const ids = ((data ?? []) as { id: string }[]).map((row) => row.id)
    if (ids.length === 0) return 0

    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
    if (authError) throw authError
    const authUser = authData.user
    if (!authUser?.email_confirmed_at || authUser.email?.toLowerCase() !== address.toLowerCase()) {
      logger.info('ClaimOrders', 'Guest orders match an unconfirmed email; not claimed', { userId, orders: ids.length })
      return 0
    }

    // user_id is null in the filter again so an order claimed by a parallel
    // request is not moved a second time.
    const { data: claimed, error: updateError } = await supabase
      .from('orders')
      .update({ user_id: userId } as never)
      .in('id', ids)
      .is('user_id', null)
      .select('id')
    if (updateError) throw updateError

    const count = (claimed ?? []).length
    logger.info('ClaimOrders', 'Guest orders attached to account', { userId, count })
    return count
  } catch (error) {
    // Let the next request retry rather than waiting out the window.
    lastChecked.delete(userId)
    logger.warn('ClaimOrders', 'Could not claim guest orders', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}
