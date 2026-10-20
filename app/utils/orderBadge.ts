interface BadgeInput {
  status: { label: string; tone: string }
  progress?: { label: string; cancelled: boolean }
}

/**
 * The one-word state shown on an order. A payment problem (awaiting payment,
 * payment not completed, cancelled) wins over where the order is; otherwise the
 * fulfilment step staff set.
 */
export function orderBadge(order: BadgeInput): { label: string; tone: string } {
  if (!order.progress || order.progress.cancelled || order.status.tone === 'bad' || order.status.tone === 'warn') {
    return order.status
  }
  return { label: order.progress.label, tone: 'info' }
}
