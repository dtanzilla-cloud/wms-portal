import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  // Step 1: get levels from view (no nested join — it's a view)
  let levelsQuery = supabase
    .from('inventory_levels')
    .select('sku_id, customer_id, quantity_on_hand, quantity_reserved, quantity_available')
    .order('quantity_available', { ascending: true })

  if (!isStaff) {
    levelsQuery = levelsQuery.eq('customer_id', profile?.customer_id)
  }

  const { data: levels } = await levelsQuery

  if (!levels || levels.length === 0) {
    const csv = isStaff
      ? 'Customer,SKU Code,Description,Unit,Lot #,Inbound Date,On Hand,Reserved,Available,Storage Unit,Dimensions\n'
      : 'SKU Code,Description,Unit,Lot #,Inbound Date,On Hand,Reserved,Available,Storage Unit,Dimensions\n'
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  // Step 2: fetch SKU details and customers separately
  const skuIds = levels.map((r: any) => r.sku_id)
  const customerIds = [...new Set(levels.map((r: any) => r.customer_id))]

  const [{ data: skuRows }, { data: customerRows }] = await Promise.all([
    supabase
      .from('skus')
      .select('id, sku_code, description, unit, storage_unit, dimensions_cm, lot_number, inbound_date')
      .in('id', skuIds),
    isStaff
      ? supabase.from('customers').select('id, name').in('id', customerIds as string[])
      : Promise.resolve({ data: [] }),
  ])

  const skuMap = Object.fromEntries((skuRows ?? []).map((s: any) => [s.id, s]))
  const custMap = Object.fromEntries((customerRows ?? []).map((c: any) => [c.id, c]))

  const header = isStaff
    ? ['Customer', 'SKU Code', 'Description', 'Unit', 'Lot #', 'Inbound Date', 'On Hand', 'Reserved', 'Available', 'Storage Unit', 'Dimensions']
    : ['SKU Code', 'Description', 'Unit', 'Lot #', 'Inbound Date', 'On Hand', 'Reserved', 'Available', 'Storage Unit', 'Dimensions']

  const dataRows = (levels ?? []).map((row: any) => {
    const sku = skuMap[row.sku_id] ?? {}
    const base = [
      sku.sku_code ?? '',
      sku.description ?? '',
      sku.unit ?? '',
      sku.lot_number ?? '',
      sku.inbound_date ?? '',
      row.quantity_on_hand,
      row.quantity_reserved,
      row.quantity_available,
      sku.storage_unit ?? '',
      sku.dimensions_cm ?? '',
    ]
    return isStaff ? [custMap[row.customer_id]?.name ?? '', ...base] : base
  })

  const csv = [header, ...dataRows]
    .map(r => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
