import { useState, useEffect, useCallback } from 'react'
import { Bell, Phone, X, Clock, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../utils/api'

/**
 * ReminderPopup — Global component that polls for upcoming reminders
 * and shows a floating popup 10 minutes before a scheduled reminder.
 * Only active for TELECALLER role.
 */
export default function ReminderPopup() {
  const [popups, setPopups] = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_reminders') || '[]')
    } catch {
      return []
    }
  })

  const checkReminders = useCallback(async () => {
    try {
      const role = localStorage.getItem('user_role')
      const token = localStorage.getItem('access_token')
      if (role !== 'TELECALLER' || !token) return

      const data = await fetchWithAuth('/reminders/upcoming/')
      const reminders = data.results || data || []
      const now = new Date()
      const tenMinutes = 10 * 60 * 1000

      const upcoming = reminders.filter(r => {
        const scheduledTime = new Date(r.scheduled_at)
        const timeUntil = scheduledTime - now
        // Show popup if ≤ 10 min away and not past by more than 5 min
        return timeUntil <= tenMinutes && timeUntil > -5 * 60 * 1000 && !dismissed.includes(r.id)
      })

      setPopups(upcoming)

      // Try browser notification API for each upcoming reminder
      if (upcoming.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        upcoming.forEach(r => {
          const notifKey = `notif_sent_${r.id}`
          if (!sessionStorage.getItem(notifKey)) {
            const mins = Math.max(0, Math.round((new Date(r.scheduled_at) - now) / 60000))
            new Notification('📞 Upcoming Follow-up', {
              body: `${r.lead_name || 'Lead'} — ${r.note || 'Scheduled call'} (${mins} min${mins !== 1 ? 's' : ''} away)`,
              icon: '/favicon.ico',
              tag: `reminder-${r.id}`
            })
            sessionStorage.setItem(notifKey, '1')
          }
        })
      }
    } catch (err) {
      // Silently fail — don't break the app for notifications
      console.warn('Reminder check failed:', err)
    }
  }, [dismissed])

  useEffect(() => {
    // Request browser notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Check immediately
    checkReminders()

    // Poll every 60 seconds
    const interval = setInterval(checkReminders, 60000)
    return () => clearInterval(interval)
  }, [checkReminders])

  const handleDismiss = (id) => {
    const updated = [...dismissed, id]
    setDismissed(updated)
    localStorage.setItem('dismissed_reminders', JSON.stringify(updated))
    setPopups(prev => prev.filter(p => p.id !== id))
  }

  const handleCall = (lead_id) => {
    // Navigate to telecaller leads page
    window.location.href = '/telecaller/leads'
  }

  if (popups.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-3 max-w-sm w-full" style={{ pointerEvents: 'none' }}>
      {popups.map((reminder, idx) => {
        const scheduledTime = new Date(reminder.scheduled_at)
        const now = new Date()
        const minsUntil = Math.round((scheduledTime - now) / 60000)
        const isPast = minsUntil <= 0
        
        return (
          <div
            key={reminder.id}
            className={clsx(
              'bg-card border shadow-2xl rounded-2xl p-4 animate-in slide-in-from-bottom-4 fade-in duration-500',
              isPast 
                ? 'border-danger/40 shadow-danger/10' 
                : 'border-amber/40 shadow-amber/10'
            )}
            style={{ 
              pointerEvents: 'auto',
              animationDelay: `${idx * 150}ms`
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  isPast ? 'bg-danger/15 text-danger' : 'bg-amber/15 text-amber'
                )}>
                  {isPast ? <AlertTriangle size={16} /> : <Bell size={16} className="animate-pulse" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-txt uppercase tracking-wider">
                    {isPast ? '⏰ Overdue Reminder' : '🔔 Upcoming Reminder'}
                  </div>
                  <div className={clsx(
                    'text-[10px] font-mono font-bold',
                    isPast ? 'text-danger' : 'text-amber'
                  )}>
                    {isPast 
                      ? `${Math.abs(minsUntil)} min${Math.abs(minsUntil) !== 1 ? 's' : ''} overdue`
                      : `In ${minsUntil} min${minsUntil !== 1 ? 's' : ''}`
                    }
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(reminder.id)}
                className="p-1 hover:bg-bg3 rounded-lg text-txt3 hover:text-txt transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="bg-bg3 rounded-xl p-3 mb-3 border border-border/50">
              <div className="text-sm font-bold text-txt mb-0.5">
                {reminder.lead_name || 'Scheduled Follow-up'}
              </div>
              {reminder.note && (
                <div className="text-xs text-txt2 line-clamp-2">{reminder.note}</div>
              )}
              <div className="text-[10px] text-txt3 font-mono mt-1.5">
                <Clock size={10} className="inline mr-1" />
                {scheduledTime.toLocaleString([], { 
                  month: 'short', day: 'numeric', 
                  hour: '2-digit', minute: '2-digit' 
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleCall(reminder.lead)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
              >
                <Phone size={12} /> Open Leads
              </button>
              <button
                onClick={() => handleDismiss(reminder.id)}
                className="px-3 py-2 bg-bg3 text-txt2 rounded-xl text-xs font-bold hover:bg-bg2 transition-colors border border-border"
              >
                Dismiss
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
