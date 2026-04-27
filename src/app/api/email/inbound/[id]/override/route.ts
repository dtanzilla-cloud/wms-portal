import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'
    if (!isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { action, quantity, unit, sku_id, lot_number, po_number } = await req.json()

    if (!action || !quantity || !sku_id) {
      return NextResponse.json(
        { error: 'action, quantity, and sku_id are required' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data: tx } = await admin
      .from('email_transactions')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const { data: sku } = await admin
      .from('skus')
      .select('customer_id')
      .eq('id', sku_id)
      .single()

    if (!sku) return NextResponse.json({ error: 'SKU not found' }, { status: 404 })

    const { data: movement, error: movementError } = await admin
      .from('inventory_movements')
      .insert({
        sku_id,
        customer_id: sku.customer_id,
        movement_type: action === 'IN' ? 'inbound' : 'outbound',
        quantity: Number(quantity),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (movementError) throw movementError

    const { data: updated, error: updateError } = await admin
      .from('email_transactions')
      .update({
        status: 'applied',
        inventory_movement_id: movement.id,
        parsed_action: action,
        parsed_quantity: Number(quantity),
        parsed_unit: unit ?? null,
        parsed_sku_id: sku_id,
        parsed_lot_number: lot_number ?? null,
        parsed_po_number: po_number ?? null,
        parsed_confidence: 'high',
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('[email/inbound/override]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
