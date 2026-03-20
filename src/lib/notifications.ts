import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = `WMS Portal <noreply@${process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '') ?? 'yourdomain.com'}>`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function baseLayout(title: string, body: string) {
  return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1d4ed8;padding:20px 28px">
    <span style="color:#fff;font-size:16px;font-weight:600">WMS Portal</span>
  </div>
  <div style="padding:28px">
    <h2 style="margin:0 0 12px;font-size:18px;color:#1e293b">${title}</h2>
    ${body}
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
      WMS Portal · <a href="${APP_URL}" style="color:#3b82f6">Go to portal</a>
    </div>
  </div>
</div>
</body></html>`
}

function btn(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">${label}</a>`
}

export async function sendInboundSubmitted(to: string, orderNumber: string, customerName: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `New inbound order ${orderNumber} — ${customerName}`,
    html: baseLayout('New inbound order received',
      `<p style="color:#475569;font-size:14px;line-height:1.6">Customer <strong>${customerName}</strong> has submitted inbound order <strong>${orderNumber}</strong> and is awaiting warehouse receipt.</p>
      ${btn('View order', `${APP_URL}/orders/inbound`)}`)
  })
}

export async function sendInboundPutAway(to: string, orderNumber: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `Your shipment ${orderNumber} has been put away`,
    html: baseLayout('Shipment received & put away',
      `<p style="color:#475569;font-size:14px;line-height:1.6">Your inbound order <strong>${orderNumber}</strong> has been received and put away. Your inventory has been updated.</p>
      ${btn('View inventory', `${APP_URL}/inventory`)}`)
  })
}

export async function sendOutboundShipped(to: string, orderNumber: string, tracking?: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `Your order ${orderNumber} has been shipped`,
    html: baseLayout('Order shipped',
      `<p style="color:#475569;font-size:14px;line-height:1.6">Your outbound order <strong>${orderNumber}</strong> has been dispatched.</p>
      ${tracking ? `<p style="color:#475569;font-size:14px">Tracking: <strong>${tracking}</strong></p>` : ''}
      ${btn('View order', `${APP_URL}/orders/outbound`)}`)
  })
}

export async function sendDocumentUploaded(to: string, orderNumber: string, filename: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `Document uploaded to order ${orderNumber}`,
    html: baseLayout('New document attached',
      `<p style="color:#475569;font-size:14px;line-height:1.6">A document <strong>${filename}</strong> has been uploaded to order <strong>${orderNumber}</strong>.</p>
      ${btn('View documents', `${APP_URL}/documents`)}`)
  })
}

export async function sendTrialReminder(to: string, name: string, daysLeft: number) {
  await resend.emails.send({
    from: FROM, to,
    subject: `Your WMS trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html: baseLayout('Your trial is ending soon',
      `<p style="color:#475569;font-size:14px;line-height:1.6">Hi ${name}, your WMS Portal trial expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. Contact us to continue using the platform.</p>
      ${btn('Go to portal', APP_URL)}`)
  })
}

export async function sendNewTrialSignup(to: string, companyName: string, email: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `New trial signup — ${companyName}`,
    html: baseLayout('New trial account created',
      `<p style="color:#475569;font-size:14px;line-height:1.6"><strong>${companyName}</strong> (${email}) has signed up for a 14-day trial.</p>
      ${btn('View in admin', `${APP_URL}/admin/customers`)}`)
  })
}
