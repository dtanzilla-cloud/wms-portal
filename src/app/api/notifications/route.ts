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

      const staffEmail = process.env.STAFF_NOTIFICATION_EMAIL || process.env.NEXT_PUBLIC_STAFF_EMAIL
      const customerEmail = order.customers?.billing_email
      const customerName = order.customers?.name ?? ''
      const orderNumber = order.order_number

      const sends: Promise<any>[] = []

      if (type === 'inbound_submitted') {
        if (staffEmail) sends.push(sendInboundSubmitted(staffEmail, orderNumber, customerName))
        if (customerEmail) sends.push(sendInboundSubmittedCustomer(customerEmail, orderNumber))
      }

      if (type === 'inbound_received') {
        if (customerEmail) sends.push(sendInboundReceived(customerEmail, orderNumber))
        if (staffEmail) sends.push(sendInboundReceived(staffEmail, orderNumber, customerName))
      }

      if (type === 'inbound_put_away') {
        if (customerEmail) sends.push(sendInboundPutAway(customerEmail, orderNumber))
        if (staffEmail) sends.push(sendInboundPutAway(staffEmail, orderNumber, customerName))
      }

      if (type === 'outbound_submitted') {
        if (staffEmail) sends.push(sendOutboundSubmitted(staffEmail, orderNumber, customerName))
        if (customerEmail) sends.push(sendOutboundSubmitted(customerEmail, orderNumber))
      }

      if (type === 'outbound_picked') {
        if (customerEmail) sends.push(sendOutboundPicked(customerEmail, orderNumber))
        if (staffEmail) sends.push(sendOutboundPicked(staffEmail, orderNumber, customerName))
      }

      if (type === 'outbound_packed') {
        if (customerEmail) sends.push(sendOutboundPacked(customerEmail, orderNumber))
        if (staffEmail) sends.push(sendOutboundPacked(staffEmail, orderNumber, customerName))
      }

      if (type === 'outbound_shipped') {
        if (customerEmail) sends.push(sendOutboundShipped(customerEmail, orderNumber, order.tracking_number ?? undefined))
        if (staffEmail) sends.push(sendOutboundShipped(staffEmail, orderNumber, order.tracking_number ?? undefined, customerName))
      }

      if (type === 'order_updated') {
        if (customerEmail) sends.push(sendOrderUpdated(customerEmail, orderNumber, order.order_type))
        if (staffEmail) sends.push(sendOrderUpdated(staffEmail, orderNumber, order.order_type, customerName))
      }

      if (type === 'order_cancelled') {
        if (customerEmail) sends.push(sendOrderCancelled(customerEmail, orderNumber, order.order_type))
        if (staffEmail) sends.push(sendOrderCancelled(staffEmail, orderNumber, order.order_type, customerName))
      }

      await Promise.allSettled(sends)
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
    // Don't fail the request if email fails
    console.error('Notification error:', e)
    return NextResponse.json({ success: true })
  }
}
