import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  OrderDetails,
  sendInboundSubmitted,
  sendInboundSubmittedCustomer,
  sendInboundReceived,
  sendInboundPutAway,
  sendOutboundSubmitted,
  sendOutboundPicked,
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

      // Customer emails
      const { data: customerProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('customer_id', order.customer_id)
      const customerEmails = (customerProfiles ?? []).map((p: any) => p.email).filter(Boolean)
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

      // ── Inbound ───────────────────────────────────────────────────────────
      if (type === 'inbound_submitted') {
        staffEmails.forEach(e => sends.push(sendInboundSubmitted(e, orderNumber, customerName)))
        customerEmails.forEach(e => sends.push(sendInboundSubmittedCustomer(e, orderNumber)))
      }
      if (type === 'inbound_received') {
        customerEmails.forEach(e => sends.push(sendInboundReceived(e, orderNumber)))
        staffEmails.forEach(e => sends.push(sendInboundReceived(e, orderNumber, customerName)))
      }
      if (type === 'inbound_put_away') {
        customerEmails.forEach(e => sends.push(sendInboundPutAway(e, orderNumber)))
        staffEmails.forEach(e => sends.push(sendInboundPutAway(e, orderNumber, customerName)))
      }

      // ── Outbound ──────────────────────────────────────────────────────────
      if (type === 'outbound_submitted') {
        staffEmails.forEach(e => sends.push(sendOutboundSubmitted(e, orderNumber, customerName, orderDetails)))
        customerEmails.forEach(e => sends.push(sendOutboundSubmitted(e, orderNumber, undefined, orderDetails)))
        if (consigneeEmail) sends.push(sendConsigneeOrderConfirmation(consigneeEmail, orderNumber, consigneeName, orderDetails, trackUrl, replyTo))
      }
      if (type === 'outbound_picked') {
        staffEmails.forEach(e => sends.push(sendOutboundPicked(e, orderNumber, customerName, orderDetails)))
        customerEmails.forEach(e => sends.push(sendOutboundPicked(e, orderNumber, undefined, orderDetails)))
        if (consigneeEmail) sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'picked', orderDetails, trackUrl, replyTo))
      }
      if (type === 'outbound_packed') {
        staffEmails.forEach(e => sends.push(sendOutboundPacked(e, orderNumber, customerName, orderDetails)))
        customerEmails.forEach(e => sends.push(sendOutboundPacked(e, orderNumber, undefined, orderDetails)))
        if (consigneeEmail) sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'packed', orderDetails, trackUrl, replyTo))
      }
      if (type === 'outbound_shipped') {
        staffEmails.forEach(e => sends.push(sendOutboundShipped(e, orderNumber, order.tracking_number ?? undefined, customerName, orderDetails)))
        customerEmails.forEach(e => sends.push(sendOutboundShipped(e, orderNumber, order.tracking_number ?? undefined, undefined, orderDetails)))
        if (consigneeEmail) sends.push(sendConsigneeOrderShipped(consigneeEmail, orderNumber, consigneeName, orderDetails, trackUrl, replyTo))
      }
      if (type === 'order_updated') {
        staffEmails.forEach(e => sends.push(sendOrderUpdated(e, orderNumber, order.order_type, customerName, order.order_type === 'outbound' ? orderDetails : undefined)))
        customerEmails.forEach(e => sends.push(sendOrderUpdated(e, orderNumber, order.order_type, undefined, order.order_type === 'outbound' ? orderDetails : undefined)))
        if (consigneeEmail && order.order_type === 'outbound') sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'updated', orderDetails, trackUrl, replyTo))
      }
      if (type === 'order_cancelled') {
        staffEmails.forEach(e => sends.push(sendOrderCancelled(e, orderNumber, order.order_type, customerName)))
        customerEmails.forEach(e => sends.push(sendOrderCancelled(e, orderNumber, order.order_type)))
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
