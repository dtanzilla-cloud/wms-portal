import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendNewTrialSignup } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    // Verify caller is staff
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['warehouse_staff', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { company, billingEmail, fullName, userEmail, password, status, trialDays } = await req.json()
    if (!company || !billingEmail || !fullName || !userEmail || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }

    const admin = await createAdminClient()

    // Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: userEmail, password, email_confirm: true,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const userId = authData.user.id
    const trialEndsAt = status === 'trial'
      ? new Date(Date.now() + (trialDays || 14) * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Create customer
    const code = company.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20)
    const { data: customer, error: custError } = await admin
      .from('customers')
      .insert({ name: company, code, billing_email: billingEmail, status, trial_ends_at: trialEndsAt })
      .select().single()
    if (custError) return NextResponse.json({ error: custError.message }, { status: 400 })

    // Create profile
    const { error: profError } = await admin.from('profiles').insert({
      id: userId, customer_id: customer.id, role: 'customer', full_name: fullName, email: userEmail,
    })
    if (profError) return NextResponse.json({ error: profError.message }, { status: 400 })

    // Notify staff of new signup
    const staffEmail = process.env.STAFF_NOTIFICATION_EMAIL
    if (staffEmail && status === 'trial') {
      try { await sendNewTrialSignup(staffEmail, company, userEmail) } catch {}
    }

    return NextResponse.json({ success: true, customer })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
