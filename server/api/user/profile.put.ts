import { serverSupabaseUser } from '#supabase/server'
import { resolveBitrixContactId, cacheProfileName } from '../../utils/bitrixContact'
import { getAuthUserId } from '../../utils/authUserId'
import { bitrixFetch } from '../../utils/bitrixAuth'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  const userId = getAuthUserId(user)

  if (!user || !userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const { firstName, lastName, phone, address } = body

  const contactId = await resolveBitrixContactId(userId, user.email ?? '')

  try {
    await bitrixFetch('crm.contact.update', {
      method: 'POST',
      body: {
        id: contactId,
        fields: {
          NAME: firstName,
          LAST_NAME: lastName,
          PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
          ADDRESS: address,
        },
      },
    })

    // The GET caches the CRM contact for 5 minutes; without this the page
    // re-reads its own pre-edit data straight after saving.
    await useStorage('cache').removeItem(`profile:${contactId}`)
    await cacheProfileName(userId, firstName ?? '', lastName ?? '')

    return {
      success: true,
      message: 'Profile updated successfully',
      contactId,
    }
  } catch (error: unknown) {
    const err = error as { data?: unknown }
    logger.error('Profile Update', 'Bitrix update error', { error: err.data || error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to synchronize profile with CRM',
    })
  }
})
