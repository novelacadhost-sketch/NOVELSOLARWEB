import { serverSupabaseServiceRole } from '#supabase/server'
import nodemailer from 'nodemailer'
import { logger } from '../../utils/logger'
import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const applicationId = body?.applicationId

  if (!applicationId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing applicationId' })
  }

  const supabase = serverSupabaseServiceRole(event)

  try {
    const { data: appData, error: fetchError } = await supabase
      .from('dealer_applications')
      .select('email, business_name, contact_name, status')
      .eq('id', applicationId)
      .single()

    if (fetchError || !appData) {
      throw createError({ statusCode: 404, statusMessage: 'Application not found' })
    }

    if (appData.status !== 'approved') {
      throw createError({ statusCode: 400, statusMessage: 'Cannot renew invite for non-approved dealer' })
    }

    // Generate fresh token and expiry
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    const { data: existingInvites } = await supabase.from('dealer_invitations').select('id').eq('email', appData.email)

    if (existingInvites && existingInvites.length > 0) {
      await supabase
        .from('dealer_invitations')
        .update({
          token: token,
          expires_at: expiresAt,
          used: false,
          created_at: new Date().toISOString(),
        })
        .eq('id', existingInvites[0].id)
    } else {
      await supabase.from('dealer_invitations').insert({
        email: appData.email,
        token: token,
        expires_at: expiresAt,
        used: false,
      })
    }

    // Resend dynamically updated email
    const config = useRuntimeConfig()
    if (config.smtpUser && config.smtpPass) {
      const transporter = nodemailer.createTransport({
        pool: true,
        host: config.smtpHost,
        port: Number(config.smtpPort) || 587,
        secure: false,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
        tls: { rejectUnauthorized: false },
      })

      const domain = config.public.baseUrl ? config.public.baseUrl.replace(/\/$/, '') : 'https://novelsolar.com'
      const setupLink = `${domain}/dealer/setup-account?token=${token}`

      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #002888;">Action Required: Your Setup Link Has Been Renewed</h2>
          <p>Hello ${appData.contact_name},</p>
          <p>Your original setup link for the NovelSolar Authorized Dealer Network has expired.</p>
          <p>We have generated a fresh setup link for <strong>${appData.business_name}</strong>. Please set up your account password using the secure link below:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${setupLink}" style="background-color: #002888; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Set Up My Account</a>
          </div>
          <p style="color: #d32f2f; font-weight: bold;">Important: This new setup link will expire in exactly 3 days and can only be used once.</p>
          <p>If you have any questions, please reply to this email or contact our support team.</p>
          <p>Best regards,<br>The NovelSolar Team</p>
        </div>
      `

      await transporter
        .sendMail({
          from: config.smtpFrom,
          to: appData.email,
          subject: 'Action Required: Renewed Dealer Setup Link',
          html: emailHtml,
        })
        .catch((e) => logger.error('Dealer Renew API', 'Email send failed', { error: e }))
    }

    return { success: true, message: 'Invitation renewed and email sent' }
  } catch (err: unknown) {
    const error = err as { statusCode?: number; statusMessage?: string; message?: string }
    logger.error('Dealer Renew API', 'Error renewing invite', { error })
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Internal server error',
    })
  }
})
