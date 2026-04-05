import { useState } from 'react'
import Layout from '../../components/Layout'
import { fetchWithAuth } from '../../utils/api'
import { Megaphone, Send, Users, CheckCircle2, AlertCircle, Sparkles, Bell, Smartphone, Globe } from 'lucide-react'

const QUICK_TEMPLATES = [
  { emoji: '🎉', title: 'Happy New Year!', message: 'Wishing everyone a happy and prosperous New Year! 🎆' },
  { emoji: '🪔', title: 'Happy Diwali!', message: 'May this Diwali bring happiness and prosperity to you and your family! 🪔✨' },
  { emoji: '🚀', title: 'New Feature Launch', message: 'We just released exciting new features! Check them out now.' },
  { emoji: '🔧', title: 'Scheduled Maintenance', message: 'The platform will undergo maintenance tonight from 11 PM to 2 AM. Please save your work.' },
  { emoji: '📢', title: 'Important Update', message: 'We have an important announcement. Please check your notifications for details.' },
  { emoji: '🏆', title: 'Monthly Contest', message: 'This month\'s top performer contest is live! May the best team win! 💪' },
]

export default function BroadcastPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setError('Both title and message are required.')
      return
    }
    
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await fetchWithAuth('/superadmin/clients/broadcast/', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), message: message.trim() }),
      })
      setResult(data)
      setTitle('')
      setMessage('')
    } catch (err) {
      setError(err.message || 'Failed to send broadcast.')
    } finally {
      setLoading(false)
    }
  }

  const applyTemplate = (template) => {
    setTitle(template.title)
    setMessage(template.message)
    setResult(null)
    setError('')
  }

  return (
    <Layout role="superadmin" pageTitle="Broadcast Notifications">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#8B6CF7]/10 via-card to-card p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B6CF7]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B6CF7] to-[#6D4AE6] flex items-center justify-center shadow-lg shadow-[#8B6CF7]/25 shrink-0">
              <Megaphone size={24} className="text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-txt mb-1.5">Broadcast Notifications</h2>
              <p className="text-sm text-txt2 max-w-lg leading-relaxed">
                Send a custom notification to <strong>every user</strong> on the platform — client admins, telecallers, 
                field agents, and managers. They'll receive it as an in-app notification and a push notification 
                on their mobile devices.
              </p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-txt3">
                  <Bell size={12} className="text-[#8B6CF7]" /> In-App
                </div>
                <div className="flex items-center gap-1.5 text-xs text-txt3">
                  <Smartphone size={12} className="text-[#8B6CF7]" /> Push (Mobile)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-txt3">
                  <Globe size={12} className="text-[#8B6CF7]" /> Push (Browser)
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Compose Form */}
          <div className="lg:col-span-2 space-y-5">
            {/* Compose Card */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-bold text-txt">
                <Send size={14} className="text-[#8B6CF7]" />
                Compose Message
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-txt2 uppercase tracking-wider">Notification Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Happy New Year! 🎉"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-bg hover:border-txt3 focus:border-[#8B6CF7] focus:ring-4 focus:ring-[#8B6CF7]/10 transition-all outline-none text-txt text-sm"
                />
                <div className="text-right text-[10px] text-txt3">{title.length}/200</div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-txt2 uppercase tracking-wider">Message Body</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your broadcast message here..."
                  rows={5}
                  maxLength={1000}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-bg hover:border-txt3 focus:border-[#8B6CF7] focus:ring-4 focus:ring-[#8B6CF7]/10 transition-all outline-none text-txt text-sm resize-none"
                />
                <div className="text-right text-[10px] text-txt3">{message.length}/1000</div>
              </div>

              {/* Live Preview */}
              {(title || message) && (
                <div className="p-4 bg-bg2 rounded-xl border border-border/60">
                  <div className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2">Preview</div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#8B6CF7]/10 flex items-center justify-center shrink-0">
                      <Megaphone size={14} className="text-[#8B6CF7]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-txt">{title || 'Title'}</div>
                      <p className="text-[11px] text-txt2 mt-0.5 whitespace-pre-wrap break-words">{message || 'Message body'}</p>
                      <span className="text-[9px] text-txt3 mt-1 block">just now</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-danger/5 border border-danger/20 rounded-xl flex items-center gap-2 text-danger text-xs font-medium">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Success */}
              {result && (
                <div className="p-4 bg-[#10B981]/5 border border-[#10B981]/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-[#10B981] text-sm font-bold">
                    <CheckCircle2 size={16} />
                    Broadcast Sent Successfully!
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div className="text-center p-2 bg-bg rounded-lg">
                      <div className="text-lg font-bold text-txt">{result.users_notified}</div>
                      <div className="text-[9px] text-txt3 font-medium">Users Notified</div>
                    </div>
                    <div className="text-center p-2 bg-bg rounded-lg">
                      <div className="text-lg font-bold text-[#10B981]">{result.push_sent}</div>
                      <div className="text-[9px] text-txt3 font-medium">Push Sent</div>
                    </div>
                    <div className="text-center p-2 bg-bg rounded-lg">
                      <div className="text-lg font-bold text-danger">{result.push_failed}</div>
                      <div className="text-[9px] text-txt3 font-medium">Push Failed</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={loading || !title.trim() || !message.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-[#8B6CF7] to-[#6D4AE6] text-white rounded-xl font-semibold text-sm shadow-lg shadow-[#8B6CF7]/25 hover:shadow-[#8B6CF7]/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending to all users...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Broadcast
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Quick Templates */}
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-txt mb-4">
                <Sparkles size={14} className="text-amber" />
                Quick Templates
              </div>
              <div className="space-y-2">
                {QUICK_TEMPLATES.map((tmpl, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(tmpl)}
                    className="w-full text-left p-3 rounded-xl hover:bg-bg2 border border-transparent hover:border-border transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tmpl.emoji}</span>
                      <span className="text-xs font-bold text-txt group-hover:text-[#8B6CF7] transition-colors">{tmpl.title}</span>
                    </div>
                    <p className="text-[10px] text-txt3 mt-1 truncate pl-7">{tmpl.message}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Info box */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-txt">
                <Users size={14} className="text-accent2" />
                How it works
              </div>
              <div className="text-[11px] text-txt2 space-y-2 leading-relaxed">
                <p>📱 Users with the <strong>mobile app</strong> installed will receive a native push notification — even if the app is closed.</p>
                <p>🌐 Users logged in via <strong>browser</strong> with notifications enabled will get a browser push notification.</p>
                <p>🔔 All users will see the message in their <strong>in-app notification</strong> bell the next time they open the app.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
