import {
  configureCloudinary,
  uploadBufferToCloudinary,
  validateGalleryFiles,
  validateImageFile,
  type UploadedImageFile,
} from '../../utils/productMedia'
import type { BitrixResponse } from '../../types/bitrix'
import { logger } from '../../utils/logger'
import { setProductHidden } from '../../utils/productVisibility'
import { cleanText, parseGallery, parseSpecs, sanitizeRichText } from '../../utils/productFields'

export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, 'content-type') || ''
  const isMultipart = contentType.includes('multipart/form-data')
  const config = useRuntimeConfig()

  let productId: string | null = null
  let productName: string | null = null
  let productPrice: string | number | null = null
  let productDealerPrice: string | number | null = null
  let productDescription: string | null = null
  let productSpecs: unknown = null
  let productDisabled = false
  let mainImageUrl: string | null = null
  let galleryUrls: string[] = []
  let removeMainImage = false
  let mainImageFile: UploadedImageFile | undefined = undefined
  let newGalleryFiles: UploadedImageFile[] = []

  if (isMultipart) {
    configureCloudinary()
    const formData = await readMultipartFormData(event)

    if (!formData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid form data',
      })
    }

    // Read as typed. These used to go through sanitizePayload(), which
    // HTML-escaped the specs and gallery JSON before it was parsed — so every
    // save wiped both — and escaped the name again on every save. Each field
    // is now cleaned for what it is; see server/utils/productFields.ts.
    const getField = (name: string): string | null => {
      const field = formData.find((entry) => entry.name === name)
      return field ? field.data.toString() : null
    }

    productId = getField('productId')
    productName = cleanText(getField('productName'), 255)
    productPrice = getField('productPrice')
    productDealerPrice = getField('productDealerPrice')
    productDescription = sanitizeRichText(getField('productDescription'))
    productDisabled = getField('productDisabled') === 'true'
    mainImageUrl = getField('mainImageUrl')
    removeMainImage = getField('removeMainImage') === 'true'
    mainImageFile = formData.find((entry) => entry.name === 'mainImageFile')
    newGalleryFiles = formData.filter((entry) => entry.name === 'newGalleryFiles')

    productSpecs = parseSpecs(getField('productSpecs'))
    galleryUrls = parseGallery(getField('galleryUrls'))

    if (mainImageFile) {
      await validateImageFile(mainImageFile, 'Main image')
      const uploadedMainImage = await uploadBufferToCloudinary(mainImageFile.data)
      mainImageUrl = uploadedMainImage.secure_url
    } else if (removeMainImage) {
      mainImageUrl = ''
    }

    if (newGalleryFiles.length > 0) {
      await validateGalleryFiles(newGalleryFiles)
    }

    if (newGalleryFiles.length > 0) {
      const uploadedGallery = await Promise.all(newGalleryFiles.map((file) => uploadBufferToCloudinary(file.data)))
      galleryUrls = [...galleryUrls, ...uploadedGallery.map((item) => item.secure_url)]
    }
  } else {
    const body = (await readBody(event)) as Record<string, unknown>
    productId = body.productId == null ? null : String(body.productId)
    productName = cleanText(body.productName, 255)
    productPrice = body.productPrice as string | number | null
    productDealerPrice = body.productDealerPrice as string | number | null
    productDescription = sanitizeRichText(body.productDescription)
    productSpecs = parseSpecs(typeof body.productSpecs === 'string' ? body.productSpecs : JSON.stringify(body.productSpecs ?? []))
    productDisabled = !!body.productDisabled
  }

  // Security check handled by admin-auth server middleware

  if (!productId || !productName || !productPrice) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: ID, Name, Price',
    })
  }

  try {
    const bitrixUrl = config.bitrixWebhookUrl
    if (!bitrixUrl) {
      throw createError({ statusCode: 500, statusMessage: 'Bitrix not configured' })
    }

    const formattedBitrixUrl = (bitrixUrl as string).endsWith('/') ? bitrixUrl : `${bitrixUrl}/`

    const fields: Record<string, unknown> = {
      NAME: productName,
      PRICE: productPrice,
      PROPERTY_184: productDealerPrice || '',
      DESCRIPTION: productDescription || '',
      DESCRIPTION_TYPE: 'html',
      // ACTIVE is deliberately NOT sent. Hiding a product is a website
      // decision; writing ACTIVE: 'N' deactivated it in Bitrix for sales,
      // quotes and the catalogue too, and the webhook then deleted it from the
      // mirror. Visibility is stored in product_visibility instead.
      PROPERTY_104: productSpecs ? JSON.stringify(productSpecs) : '[]',
    }

    if (isMultipart) {
      if (mainImageFile || removeMainImage || mainImageUrl) {
        fields.PROPERTY_102 = mainImageUrl || ''
      }
      fields.PROPERTY_112 = JSON.stringify(galleryUrls)
    }

    logger.debug('UPDATE', 'Bitrix update payload', { id: productId, fields })

    // Update product in Bitrix
    const updateResponse = await $fetch<BitrixResponse<number | string | boolean>>(
      `${formattedBitrixUrl}crm.product.update`,
      {
        method: 'POST',
        body: {
          id: productId,
          fields,
        },
      },
    )

    if ((updateResponse as any).error) {
      const bitrixError = (updateResponse as any).error_description || (updateResponse as any).error
      throw createError({
        statusCode: 400,
        statusMessage: `Bitrix Error: ${bitrixError}`,
      })
    }

    if (!updateResponse.result) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Update failed in Bitrix: No result returned',
      })
    }

    // After Bitrix, so a failed product update does not leave the site hiding
    // something that was never saved.
    try {
      await setProductHidden(String(productId), productDisabled, event.context.admin?.user_id)
    } catch (visibilityError) {
      logger.error('UPDATE', 'Product saved but visibility not stored', {
        id: productId,
        error: visibilityError instanceof Error ? visibilityError.message : String(visibilityError),
      })
      throw createError({
        statusCode: 500,
        statusMessage: 'The product was saved, but its visibility setting was not. Try again.',
      })
    }

    return {
      success: true,
      message: `Product "${productName}" updated successfully`,
      productId: updateResponse.result,
    }
  } catch (error: any) {
    logger.error('UPDATE', 'Error updating product', { error })
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to update product',
    })
  }
})
