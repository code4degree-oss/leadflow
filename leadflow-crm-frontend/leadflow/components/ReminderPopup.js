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
  const [hiddenReminders, setHiddenReminders] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem('hidden_reminders') || '{}')
      const now = new Date().getTime()
      const cleaned = {}
      Object.entries(data).forEach(([id, time]) => {
        if (now < time) {
          cleaned[id] = time
        }
      })
      localStorage.setItem('hidden_reminders', JSON.stringify(cleaned))
      return cleaned
    } catch {
      return {}
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
      const fiveMinutes = 5 * 60 * 1000

      const upcoming = reminders.filter(r => {
        const scheduledTime = new Date(r.scheduled_at)
        const timeUntil = scheduledTime - now
        const hiddenTime = hiddenReminders[r.id]
        const isHidden = hiddenTime && (now.getTime() < hiddenTime)
        
        // Show popup if ≤ 5 min away and not past by more than 5 min
        return timeUntil <= fiveMinutes && timeUntil > -5 * 60 * 1000 && !isHidden
      })

      setPopups(upcoming)

      // Play sound and show browser notification for each upcoming reminder
      if (upcoming.length > 0) {
        let soundPlayed = false;

        upcoming.forEach(r => {
          const notifKey = `notif_sent_${r.id}`
          if (!sessionStorage.getItem(notifKey)) {
            // Play notification sound once per check exactly for 2 seconds
            if (!soundPlayed) {
              const audio = new Audio('/ring.mp3');
              audio.loop = true;
              audio.play().catch(e => console.warn('Audio play failed:', e));
              setTimeout(() => {
                  audio.pause();
                  audio.currentTime = 0;
              }, 2000);
              soundPlayed = true;
            }

            // Show native browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              const mins = Math.max(0, Math.round((new Date(r.scheduled_at) - now) / 60000))
              new Notification('📞 Upcoming Follow-up', {
                body: `${r.lead_name || 'Lead'} — ${r.note || 'Scheduled call'} (${mins} min${mins !== 1 ? 's' : ''} away)`,
                icon: '/favicon.ico',
                tag: `reminder-${r.id}`
              })
            }
            sessionStorage.setItem(notifKey, '1')
          }
        })
      }
    } catch (err) {
      // Silently fail — don't break the app for notifications
      console.warn('Reminder check failed:', err)
    }
  }, [hiddenReminders])

  useEffect(() => {
    // Request browser notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Check immediately
    checkReminders()

    // Listen for WebSocket events to refresh reminders
    const handleWsMessage = (e) => {
      const payload = e.detail;
      if (payload.type === 'notification' && payload.data.notif_type === 'REMINDER') {
        checkReminders();
      }
    };
    window.addEventListener('ws_message', handleWsMessage);

    // Fallback poll every 5 minutes instead of 1 minute to save resources
    const interval = setInterval(checkReminders, 5 * 60 * 1000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('ws_message', handleWsMessage)
    }
  }, [checkReminders])

  const handleHide = (id, hideDurationMs) => {
    const hiddenUntil = new Date().getTime() + hideDurationMs
    const updated = { ...hiddenReminders, [id]: hiddenUntil }
    setHiddenReminders(updated)
    localStorage.setItem('hidden_reminders', JSON.stringify(updated))
    setPopups(prev => prev.filter(p => p.id !== id))
  }

  const handleDismiss = (id) => handleHide(id, 24 * 60 * 60 * 1000) // hide for 24h
  const handleSnooze = (id, mins) => handleHide(id, mins * 60 * 1000)

  const handleCall = (lead_id) => {
    // Navigate to telecaller leads page
    window.location.href = '/telecaller/leads'
  }

  if (popups.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end justify-end gap-4 pointer-events-none">
      <div className="flex flex-col gap-4 w-full max-w-sm">
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
            <div className="flex flex-col gap-2">
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
              <div className="flex gap-2 justify-center mt-1">
                <span className="text-[10px] text-txt3 self-center font-bold uppercase mr-1">Snooze:</span>
                {[5, 15, 30].map(mins => (
                  <button key={mins} onClick={() => handleSnooze(reminder.id, mins)} className="text-[10px] font-bold text-accent hover:bg-accent/10 px-2 py-1 rounded-lg transition-colors">
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
