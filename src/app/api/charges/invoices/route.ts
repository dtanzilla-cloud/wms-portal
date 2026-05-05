import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'charge-invoices'

async function ensureBucket() {
  const admin = createAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: false })
  }
}

// GET /api/charges/invoices?id=xxx  — returns a signed download URL
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: invoice, error } = await supabase
      .from('charge_invoices')
      .select('storage_path, filename')
      .eq('id', id)
      .single()

    if (error || !invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const admin = createAdminClient()
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(invoice.storage_path, 60 * 60) // 1 hour

    return NextResponse.json({ url: signed?.signedUrl, filename: invoice.filename })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/charges/invoices  — multipart: customer_id, billing_month (YYYY-MM-01), notes?, file
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'warehouse_staff'].includes(profile.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const formData = await req.formData()
    const customerId = formData.get('customer_id') as string | null
    const billingMonth = formData.get('billing_month') as string | null // 'YYYY-MM-01'
    const notes = (formData.get('notes') as string | null) ?? ''
    const file = formData.get('file') as File | null

    if (!customerId) return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 })
    if (!billingMonth) return NextResponse.json({ error: 'Missing billing_month' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf'))
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })

    await ensureBucket()

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${customerId}/${billingMonth}/${Date.now()}_${safeName}`

    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data, error: dbError } = await supabase
      .from('charge_invoices')
      .insert({
        customer_id: customerId,
        billing_month: billingMonth,
        filename: safeName,
        storage_path: storagePath,
        file_size_bytes: buffer.length,
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      await admin.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/charges/invoices?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'warehouse_staff'].includes(profile.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: invoice } = await supabase
      .from('charge_invoices')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const admin = createAdminClient()
    await admin.storage.from(BUCKET).remove([invoice.storage_path])

    const { error } = await supabase
      .from('charge_invoices')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
