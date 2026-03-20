'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function CustomerPicker({ customers, selectedId }: { customers: { id: string; name: string }[]; selectedId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('customer', e.target.value)
    } else {
      params.delete('customer')
    }
    router.push(`/inventory?${params.toString()}`)
  }

  return (
    <select
      value={selectedId}
      onChange={handleChange}
      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      <option value="">All customers</option>
      {customers.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
