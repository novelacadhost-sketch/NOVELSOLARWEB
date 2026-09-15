import { configureCloudinary, uploadBufferToCloudinary, validateImageFile } from '../../../utils/productMedia'
import { logger } from '../../../utils/logger'

/**
 * Upload one page image to Cloudinary and hand back its URL.
 *
 * Shares the product-media validators — same 10 MB cap and MIME whitelist — so
 * there is one definition of "an image we accept". A separate folder keeps page
 * banners from appearing in the product media library.
 *
 * The URL is returned, not stored: the caller puts it in a block and posts the
 * whole slot to save.post.ts. An upload that is never saved is just an orphaned
 * Cloudinary asset, not a half-written page.
 */
export default defineEventHandler(async (event) => {
  configureCloudinary()

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  const imageFile = formData.find((f) => f.name === 'image')
  if (!imageFile) {
    throw createError({ statusCode: 400, statusMessage: 'Missing image file (field name: image).' })
  }

  await validateImageFile(imageFile, 'Page image')

  try {
    const result = await uploadBufferToCloudinary(imageFile.data, 'novel_solar_pages')
    logger.info('PageContent', 'Image uploaded', { publicId: result.public_id })
    return { success: true, url: result.secure_url, publicId: result.public_id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('PageContent', 'Upload failed', { error: message })
    throw createError({ statusCode: 500, statusMessage: message || 'Failed to upload image.' })
  }
})
