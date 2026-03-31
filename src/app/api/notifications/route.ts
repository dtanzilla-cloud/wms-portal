import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  OrderDetails,
  sendInboundSubmitted,
  sendInboundReceived,
  sendInboundPutAway,
  sendOutboundSubmitted,
  sendOutboundPacked,
  sendOutboundShipped,
  sendOrderUpdated,
  sendOrderCancelled,
  sendDocumentUploaded,
  sendConsigneeOrderConfirmation,
  sendConsigneeOrderShipped,
  sendConsigneeOrderUpdated,
} from '@/lib/notifications'

export async function POST(req: NextRequest) {
  // Set DISABLE_EMAILS=true in environment to suppress all outgoing emails
  // (useful during development / bug fixing). Remove or set to false to re-enable.
  if (process.env.DISABLE_EMAILS === 'true') {
    return NextResponse.json({ success: true, emailsDisabled: true })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { type, order_id, document_id } = await req.json()

    if (order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('*, customers(name, billing_email), consignees(company_name, contact_email), consignee_addresses:consignee_address_id(address_line1, address_line2, city, state, postal_code, country), order_items(quantity, skus(sku_code, description, unit))')
        .eq('id', order_id)
        .single()

      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      // Warehouse address
      const { data: ws } = await supabase
        .from('company_settings')
        .select('warehouse_name, address_line1, address_line2, city, state, postal_code, country, phone, email')
        .eq('id', 1)
        .single()
      const warehouseAddress = ws
        ? [ws.warehouse_name, ws.address_line1, ws.address_line2, ws.city, ws.state, ws.postal_code].filter(Boolean).join(', ')
        : ''

      // Fetch order documents (exclude consignee uploads) and get signed URLs
      const { data: orderDocuments } = await supabase
        .from('documents')
        .select('filename, storage_path')
        .eq('order_id', order_id)
        .neq('document_type', 'consignee_attachment')

      const documents: { filename: string; url?: string }[] = []
      for (const doc of orderDocuments ?? []) {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7)
        documents.push({ filename: doc.filename, url: signed?.signedUrl })
      }

      // Consignee info
      const trackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/track/${order.order_number}`
      const consigneeEmail = (order.consignees as any)?.contact_email ?? null
      const consigneeName = (order.consignees as any)?.company_name ?? ''
      const addr = order.consignee_addresses as any
      const deliveryAddress = addr
        ? [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean).join(', ')
        : ''
      const orderItems = ((order.order_items as any[]) ?? []).map((i: any) => ({
        sku_code: i.skus?.sku_code ?? '',
        description: i.skus?.description ?? '',
        quantity: i.quantity,
        unit: i.skus?.unit ?? '',
      }))

      // Staff emails
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .in('role', ['admin', 'warehouse_staff'])
      const adminEmails = (admins ?? []).map((p: any) => p.email).filter(Boolean)
      const fallbackStaff = process.env.STAFF_NOTIFICATION_EMAIL || process.env.NEXT_PUBLIC_STAFF_EMAIL
      const staffEmails = adminEmails.length > 0 ? adminEmails : fallbackStaff ? [fallbackStaff] : []

      // Customer emails — prefer portal accounts linked to this customer;
      // fall back to the customer's billing_email if no profiles are linked yet.
      const { data: customerProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('customer_id', order.customer_id)
      const billingEmail: string | undefined = (order.customers as any)?.billing_email ?? undefined
      const profileEmails = (customerProfiles ?? []).map((p: any) => p.email).filter(Boolean)
      const customerEmails: string[] = profileEmails.length > 0
        ? profileEmails
        : billingEmail ? [billingEmail] : []
      const customerName = order.customers?.name ?? ''
      const orderNumber = order.order_number

      const replyTo = staffEmails[0] ?? undefined

      // ── Build shared OrderDetails object ──────────────────────────────────
      const orderDetails: OrderDetails = {
        customerName,
        consigneeName,
        deliveryAddress,
        warehouseAddress,
        referenceType: order.reference_type ?? undefined,
        referenceNumber: order.reference_number ?? undefined,
        shipByDate: order.ship_by_date ?? undefined,
        palletCount: order.pallet_count ?? undefined,
        palletWeightKg: order.pallet_weight_kg ?? undefined,
        palletDimensions: order.pallet_dimensions ?? undefined,
        carrier: order.carrier ?? undefined,
        trackingNumber: order.tracking_number ?? undefined,
        items: orderItems,
        documents,
      }

      const sends: Promise<any>[] = []
      // All staff + customer recipients in one combined list
      const allEmails = [...staffEmails, ...customerEmails]

      // ── Inbound ───────────────────────────────────────────────────────────
      if (type === 'inbound_submitted') {
        if (allEmails.length) sends.push(sendInboundSubmitted(allEmails, orderNumber, customerName, orderDetails))
      }
      if (type === 'inbound_received') {
        if (allEmails.length) sends.push(sendInboundReceived(allEmails, orderNumber, customerName, orderDetails))
      }
      if (type === 'inbound_put_away') {
        if (allEmails.length) sends.push(sendInboundPutAway(allEmails, orderNumber, customerName, orderDetails))
      }

      // ── Outbound ──────────────────────────────────────────────────────────
      if (type === 'outbound_submitted') {
        if (allEmails.length) sends.push(sendOutboundSubmitted(allEmails, orderNumber, customerName, orderDetails))
        if (consigneeEmail) sends.push(sendConsigneeOrderConfirmation(consigneeEmail, orderNumber, consigneeName, orderDetails, trackUrl, replyTo))
      }
      if (type === 'outbound_packed') {
        if (allEmails.length) sends.push(sendOutboundPacked(allEmails, orderNumber, customerName, orderDetails))
        if (consigneeEmail) sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'packed', orderDetails, trackUrl, replyTo))
      }
      if (type === 'outbound_shipped') {
        if (allEmails.length) sends.push(sendOutboundShipped(allEmails, orderNumber, order.tracking_number ?? undefined, customerName, orderDetails))
        if (consigneeEmail) sends.push(sendConsigneeOrderShipped(consigneeEmail, orderNumber, consigneeName, orderDetails, trackUrl, replyTo))
      }
      if (type === 'order_updated') {
        if (allEmails.length) sends.push(sendOrderUpdated(allEmails, orderNumber, order.order_type, customerName, orderDetails))
        if (consigneeEmail && order.order_type === 'outbound') sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'updated', orderDetails, trackUrl, replyTo))
      }
      if (type === 'order_cancelled') {
        if (allEmails.length) sends.push(sendOrderCancelled(allEmails, orderNumber, order.order_type, customerName))
        if (consigneeEmail && order.order_type === 'outbound') sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'cancelled', orderDetails, trackUrl, replyTo))
      }

      const results = await Promise.allSettled(sends)
      const debug = {
        type, order_id, orderNumber, staffEmails, customerEmails, consigneeEmail,
        sendsQueued: sends.length,
        results: results.map((r, i) =>
          r.status === 'fulfilled'
            ? { i, ok: true }
            : { i, ok: false, error: r.reason?.message ?? String(r.reason) }
        ),
      }
      console.log('Notification debug:', JSON.stringify(debug, null, 2))
      return NextResponse.json({ success: true, debug })
    }

    if (document_id) {
      const { data: doc } = await supabase
        .from('documents')
        .select('*, orders(order_number, customers(billing_email))')
        .eq('id', document_id)
        .single()
      if (doc && type === 'document_uploaded') {
        const email = (doc.orders as any)?.customers?.billing_email
        if (email) await sendDocumentUploaded(email, (doc.orders as any)?.order_number, doc.filename)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Notification error:', e)
    return NextResponse.json({ success: false, error: e?.message ?? String(e) }, { status: 500 })
  }
}
