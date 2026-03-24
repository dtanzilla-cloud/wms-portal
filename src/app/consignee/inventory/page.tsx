import { createClient } from '@/lib/supabase/server'

export default async function ConsigneeInventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('consignees(customer_id)')
    .eq('id', user!.id)
    .single()

  const customerId = (profile?.consignees as any)?.customer_id

  // Fetch inventory levels
  const { data: levels } = await supabase
    .from('inventory_levels')
    .select('sku_id, quantity_on_hand, quantity_reserved, quantity_available')
    .eq('customer_id', customerId)
    .order('quantity_available', { ascending: true })

  const skuIds = (levels ?? []).map((l: any) => l.sku_id)
  let skuMap: Record<string, any> = {}
  if (skuIds.length > 0) {
    const { data: skus } = await supabase
      .from('skus')
      .select('id, sku_code, description, unit, lot_number, inbound_date')
      .in('id', skuIds)
    skuMap = Object.fromEntries((skus ?? []).map((s: any) => [s.id, s]))
  }

  const rows = (levels ?? []).map((l: any) => ({ ...l, sku: skuMap[l.sku_id] }))

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Inventory</h1>
      <p className="text-sm text-gray-500 mb-6">{rows.length} SKU{rows.length !== 1 ? 's' : ''}</p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Description</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Lot #</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">On hand</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Reserved</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No inventory items</td></tr>
            )}
            {rows.map((row: any) => (
              <tr key={row.sku_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-orange-600">{row.sku?.sku_code}</td>
                <td className="px-4 py-3 text-gray-800">{row.sku?.description}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.sku?.lot_number ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-700 font-medium">{row.quantity_on_hand}</td>
                <td className="px-4 py-3 text-right text-orange-600">{row.quantity_reserved}</td>
                <td className={`px-4 py-3 text-right font-semibold ${row.quantity_available <= 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {row.quantity_available}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
