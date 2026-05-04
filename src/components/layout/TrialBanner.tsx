import { AlertTriangle } from 'lucide-react'

interface Props {
  trialEndsAt: string
  expired: boolean
}

export default function TrialBanner({ trialEndsAt, expired }: Props) {
  const endsDate = new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  if (expired) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-3">
        <AlertTriangle size={16} className="shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Your trial expired on {endsDate}</p>
          <p className="text-xs opacity-90">Your account is now read-only. Contact us to continue using CTS Portal.</p>
        </div>
        <a href="mailto:hello@mondayseed.com" className="shrink-0 bg-white text-red-600 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors">
          Contact us
        </a>
      </div>
    )
  }

  const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  if (daysLeft > 5) return null

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center gap-3">
      <AlertTriangle size={15} className="shrink-0" />
      <p className="text-sm">
        <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong> left on your trial — expires {endsDate}.{' '}
        <a href="mailto:hello@mondayseed.com" className="underline">Contact us to continue.</a>
      </p>
    </div>
  )
}
