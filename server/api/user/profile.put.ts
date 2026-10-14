import { z } from 'zod'
import { serverSupabaseUser } from '#supabase/server'
import { resolveBitrixContactId, cacheProfileName } from '../../utils/bitrixContact'
import { getAuthUserId } from '../../utils/authUserId'
import { bitrixFetch } from '../../utils/bitrixAuth'
import { logger } from '../../utils/logger'

// Bounds match what the account page asks for. Anything else (an object, a
// 10 MB string) was passed straight to the CRM contact.
const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().default(''),
  phone: z.string().trim().min(7).max(30),
  address: z.string().trim().max(500).optional().default(''),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  const userId = getAuthUserId(user)

  if (!user || !userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const parsed = profileSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    const labels: Record<string, string> = {
      firstName: 'first name',
      lastName: 'last name',
      phone: 'phone number',
      address: 'address',
    }
    const field = String(parsed.error.issues[0]?.path[0] ?? '')
    throw createError({ statusCode: 400, statusMessage: `Please check your ${labels[field] ?? 'details'}.` })
  }
  const { firstName, lastName, phone, address } = parsed.data

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
