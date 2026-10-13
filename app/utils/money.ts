/** ₦1,234,500 — whole naira, which is what orders and Paystack charge. */
export function formatNaira(value: number | string | null | undefined): string {
  const n = Number(value)
  return `₦${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString('en-NG')}`
}

/** 12 Oct 2026, 14:05 in Lagos time, whatever the viewer's clock says. */
export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  })
}

export const STATUS_TONE_CLASSES: Record<string, string> = {
  ok: 'bg-green-50 text-green-700 border-green-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  bad: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
}
