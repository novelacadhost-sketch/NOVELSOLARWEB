import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'
import { fileTypeFromBuffer } from 'file-type'
import { logger } from './logger'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_GALLERY_FILES = 10

export interface UploadedImageFile {
  filename?: string
  type?: string
  data: Buffer
}

export async function validateImageFile(file: UploadedImageFile, label: string) {
  const detected = await fileTypeFromBuffer(file.data)
  const mime = detected?.mime ?? ''

  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label}: Invalid file type "${mime || 'unknown'}". Allowed: JPEG, PNG, WebP, GIF, AVIF.`,
    })
  }

  if (file.data.length > MAX_FILE_SIZE) {
    const sizeMB = (file.data.length / (1024 * 1024)).toFixed(1)
    throw createError({
      statusCode: 400,
      statusMessage: `${label}: File too large (${sizeMB} MB). Maximum allowed: 10 MB.`,
    })
  }
}

export async function validateGalleryFiles(files: UploadedImageFile[]) {
  if (files.length > MAX_GALLERY_FILES) {
    throw createError({
      statusCode: 400,
      statusMessage: `Too many gallery images (${files.length}). Maximum allowed: ${MAX_GALLERY_FILES}.`,
    })
  }

  for (let i = 0; i < files.length; i++) {
    await validateImageFile(files[i], `Gallery image ${i + 1}`)
  }
}

export function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

/**
 * Copy a remote image into Cloudinary and return the delivery URL.
 *
 * Cloudinary fetches the file itself, so the bytes never pass through this
 * function — one API call per image instead of a download followed by an
 * upload, which matters inside a 60-second serverless budget.
 *
 * `publicId` must be derived from something stable about the SOURCE image, so
 * the same picture always lands on the same Cloudinary object. With
 * `overwrite: false` a repeat call is then a no-op rather than a second copy
 * and a second set of credits — the nightly sync walks every product, so
 * without this it would re-upload the whole catalogue every night.
 */
export async function mirrorRemoteImageToCloudinary(
  remoteUrl: string,
  publicId: string,
  folder = 'novel_solar_bitrix',
): Promise<string> {
  const result = await cloudinary.uploader.upload(remoteUrl, {
    public_id: publicId,
    folder,
    overwrite: false,
    // Cloudinary returns the EXISTING asset rather than erroring when the id is
    // taken, which is what makes a repeat run cheap instead of fatal.
    invalidate: false,
    resource_type: 'image',
  })

  return result.secure_url
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = 'novel_solar_products',
): Promise<UploadApiResponse> {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error || !result) {
        logger.error('Cloudinary', 'Upload error', { error })
        reject(error ?? new Error('Cloudinary returned no result'))
        return
      }

      resolve(result)
    })

    uploadStream.end(buffer)
  })
}
