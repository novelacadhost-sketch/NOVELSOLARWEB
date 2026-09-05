import { serverSupabaseServiceRole } from '#supabase/server'
import nodemailer from 'nodemailer'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  // Security check is handled globally by server/middleware/admin-auth.ts for /api/admin/* routes

  const body = await readBody(event)
  const applicationId = body?.applicationId

  if (!applicationId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing applicationId' })
  }

  const supabase = await serverSupabaseServiceRole(event)

  try {
    // 1. Fetch the application to get the email and current status
    const { data: appData, error: fetchError } = (await supabase
      .from('dealer_applications')
      .select('email, business_name, contact_name, status')
      .eq('id', applicationId)
      .single()) as { data: any; error: any }

    if (fetchError || !appData) {
      throw createError({ statusCode: 404, statusMessage: 'Application not found' })
    }

    if (appData.status === 'rejected') {
      throw createError({ statusCode: 400, statusMessage: 'Application is already rejected' })
    }

    const previousStatus = appData.status

    // 2. Update status to 'rejected'
    const { error: updateError } = await supabase
      .from('dealer_applications')
      .update({ status: 'rejected' } as never)
      .eq('id', applicationId)

    if (updateError) throw updateError

    // 3. If they were approved, downgrade their role in Auth & Profiles
    if (previousStatus === 'approved') {
      try {
        // Find the user ID by email via generating a silent magic link
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: appData.email,
        })

        if (!linkError && linkData?.user?.id) {
          const userId = linkData.user.id
          // Revoke dealer role in user metadata
          await supabase.auth.admin.updateUserById(userId, { user_metadata: { role: 'customer' } })

          // Downgrade in profiles table
          await supabase.from('profiles').upsert({
            user_id: userId,
            email: appData.email,
            first_name: appData.contact_name,
            role: 'customer',
            dealer_status: 'rejected',
          } as never)
        }
      } catch (downgradeError) {
        logger.error('Dealer Reject API', 'Failed to downgrade user, continuing to send email', {
          error: downgradeError,
        })
      }
    }

    // 4. Send rejection/removal email
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
      const reapplyLink = `${domain}/dealer-application`

      let emailHtml = ''
      let subject = ''

      if (previousStatus === 'pending') {
        subject = 'Update on your NovelSolar Dealer Application'
        emailHtml = `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #002888;">Dealer Application Status</h2>
            <p>Hello ${appData.contact_name},</p>
            <p>Thank you for your interest in the NovelSolar Authorized Dealer Network.</p>
            <p>After careful review of your application for <strong>${appData.business_name}</strong>, we are unable to approve your application at this time.</p>
            <p>If you believe this was in error, or if you have obtained the necessary requirements and wish to reapply, you can submit a new application here:</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${reapplyLink}" style="background-color: #002888; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reapply as a Dealer</a>
            </div>
            <p>Best regards,<br>The NovelSolar Team</p>
          </div>
        `
      } else {
        subject = 'Notice: NovelSolar Dealer Account Removed'
        emailHtml = `
          <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #a9001d;">Dealer Account Status Update</h2>
            <p>Hello ${appData.contact_name},</p>
            <p>We are writing to inform you that your dealer account for <strong>${appData.business_name}</strong> has been removed from the NovelSolar Authorized Dealer Network.</p>
            <p>Your account will no longer have access to wholesale pricing or dealer-exclusive resources. Any active orders will be processed under standard retail terms.</p>
            <p>If you wish to reapply for dealer status in the future, please use the link below to submit a new application with updated credentials:</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${reapplyLink}" style="background-color: #002888; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reapply as a Dealer</a>
            </div>
            <p>If you have any questions, please reply to this email to speak with a representative.</p>
            <p>Best regards,<br>The NovelSolar Team</p>
          </div>
        `
      }

      await transporter
        .sendMail({
          from: config.smtpFrom,
          to: appData.email,
          subject: subject,
          html: emailHtml,
        })
        .catch((e) => logger.error('Dealer Reject API', 'Email send failed', { error: e }))
    }

    return { success: true, message: 'Dealer rejected/removed and email sent' }
  } catch (err: unknown) {
    const error = err as { statusCode?: number; statusMessage?: string; message?: string }
    logger.error('Dealer Reject API', 'Error rejecting dealer', { error })
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || error.statusMessage || 'Internal server error',
    })
  }
})
