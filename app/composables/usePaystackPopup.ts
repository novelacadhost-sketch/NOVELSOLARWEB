/**
 * Paystack inline popup.
 *
 * The customer pays in an overlay with the site still behind it, instead of
 * being sent off to checkout.paystack.com and back.
 *
 * IT RESUMES A TRANSACTION, it never calls setup() with an amount. The
 * transaction was opened by /api/checkout with the total resolved from Bitrix,
 * and the access code points at that fixed amount — so nothing here can change
 * what is charged. Passing an amount from the browser would hand the customer
 * their own price.
 *
 * Nothing here decides whether payment succeeded either. On success the
 * customer goes to our own callback endpoint, which asks Paystack directly;
 * the webhook usually settles the order before they arrive.
 */

const SCRIPT_URL = 'https://js.paystack.co/v2/inline.js'

interface PaystackV2 {
  resumeTransaction: (
    accessCode: string,
    options?: {
      onSuccess?: (response: { reference: string }) => void
      onCancel?: () => void
      onError?: (error: unknown) => void
    },
  ) => void
}

declare global {
  interface Window {
    PaystackPop?: new () => PaystackV2
  }
}

let scriptPromise: Promise<boolean> | null = null

/**
 * Resolves false rather than throwing when the script cannot load — an ad
 * blocker or a bad network is a reason to fall back to the redirect, not to
 * strand someone who is trying to pay.
 */
function loadPaystackScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.PaystackPop) return Promise.resolve(true)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.PaystackPop)))
      existing.addEventListener('error', () => resolve(false))
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve(Boolean(window.PaystackPop))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return scriptPromise
}

export interface PaystackPopupArgs {
  accessCode: string
  reference: string
  /** Used when the popup cannot open at all. */
  fallbackUrl: string
  onCancel?: () => void
}

export function usePaystackPopup() {
  /**
   * Opens the popup, or navigates to the hosted page if it cannot open.
   * Returns false only when the customer dismissed it, so the caller knows to
   * leave them on the checkout page with their order intact.
   */
  const payWithPopup = async (args: PaystackPopupArgs): Promise<boolean> => {
    const ready = await loadPaystackScript()

    if (!ready || !window.PaystackPop) {
      window.location.href = args.fallbackUrl
      return true
    }

    return new Promise<boolean>((resolve) => {
      const done = () => {
        // Our own endpoint, not a client-side "paid" assumption: it verifies
        // with Paystack and redirects to /thank-you with the real outcome.
        window.location.href = `/api/payments/paystack/callback?reference=${encodeURIComponent(args.reference)}`
        resolve(true)
      }

      try {
        new window.PaystackPop!().resumeTransaction(args.accessCode, {
          onSuccess: done,
          onCancel: () => {
            args.onCancel?.()
            resolve(false)
          },
          // An error inside the widget is not a failed payment — one may still
          // have gone through — so this takes the same verified route out.
          onError: done,
        })
      } catch {
        window.location.href = args.fallbackUrl
        resolve(true)
      }
    })
  }

  return { payWithPopup }
}
