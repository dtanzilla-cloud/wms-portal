import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File
    const orderId = form.get('order_id') as string

    if (!file || !orderId) {
      return NextResponse.json({ error: 'Missing file or order_id' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `orders/${orderId}/photos/${Date.now()}.${ext}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: storageErr } = await supabase.storage
      .from('documents')
      .upload(path, buffer, { contentType: file.type })

    if (storageErr) throw storageErr

    const { data: photo, error: dbErr } = await supabase
      .from('order_photos')
      .insert({ order_id: orderId, storage_path: path, filename: file.name, uploaded_by: user.id })
      .select()
      .single()

    if (dbErr) throw dbErr

    return NextResponse.json({ photo })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
