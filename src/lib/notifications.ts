import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Use explicit RESEND_FROM_EMAIL if set, otherwise derive hostname safely from APP_URL
function getFrom() {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL
  try {
    const host = new URL(APP_URL.startsWith('http') ? APP_URL : `https://${APP_URL}`).hostname
    return `WMS Portal <noreply@${host}>`
  } catch {
    return `WMS Portal <noreply@yourdomain.com>`
  }
}
const FROM = getFrom()

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

function p(text: string) {
  return `<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px">${text}</p>`
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
    subject: isStaff
      ? `Inbound order ${orderNumber} marked received`
      : `Your shipment ${orderNumber} has arrived`,
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
    subject: isStaff
      ? `Inbound order ${orderNumber} put away`
      : `Your shipment ${orderNumber} has been put away`,
    html: baseLayout(
      isStaff ? 'Inbound order put away' : 'Shipment received & put away',
      isStaff
        ? `${p(`Inbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been put away. Inventory has been updated.`)}${btn('View order', `${APP_URL}/orders/inbound`)}`
        : `${p(`Your inbound order <strong>${orderNumber}</strong> has been received and put away. Your inventory has been updated.`)}${btn('View inventory', `${APP_URL}/inventory`)}`
    )
  })
}

// ── Outbound ─────────────────────────────────────────────────────────────────

export async function sendOutboundSubmitted(to: string, orderNumber: string, customerName?: string) {
  const isStaff = !!customerName
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff
      ? `New outbound order ${orderNumber} — ${customerName}`
      : `Outbound order ${orderNumber} submitted`,
    html: baseLayout(
      isStaff ? 'New outbound order received' : 'Order submitted',
      isStaff
        ? `${p(`Customer <strong>${customerName}</strong> has submitted outbound order <strong>${orderNumber}</strong> and is awaiting fulfillment.`)}${btn('View order', `${APP_URL}/orders/outbound`)}`
        : `${p(`Your outbound order <strong>${orderNumber}</strong> has been submitted. The warehouse will begin processing it shortly.`)}${btn('View order', `${APP_URL}/orders/outbound`)}`
    )
  })
}

export async function sendOutboundPicked(to: string, orderNumber: string, customerName?: string) {
  const isStaff = !!customerName
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff
      ? `Outbound order ${orderNumber} picked`
      : `Your order ${orderNumber} is being picked`,
    html: baseLayout(
      isStaff ? 'Outbound order picked' : 'Order being picked',
      isStaff
        ? `${p(`Outbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been picked.`)}${btn('View order', `${APP_URL}/orders/outbound`)}`
        : `${p(`Your outbound order <strong>${orderNumber}</strong> is currently being picked at the warehouse.`)}${btn('View order', `${APP_URL}/orders/outbound`)}`
    )
  })
}

export async function sendOutboundPacked(to: string, orderNumber: string, customerName?: string) {
  const isStaff = !!customerName
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff
      ? `Outbound order ${orderNumber} packed`
      : `Your order ${orderNumber} has been packed`,
    html: baseLayout(
      isStaff ? 'Outbound order packed' : 'Order packed & ready to ship',
      isStaff
        ? `${p(`Outbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been packed and is ready to ship.`)}${btn('View order', `${APP_URL}/orders/outbound`)}`
        : `${p(`Your outbound order <strong>${orderNumber}</strong> has been packed and is ready for shipment.`)}${btn('View order', `${APP_URL}/orders/outbound`)}`
    )
  })
}

export async function sendOutboundShipped(to: string, orderNumber: string, tracking?: string, customerName?: string) {
  const isStaff = !!customerName
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff
      ? `Outbound order ${orderNumber} shipped`
      : `Your order ${orderNumber} has been shipped`,
    html: baseLayout(
      isStaff ? 'Outbound order shipped' : 'Order shipped',
      isStaff
        ? `${p(`Outbound order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been dispatched.`)}${tracking ? p(`Tracking: <strong>${tracking}</strong>`) : ''}${btn('View order', `${APP_URL}/orders/outbound`)}`
        : `${p(`Your outbound order <strong>${orderNumber}</strong> has been dispatched.`)}${tracking ? p(`Tracking: <strong>${tracking}</strong>`) : ''}${btn('View order', `${APP_URL}/orders/outbound`)}`
    )
  })
}

// ── Order updated ────────────────────────────────────────────────────────────

export async function sendOrderUpdated(to: string, orderNumber: string, orderType: string, customerName?: string) {
  const isStaff = !!customerName
  const typeLabel = orderType === 'inbound' ? 'inbound' : 'outbound'
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff
      ? `Order ${orderNumber} has been updated`
      : `Your ${typeLabel} order ${orderNumber} has been updated`,
    html: baseLayout('Order updated',
      isStaff
        ? `${p(`${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} order <strong>${orderNumber}</strong> for <strong>${customerName}</strong> has been updated.`)}${btn('View order', `${APP_URL}/orders/${typeLabel}`)}`
        : `${p(`Your ${typeLabel} order <strong>${orderNumber}</strong> has been updated. Please review the changes.`)}${btn('View order', `${APP_URL}/orders/${typeLabel}`)}`
    )
  })
}

// ── Cancellation ─────────────────────────────────────────────────────────────

export async function sendOrderCancelled(to: string, orderNumber: string, orderType: string, customerName?: string) {
  const isStaff = !!customerName
  const typeLabel = orderType === 'inbound' ? 'inbound' : 'outbound'
  await resend.emails.send({
    from: FROM, to,
    subject: isStaff
      ? `Order ${orderNumber} cancelled`
      : `Your ${typeLabel} order ${orderNumber} has been cancelled`,
    html: baseLayout(
      'Order cancelled',
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
  items: { sku_code: string; description: string; quantity: number; unit: string }[],
  deliveryAddress: string,
  warehouseAddress: string,
) {
  const rows = items.map(i =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${i.sku_code}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${i.description}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${i.quantity} ${i.unit}</td>
    </tr>`
  ).join('')

  await resend.emails.send({
    from: FROM, to,
    subject: `Incoming shipment ${orderNumber} — Order confirmation`,
    html: baseLayout('Incoming shipment confirmation',
      `${p(`An outbound order <strong>${orderNumber}</strong> has been placed for delivery to <strong>${consigneeName}</strong>.`)}
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="text-align:left;padding:8px">SKU</th>
            <th style="text-align:left;padding:8px">Description</th>
            <th style="text-align:left;padding:8px">Qty</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${deliveryAddress ? p(`Deliver to: <strong>${deliveryAddress}</strong>`) : ''}
      ${warehouseAddress ? p(`Shipping from: ${warehouseAddress}`) : ''}`
    )
  })
}

export async function sendConsigneeOrderShipped(
  to: string,
  orderNumber: string,
  consigneeName: string,
  tracking?: string,
  carrier?: string,
  warehouseAddress?: string,
) {
  await resend.emails.send({
    from: FROM, to,
    subject: `Your shipment ${orderNumber} is on its way`,
    html: baseLayout('Your shipment has been dispatched',
      `${p(`Order <strong>${orderNumber}</strong> has been dispatched and is on its way to <strong>${consigneeName}</strong>.`)}
      ${carrier ? p(`Carrier: <strong>${carrier}</strong>`) : ''}
      ${tracking ? p(`Tracking number: <strong>${tracking}</strong>`) : ''}
      ${warehouseAddress ? p(`Shipped from: ${warehouseAddress}`) : ''}`
    )
  })
}

export async function sendConsigneeOrderUpdated(
  to: string,
  orderNumber: string,
  consigneeName: string,
  status: string,
) {
  const statusLabel = status.replace(/_/g, ' ')
  await resend.emails.send({
    from: FROM, to,
    subject: `Update on your incoming shipment ${orderNumber}`,
    html: baseLayout('Shipment update',
      `${p(`Your incoming shipment <strong>${orderNumber}</strong> for <strong>${consigneeName}</strong> has been updated.`)}
      ${p(`Current status: <strong>${statusLabel}</strong>`)}`
    )
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
    subject: `Your WMS trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html: baseLayout('Your trial is ending soon',
      `${p(`Hi ${name}, your WMS Portal trial expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. Contact us to continue using the platform.`)}
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
