import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

    const formData = await req.formData()
    const file = formData.get('file') as File
    const orderId = formData.get('order_id') as string
    const documentType = formData.get('document_type') as string || 'other'

    if (!file || !orderId) return NextResponse.json({ error: 'Missing file or order_id' }, { status: 400 })

    // Get order to verify access and get customer_id
    const { data: order } = await supabase.from('orders').select('customer_id').eq('id', orderId).single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
    if (!isStaff && order.customer_id !== profile?.customer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Upload to Supabase storage
    const ext = file.name.split('.').pop()
    const storagePath = `${order.customer_id}/${orderId}/${Date.now()}-${file.name}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.type })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    // Save document record
    const { data: doc, error: docError } = await supabase.from('documents').insert({
      order_id: orderId,
      customer_id: order.customer_id,
      document_type: documentType,
      filename: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      uploaded_by: user.id,
      is_generated: false,
    }).select().single()

    if (docError) return NextResponse.json({ error: docError.message }, { status: 500 })

    return NextResponse.json({ success: true, document: doc })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
