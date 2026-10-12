import nodemailer from 'nodemailer'
import { useRuntimeConfig } from '#imports'

let _transporter: ReturnType<typeof nodemailer.createTransport> | null = null

export function getMailTransporter() {
  if (!_transporter) {
    const config = useRuntimeConfig()
    if (config.smtpUser && config.smtpPass) {
      _transporter = nodemailer.createTransport({
        pool: true,
        host: config.smtpHost,
        port: Number(config.smtpPort) || 587,
        secure: false,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      })
    }
  }
  return _transporter
}
