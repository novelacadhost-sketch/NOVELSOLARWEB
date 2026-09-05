import { defineTask } from 'nitropack/runtime'
import { syncAllProducts } from '../utils/syncAllProducts'

// Kept for long-running server deployments and local `nuxi task run`. On
// Vercel this task is never registered, so /api/admin/trigger-sync calls
// syncAllProducts() directly instead of going through runTask().
export default defineTask({
  meta: {
    name: 'sync:products',
    description: 'Sync active products from Bitrix CRM to Supabase mirror',
  },
  async run() {
    return { result: await syncAllProducts() }
  },
})
