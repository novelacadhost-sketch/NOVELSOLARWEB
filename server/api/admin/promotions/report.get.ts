import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'

/**
 * GET /api/admin/promotions/report?from=2026-10-01&to=2026-10-31
 *
 * Sales credited to each staff code over a period, from the order records.
 *
 * WHAT COUNTS. A Paystack order counts once it is paid (status confirmed); one
 * left pending is a card form someone abandoned and is reported separately as
 * unpaid, never as a sale. Pay-at-store orders are never marked paid in this
 * database — they are settled at the counter and in Bitrix — so they are shown
 * as their own column rather than mixed in with money already received.
 * Cancelled and failed orders are left out.
 */

interface OrderRow {
  staff_bitrix_id: number
  staff_code: string | null
  status: string
  payment_method: string | null
  total: number | string
  discount_amount: number | string
}

interface StaffTotals {
  staffBitrixId: number
  code: string | null
  name: string | null
  paidOnline: { orders: number; value: number }
  payAtStore: { orders: number; value: number }
  unpaid: { orders: number; value: number }
  discountGiven: number
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const PAGE = 1000

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const from = typeof query.from === 'string' && DAY.test(query.from) ? query.from : null
  const to = typeof query.to === 'string' && DAY.test(query.to) ? query.to : null
  if (!from || !to || from > to) {
    throw createError({ statusCode: 400, statusMessage: 'Give a valid from and to date (YYYY-MM-DD).' })
  }

  const supabase = getSupabaseAdminClient()
  // Lagos is UTC+1 all year, so the day boundaries are the business's own.
  const fromIso = `${from}T00:00:00+01:00`
  const toIso = `${to}T23:59:59.999+01:00`

  const orders: OrderRow[] = []
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await supabase
      .from('orders')
      .select('staff_bitrix_id, staff_code, status, payment_method, total, discount_amount')
      .not('staff_bitrix_id', 'is', null)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at')
      .range(start, start + PAGE - 1)
    if (error) throw createError({ statusCode: 500, statusMessage: 'Could not read the orders.' })
    const page = (data ?? []) as OrderRow[]
    orders.push(...page)
    if (page.length < PAGE) break
  }

  const ids = [...new Set(orders.map((o) => o.staff_bitrix_id))]
  const names = new Map<number, { code: string; name: string }>()
  if (ids.length) {
    const { data } = await supabase.from('staff_codes').select('bitrix_user_id, code, first_name, last_name').in('bitrix_user_id', ids)
    for (const row of (data ?? []) as { bitrix_user_id: number; code: string; first_name: string; last_name: string }[]) {
      names.set(row.bitrix_user_id, { code: row.code, name: `${row.first_name} ${row.last_name}`.trim() })
    }
  }

  const byStaff = new Map<number, StaffTotals>()
  for (const order of orders) {
    if (order.status === 'cancelled' || order.status === 'failed') continue

    let entry = byStaff.get(order.staff_bitrix_id)
    if (!entry) {
      const known = names.get(order.staff_bitrix_id)
      entry = {
        staffBitrixId: order.staff_bitrix_id,
        code: known?.code ?? order.staff_code,
        name: known?.name ?? null,
        paidOnline: { orders: 0, value: 0 },
        payAtStore: { orders: 0, value: 0 },
        unpaid: { orders: 0, value: 0 },
        discountGiven: 0,
      }
      byStaff.set(order.staff_bitrix_id, entry)
    }

    const value = Number(order.total) || 0
    const isPaystack = order.payment_method === 'paystack'
    const bucket = isPaystack ? (order.status === 'confirmed' ? entry.paidOnline : entry.unpaid) : entry.payAtStore
    bucket.orders++
    bucket.value += value

    // Only on orders that are real sales; an abandoned card form gave nothing away.
    if (!(isPaystack && order.status !== 'confirmed')) entry.discountGiven += Number(order.discount_amount) || 0
  }

  const rows = [...byStaff.values()].sort(
    (a, b) => b.paidOnline.value + b.payAtStore.value - (a.paidOnline.value + a.payAtStore.value),
  )

  return { from, to, rows }
})
