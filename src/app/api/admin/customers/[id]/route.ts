import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function verifyStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['warehouse_staff', 'admin'].includes(profile.role)) return null
  return user
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!await verifyStaff()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const admin = createAdminClient()
    const { data, error } = await admin.from('customers').select('*').eq('id', params.id).single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ customer: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!await verifyStaff()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { name, billingEmail, status, trialEndsAt } = await req.json()
    if (!name || !billingEmail || !status) {
      return NextResponse.json({ error: 'Name, billing email, and status are required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('customers')
      .update({ name, billing_email: billingEmail, status, trial_ends_at: trialEndsAt ?? null })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, customer: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!await verifyStaff()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { error } = await admin.from('customers').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
