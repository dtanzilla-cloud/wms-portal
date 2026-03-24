import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { token, full_name, email, password } = await req.json()
    if (!token || !full_name || !email || !password)
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })

    const admin = createAdminClient()

    // Validate token
    const { data: consignee } = await admin
      .from('consignees')
      .select('id, company_name, customer_id, invite_token, invite_accepted_at')
      .eq('invite_token', token)
      .single()

    if (!consignee)
      return NextResponse.json({ error: 'Invalid or expired invitation link' }, { status: 400 })
    if (consignee.invite_accepted_at)
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 })

    // Create auth user (email already confirmed)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const userId = authData.user.id

    // Create profile linked to the consignee record
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      customer_id: null,           // consignees don't have a direct customer_id on profile
      consignee_id: consignee.id,
      role: 'consignee',
      full_name,
      email,
    })
    if (profileError) {
      // Roll back auth user
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Mark invite as accepted
    await admin
      .from('consignees')
      .update({ invite_accepted_at: new Date().toISOString() })
      .eq('id', consignee.id)

    // Sign in the new user to get a session
    const { error: signInError } = await admin.auth.signInWithPassword({ email, password })
    if (signInError) {
      // Account created successfully, just can't auto-sign-in
      return NextResponse.json({ success: true, redirect: '/auth/login' })
    }

    return NextResponse.json({ success: true, redirect: '/consignee' })
  } catch (e: any) {
    console.error('Accept invite error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
