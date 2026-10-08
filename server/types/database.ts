// Supabase/Database Types

export interface AuthSession {
  id: string
  auth_id: string
  domain: string
  created_at: string
  updated_at: string
}

export interface AdminUser {
  id: string
  email: string
  role: 'admin' | 'super_admin'
  created_at: string
  updated_at: string
  last_sign_in_at?: string
}

// Failed submission types (for local storage)
export interface FailedContact {
  id: string
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
  timestamp: string
}

export interface FailedBooking {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  preferredDate: string
  serviceType: string
  details?: string
  timestamp: string
}

export interface FailedQuote {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  projectType: string
  details?: string
  timestamp: string
}

export interface FailedOrder {
  orderId: string
  customer: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    address?: string
    note?: string
  }
  cart: Array<{
    id?: string | number
    ID?: string | number
    name?: string
    price?: number
    discount?: number
    quantity: number
  }>
  total: number
  branch?: {
    address?: string
    state?: string
    name?: string
  }
  paymentMethod?: string
  /** Absent on orders queued before staff codes existed. */
  referral?: {
    code: string
    staffBitrixId: number
    discountPercent: number
    discountAmount: number
    subtotal: number
    noDiscountReason?: 'dealer' | 'disabled' | 'below_minimum' | null
    cappedAt?: number | null
  } | null
  timestamp: string
  status: string
}

// Email template types
export interface OrderProductItem {
  name: string
  quantity: number
  price: number
  image: string
}

export interface OrderDetails {
  orderNumber: string
  orderDate: string
  paymentMethod: string
  branchName: string
  subtotal: number
  shipping: number
  /** A staff-code discount, shown as its own line between subtotal and total. */
  discount?: { label: string; amount: number } | null
  total: number
  products: OrderProductItem[]
}

export interface ServiceBookingDetails {
  customerName: string
  serviceName: string
  requestedDate: string
  address: string
  price?: number | string
}
