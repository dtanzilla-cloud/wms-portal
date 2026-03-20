'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 mb-6">
          An unexpected error occurred. Please try again, or go back to the dashboard.
        </p>
        <div className="flex items-center gap-3 justify-center">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/dashboard" className="btn-secondary">Go to dashboard</Link>
        </div>
      </div>
    </div>
  )
}
