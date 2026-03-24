import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CheckCircle, Package, MapPin, Truck } from 'lucide-react'
import ConsigneeUploadForm from '@/components/track/ConsigneeUploadForm'

export default async function TrackingPage({ params }: { params: { orderNumber: string } }) {
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select('*, consignees(company_name, contact_name, contact_phone), consignee_addresses:consignee_address_id(*), order_items(quantity, lot_number, skus(sku_code, description, unit))')
    .eq('order_number', params.orderNumber)
    .eq('order_type', 'outbound')
    .neq('status', 'draft')
    .single()

  if (!order) notFound()

  const statusFlow = ['submitted', 'picked', 'packed', 'shipped']
  const currentIdx = statusFlow.indexOf(order.status)
  const isCancelled = order.status === 'cancelled'

  return (
    <div style={{ margin: 0, padding: 0, background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#1d4ed8', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontSize: '16px', fontWeight: 600 }}>CTS Portal</span>
        <span style={{ color: '#bfdbfe', fontSize: '13px' }}>Shipment Tracking</span>
      </div>

      <div style={{ maxWidth: '680px', margin: '32px auto', padding: '0 16px 48px' }}>
        {/* Order header */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Order number</p>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{order.order_number}</h1>
            </div>
            <span style={{
              padding: '4px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 500,
              background: isCancelled ? '#fee2e2' : order.status === 'shipped' ? '#dcfce7' : '#fff7ed',
              color: isCancelled ? '#dc2626' : order.status === 'shipped' ? '#16a34a' : '#ea580c',
              border: `1px solid ${isCancelled ? '#fca5a5' : order.status === 'shipped' ? '#86efac' : '#fdba74'}`,
            }}>
              {order.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {!isCancelled && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px 24px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {statusFlow.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '11px', fontWeight: 600,
                      background: i < currentIdx ? '#f97316' : i === currentIdx ? '#fff7ed' : '#f1f5f9',
                      border: i === currentIdx ? '2px solid #f97316' : '2px solid transparent',
                      color: i < currentIdx ? '#fff' : i === currentIdx ? '#ea580c' : '#94a3b8',
                    }}>
                      {i < currentIdx ? <CheckCircle size={14} /> : i + 1}
                    </div>
                    <span style={{
                      fontSize: '11px', marginTop: '6px', textTransform: 'capitalize', whiteSpace: 'nowrap',
                      color: i <= currentIdx ? '#374151' : '#94a3b8', fontWeight: i === currentIdx ? 600 : 400,
                    }}>
                      {s}
                    </span>
                  </div>
                  {i < statusFlow.length - 1 && (
                    <div style={{
                      height: '2px', flex: 1, margin: '0 4px', marginBottom: '20px',
                      background: i < currentIdx ? '#f97316' : '#e2e8f0',
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Ship to */}
          {order.consignees && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <MapPin size={14} color="#64748b" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Ship to</span>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', margin: '0 0 2px' }}>{order.consignees.company_name}</p>
              {order.consignees.contact_name && (
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 8px' }}>{order.consignees.contact_name}</p>
              )}
              {order.consignee_addresses && (
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
                  <p style={{ margin: 0 }}>{order.consignee_addresses.address_line1}</p>
                  {order.consignee_addresses.address_line2 && <p style={{ margin: 0 }}>{order.consignee_addresses.address_line2}</p>}
                  <p style={{ margin: 0 }}>{order.consignee_addresses.city}, {order.consignee_addresses.state} {order.consignee_addresses.postal_code}</p>
                </div>
              )}
              {order.delivery_instructions && (
                <p style={{ fontSize: '12px', color: '#3b82f6', background: '#eff6ff', padding: '6px 10px', borderRadius: '4px', marginTop: '10px' }}>
                  {order.delivery_instructions}
                </p>
              )}
            </div>
          )}

          {/* Shipment info */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Truck size={14} color="#64748b" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Shipment info</span>
            </div>
            <dl style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {order.ship_by_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: '#64748b' }}>Ship by</dt>
                  <dd style={{ color: '#1e293b', fontWeight: 500, margin: 0 }}>
                    {new Date(order.ship_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </dd>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt style={{ color: '#64748b' }}>Pallets</dt>
                <dd style={{ color: '#1e293b', fontWeight: 500, margin: 0 }}>{order.pallet_count}</dd>
              </div>
              {order.pallet_weight_kg && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: '#64748b' }}>Weight</dt>
                  <dd style={{ color: '#1e293b', fontWeight: 500, margin: 0 }}>{order.pallet_weight_kg} kg</dd>
                </div>
              )}
              {order.pallet_dimensions && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: '#64748b' }}>Dimensions</dt>
                  <dd style={{ color: '#1e293b', fontWeight: 500, margin: 0, fontFamily: 'monospace', fontSize: '12px' }}>{order.pallet_dimensions}</dd>
                </div>
              )}
              {order.carrier && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: '#64748b' }}>Carrier</dt>
                  <dd style={{ color: '#1e293b', fontWeight: 500, margin: 0 }}>{order.carrier}</dd>
                </div>
              )}
              {order.tracking_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <dt style={{ color: '#64748b', whiteSpace: 'nowrap' }}>Tracking #</dt>
                  <dd style={{ color: '#1e293b', fontWeight: 600, margin: 0, fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>{order.tracking_number}</dd>
                </div>
              )}
              {order.reference_type && order.reference_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt style={{ color: '#64748b' }}>{order.reference_type}</dt>
                  <dd style={{ color: '#1e293b', fontWeight: 500, margin: 0, fontFamily: 'monospace', fontSize: '12px' }}>{order.reference_number}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={14} color="#64748b" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Items</span>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8' }}>{order.order_items?.length ?? 0} lines</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 500, color: '#64748b', fontSize: '12px' }}>SKU</th>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 500, color: '#64748b', fontSize: '12px' }}>Description</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 500, color: '#64748b', fontSize: '12px' }}>Qty</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 500, color: '#64748b', fontSize: '12px' }}>Unit</th>
                {order.order_items?.some((i: any) => i.lot_number) && (
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 500, color: '#64748b', fontSize: '12px' }}>Lot #</th>
                )}
              </tr>
            </thead>
            <tbody>
              {order.order_items?.map((item: any, idx: number) => (
                <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 20px', color: '#c2410c', fontFamily: 'monospace', fontSize: '12px' }}>{item.skus?.sku_code}</td>
                  <td style={{ padding: '10px 20px', color: '#374151' }}>{item.skus?.description}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', color: '#1e293b', fontWeight: 600 }}>{item.quantity}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', color: '#64748b' }}>{item.skus?.unit}</td>
                  {order.order_items?.some((i: any) => i.lot_number) && (
                    <td style={{ padding: '10px 20px', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{item.lot_number ?? '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {order.notes && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px 24px', marginTop: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Notes</p>
            <p style={{ fontSize: '13px', color: '#475569', whiteSpace: 'pre-wrap', margin: 0 }}>{order.notes}</p>
          </div>
        )}

        {/* Consignee reply / upload */}
        <ConsigneeUploadForm orderNumber={params.orderNumber} />

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '32px' }}>
          CTS Portal · Shipment tracking for {params.orderNumber}
        </p>
      </div>
    </div>
  )
}
