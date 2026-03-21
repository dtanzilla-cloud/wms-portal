import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: photo } = await supabase
      .from('order_photos')
      .select('storage_path')
      .eq('id', params.id)
      .single()

    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await supabase.storage.from('documents').remove([photo.storage_path])
    await supabase.from('order_photos').delete().eq('id', params.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: photo } = await supabase
      .from('order_photos')
      .select('storage_path')
      .eq('id', params.id)
      .single()

    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(photo.storage_path, 3600)

    return NextResponse.json({ url: signed?.signedUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
