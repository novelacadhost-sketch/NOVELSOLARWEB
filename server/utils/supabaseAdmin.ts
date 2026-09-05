import { createClient } from '@supabase/supabase-js'

type SupabaseAdminClient = ReturnType<typeof createClient>

let client: SupabaseAdminClient | null = null

export function getSupabaseAdminClient(): SupabaseAdminClient {
  if (client) return client

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: `Supabase admin client not configured (missing ${!url ? 'NUXT_PUBLIC_SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY'}).`,
    })
  }

  client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return client
}
