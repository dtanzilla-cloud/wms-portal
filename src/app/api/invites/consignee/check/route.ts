import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false, error: 'Missing token' })

  const admin = createAdminClient()
  const { data: consignee } = await admin
    .from('consignees')
    .select('id, company_name, contact_email, invite_accepted_at')
    .eq('invite_token', token)
    .single()

  if (!consignee) return NextResponse.json({ valid: false, error: 'Invalid or expired invitation link' })
  if (consignee.invite_accepted_at)
    return NextResponse.json({ valid: false, error: 'This invitation has already been used' })

  return NextResponse.json({
    valid: true,
    company_name: consignee.company_name,
    contact_email: consignee.contact_email,
  })
}
