import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { company, full_name, email, password } = await req.json()
    if (!company || !full_name || !email || !password)
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })

    const supabase = createAdminClient()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const userId = authData.user.id
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    // Create customer record
    const code = company.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .insert({ name: company, code, billing_email: email, status: 'trial', trial_ends_at: trialEndsAt })
      .select().single()
    if (custError) return NextResponse.json({ error: custError.message }, { status: 400 })

    // Create profile
    await supabase.from('profiles').insert({
      id: userId, customer_id: customer.id, role: 'customer', full_name, email,
    })

    // Sign in the new user
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) return NextResponse.json({ error: 'Account created, please sign in' }, { status: 200 })

    // TODO: send welcome email via Resend

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
