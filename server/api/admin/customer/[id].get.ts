import { serverSupabaseServiceRole } from '#supabase/server'
import { logger } from '../../../utils/logger'

// Columns are listed rather than select('*') so onboarding_token and
// token_expires_at stay on the server — they are a dealer's account-takeover
// credential and nothing on this page shows them.
const CUSTOMER_COLUMNS = 'user_id, email, first_name, last_name, phone, role, dealer_status, created_at'

interface CustomerProfile {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: string
  dealer_status: string
  created_at: string
}

interface CustomerOrder {
  id: string
  // order_status enum, NOT NULL in the schema.
  status: string
  // The column is `total`. The page asked for `total_amount`, which does not
  // exist, so every order rendered as N0.
  total: number
  created_at: string
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Customer ID is required' })
  }

  const supabase = await serverSupabaseServiceRole(event)

  try {
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(CUSTOMER_COLUMNS)
      .eq('user_id', id)
      .single<CustomerProfile>()

    if (profileError || !profile) {
      throw createError({ statusCode: 404, statusMessage: 'Customer not found' })
    }

    // Fetch orders (Note: Currently NovelSolar checkout sends orders to Bitrix CRM.
    // This queries the Supabase orders table in case future webhooks populate it).
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, status, total, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .returns<CustomerOrder[]>()

    if (ordersError) {
      logger.warn('Admin Customer API', 'Failed to fetch orders for customer', { error: ordersError })
    }

    return {
      success: true,
      customer: { ...profile, id: profile.user_id },
      orders: orders ?? [],
    }
  } catch (err: unknown) {
    const error = err as { statusCode?: number; statusMessage?: string; message?: string }
    logger.error('Admin Customer API', 'Failed to fetch customer details', { error })
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
    })
  }
})
