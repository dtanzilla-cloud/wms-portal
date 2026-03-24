import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const orderNumber = formData.get('orderNumber') as string | null
    const senderName = (formData.get('senderName') as string | null) ?? 'Consignee'
    const message = (formData.get('message') as string | null) ?? ''
    const files = formData.getAll('files') as File[]

    if (!orderNumber) return NextResponse.json({ error: 'Missing orderNumber' }, { status: 400 })
    if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

    const supabase = createAdminClient()

    // Fetch order to get id + customer_id
    const { data: order } = await supabase
      .from('orders')
      .select('id, customer_id, order_number')
      .eq('order_number', orderNumber)
      .eq('order_type', 'outbound')
      .neq('status', 'draft')
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const uploaded: { filename: string; url: string }[] = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${order.customer_id}/${order.id}/consignee/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      // Record in documents table
      await supabase.from('documents').insert({
        order_id: order.id,
        customer_id: order.customer_id,
        document_type: 'consignee_attachment',
        filename: safeName,
        storage_path: storagePath,
        file_size_bytes: buffer.length,
        is_generated: false,
      })

      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7)

      uploaded.push({ filename: safeName, url: signedData?.signedUrl ?? '' })
    }

    // Add a note to the order with the sender's message if provided
    if (message.trim()) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('notes')
        .eq('id', order.id)
        .single()

      const existingNotes = existingOrder?.notes ?? ''
      const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      const appendedNote = `[${senderName} — ${timestamp}]: ${message}`
      const newNotes = existingNotes ? `${existingNotes}\n\n${appendedNote}` : appendedNote

      await supabase.from('orders').update({ notes: newNotes }).eq('id', order.id)
    }

    // Notify staff via email
    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('role', ['admin', 'warehouse_staff'])
    const staffEmails = (staffProfiles ?? []).map((p: any) => p.email).filter(Boolean)

    if (staffEmails.length > 0 && uploaded.length > 0) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? `CTS Portal <noreply@yourdomain.com>`
      const fileList = uploaded.map(f => `<li>${f.filename}</li>`).join('')

      for (const email of staffEmails) {
        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: `Consignee reply on order ${orderNumber}`,
          html: `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1d4ed8;padding:20px 28px">
    <span style="color:#fff;font-size:16px;font-weight:600">CTS Portal</span>
  </div>
  <div style="padding:28px">
    <h2 style="margin:0 0 12px;font-size:18px;color:#1e293b">Consignee reply on ${orderNumber}</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px"><strong>${senderName}</strong> replied to order <strong>${orderNumber}</strong>.</p>
    ${message ? `<p style="color:#475569;font-size:14px;line-height:1.6;background:#f8fafc;padding:12px 16px;border-radius:6px;border-left:3px solid #3b82f6">${message}</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:12px 0 4px">Attached files (${uploaded.length}):</p>
    <ul style="color:#374151;font-size:13px;margin:0;padding-left:20px">${fileList}</ul>
    <a href="${APP_URL}/orders/outbound" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">View order</a>
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
      CTS Portal · <a href="${APP_URL}" style="color:#3b82f6">Go to portal</a>
    </div>
  </div>
</div>
</body></html>`,
        })
      }
    }

    return NextResponse.json({ success: true, uploaded })
  } catch (e: any) {
    console.error('Track upload error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
