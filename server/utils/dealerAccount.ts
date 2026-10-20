import { getSupabaseAdminClient } from './supabaseAdmin'
import { logger } from './logger'

export interface DealerAccount {
  /** Same rule as the dealer price gate: role 'dealer' AND status 'approved'. */
  approved: boolean
  status: 'none' | 'pending' | 'approved' | 'rejected'
  businessName: string | null
  approvedAt: string | null
}

/**
 * What the account page shows a dealer. Null for anyone who is not, and never
 * was, a dealer. Read fresh on every call (not from the profile cache) so an
 * approval or suspension shows up straight away.
 */
export async function getDealerAccount(userId: string): Promise<DealerAccount | null> {
  const supabase = getSupabaseAdminClient()
  try {
    const { data: profile } = (await supabase
      .from('profiles')
      .select('role, dealer_status')
      .eq('user_id', userId)
      .maybeSingle()) as { data: { role: string | null; dealer_status: DealerAccount['status'] | null } | null }

    const { data: application } = (await supabase
      .from('dealer_applications')
      .select('business_name, status, approved_at')
      .eq('registered_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { business_name: string | null; status: string; approved_at: string | null } | null }

    if (profile?.role !== 'dealer' && !application) return null

    const status = profile?.dealer_status ?? 'none'
    return {
      approved: profile?.role === 'dealer' && status === 'approved',
      status,
      businessName: application?.business_name ?? null,
      approvedAt: application?.approved_at ?? null,
    }
  } catch (error) {
    logger.warn('PROFILE', 'Could not read dealer account', { userId, error })
    return null
  }
}
