import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Find a Supabase Auth user by email across every page of users.
 *
 * `auth.admin.listUsers()` with no arguments returns page 1 only (50 users).
 * The admin password reset, create-admin and the admin list all called it that
 * way, so once customer accounts pushed an admin past the first 50, that admin
 * would silently get no reset email and appear as "unknown" in the list.
 */
export async function findAuthUserByEmail(supabase: SupabaseClient, email: string) {
  const wanted = email.trim().toLowerCase()
  const perPage = 1000
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users ?? []
    const match = users.find((user) => user.email?.toLowerCase() === wanted)
    if (match) return match
    if (users.length < perPage) return null
  }
  return null
}
