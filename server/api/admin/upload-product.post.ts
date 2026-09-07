import {
  configureCloudinary,
  uploadBufferToCloudinary,
  validateGalleryFiles,
  validateImageFile,
} from '../../utils/productMedia'
import type { BitrixResponse } from '../../types/bitrix'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  configureCloudinary()

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  // Helper to extract fields from multipart form data
  const getField = (name: string): string | null => {
    const field = formData.find((f) => f.name === name)
    return field ? (sanitizePayload(field.data.toString()) as string) : null
  }

  // Removed passcode check - Handled globally by admin-auth server middleware

  // 3. Extract Product Fields
  let productName = getField('productName')
  const productPrice = getField('productPrice')
  const productDealerPrice = getField('productDealerPrice')
  const productType = getField('productType')
  const productBrand = getField('productBrand')
  const productDescription = getField('productDescription')
  const productSpecs = getField('productSpecs')
  const imageFile = formData.find((f) => f.name === 'productImage')
  const galleryImages = formData.filter((f) => f.name === 'galleryImages')

  if (!productName || !productPrice || !imageFile) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  // Validate main image
  await validateImageFile(imageFile, 'Main image')

  if (galleryImages.length > 0) {
    await validateGalleryFiles(galleryImages)
  }

  // 3.5. Brand Integrity: Ensure the brand name is in the product title for shop filtering
  if (productBrand && productBrand !== 'general') {
    const brandLabel = productBrand.charAt(0).toUpperCase() + productBrand.slice(1)
    if (!productName.toLowerCase().includes(productBrand.toLowerCase())) {
      productName = `${brandLabel} ${productName}`
    }
  }

  try {
    const cloudinaryResult = await uploadBufferToCloudinary(imageFile.data)
    const imageUrl = cloudinaryResult.secure_url

    // 4.5. Gallery Uploads: Process additional images
    const galleryUploadPromises = galleryImages.map((img) => uploadBufferToCloudinary(img.data))
    const galleryResults = await Promise.all(galleryUploadPromises)
    const galleryUrls = galleryResults.map((r) => r.secure_url)

    // 5. Bitrix Upload: Add product with Cloudinary image URL in PROPERTY_44
    const webhookUrl = config.bitrixWebhookUrl
    if (!webhookUrl) throw new Error('BITRIX_WEBHOOK_URL not configured')
    const formattedWebhookUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`

    // Determine MEASURE based on productType
    const measureId = productType === 'meter' ? 6 : 5

    const bitrixResponse = await $fetch<BitrixResponse<number | string>>(`${formattedWebhookUrl}crm.product.add`, {
      method: 'POST',
      body: {
        fields: {
          NAME: productName,
          PRICE: productPrice,
          PROPERTY_184: productDealerPrice || '',
          CURRENCY_ID: 'NGN',
          ACTIVE: 'Y',
          MEASURE: measureId,
          DESCRIPTION: productDescription,
          DESCRIPTION_TYPE: 'html',
          PROPERTY_102: imageUrl, // Store Cloudinary URL directly in Custom Field
          PROPERTY_104: productSpecs, // Stringified specs array
          PROPERTY_112: JSON.stringify(galleryUrls), // Stringified gallery URL array
        },
      },
    })

    if (bitrixResponse.error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Bitrix Error: ${bitrixResponse.error_description || bitrixResponse.error}`,
      })
    }

    return {
      success: true,
      message: 'Product added successfully with Cloudinary image hosting',
      bitrixId: bitrixResponse.result,
      cloudinaryUrl: imageUrl,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Upload Product', 'Pipeline error', { error: message })
    throw createError({
      statusCode: 500,
      statusMessage: message || 'Internal server error',
    })
  }
})
