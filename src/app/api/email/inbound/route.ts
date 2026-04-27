import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseEmailWithClaude } from '@/lib/parseEmailWithClaude'
import { sendReplyEmail } from '@/lib/sendReplyEmail'

export async function POST(req: NextRequest) {
  // Always return 200 — Postmark retries on anything else
  try {
    if (!req.headers.get('x-postmark-signature')) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 200 })
    }

    const body = await req.json()
    const senderEmail: string = (body.From ?? '').toLowerCase().trim()
    const subject: string = body.Subject ?? ''
    const textBody: string = body.TextBody ?? ''
    const postmarkMessageId: string = body.MessageID ?? ''

    if (!senderEmail) {
      return NextResponse.json({ skipped: 'no sender' }, { status: 200 })
    }

    const admin = createAdminClient()

    // Resolve sender against profiles and customers
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, customer_id')
      .eq('email', senderEmail)
      .maybeSingle()

    let senderRole: 'staff' | 'customer' | 'unknown' = 'unknown'
    let customerId: string | null = null

    if (profile) {
      if (profile.role === 'warehouse_staff' || profile.role === 'admin') {
        senderRole = 'staff'
      } else if (profile.role === 'customer') {
        senderRole = 'customer'
        customerId = profile.customer_id
      }
    } else {
      // Fall back to billing_email on customers table
      const { data: customer } = await admin
        .from('customers')
        .select('id')
        .eq('billing_email', senderEmail)
        .maybeSingle()

      if (customer) {
        senderRole = 'customer'
        customerId = customer.id
      }
    }

    if (senderRole === 'unknown') {
      await admin.from('email_transactions').insert({
        sender_email: senderEmail,
        sender_role: 'unknown',
        raw_subject: subject,
        raw_body: textBody,
        postmark_message_id: postmarkMessageId,
        status: 'rejected',
        rejection_reason: 'unauthorized sender',
      })

      await sendReplyEmail(senderEmail, 'rejected', {
        rejectionReason: 'unauthorized sender',
      })

      return NextResponse.json({ status: 'rejected' }, { status: 200 })
    }

    // Fetch SKU list scoped to the sender's customer (or all SKUs for staff)
    const skuQuery = admin.from('skus').select('id, sku_code, description')
    if (customerId) skuQuery.eq('customer_id', customerId)
    const { data: skus } = await skuQuery
    const skuList = (skus ?? []).map(s => ({
      id: s.id,
      code: s.sku_code,
      name: s.description,
    }))

    // Parse intent with Claude
    const parsed = await parseEmailWithClaude(senderEmail, subject, textBody, skuList)

    if (parsed.confidence === 'high' && parsed.action && parsed.skuId && parsed.quantity) {
      // Write inventory movement
      const { data: movement, error: movementError } = await admin
        .from('inventory_movements')
        .insert({
          sku_id: parsed.skuId,
          customer_id: customerId ?? (await resolveCustomerForSku(admin, parsed.skuId)),
          movement_type: parsed.action === 'IN' ? 'inbound' : 'outbound',
          quantity: parsed.quantity,
          created_by: profile?.id ?? null,
        })
        .select('id')
        .single()

      if (movementError) throw movementError

      await admin.from('email_transactions').insert({
        sender_email: senderEmail,
        sender_role: senderRole,
        raw_subject: subject,
        raw_body: textBody,
        postmark_message_id: postmarkMessageId,
        parsed_action: parsed.action,
        parsed_quantity: parsed.quantity,
        parsed_unit: parsed.unit ?? null,
        parsed_sku_id: parsed.skuId,
        parsed_lot_number: parsed.lotNumber ?? null,
        parsed_po_number: parsed.poNumber ?? null,
        parsed_confidence: parsed.confidence,
        parsed_raw_intent: parsed.rawIntent ?? null,
        status: 'applied',
        inventory_movement_id: movement.id,
      })

      await sendReplyEmail(senderEmail, 'applied', { ...parsed, movementId: movement.id })
      return NextResponse.json({ status: 'applied' }, { status: 200 })
    }

    // Low confidence — log but do not write movement
    await admin.from('email_transactions').insert({
      sender_email: senderEmail,
      sender_role: senderRole,
      raw_subject: subject,
      raw_body: textBody,
      postmark_message_id: postmarkMessageId,
      parsed_action: parsed.action ?? null,
      parsed_quantity: parsed.quantity ?? null,
      parsed_unit: parsed.unit ?? null,
      parsed_sku_id: parsed.skuId ?? null,
      parsed_lot_number: parsed.lotNumber ?? null,
      parsed_po_number: parsed.poNumber ?? null,
      parsed_confidence: parsed.confidence,
      parsed_raw_intent: parsed.rawIntent ?? null,
      status: 'clarification_needed',
    })

    await sendReplyEmail(senderEmail, 'clarification_needed', parsed)
    return NextResponse.json({ status: 'clarification_needed' }, { status: 200 })
  } catch (err: any) {
    console.error('[email/inbound]', err)
    // Still return 200 to prevent Postmark retries for server errors
    return NextResponse.json({ error: err.message }, { status: 200 })
  }
}

async function resolveCustomerForSku(
  admin: ReturnType<typeof createAdminClient>,
  skuId: string,
): Promise<string | null> {
  const { data } = await admin.from('skus').select('customer_id').eq('id', skuId).maybeSingle()
  return data?.customer_id ?? null
}
