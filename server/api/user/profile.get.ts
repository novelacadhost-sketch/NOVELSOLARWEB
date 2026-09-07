import { getUserSession } from '../../utils/userSession'
import { logger } from '../../utils/logger'

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabaseUser = await serverSupabaseUser(event)
    if (supabaseUser) {
      const supabase = await serverSupabaseClient(event)
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, email, phone')
        .eq('id', getAuthUserId(supabaseUser) ?? '')
        .single()

      return {
        firstName: profile?.company_name || 'Dealer',
        lastName: '',
        email: profile?.email || supabaseUser.email,
        phone: profile?.phone || '',
        address: '',
        isDealer: true,
      }
    }
  } catch (error) {
    logger.warn('PROFILE', 'Supabase user check failed, falling back to Bitrix', { error })
  }

  const config = useRuntimeConfig()
  const bitrixUrl = config.bitrixWebhookUrl
  const authToken = getCookie(event, 'auth_token')
  const userSession = await getUserSession(authToken)

  if (!userSession) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized. Please login.',
    })
  }
  const contactId = userSession.contactId

  // Handle local/temporary IDs (if Bitrix was down during login)
  if (contactId.startsWith('temp_') || contactId.startsWith('local_')) {
    return {
      firstName: 'Valued',
      lastName: 'Customer',
      email: '',
      phone: '',
      address: '',
      isTemporary: true,
    }
  }

  if (!bitrixUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CRM Configuration missing',
    })
  }

  const normalizedBitrixUrl = bitrixUrl.endsWith('/') ? bitrixUrl : `${bitrixUrl}/`

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

  // Use storage for short-term caching (5 minutes)
  const cacheKey = `profile:${contactId}`
  const cachedProfile = (await useStorage('cache').getItem(cacheKey)) as CachedProfile | null
  if (cachedProfile && cachedProfile.expires > Date.now()) {
    return cachedProfile.data
  }

  try {
    const response = await $fetch<{ result: BitrixContact }>(`${normalizedBitrixUrl}crm.contact.get`, {
      method: 'POST',
      body: { id: contactId },
    })

    const contact = response.result
    if (!contact) {
      throw new Error('Contact not found in CRM')
    }

    // Extract email and phone from multi-fields
    const email = contact.EMAIL?.[0]?.VALUE || ''
    const phone = contact.PHONE?.[0]?.VALUE || ''

    const profileData = {
      firstName: contact.NAME || '',
      lastName: contact.LAST_NAME || '',
      email: email,
      phone: phone,
      address: contact.ADDRESS || '',
    }

    // Cache the profile data
    await useStorage('cache').setItem(cacheKey, {
      data: profileData,
      expires: Date.now() + 5 * 60 * 1000,
    })

    return profileData
  } catch (error) {
    logger.error('PROFILE', 'Fetch error', { contactId, error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch user profile from CRM',
    })
  }
})
