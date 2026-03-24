import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
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

      // Warehouse address for consignee emails
      const { data: warehouseSettings } = await supabase
        .from('company_settings')
        .select('warehouse_name, address_line1, address_line2, city, state, postal_code, country')
        .eq('id', 1)
        .single()
      const warehouseAddress = warehouseSettings
        ? [warehouseSettings.warehouse_name, warehouseSettings.address_line1, warehouseSettings.address_line2, warehouseSettings.city, warehouseSettings.state, warehouseSettings.postal_code].filter(Boolean).join(', ')
        : ''

      // Consignee
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

      // Use admin profile emails from the database, fall back to env var
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .in('role', ['admin', 'warehouse_staff'])
      const adminEmails = (admins ?? []).map((p: any) => p.email).filter(Boolean)
      const staffEmail = adminEmails.length > 0
        ? adminEmails[0]
        : (process.env.STAFF_NOTIFICATION_EMAIL || process.env.NEXT_PUBLIC_STAFF_EMAIL)
      const staffEmails = adminEmails.length > 0
        ? adminEmails
        : staffEmail ? [staffEmail] : []

      // Get all login emails for users linked to this customer
      const { data: customerProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('customer_id', order.customer_id)
      const customerEmails = (customerProfiles ?? []).map((p: any) => p.email).filter(Boolean)
      // Fall back to billing_email if no profiles found
      const customerEmail = customerEmails.length > 0
        ? customerEmails[0]
        : order.customers?.billing_email
      const customerName = order.customers?.name ?? ''
      const orderNumber = order.order_number

      const sends: Promise<any>[] = []

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

      const replyTo = staffEmails[0] ?? undefined
      const referenceType: string | undefined = order.reference_type ?? undefined
      const referenceNumber: string | undefined = order.reference_number ?? undefined

      if (type === 'outbound_submitted') {
        staffEmails.forEach(e => sends.push(sendOutboundSubmitted(e, orderNumber, customerName)))
        customerEmails.forEach(e => sends.push(sendOutboundSubmitted(e, orderNumber)))
        if (consigneeEmail) sends.push(sendConsigneeOrderConfirmation(consigneeEmail, orderNumber, consigneeName, orderItems, deliveryAddress, warehouseAddress, trackUrl, referenceType, referenceNumber, replyTo))
      }

      if (type === 'outbound_picked') {
        customerEmails.forEach(e => sends.push(sendOutboundPicked(e, orderNumber)))
        staffEmails.forEach(e => sends.push(sendOutboundPicked(e, orderNumber, customerName)))
        if (consigneeEmail) sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'picked', trackUrl, replyTo))
      }

      if (type === 'outbound_packed') {
        customerEmails.forEach(e => sends.push(sendOutboundPacked(e, orderNumber)))
        staffEmails.forEach(e => sends.push(sendOutboundPacked(e, orderNumber, customerName)))
        if (consigneeEmail) sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'packed', trackUrl, replyTo))
      }

      if (type === 'outbound_shipped') {
        customerEmails.forEach(e => sends.push(sendOutboundShipped(e, orderNumber, order.tracking_number ?? undefined)))
        staffEmails.forEach(e => sends.push(sendOutboundShipped(e, orderNumber, order.tracking_number ?? undefined, customerName)))
        if (consigneeEmail) sends.push(sendConsigneeOrderShipped(consigneeEmail, orderNumber, consigneeName, order.tracking_number ?? undefined, order.carrier ?? undefined, warehouseAddress, trackUrl, replyTo))
      }

      if (type === 'order_updated') {
        customerEmails.forEach(e => sends.push(sendOrderUpdated(e, orderNumber, order.order_type)))
        staffEmails.forEach(e => sends.push(sendOrderUpdated(e, orderNumber, order.order_type, customerName)))
        if (consigneeEmail && order.order_type === 'outbound') sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'updated', trackUrl, replyTo))
      }

      if (type === 'order_cancelled') {
        customerEmails.forEach(e => sends.push(sendOrderCancelled(e, orderNumber, order.order_type)))
        staffEmails.forEach(e => sends.push(sendOrderCancelled(e, orderNumber, order.order_type, customerName)))
        if (consigneeEmail && order.order_type === 'outbound') sends.push(sendConsigneeOrderUpdated(consigneeEmail, orderNumber, consigneeName, 'cancelled', trackUrl, replyTo))
      }

      const results = await Promise.allSettled(sends)
      const debug = {
        type,
        order_id,
        orderNumber,
        staffEmails,
        customerEmails,
        consigneeEmail,
        sendsQueued: sends.length,
        results: results.map((r, i) =>
          r.status === 'fulfilled'
            ? { i, ok: true, data: r.value }
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
        if (email) {
          await sendDocumentUploaded(email, (doc.orders as any)?.order_number, doc.filename)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Notification error:', e)
    return NextResponse.json({ success: false, error: e?.message ?? String(e) }, { status: 500 })
  }
}
