import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const docId = req.nextUrl.searchParams.get('id')
    if (!docId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: doc } = await supabase.from('documents').select('*').eq('id', docId).single()
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
    if (!isStaff && doc.customer_id !== profile?.customer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60 * 60 * 24) // 24 hours

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ url: data.signedUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
