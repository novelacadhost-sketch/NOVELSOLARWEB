import { serverSupabaseServiceRole } from '#supabase/server'
import nodemailer from 'nodemailer'
import { logger } from '../../utils/logger'
import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  // Security check is handled globally by server/middleware/admin-auth.ts for /api/admin/* routes

  const body = await readBody(event)
  const applicationId = body?.applicationId

  if (!applicationId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing applicationId' })
  }

  const supabase = await serverSupabaseServiceRole(event)

  try {
    // 1. Fetch the application to get the email
    const { data: appData, error: fetchError } = (await supabase
      .from('dealer_applications')
      .select('email, business_name, contact_name, status')
      .eq('id', applicationId)
      .single()) as { data: any; error: any }

    if (fetchError || !appData) {
      throw createError({ statusCode: 404, statusMessage: 'Application not found' })
    }

    if (appData.status === 'approved') {
      throw createError({ statusCode: 400, statusMessage: 'Application is already approved' })
    }

    // 2. Update status to 'approved'
    const { error: updateError } = await supabase
      .from('dealer_applications')
      .update({ status: 'approved' } as never)
      .eq('id', applicationId)

    if (updateError) throw updateError

    // 3. Check if user exists & provision
    let userId: string | null = null

    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: appData.email,
      email_confirm: true,
      user_metadata: { role: 'dealer' },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already')) {
        // User exists. Fetch their ID securely
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: appData.email,
        })
        if (linkError || !linkData?.user?.id) throw authError
        userId = linkData.user.id
        await supabase.auth.admin.updateUserById(userId, { user_metadata: { role: 'dealer' } })
      } else {
        throw authError
      }
    } else {
      userId = newUser.user.id
    }

    if (!userId) {
      throw createError({ statusCode: 400, statusMessage: 'Failed to provision user ID' })
    }

    // 4. Generate onboarding token and expiration
    const onboardingToken = crypto.randomBytes(32).toString('hex')
    const onboardingTokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // 5. Upsert the profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      user_id: userId,
      email: appData.email,
      first_name: appData.contact_name,
      role: 'dealer',
      dealer_status: 'approved',
      onboarding_token: onboardingToken,
      token_expires_at: onboardingTokenExpires,
    } as never)

    if (profileError) throw profileError

    // 6. Send approval email
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
      const setupLink = `${domain}/dealer/setup-account?token=${onboardingToken}`

      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #002888;">Congratulations! Your Application is Approved</h2>
          <p>Hello ${appData.contact_name},</p>
          <p>We are thrilled to welcome <strong>${appData.business_name}</strong> to the NovelSolar Authorized Dealer Network!</p>
          <p>Your wholesale pricing account has been activated. Please complete your account setup to start ordering:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${setupLink}" style="background-color: #002888; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Complete Account Setup</a>
          </div>
          <p>This link will expire in 48 hours.</p>
          <p>If you have any questions, please reply to this email or contact our support team.</p>
          <p>Best regards,<br>The NovelSolar Team</p>
        </div>
      `

      await transporter
        .sendMail({
          from: config.smtpFrom,
          to: appData.email,
          subject: 'Welcome to NovelSolar! Your Dealer Account is Ready',
          html: emailHtml,
        })
        .catch((e) => logger.error('Dealer Approval API', 'Email send failed', { error: e }))
    }

    return { success: true, message: 'Dealer approved and email sent' }
  } catch (err: unknown) {
    const error = err as { statusCode?: number; statusMessage?: string; message?: string }
    logger.error('Dealer Approval API', 'Error approving dealer', { error })
    throw createError({
      statusCode: error.statusCode || 400,
      statusMessage: error.message || error.statusMessage || 'Internal server error',
    })
  }
})
