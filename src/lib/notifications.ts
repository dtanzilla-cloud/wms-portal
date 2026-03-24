import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function getFrom() {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL
  try {
    const host = new URL(APP_URL.startsWith('http') ? APP_URL : `https://${APP_URL}`).hostname
    return `CTS Portal <noreply@${host}>`
  } catch {
    return `CTS Portal <noreply@yourdomain.com>`
  }
}
const FROM = getFrom()

// ── Shared order details interface ───────────────────────────────────────────

export interface OrderDetails {
  consigneeName?: string
  deliveryAddress?: string   // formatted string, used in consignee + staff emails
  warehouseAddress?: string  // shown only in consignee emails
  referenceType?: string
  referenceNumber?: string
  shipByDate?: string
  palletCount?: number | null
  palletWeightKg?: number | null
  palletDimensions?: string | null
  carrier?: string
  trackingNumber?: string
  items?: { sku_code: string; description: string; quantity: number; unit: string }[]
  documents?: { filename: string; url?: string }[]
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

function p(text: string) {
  return `<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px">${text}</p>`
}

function btn(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">${label}</a>`
}

function addrCell(label: string, address: string) {
  const lines = address.replace(/,\s*/g, '<br>')
  return `<td style="vertical-align:top;padding-right:8px">
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px" cellspacing="0" cellpadding="0">
      <tr><td style="padding:12px 14px">
        <p style="margin:0 0 5px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600">${label}</p>
        <p style="margin:0;font-size:13px;color:#1e293b;line-height:1.7">${lines}</p>
      </td></tr>
    </table>
  </td>`
}

/**
 * Builds a rich order details block — fully email-safe (table-only layout).
 * includeWarehouse = true for consignee emails; false for staff/customer.
 */
function buildOrderDetailsHtml(d: OrderDetails, includeWarehouse = false): string {
  const parts: string[] = []

  // Two-column address row
  const showDelivery = !!d.deliveryAddress
  const showWarehouse = includeWarehouse && !!d.warehouseAddress
  if (showDelivery || showWarehouse) {
    parts.push(`
    <table style="width:100%;border-collapse:collapse;margin:16px 0" cellspacing="0" cellpadding="0"><tr>
      ${showDelivery ? addrCell('Ship to', d.deliveryAddress!) : '<td></td>'}
      ${showWarehouse ? addrCell('Shipping from', d.warehouseAddress!) : '<td></td>'}
    </tr></table>`)
  }

  // Key/value details table
  const detailRows: string[] = []
  if (d.referenceType && d.referenceNumber)
    detailRows.push(detailRow(d.referenceType, `<span style="font-family:monospace">${d.referenceNumber}</span>`))
  if (d.shipByDate)
    detailRows.push(detailRow('Ship by', new Date(d.shipByDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })))
  if (d.palletCount)
    detailRows.push(detailRow('Pallets', String(d.palletCount)))
  if (d.palletWeightKg)
    detailRows.push(detailRow('Pallet weight', `${d.palletWeightKg} kg`))
  if (d.palletDimensions)
    detailRows.push(detailRow('Dimensions', `<span style="font-family:monospace">${d.palletDimensions}</span>`))
  if (d.carrier)
    detailRows.push(detailRow('Carrier', d.carrier))
  if (d.trackingNumber)
    detailRows.push(detailRow('Tracking #', `<span style="font-family:monospace">${d.trackingNumber}</span>`))

  if (detailRows.length) {
    parts.push(`<table style="width:100%;border-collapse:collapse;margin:16px 0" cellspacing="0" cellpadding="0">${detailRows.join('')}</table>`)
  }

  // Items table
  if (d.items && d.items.length > 0) {
    const rows = d.items.map(i =>
      `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-size:12px;color:#c2410c">${i.sku_code}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#374151;font-size:13px">${i.description}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#1e293b;font-weight:600;font-size:13px">${i.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b;font-size:13px">${i.unit}</td>
      </tr>`
    ).join('')
    parts.push(`
    <p style="margin:16px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600">Items</p>
    <table style="width:100%;border-collapse:collapse" cellspacing="0" cellpadding="0">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="text-align:left;padding:8px 10px;font-size:11px;color:#64748b;font-weight:600">SKU</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;color:#64748b;font-weight:600">Description</th>
          <th style="text-align:right;padding:8px 10px;font-size:11px;color:#64748b;font-weight:600">Qty</th>
          <th style="text-align:right;padding:8px 10px;font-size:11px;color:#64748b;font-weight:600">Unit</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`)
  }

  // Attachments
  if (d.documents && d.documents.length > 0) {
    const docRows = d.documents.map(doc =>
      `<tr><td style="padding:5px 0;border-bottom:1px solid #f1f5f9">
        ${doc.url
          ? `<a href="${doc.url}" style="color:#2563eb;font-size:13px;text-decoration:none">📎 ${doc.filename}</a>`
          : `<span style="font-size:13px;color:#374151">📎 ${doc.filename}</span>`}
      </td></tr>`
    ).join('')
    parts.push(`
    <p style="margin:16px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600">Attachments</p>
    <table style="width:100%;border-collapse:collapse" cellspacing="0" cellpadding="0">
      <tbody>${docRows}</tbody>
    </table>`)
  }

  return parts.join('\n')
}

function detailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;color:#64748b;font-size:13px;width:140px;border-bottom:1px solid #f1f5f9">${label}</td>
    <td style="padding:5px 0;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9">${value}</td>
  </tr>`
}

function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif">
<div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1d4ed8;padding:20px 28px">
    <span style="color:#fff;font-size:16px;font-weight:600">CTS Portal</span>
  </div>
  <div style="padding:28px">
    <h2 style="margin:0 0 12px;font-size:18px;color:#1e293b">${title}</h2>
    ${body}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
      CTS Portal · <a href="${APP_URL}" style="color:#3b82f6">Go to portal</a>
    </div>
  </div>
</div>
</body></html>`
}

function consigneeLayout(title: string, body: string, trackUrl: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif">
<div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1d4ed8;padding:20px 28px">
    <span style="color:#fff;font-size:16px;font-weight:600">CTS Portal</span>
  </div>
  <div style="padding:28px">
    <h2 style="margin:0 0 12px;font-size:18px;color:#1e293b">${title}</h2>
    ${body}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f1f5f9">
      <a href="${trackUrl}" style="display:inline-block;padding:10px 22px;background:#f97316;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">Track your shipment</a>
    </div>
  </div>
</div>
</body></html>`
}

// ── Inbound ──────────────────────────────────────────────────────────────────

export async function sendInboundSubmitted(to: string, orderNumber: string, customerName: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `New inbound order ${orderNumber} — ${customerName}`,
    html: baseLayout('New inbound order received',
      `${p(`Customer <strong>${customerName}</strong> has submitted inbound order <strong>${orderNumber}</strong> and is awaiting warehouse receipt.`)}
      ${btn('View order', `${APP_URL}/orders/inbound`)}`)
  })
}

export async function sendInboundSubmittedCustomer(to: string, orderNumber: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `Inbound order ${orderNumber} submitted`,
    html: baseLayout('Order submitted',
      `${p(`Your inbound order <strong>${orderNumber}</strong> has been submitted to the warehouse. You'll receive updates as it progresses.`)}
      ${btn('View order', `${APP_URL}/orders/inbound`)}`)
  })
}

export async function sendInboundReceived(to: string, orderNumber: string, customerName?: string) {
  const isStaff = !!customerName
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff ? `Inbound order ${orderNumber} marked received` : `Your shipment ${orderNumber} has arrived`,
    html: baseLayout(
      isStaff ? 'Inbound shipment received' : 'Shipment arrived at warehouse',
      isStaff
        ? `${p(`Inbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been marked as received and is awaiting put-away.`)}${btn('View order', `${APP_URL}/orders/inbound`)}`
        : `${p(`Your inbound shipment <strong>${orderNumber}</strong> has arrived at the warehouse and is being processed.`)}${btn('View order', `${APP_URL}/orders/inbound`)}`
    )
  })
}

export async function sendInboundPutAway(to: string, orderNumber: string, customerName?: string) {
  const isStaff = !!customerName
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff ? `Inbound order ${orderNumber} put away` : `Your shipment ${orderNumber} has been put away`,
    html: baseLayout(
      isStaff ? 'Inbound order put away' : 'Shipment received & put away',
      isStaff
        ? `${p(`Inbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been put away. Inventory has been updated.`)}${btn('View order', `${APP_URL}/orders/inbound`)}`
        : `${p(`Your inbound order <strong>${orderNumber}</strong> has been received and put away. Your inventory has been updated.`)}${btn('View inventory', `${APP_URL}/inventory`)}`
    )
  })
}

// ── Outbound ─────────────────────────────────────────────────────────────────

export async function sendOutboundSubmitted(to: string, orderNumber: string, customerName?: string, details?: OrderDetails) {
  const isStaff = !!customerName
  const intro = isStaff
    ? p(`Customer <strong>${customerName}</strong> has submitted outbound order <strong>${orderNumber}</strong> and is awaiting fulfillment.`)
    : p(`Your outbound order <strong>${orderNumber}</strong> has been submitted. The warehouse will begin processing it shortly.`)
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff ? `New outbound order ${orderNumber} — ${customerName}` : `Outbound order ${orderNumber} submitted`,
    html: baseLayout(isStaff ? 'New outbound order received' : 'Order submitted',
      `${intro}${details ? buildOrderDetailsHtml(details) : ''}${btn('View order', `${APP_URL}/orders/outbound`)}`)
  })
}

export async function sendOutboundPicked(to: string, orderNumber: string, customerName?: string, details?: OrderDetails) {
  const isStaff = !!customerName
  const intro = isStaff
    ? p(`Outbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been picked.`)
    : p(`Your outbound order <strong>${orderNumber}</strong> is currently being picked at the warehouse.`)
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff ? `Outbound order ${orderNumber} picked` : `Your order ${orderNumber} is being picked`,
    html: baseLayout(isStaff ? 'Outbound order picked' : 'Order being picked',
      `${intro}${details ? buildOrderDetailsHtml(details) : ''}${btn('View order', `${APP_URL}/orders/outbound`)}`)
  })
}

export async function sendOutboundPacked(to: string, orderNumber: string, customerName?: string, details?: OrderDetails) {
  const isStaff = !!customerName
  const intro = isStaff
    ? p(`Outbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been packed and is ready to ship.`)
    : p(`Your outbound order <strong>${orderNumber}</strong> has been packed and is ready for shipment.`)
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff ? `Outbound order ${orderNumber} packed` : `Your order ${orderNumber} has been packed`,
    html: baseLayout(isStaff ? 'Outbound order packed' : 'Order packed & ready to ship',
      `${intro}${details ? buildOrderDetailsHtml(details) : ''}${btn('View order', `${APP_URL}/orders/outbound`)}`)
  })
}

export async function sendOutboundShipped(to: string, orderNumber: string, tracking?: string, customerName?: string, details?: OrderDetails) {
  const isStaff = !!customerName
  const intro = isStaff
    ? p(`Outbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been dispatched.`)
    : p(`Your outbound order <strong>${orderNumber}</strong> has been dispatched.`)
  // Merge tracking into details so it shows in the detail table
  const merged: OrderDetails | undefined = details
    ? { ...details, trackingNumber: details.trackingNumber ?? tracking }
    : tracking ? { trackingNumber: tracking } : undefined
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff ? `Outbound order ${orderNumber} shipped` : `Your order ${orderNumber} has been shipped`,
    html: baseLayout(isStaff ? 'Outbound order shipped' : 'Order shipped',
      `${intro}${merged ? buildOrderDetailsHtml(merged) : ''}${btn('View order', `${APP_URL}/orders/outbound`)}`)
  })
}

// ── Order updated / cancelled ─────────────────────────────────────────────────

export async function sendOrderUpdated(to: string, orderNumber: string, orderType: string, customerName?: string, details?: OrderDetails) {
  const isStaff = !!customerName
  const typeLabel = orderType === 'inbound' ? 'inbound' : 'outbound'
  const intro = isStaff
    ? p(`${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been updated.`)
    : p(`Your ${typeLabel} order <strong>${orderNumber}</strong> has been updated. Please review the changes.`)
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff ? `Order ${orderNumber} has been updated` : `Your ${typeLabel} order ${orderNumber} has been updated`,
    html: baseLayout('Order updated',
      `${intro}${typeLabel === 'outbound' && details ? buildOrderDetailsHtml(details) : ''}${btn('View order', `${APP_URL}/orders/${typeLabel}`)}`)
  })
}

export async function sendOrderCancelled(to: string, orderNumber: string, orderType: string, customerName?: string) {
  const isStaff = !!customerName
  const typeLabel = orderType === 'inbound' ? 'inbound' : 'outbound'
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff ? `Order ${orderNumber} cancelled` : `Your ${typeLabel} order ${orderNumber} has been cancelled`,
    html: baseLayout('Order cancelled',
      isStaff
        ? `${p(`${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been cancelled.`)}${btn('View orders', `${APP_URL}/orders/${typeLabel}`)}`
        : `${p(`Your ${typeLabel} order <strong>${orderNumber}</strong> has been cancelled.`)}${p('If you have any questions, please contact the warehouse.')}${btn('View orders', `${APP_URL}/orders/${typeLabel}`)}`
    )
  })
}

// ── Consignee ────────────────────────────────────────────────────────────────

export async function sendConsigneeOrderConfirmation(
  to: string,
  orderNumber: string,
  consigneeName: string,
  details: OrderDetails,
  trackUrl: string,
  referenceType?: string,
  referenceNumber?: string,
  replyTo?: string,
) {
  const refPart = referenceType && referenceNumber ? ` ${referenceType} ${referenceNumber}` : ''
  const subject = `Outbound order ${consigneeName}${refPart}`

  const merged: OrderDetails = { ...details, consigneeName, referenceType, referenceNumber }

  const body = `
    ${p(`An outbound order <strong>${orderNumber}</strong> has been placed for delivery to <strong>${consigneeName}</strong>.`)}
    ${buildOrderDetailsHtml(merged, true)}
  `

  await resend.emails.send({
    from: FROM, to,
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject,
    html: consigneeLayout(`Incoming shipment — ${orderNumber}`, body, trackUrl),
  })
}

export async function sendConsigneeOrderShipped(
  to: string,
  orderNumber: string,
  consigneeName: string,
  details: OrderDetails,
  trackUrl?: string,
  replyTo?: string,
) {
  const body = `
    ${p(`Order <strong>${orderNumber}</strong> has been dispatched and is on its way to <strong>${consigneeName}</strong>.`)}
    ${buildOrderDetailsHtml(details, true)}
  `
  await resend.emails.send({
    from: FROM, to,
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject: `Your shipment ${orderNumber} is on its way`,
    html: consigneeLayout('Your shipment has been dispatched', body, trackUrl ?? APP_URL),
  })
}

export async function sendConsigneeOrderUpdated(
  to: string,
  orderNumber: string,
  consigneeName: string,
  status: string,
  details: OrderDetails,
  trackUrl?: string,
  replyTo?: string,
) {
  const statusLabel = status.replace(/_/g, ' ')
  const body = `
    ${p(`Your incoming shipment <strong>${orderNumber}</strong> for <strong>${consigneeName}</strong> has been updated.`)}
    ${p(`Current status: <strong style="text-transform:capitalize">${statusLabel}</strong>`)}
    ${buildOrderDetailsHtml(details, true)}
  `
  await resend.emails.send({
    from: FROM, to,
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject: `Update on your incoming shipment ${orderNumber}`,
    html: consigneeLayout('Shipment update', body, trackUrl ?? APP_URL),
  })
}

// ── Documents & Trials ───────────────────────────────────────────────────────

export async function sendDocumentUploaded(to: string, orderNumber: string, filename: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `Document uploaded to order ${orderNumber}`,
    html: baseLayout('New document attached',
      `${p(`A document <strong>${filename}</strong> has been uploaded to order <strong>${orderNumber}</strong>.`)}
      ${btn('View documents', `${APP_URL}/documents`)}`)
  })
}

export async function sendTrialReminder(to: string, name: string, daysLeft: number) {
  await resend.emails.send({
    from: FROM, to,
    subject: `Your CTS Portal trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html: baseLayout('Your trial is ending soon',
      `${p(`Hi ${name}, your CTS Portal trial expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. Contact us to continue using the platform.`)}
      ${btn('Go to portal', APP_URL)}`)
  })
}

export async function sendNewTrialSignup(to: string, companyName: string, email: string) {
  await resend.emails.send({
    from: FROM, to,
    subject: `New trial signup — ${companyName}`,
    html: baseLayout('New trial account created',
      `${p(`<strong>${companyName}</strong> (${email}) has signed up for a 14-day trial.`)}
      ${btn('View in admin', `${APP_URL}/admin/customers`)}`)
  })
}
