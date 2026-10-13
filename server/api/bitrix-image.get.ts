import { logger } from '../utils/logger'
import { bitrixFetch } from '../utils/bitrixAuth'

/**
 * Serves a Bitrix product picture that only exists behind portal auth.
 *
 * `url` is a Bitrix file link, usually the relative showUrl
 * (`/bitrix/components/bitrix/crm.product.file/download.php?productId=…&fieldName=…&fileId=…`),
 * or the admin search's `crm_product_show.php?ID=…&fieldName=…`, which has no fileId.
 *
 * `catalog.product.download` requires the fileId — without it Bitrix answers
 * "Required fields: fileId", which is why this returned 500 for every image.
 */

const FIELD_NAMES: Record<string, string> = {
  DETAIL_PICTURE: 'detailPicture',
  PREVIEW_PICTURE: 'previewPicture',
}

/** DETAIL_PICTURE -> detailPicture, PROPERTY_44 -> property44. */
function restFieldName(raw: string): string | null {
  if (FIELD_NAMES[raw]) return FIELD_NAMES[raw]!
  const property = /^PROPERTY_(\d+)$/.exec(raw)
  return property ? `property${property[1]}` : null
}

/** The file id currently held in that field, for links that do not carry one. */
async function lookupFileId(productId: string, rawFieldName: string): Promise<string | null> {
  const response = await bitrixFetch<{ result?: Record<string, unknown> }>(`crm.product.get?id=${productId}`)
  const value = response.result?.[rawFieldName]
  const first = Array.isArray(value) ? (value[0] as { value?: unknown } | undefined)?.value : value
  const id = (first as { id?: unknown } | null | undefined)?.id
  return id != null && /^\d+$/.test(String(id)) ? String(id) : null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const url = getQuery(event).url
  if (typeof url !== 'string' || !url) {
    throw createError({ statusCode: 400, statusMessage: 'Missing url parameter' })
  }

  let params: URLSearchParams
  try {
    // Bitrix hands these out as portal-relative paths.
    params = new URL(url, 'https://portal.invalid').searchParams
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Bitrix image URL' })
  }

  const productId = params.get('productId') || params.get('ID')
  const rawFieldName = params.get('fieldName') || ''
  const fieldName = restFieldName(rawFieldName)
  if (!productId || !/^\d+$/.test(productId) || !fieldName) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Bitrix image URL' })
  }

  const webhookUrl = config.bitrixWebhookUrl
  if (!webhookUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Server configuration error: Webhook missing' })
  }
  const formattedWebhookUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`

  try {
    let fileId = params.get('fileId')
    if (!fileId || !/^\d+$/.test(fileId)) fileId = await lookupFileId(productId, rawFieldName)
    if (!fileId) {
      throw createError({ statusCode: 404, statusMessage: 'Image not found' })
    }

    const response = await $fetch.raw<ArrayBuffer>(`${formattedWebhookUrl}catalog.product.download`, {
      method: 'POST',
      body: { fields: { productId, fieldName, fileId } },
      responseType: 'arrayBuffer',
      ignoreResponseError: true,
    })

    const type = response.headers.get('content-type') || ''
    if (!response.ok || !type.startsWith('image/')) {
      // Bitrix explains a refusal in a small JSON body: "Product file wrong" for
      // a file that is not on this product/field, and so on. That is a missing
      // image, not a server fault.
      const detail = response._data ? Buffer.from(response._data).toString('utf8', 0, 200) : ''
      logger.warn('BitrixImage', 'Bitrix refused the image', { productId, fieldName, fileId, status: response.status, detail })
      throw createError({ statusCode: 404, statusMessage: 'Image not found' })
    }

    setHeaders(event, {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=604800, immutable',
    })
    return Buffer.from(response._data!)
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 404) throw error
    const err = error as { data?: unknown; message?: string }
    // A failed fetch names the webhook URL, whose path is the credential.
    const message = String(err.message || '').replace(/\/rest\/\d+\/[^/\s"]+\//g, '/rest/***/')
    logger.error('BitrixImage', 'REST image download error', { productId, fieldName, error: message })
    throw createError({ statusCode: 502, statusMessage: 'Failed to download image from Bitrix' })
  }
})
