// Bitrix CRM API Types

export interface BitrixResponse<T> {
  result?: T
  error?: string | boolean
  error_description?: string
  time?: {
    elapsed: number
  }
}

export interface BitrixLeadResponse {
  result: number | string
  error?: string | boolean
  error_description?: string
}

export interface BitrixContactResponse {
  result: number | string
  error?: string | boolean
  error_description?: string
}

export interface BitrixProductResponse {
  result: {
    ID: number | string
    ACTIVE: string
    NAME: string
    PRICE: string | number
    PROPERTY_102?: any // Cloudinary URL or similar
    PROPERTY_44?: any // Preview picture
    PREVIEW_PICTURE?: any
    DETAIL_PICTURE?: any
    [key: string]: any
  }
  error?: string | boolean
  error_description?: string
}

export interface BitrixProductListResponse {
  result: {
    total?: number
    items: Array<{
      ID: number | string
      ACTIVE: string
      NAME: string
      PRICE: string | number
      PROPERTY_102?: any
      PROPERTY_44?: any
      PREVIEW_PICTURE?: any
      DETAIL_PICTURE?: any
      [key: string]: any
    }>
    next?: number
  }
  error?: string | boolean
  error_description?: string
}

// Bitrix Auth Types
// Bitrix Context Types (moved from bitrixAuth.ts)
// Bitrix Lead (subset of fields returned by crm.lead.list / crm.lead.get)
export interface BitrixLead {
  ID: string
  TITLE: string
  NAME?: string
  LAST_NAME?: string
  EMAIL?: Array<{ VALUE: string; VALUE_TYPE: string }>
  PHONE?: Array<{ VALUE: string; VALUE_TYPE: string }>
  OPPORTUNITY?: string | number
  CURRENCY_ID?: string
  COMMENTS?: string
  ADDRESS?: string
  DATE_CREATE: string
  SOURCE_ID?: string
  STATUS_ID?: string
}

export interface BitrixLeadListResponse {
  result: BitrixLead[]
  next?: number
  total?: number
  error?: string | boolean
  error_description?: string
}

export type SubmissionType = 'order' | 'quote' | 'contact' | 'booking' | 'other'

export type TaggedLead = BitrixLead & { submissionType: SubmissionType }
