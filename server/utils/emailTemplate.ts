import type { OrderDetails, ServiceBookingDetails } from '../types/database'

function getEmailTemplateUrls() {
  const config = useRuntimeConfig()
  const siteUrl = config.public.baseUrl.replace(/\/$/, '')

  return {
    siteUrl,
    logoUrl: `${siteUrl}/images/logo.png`,
    whatsappUrl: `https://wa.me/${config.public.whatsappNumber}`,
  }
}

export function generateOrderReceiptHtml(orderDetails: OrderDetails) {
  const { siteUrl, logoUrl, whatsappUrl } = getEmailTemplateUrls()
  const productsHtml = orderDetails.products
    .map(
      (item: any) => `
    <tr>
      <td style="padding: 15px 0; border-bottom: 1px solid #e5e2e1; width: 90px;">
        <img src="${item.image}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; background-color: #f0edec; border: 1px solid #e5e2e1;" />
      </td>
      <td style="padding: 15px 15px; border-bottom: 1px solid #e5e2e1; color: #1c1b1b;">
        <h4 style="margin: 0; font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: bold; font-size: 15px; color: #1c1b1b;">${item.name}</h4>
        <p style="margin: 6px 0 0 0; font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #525252;">Quantity: ${item.quantity}</p>
      </td>
      <td style="padding: 15px 0; border-bottom: 1px solid #e5e2e1; text-align: right; vertical-align: middle;">
        <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-weight: bold; font-size: 15px; color: #1c1b1b;">₦${item.price.toLocaleString()}</span>
      </td>
    </tr>
  `,
    )
    .join('')

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="background-color: #fcf9f8; color: #1c1b1b; font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased;">
    <table align="center" width="100%" style="max-width: 640px; background-color: #ffffff; margin: 0 auto; border-spacing: 0; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1); border-top: 4px solid #a9001d;">
      <tr>
        <td align="center" style="padding: 30px 20px; border-bottom: 1px solid #e5e2e1;">
          <a href="${siteUrl}" target="_blank" style="text-decoration: none;">
            <img src="${logoUrl}" alt="Novel Solar" style="max-height: 45px; width: auto; display: block;" />
          </a>
        </td>
      </tr
      <tr>
        <td align="center" style="padding: 50px 40px 40px;">
          <div style="display: inline-block; width: 60px; height: 60px; background-color: #ffe7e5; border-radius: 50%; border: 6px solid #ffdad7; line-height: 60px; text-align: center; margin-bottom: 20px;">
            <span style="color: #a9001d; font-size: 30px;">&#10004;</span>
          </div>
          <h1 style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: 800; font-size: 28px; color: #1c1b1b; margin: 0 0 12px 0;">Order Confirmed</h1>
          <p style="font-family: 'Inter', Arial, sans-serif; color: #525252; font-size: 14px; line-height: 1.6; max-width: 420px; margin: 0 auto;">
            Thank you for choosing Novel Solar. Your precision energy solution is being prepared for dispatch.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px 40px; background-color: #f6f3f2; border-top: 1px solid #e5e2e1; border-bottom: 1px solid #e5e2e1;">
          <table width="100%" style="border-spacing: 0;">
            <tr>
              <td width="50%" style="padding-bottom: 20px;">
                <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #525252; font-weight: bold; display: block; margin-bottom: 6px;">Order Number</span>
                <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: bold; font-size: 16px; color: #1c1b1b;">#${orderDetails.orderNumber}</span>
              </td>
              <td width="50%" style="padding-bottom: 20px;">
                <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #525252; font-weight: bold; display: block; margin-bottom: 6px;">Order Date</span>
                <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: bold; font-size: 16px; color: #1c1b1b;">${orderDetails.orderDate}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 20px; border-top: 1px solid #e5e2e1;">
                <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #525252; font-weight: bold;">Payment Method: </span>
                <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: bold; font-size: 14px; color: #1c1b1b;">${orderDetails.paymentMethod}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 40px 40px 10px;">
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #a9001d; font-weight: bold; margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 1px solid #ffdad7; display: inline-block;">Product Summary</h2>
          <table width="100%" style="border-spacing: 0;">
            ${productsHtml}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 40px 40px;">
          <table width="100%" style="border-spacing: 0; margin-top: 20px;">
            <tr>
              <td style="padding-bottom: 12px; font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #525252;">Subtotal</td>
              <td style="padding-bottom: 12px; text-align: right; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #1c1b1b;">₦${orderDetails.subtotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding-bottom: 24px; font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #525252;">Technical Shipping & Handling</td>
              <td style="padding-bottom: 24px; text-align: right; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #1c1b1b;">₦${orderDetails.shipping.toLocaleString()}</td>
            </tr>
            ${
              orderDetails.discount
                ? `<tr>
              <td style="padding-bottom: 24px; font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #525252;">${orderDetails.discount.label}</td>
              <td style="padding-bottom: 24px; text-align: right; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #15803d;">-₦${orderDetails.discount.amount.toLocaleString()}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding: 24px 20px; background-color: #ffe7e5; border-radius: 4px 0 0 4px;">
                <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #a9001d; font-weight: 800;">Total Amount Paid</span>
              </td>
              <td style="padding: 24px 20px; background-color: #ffe7e5; text-align: right; border-radius: 0 4px 4px 0;">
                <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 24px; font-weight: 900; color: #1c1b1b;">₦${orderDetails.total.toLocaleString()}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 40px; background-color: #f6f3f2; border-top: 1px solid #e5e2e1; border-bottom: 1px solid #e5e2e1; text-align: center;">
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #1c1b1b; font-weight: bold; margin: 0 0 12px 0;">Fulfillment Branch</h2>
          <div style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #1c1b1b; font-weight: bold; line-height: 1.6; margin-bottom: 30px;">
            ${orderDetails.branchName}
          </div>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #525252; font-weight: bold; margin: 0 0 12px 0; border-top: 1px solid #e5e2e1; padding-top: 30px;">Novel Solar Head Office</h2>
          <div style="font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #525252; line-height: 1.6;">
            <p style="margin: 0;">Novel Solar Akinjide Plaza</p>
            <p style="margin: 0;">No. 76, Adekunle Fajuyi Road, Ekotedo, Ibadan, Oyo State</p>
            <p style="margin: 0;">Nigeria.</p>
          </div>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 50px 40px;">
          <h3 style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: 800; font-size: 20px; color: #1c1b1b; margin: 0 0 12px 0;">What happens next?</h3>
          <p style="font-family: 'Inter', Arial, sans-serif; color: #525252; font-size: 14px; line-height: 1.6; max-width: 400px; margin: 0 auto 30px;">
            Our sales team will reach out to you to validate your order within 24 hours.
          </p>
          <a href="${whatsappUrl}" target="_blank" style="display: block; width: 100%; max-width: 320px; margin: 0 auto; text-decoration: none; border: 2px solid #25D366; border-radius: 4px; padding: 14px 0; background-color: #ffffff; text-align: center;">
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/WhatsApp_icon.png" alt="WhatsApp" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 8px; display: inline-block;" />
            <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 12px; font-weight: bold; letter-spacing: 0.15em; color: #128C7E; text-transform: uppercase; vertical-align: middle; display: inline-block;">WhatsApp Support</span>
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 40px; background-color: #3c59b0;">
          <div style="margin-bottom: 20px;">
            <a href="#" style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #ffffff; text-decoration: none; font-weight: bold; margin: 0 10px;">Support</a>
            <a href="#" style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #ffffff; text-decoration: none; font-weight: bold; margin: 0 10px;">Privacy</a>
            <a href="#" style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #ffffff; text-decoration: none; font-weight: bold; margin: 0 10px;">Terms</a>
          </div>
          <p style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.7); line-height: 1.8; margin: 0;">
            © ${new Date().getFullYear()} Novel Solar. All rights reserved.<br/>Precision Engineering for Sustainable Power.
          </p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `
}

export function generateServiceBookingHtml(bookingDetails: ServiceBookingDetails) {
  const { siteUrl, logoUrl, whatsappUrl } = getEmailTemplateUrls()
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="background-color: #fcf9f8; color: #1c1b1b; font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased;">
    <table align="center" width="100%" style="max-width: 640px; background-color: #ffffff; margin: 0 auto; border-spacing: 0; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1); border-top: 4px solid #002888;">
      <tr>
        <td align="center" style="padding: 30px 20px; border-bottom: 1px solid #e5e2e1;">
          <a href="${siteUrl}" target="_blank" style="text-decoration: none;">
            <img src="${logoUrl}" alt="Novel Solar" style="max-height: 45px; width: auto; display: block;" />
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 50px 40px 40px;">
          <div style="display: inline-block; width: 60px; height: 60px; background-color: #e5f0ff; border-radius: 50%; border: 6px solid #cce0ff; line-height: 60px; text-align: center; margin-bottom: 20px;">
            <span style="color: #002888; font-size: 30px;">&#128197;</span>
          </div>
          <h1 style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: 800; font-size: 28px; color: #1c1b1b; margin: 0 0 12px 0;">Booking Received</h1>
          <p style="font-family: 'Inter', Arial, sans-serif; color: #525252; font-size: 14px; line-height: 1.6; max-width: 420px; margin: 0 auto;">
            Hello ${bookingDetails.customerName},<br>
            Thank you for choosing Novel Solar. We have received your service request and our team is reviewing it.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px 40px; background-color: #f6f3f2; border-top: 1px solid #e5e2e1; border-bottom: 1px solid #e5e2e1;">
          <table width="100%" style="border-spacing: 0;">
            <tr>
              <td width="50%" style="padding-bottom: 20px;">
                <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #525252; font-weight: bold; display: block; margin-bottom: 6px;">Requested Service</span>
                <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: bold; font-size: 16px; color: #1c1b1b;">${bookingDetails.serviceName}</span>
              </td>
              <td width="50%" style="padding-bottom: 20px;">
                <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #525252; font-weight: bold; display: block; margin-bottom: 6px;">Requested Date</span>
                <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: bold; font-size: 16px; color: #1c1b1b;">${bookingDetails.requestedDate}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 20px; border-top: 1px solid #e5e2e1;">
                <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #525252; font-weight: bold;">Service Location: </span>
                <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: bold; font-size: 14px; color: #1c1b1b;">${bookingDetails.address}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 40px 40px;">
          <table width="100%" style="border-spacing: 0; margin-top: 40px;">
            <tr>
              <td style="padding: 24px 20px; background-color: #e5f0ff; border-radius: 4px 0 0 4px;">
                <span style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #002888; font-weight: 800;">Estimated Cost</span>
              </td>
              <td style="padding: 24px 20px; background-color: #e5f0ff; text-align: right; border-radius: 0 4px 4px 0;">
                <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 24px; font-weight: 900; color: #1c1b1b;">₦${Number(bookingDetails.price || 0).toLocaleString()}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 20px 40px 50px;">
          <h3 style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-weight: 800; font-size: 20px; color: #1c1b1b; margin: 0 0 12px 0;">What happens next?</h3>
          <p style="font-family: 'Inter', Arial, sans-serif; color: #525252; font-size: 14px; line-height: 1.6; max-width: 400px; margin: 0 auto 30px;">
            Our support team will reach out to you shortly to confirm the appointment time and provide you with an exact quotation.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 40px; background-color: #002888;">
          <p style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.7); line-height: 1.8; margin: 0;">
            © ${new Date().getFullYear()} Novel Solar. All rights reserved.<br/>Precision Engineering for Sustainable Power.
          </p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `
}
