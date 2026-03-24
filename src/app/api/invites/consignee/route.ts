import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'warehouse_staff'].includes(profile.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { consignee_id } = await req.json()
    if (!consignee_id) return NextResponse.json({ error: 'Missing consignee_id' }, { status: 400 })

    const admin = createAdminClient()

    // Fetch the consignee
    const { data: consignee } = await admin
      .from('consignees')
      .select('id, company_name, contact_email, contact_name, customers(name)')
      .eq('id', consignee_id)
      .single()

    if (!consignee) return NextResponse.json({ error: 'Consignee not found' }, { status: 404 })
    if (!consignee.contact_email)
      return NextResponse.json({ error: 'Consignee has no contact email' }, { status: 400 })

    // Generate a secure token
    const token = crypto.randomUUID() + '-' + crypto.randomUUID()

    await admin
      .from('consignees')
      .update({ invite_token: token, invite_sent_at: new Date().toISOString() })
      .eq('id', consignee_id)

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const inviteUrl = `${APP_URL}/auth/accept-invite?token=${token}`
    const customerName = (consignee.customers as any)?.name ?? 'CTS Portal'

    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? `CTS Portal <noreply@yourdomain.com>`

    await resend.emails.send({
      from: fromEmail,
      to: consignee.contact_email,
      subject: `You've been invited to CTS Portal by ${customerName}`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1d4ed8;padding:20px 28px">
    <span style="color:#fff;font-size:16px;font-weight:600">CTS Portal</span>
  </div>
  <div style="padding:28px">
    <h2 style="margin:0 0 12px;font-size:18px;color:#1e293b">
      You've been invited to CTS Portal
    </h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px">
      Hi ${consignee.contact_name ?? consignee.company_name},
    </p>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px">
      <strong>${customerName}</strong> has invited <strong>${consignee.company_name}</strong>
      to access CTS Portal. You can view your inventory and track your incoming shipments.
    </p>
    <a href="${inviteUrl}" style="display:inline-block;padding:11px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
      Accept invitation &amp; create account
    </a>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">
      This link expires in 7 days. If you didn't expect this invitation, you can ignore this email.
    </p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
      CTS Portal
    </div>
  </div>
</div>
</body></html>`,
    })

    return NextResponse.json({ success: true, email: consignee.contact_email })
  } catch (e: any) {
    console.error('Consignee invite error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
