import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sendInboundSubmitted,
  sendInboundPutAway,
  sendOutboundShipped,
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

      if (type === 'inbound_submitted' && staffEmail) {
        await sendInboundSubmitted(staffEmail, order.order_number, order.customers?.name ?? '')
      }
      if (type === 'inbound_put_away' && customerEmail) {
        await sendInboundPutAway(customerEmail, order.order_number)
      }
      if (type === 'outbound_shipped' && customerEmail) {
        await sendOutboundShipped(customerEmail, order.order_number, order.tracking_number ?? undefined)
      }
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
