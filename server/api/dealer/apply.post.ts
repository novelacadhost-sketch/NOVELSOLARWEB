import { serverSupabaseServiceRole } from '#supabase/server'
import { getMailTransporter } from '../../utils/mailer'
import { logger } from '../../utils/logger'
import { z } from 'zod'
import { fileTypeFromBuffer } from 'file-type'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  const getField = (name: string) => {
    const field = formData.find((f) => f.name === name)
    return field ? field.data.toString() : ''
  }

  const dealerSchema = z.object({
    businessName: z.string().trim().min(2).max(200),
    contactPerson: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(7).max(30),
    address: z.string().trim().min(5).max(500),
  })

  const parseResult = dealerSchema.safeParse({
    businessName: getField('businessName'),
    contactPerson: getField('contactPerson'),
    email: getField('email'),
    phone: getField('phone'),
    address: getField('address'),
  })

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid form inputs: ' + parseResult.error.errors.map((e) => e.message).join(', '),
    })
  }

  const { businessName, contactPerson, email, phone, address } = parseResult.data

  const previousWorkFiles = formData.filter((f) => f.name === 'previousWork' && f.filename)
  const formerPurchaseFile = formData.find((f) => f.name === 'formerPurchase' && f.filename)

  if (previousWorkFiles.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Missing previous work files' })
  }

  // Use service role to bypass RLS for inserting and accessing storage
  const supabase = serverSupabaseServiceRole(event)

  const ALLOWED_DEALER_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
  const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

  const uploadFile = async (file: { filename?: string; data: Buffer; type?: string }, folder: string) => {
    if (file.data.length > MAX_SIZE) {
      throw createError({ statusCode: 400, statusMessage: `File ${file.filename} is too large. Maximum size is 5 MB.` })
    }

    const detected = await fileTypeFromBuffer(file.data)
    const mime = detected?.mime ?? ''

    if (!ALLOWED_DEALER_TYPES.includes(mime)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid file type for ${file.filename}. Only JPEG, PNG, and PDF are accepted.`,
      })
    }

    const timestamp = Date.now()
    const safeName = file.filename?.replace(/[^\w.-]/g, '') || `file-${timestamp}`
    const path = `${folder}/${timestamp}-${safeName}`

    const { error } = await supabase.storage.from('dealer-attachments').upload(path, file.data, {
      contentType: mime,
    })

    if (error) throw error

    const { data: publicData } = supabase.storage.from('dealer-attachments').getPublicUrl(path)
    return publicData.publicUrl
  }

  try {
    // Upload files
    const previous_work_urls = await Promise.all(previousWorkFiles.map((file) => uploadFile(file, 'previous-work')))

    let former_purchase_url = null
    if (formerPurchaseFile) {
      former_purchase_url = await uploadFile(formerPurchaseFile, 'former-purchase')
    }

    // Insert into DB
    const { error: dbError } = await supabase.from('dealer_applications').insert({
      business_name: businessName,
      contact_name: contactPerson,
      email: email,
      phone: phone,
      address: address,
      previous_work_urls,
      former_purchase_url,
    })

    if (dbError) throw dbError

    // Send Email
    const transporter = getMailTransporter()
    if (transporter) {
      const config = useRuntimeConfig()

      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #002888;">Dealer Application Received</h2>
          <p>Hello ${contactPerson},</p>
          <p>Thank you for applying to become a NovelSolar dealer for <strong>${businessName}</strong>.</p>
          <p>We have received your application, including your submitted attachments, and our team is currently reviewing your profile. We typically respond within 1-2 business days.</p>
          <p>Best regards,<br>The NovelSolar Team</p>
        </div>
      `

      await transporter
        .sendMail({
          from: config.smtpFrom,
          to: email,
          subject: 'Your NovelSolar Dealer Application',
          html: emailHtml,
        })
        .catch((e: unknown) => logger.error('Dealer API', 'Email send failed', { error: e }))
    }

    return { success: true, message: 'Application submitted successfully' }
  } catch (err: unknown) {
    const error = err as { message?: string }
    logger.error('Dealer API', 'Application error', { error })
    throw createError({ statusCode: 500, statusMessage: error.message || 'Internal server error' })
  }
})
