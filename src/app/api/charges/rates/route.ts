import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/charges/rates?customer_id=xxx
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const customerId = req.nextUrl.searchParams.get('customer_id')
    if (!customerId) return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 })

    const { data, error } = await supabase
      .from('charge_rates')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? {
      storage_rate_per_unit_per_week: 0,
      inbound_rate_per_unit: 0,
      outbound_rate_per_unit: 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/charges/rates
// Body: { customer_id, storage_rate_per_unit_per_week, inbound_rate_per_unit, outbound_rate_per_unit }
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'warehouse_staff'].includes(profile.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { customer_id, storage_rate_per_unit_per_week, inbound_rate_per_unit, outbound_rate_per_unit } = body

    if (!customer_id) return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 })

    const { data, error } = await supabase
      .from('charge_rates')
      .upsert(
        {
          customer_id,
          storage_rate_per_unit_per_week: Number(storage_rate_per_unit_per_week) || 0,
          inbound_rate_per_unit: Number(inbound_rate_per_unit) || 0,
          outbound_rate_per_unit: Number(outbound_rate_per_unit) || 0,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: 'customer_id' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
