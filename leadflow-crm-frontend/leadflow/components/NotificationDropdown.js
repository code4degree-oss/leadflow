import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, Flame, Phone, UserPlus, MapPin, Upload, Info, X, Eye, Megaphone } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../utils/api'
import { useRouter } from 'next/router'

const typeConfig = {
  WON:        { icon: Flame,    color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', label: 'Won' },
  LOST:       { icon: X,        color: 'text-danger',    bg: 'bg-danger/10',    label: 'Lost' },
  REMINDER:   { icon: Phone,    color: 'text-amber',     bg: 'bg-amber/10',     label: 'Reminder' },
  VISIT:      { icon: MapPin,   color: 'text-accent2',   bg: 'bg-accent2/10',   label: 'Visit' },
  UPLOAD:     { icon: Upload,   color: 'text-purple',    bg: 'bg-purple/10',    label: 'Upload' },
  INFO:       { icon: Info,     color: 'text-txt3',      bg: 'bg-bg3',          label: 'Info' },
  BROADCAST:  { icon: Megaphone,color: 'text-[#8B6CF7]', bg: 'bg-[#8B6CF7]/10', label: 'Broadcast' },
}

export default function NotificationDropdown({ role }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [reminderPopup, setReminderPopup] = useState(null)
  const dropdownRef = useRef(null)

  const [loadingRead, setLoadingRead] = useState({})
  const [loadingAllRead, setLoadingAllRead] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Fetch initial notifications and unread count
  useEffect(() => {
    fetchUnreadCount()
  }, [])

  // Listen for WebSocket notifications
  useEffect(() => {
    const handleWsMessage = (e) => {
      const payload = e.detail;
      if (payload.type === 'notification') {
        const notif = payload.data;
        setNotifications(prev => [notif, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    };
    window.addEventListener('ws_message', handleWsMessage);
    return () => window.removeEventListener('ws_message', handleWsMessage);
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const data = await fetchWithAuth('/accounts/notifications/unread-count/')
      setUnreadCount(data.count || 0)
    } catch (err) { console.error(err) }
  }

  const fetchNotifications = async (pageNum = 1) => {
    try {
      if (pageNum > 1) setLoadingMore(true)
      const data = await fetchWithAuth(`/accounts/notifications/?page=${pageNum}`)
      const results = data.results || data || []
      
      if (pageNum === 1) {
        setNotifications(results)
      } else {
        setNotifications(prev => [...prev, ...results])
      }
      
      setHasMore(data.next !== null)
      setPage(pageNum)
    } catch (err) { console.error(err) }
    finally { setLoadingMore(false) }
  }

  const checkReminders = async () => {} // Deprecated

  const handleBellClick = () => {
    if (!open) fetchNotifications(1)
    setOpen(!open)
  }

  const markAsRead = async (id) => {
    try {
      setLoadingRead(prev => ({ ...prev, [id]: true }))
      await fetchWithAuth(`/accounts/notifications/${id}/read/`, { method: 'POST' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) { console.error(err) }
    finally { setLoadingRead(prev => ({ ...prev, [id]: false })) }
  }

  const markAllRead = async () => {
    try {
      setLoadingAllRead(true)
      await fetchWithAuth('/accounts/notifications/read-all/', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) { console.error(err) }
    finally { setLoadingAllRead(false) }
  }

  const handleView = (notif) => {
    markAsRead(notif.id)
    setOpen(false)
    // Navigate to the right page based on role and type
    if (notif.lead) {
      if (role === 'admin') {
        router.push(`/admin/leads?highlight=${notif.lead}`)
      } else if (role === 'telecaller') {
        router.push(`/telecaller/leads?highlight=${notif.lead}`)
      } else if (role === 'fieldagent') {
        router.push(`/fieldagent`)
      }
    }
  }

  const handleReminderView = (notif) => {
    setReminderPopup(null)
    markAsRead(notif.id)
    if (role === 'telecaller') {
      router.push(`/telecaller/leads?highlight=${notif.lead}`)
    } else if (role === 'fieldagent') {
      router.push(`/fieldagent`)
    }
  }

  return (
    <>
      {/* Bell Button */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleBellClick}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card2 transition-colors text-txt2"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-accent2 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 animate-in zoom-in">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-card border border-border rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg2/50">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-accent" />
                <span className="text-sm font-bold text-txt">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[9px] font-bold bg-accent2/10 text-accent2 px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} disabled={loadingAllRead}
                  className="text-[10px] font-bold text-accent hover:text-accent2 flex items-center gap-1 transition-colors disabled:opacity-50">
                  {loadingAllRead ? <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin inline-block" /> : <CheckCheck size={12} />}
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-bg3 flex items-center justify-center mx-auto mb-3">
                    <Bell size={20} className="text-txt3" />
                  </div>
                  <p className="text-sm font-medium text-txt3">No notifications yet</p>
                  <p className="text-[10px] text-txt3 mt-1">You'll see updates here</p>
                </div>
              ) : (
                notifications.map(notif => {
                  const config = typeConfig[notif.notif_type] || typeConfig.INFO
                  const Icon = config.icon
                  return (
                    <div
                      key={notif.id}
                      className={clsx(
                        'flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-bg2/50 transition-colors cursor-pointer',
                        !notif.is_read && 'bg-accent/[0.03]'
                      )}
                      onClick={() => handleView(notif)}
                    >
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
                        <Icon size={14} className={config.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={clsx('text-xs font-bold', notif.is_read ? 'text-txt3' : 'text-txt')}>
                            {notif.title}
                          </span>
                          {!notif.is_read && (
                            <span className="w-2 h-2 bg-accent2 rounded-full shrink-0" />
                          )}
                        </div>
                        {notif.message && (
                          <p className="text-[10px] text-txt3 mt-0.5 truncate">{notif.message}</p>
                        )}
                        <span className="text-[9px] text-txt3 mt-1 block">{notif.time_ago}</span>
                      </div>
                      {notif.lead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleView(notif) }}
                          className="shrink-0 text-[9px] font-bold text-accent bg-accent/10 px-2 py-1 rounded-lg hover:bg-accent/20 transition-colors flex items-center gap-1"
                        >
                          <Eye size={10} /> View
                        </button>
                      )}
                    </div>
                  )
                })
              )}
              {hasMore && notifications.length > 0 && (
                <div className="p-3 border-t border-border/50 text-center">
                  <button
                    onClick={() => fetchNotifications(page + 1)}
                    disabled={loadingMore}
                    className="text-xs font-bold text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reminder Full-screen Popup */}
      {reminderPopup && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => setReminderPopup(null)}
        >
          <div
            className="bg-card w-[90%] max-w-sm rounded-3xl shadow-2xl border border-amber/30 p-8 text-center animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-amber/10 flex items-center justify-center mx-auto mb-5 animate-pulse">
              <Phone size={28} className="text-amber" />
            </div>
            <h2 className="font-display font-bold text-xl text-txt mb-2">
              {reminderPopup.title}
            </h2>
            <p className="text-sm text-txt2 mb-6">
              {reminderPopup.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setReminderPopup(null)}
                className="flex-1 py-3 text-sm font-medium text-txt3 rounded-xl border border-border hover:bg-bg3 transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={() => handleReminderView(reminderPopup)}
                className="flex-1 py-3 text-sm font-bold text-white bg-accent rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Eye size={14} /> View Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
