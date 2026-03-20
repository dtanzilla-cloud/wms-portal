import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['warehouse_staff', 'admin'].includes(profile.role)) return null
  return { user, profile }
}

// POST - add new staff member
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const caller = await verifyAdmin(supabase)
    if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { fullName, email, password, role } = await req.json()
    if (!fullName || !email || !password) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    if (!['warehouse_staff', 'admin'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    const admin = await createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const { data: profile, error: profError } = await admin.from('profiles').insert({
      id: authData.user.id, customer_id: null, role, full_name: fullName, email,
    }).select().single()
    if (profError) return NextResponse.json({ error: profError.message }, { status: 400 })

    return NextResponse.json({ success: true, profile })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH - change staff role
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const caller = await verifyAdmin(supabase)
    if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { userId, role } = await req.json()
    if (!['warehouse_staff', 'admin'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE - remove staff member
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const caller = await verifyAdmin(supabase)
    if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { userId } = await req.json()
    if (userId === caller.user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

    const admin = await createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
