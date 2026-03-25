import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

    const docId = req.nextUrl.searchParams.get('id')
    if (!docId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: doc } = await supabase.from('documents').select('*').eq('id', docId).single()
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only staff or the document's own customer may delete
    const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
    if (!isStaff && doc.customer_id !== profile?.customer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Remove from storage (best-effort — don't fail if file is already gone)
    await supabase.storage.from('documents').remove([doc.storage_path])

    // Remove from documents table
    const { error: dbErr } = await supabase.from('documents').delete().eq('id', docId)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
