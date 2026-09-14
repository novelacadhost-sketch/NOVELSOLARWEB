import { serverSupabaseUser } from '#supabase/server'
import { resolveBitrixContactId, cacheProfileName } from '../../utils/bitrixContact'
import { getAuthUserId } from '../../utils/authUserId'
import { bitrixFetch } from '../../utils/bitrixAuth'
import { logger } from '../../utils/logger'

interface CachedProfile {
  data: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: string
  }
  expires: number
}

interface BitrixContact {
  NAME?: string
  LAST_NAME?: string
  ADDRESS?: string
  EMAIL?: { VALUE: string }[]
  PHONE?: { VALUE: string }[]
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  const userId = getAuthUserId(user)

  if (!user || !userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized. Please login.',
    })
  }

  const email = user.email ?? ''

  let contactId: string
  try {
    contactId = await resolveBitrixContactId(userId, email)
  } catch (error) {
    // Authenticated but the CRM is unreachable. Degrade rather than 500 so
    // the header and account page still render; the link resolves on a
    // later request.
    logger.error('PROFILE', 'Could not resolve CRM contact', {
      error: error instanceof Error ? error.message : error,
      userId,
    })
    return { firstName: 'Valued', lastName: 'Customer', email, phone: '', address: '', isTemporary: true }
  }

  const cacheKey = `profile:${contactId}`
  const cachedProfile = (await useStorage('cache').getItem(cacheKey)) as CachedProfile | null
  if (cachedProfile && cachedProfile.expires > Date.now()) {
    return cachedProfile.data
  }

  try {
    const response = await bitrixFetch<{ result?: BitrixContact }>('crm.contact.get', {
      method: 'POST',
      body: { id: contactId },
    })

    const contact = response.result
    if (!contact) {
      throw new Error('Contact not found in CRM')
    }

    const profileData = {
      firstName: contact.NAME || '',
      lastName: contact.LAST_NAME || '',
      email: contact.EMAIL?.[0]?.VALUE || email,
      phone: contact.PHONE?.[0]?.VALUE || '',
      address: contact.ADDRESS || '',
    }

    await useStorage('cache').setItem(cacheKey, {
      data: profileData,
      expires: Date.now() + 5 * 60 * 1000,
    })

    // Keeps the admin Customers list readable without a CRM call per row.
    // Runs at most once per cache window, and never for phone or address —
    // Bitrix stays the only copy of those.
    await cacheProfileName(userId, profileData.firstName, profileData.lastName)

    return profileData
  } catch (error) {
    logger.error('PROFILE', 'Fetch error', { contactId, error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch user profile from CRM',
    })
  }
})
