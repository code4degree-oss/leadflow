import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, X } from 'lucide-react'

/**
 * SubscriptionBanner — Shows warning banners based on subscription status.
 * 
 * - 'expiring_soon' → Yellow warning banner with days remaining
 * - 'active' / 'no_plan' / superadmin → No banner
 */
export default function SubscriptionBanner() {
  const [status, setStatus] = useState(null)
  const [days, setDays] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [role, setRole] = useState('')

  useEffect(() => {
    const subStatus = localStorage.getItem('subscription_status')
    const daysRemaining = localStorage.getItem('days_remaining')
    const userRole = localStorage.getItem('user_role')
    setStatus(subStatus)
    setDays(daysRemaining ? parseInt(daysRemaining) : null)
    setRole(userRole || '')
  }, [])

  // Super Admins never see subscription banners
  if (role === 'SUPER_ADMIN') return null

  // Only show for expiring_soon
  if (status !== 'expiring_soon' || dismissed) return null

  return (
    <div className="relative mx-6 mt-4 mb-0">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium
        bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400
        animate-in slide-in-from-top-2 duration-300"
      >
        <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0">
          <AlertTriangle size={16} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-bold">Subscription expiring soon</span>
          <span className="mx-2 opacity-40">•</span>
          <span>
            Your plan expires in <strong>{days != null ? days : '?'} day{days !== 1 ? 's' : ''}</strong>. 
            Contact your administrator to renew.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
            <Clock size={12} />
            {days != null ? days : '?'}d left
          </div>
          <button 
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-amber-500/10 rounded-lg transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
