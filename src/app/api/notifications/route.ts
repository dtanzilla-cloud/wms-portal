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
        .select('*, customers(name, billing_email)')
        .eq('id', order_id)
        .single()

      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

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

      const customerEmail = order.customers?.billing_email
      const customerName = order.customers?.name ?? ''
      const orderNumber = order.order_number

      const sends: Promise<any>[] = []

      if (type === 'inbound_submitted') {
        staffEmails.forEach(e => sends.push(sendInboundSubmitted(e, orderNumber, customerName)))
        if (customerEmail) sends.push(sendInboundSubmittedCustomer(customerEmail, orderNumber))
      }

      if (type === 'inbound_received') {
        if (customerEmail) sends.push(sendInboundReceived(customerEmail, orderNumber))
        staffEmails.forEach(e => sends.push(sendInboundReceived(e, orderNumber, customerName)))
      }

      if (type === 'inbound_put_away') {
        if (customerEmail) sends.push(sendInboundPutAway(customerEmail, orderNumber))
        staffEmails.forEach(e => sends.push(sendInboundPutAway(e, orderNumber, customerName)))
      }

      if (type === 'outbound_submitted') {
        staffEmails.forEach(e => sends.push(sendOutboundSubmitted(e, orderNumber, customerName)))
        if (customerEmail) sends.push(sendOutboundSubmitted(customerEmail, orderNumber))
      }

      if (type === 'outbound_picked') {
        if (customerEmail) sends.push(sendOutboundPicked(customerEmail, orderNumber))
        staffEmails.forEach(e => sends.push(sendOutboundPicked(e, orderNumber, customerName)))
      }

      if (type === 'outbound_packed') {
        if (customerEmail) sends.push(sendOutboundPacked(customerEmail, orderNumber))
        staffEmails.forEach(e => sends.push(sendOutboundPacked(e, orderNumber, customerName)))
      }

      if (type === 'outbound_shipped') {
        if (customerEmail) sends.push(sendOutboundShipped(customerEmail, orderNumber, order.tracking_number ?? undefined))
        staffEmails.forEach(e => sends.push(sendOutboundShipped(e, orderNumber, order.tracking_number ?? undefined, customerName)))
      }

      if (type === 'order_updated') {
        if (customerEmail) sends.push(sendOrderUpdated(customerEmail, orderNumber, order.order_type))
        staffEmails.forEach(e => sends.push(sendOrderUpdated(e, orderNumber, order.order_type, customerName)))
      }

      if (type === 'order_cancelled') {
        if (customerEmail) sends.push(sendOrderCancelled(customerEmail, orderNumber, order.order_type))
        staffEmails.forEach(e => sends.push(sendOrderCancelled(e, orderNumber, order.order_type, customerName)))
      }

      const results = await Promise.allSettled(sends)
      const debug = {
        type,
        order_id,
        orderNumber,
        staffEmails,
        customerEmail: customerEmail ?? null,
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
