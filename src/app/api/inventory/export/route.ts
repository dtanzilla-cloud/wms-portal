import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  const { data: inventory } = await supabase
    .from('inventory_levels')
    .select('*, skus(sku_code, description, unit, weight_kg, dimensions_cm), customers(name)')
    .match(isStaff ? {} : { customer_id: profile?.customer_id })
    .order('quantity_available', { ascending: true })

  const rows = [
    isStaff
      ? ['Customer', 'SKU Code', 'Description', 'Unit', 'On Hand', 'Reserved', 'Available', 'Weight (kg)', 'Dimensions', 'Last Movement']
      : ['SKU Code', 'Description', 'Unit', 'On Hand', 'Reserved', 'Available', 'Weight (kg)', 'Dimensions', 'Last Movement'],
    ...(inventory ?? []).map((row: any) => {
      const base = [
        row.skus?.sku_code ?? '',
        row.skus?.description ?? '',
        row.skus?.unit ?? '',
        row.quantity_on_hand,
        row.quantity_reserved,
        row.quantity_available,
        row.skus?.weight_kg ?? '',
        row.skus?.dimensions_cm ?? '',
        row.last_movement_at ? new Date(row.last_movement_at).toLocaleDateString() : '',
      ]
      return isStaff ? [row.customers?.name ?? '', ...base] : base
    }),
  ]

  const csv = rows.map(r => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
