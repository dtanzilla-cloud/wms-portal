import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const isStaff = profile?.role === 'warehouse_staff' || profile?.role === 'admin'

  const { data: documents } = await supabase
    .from('documents')
    .select('*, orders(order_number, order_type), customers(name)')
    .match(isStaff ? {} : { customer_id: profile?.customer_id })
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">{documents?.length ?? 0} documents — upload files from any order's detail page</p>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Filename</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Order</th>
                {isStaff && <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Customer</th>}
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents?.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 5 : 4} className="px-5 py-12 text-center text-gray-400 text-xs">
                    <FileText size={24} className="mx-auto mb-2 text-gray-300" />
                    <p>No documents yet</p>
                    <p className="mt-1">Upload files from an <Link href="/orders/inbound" className="text-blue-600 hover:underline">inbound</Link> or <Link href="/orders/outbound" className="text-blue-600 hover:underline">outbound</Link> order</p>
                  </td>
                </tr>
              )}
              {documents?.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className={doc.is_generated ? 'text-purple-500' : 'text-gray-400'} />
                      <span className="text-gray-800">{doc.filename}</span>
                      {doc.is_generated && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Generated</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600 capitalize">{doc.document_type.replace('_', ' ')}</td>
                  <td className="px-5 py-3">
                    {doc.orders && (
                      <Link href={`/orders/${doc.orders.order_type}/${doc.order_id}`} className="flex items-center gap-1.5 hover:underline">
                        {doc.orders.order_type === 'inbound'
                          ? <ArrowDownCircle size={12} className="text-blue-400" />
                          : <ArrowUpCircle size={12} className="text-orange-400" />}
                        <span className="text-blue-700 font-mono text-xs">{doc.orders.order_number}</span>
                      </Link>
                    )}
                  </td>
                  {isStaff && <td className="px-5 py-3 text-gray-500">{doc.customers?.name}</td>}
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(doc.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
