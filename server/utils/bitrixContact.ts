import { logger } from './logger'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { bitrixFetch } from './bitrixAuth'

/**
 * Resolves the Bitrix24 CRM contact that belongs to a Supabase user.
 *
 * This replaced the `user_sessions` table and the `auth_token` cookie
 * (removed 2026-09-14). That pair stored the same fact — which CRM contact a
 * signed-in customer is — in a 7-day session row keyed by an opaque token,
 * even though `profiles.bitrix_contact_id` already existed for exactly this
 * and was read by nothing. The link is a permanent property of the user, not
 * of a session, so it lives on the profile and is keyed by `user_id`.
 *
 * `profiles` rows were never created for retail customers before this: the
 * only writers were the dealer approve/reject endpoints. That is why the
 * admin Customers list only ever showed dealers.
 */

interface ProfileContactRow {
  bitrix_contact_id: string | null
}

interface ProfileInsert {
  user_id: string
  email: string
  bitrix_contact_id: string
}

interface ProfileNameUpdate {
  first_name: string
  last_name: string
}

interface ContactDetails {
  firstName?: string
  lastName?: string
  phone?: string
}

/**
 * Exported because an order is filed as a Deal, and a Deal carries no name,
 * email or phone of its own — those live on the linked contact. Guest
 * checkouts have no Supabase user, so they cannot go through
 * `resolveBitrixContactId()` and resolve by email alone.
 *
 * `details` only shapes the contact when one is created. An existing contact
 * is never overwritten: the CRM copy is the one sales staff maintain, and a
 * checkout form should not be able to rename a customer or clear their phone.
 */
export async function findOrCreateBitrixContact(email: string, details: ContactDetails = {}): Promise<string> {
  const search = await bitrixFetch<{ result?: { ID: string }[] }>('crm.contact.list', {
    method: 'POST',
    body: {
      filter: { EMAIL: email },
      select: ['ID'],
    },
  })

  const found = search.result?.[0]?.ID
  if (found) return String(found)

  const fields: Record<string, unknown> = {
    NAME: details.firstName || email.split('@')[0],
    EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
    TYPE_ID: 'CLIENT',
    SOURCE_ID: 'WEB',
  }
  if (details.lastName) fields.LAST_NAME = details.lastName
  if (details.phone) fields.PHONE = [{ VALUE: details.phone, VALUE_TYPE: 'WORK' }]

  const created = await bitrixFetch<{ result?: string | number }>('crm.contact.add', {
    method: 'POST',
    body: { fields },
  })

  if (!created.result) throw new Error('crm.contact.add returned no contact id')
  return String(created.result)
}

/**
 * Returns the CRM contact id for this user, creating the contact and the
 * profile row on first sign-in. Throws if Bitrix is unreachable — callers
 * decide whether that is fatal, since the next request retries cleanly.
 */
export async function resolveBitrixContactId(userId: string, email: string): Promise<string> {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('bitrix_contact_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    logger.warn('BitrixContact', 'Profile lookup failed; will resolve from CRM', { error: error.message })
  }

  const existing = (data as ProfileContactRow | null)?.bitrix_contact_id
  if (existing) return existing

  const contactId = await findOrCreateBitrixContact(email)

  // Update when the row already exists rather than upserting the whole
  // payload: an approved dealer has a profile here, and its `role`,
  // `dealer_status` and `email` must survive a customer-side write.
  const write = data
    ? supabase
        .from('profiles')
        .update({ bitrix_contact_id: contactId } as never)
        .eq('user_id', userId)
    : supabase.from('profiles').insert({ user_id: userId, email, bitrix_contact_id: contactId } as ProfileInsert as never)

  const { error: writeError } = await write
  if (writeError) {
    // Not fatal: the contact exists in the CRM, so the next request resolves
    // it again by email. Losing the cache costs a lookup, not correctness.
    logger.error('BitrixContact', 'Failed to persist contact link', { error: writeError.message, userId })
  }

  return contactId
}

/**
 * Display cache for the admin Customers list, which reads names out of
 * `profiles` rather than calling the CRM per row. Phone and address are
 * deliberately not mirrored — Bitrix stays the only copy of those.
 */
export async function cacheProfileName(userId: string, firstName: string, lastName: string): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName } as ProfileNameUpdate as never)
      .eq('user_id', userId)

    if (error) throw error
  } catch (err) {
    logger.warn('BitrixContact', 'Failed to cache profile name', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    })
  }
}
