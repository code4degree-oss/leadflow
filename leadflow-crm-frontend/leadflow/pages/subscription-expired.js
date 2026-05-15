import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { ShieldOff, LogOut, Mail, Phone, Lock, ShieldCheck } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function SubscriptionExpiredPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [validUntil, setValidUntil] = useState('')

  useEffect(() => {
    const firstName = localStorage.getItem('user_first_name') || ''
    const lastName = localStorage.getItem('user_last_name') || ''
    setUserName(firstName && lastName ? `${firstName} ${lastName}` : firstName || 'User')

    const vu = localStorage.getItem('valid_until') || ''
    setValidUntil(vu)

    // If user is Super Admin or subscription is fine, redirect away
    const role = localStorage.getItem('user_role')
    const status = localStorage.getItem('subscription_status')
    if (role === 'SUPER_ADMIN' || (status && status !== 'expired')) {
      router.push('/admin')
    }
  }, [])

  const handleLogout = () => {
    localStorage.clear()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden font-sans">
      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-50 shadow-sm rounded-full bg-white/10 backdrop-blur-md">
        <ThemeToggle />
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-30%] left-[-20%] w-[600px] h-[600px] bg-danger/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-15%] w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <div className="max-w-lg w-full">
          {/* Card */}
          <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
            {/* Red header strip */}
            <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 p-8 text-center relative">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <ShieldOff size={36} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Subscription Expired</h1>
                <p className="text-white/80 text-sm">Access has been temporarily suspended</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6">
              {/* Greeting */}
              <div className="text-center">
                <p className="text-txt2 text-sm leading-relaxed">
                  Hi <strong className="text-txt">{userName}</strong>, your organization's subscription
                  {validUntil ? ` expired on ${validUntil}` : ' has expired'}.
                  All features have been temporarily restricted.
                </p>
              </div>

              {/* Data safety assurance */}
              <div className="flex items-start gap-3 p-4 bg-accent/5 border border-accent/15 rounded-2xl">
                <div className="p-2 bg-accent/10 rounded-xl shrink-0 mt-0.5">
                  <ShieldCheck size={18} className="text-accent" />
                </div>
                <div>
                  <div className="text-sm font-bold text-txt mb-0.5">Your data is safe</div>
                  <p className="text-xs text-txt2 leading-relaxed">
                    All your leads, employees, and records are securely preserved. 
                    Once your subscription is renewed, everything will be instantly restored.
                  </p>
                </div>
              </div>

              {/* What's blocked */}
              <div className="p-4 bg-bg3 rounded-2xl border border-border">
                <div className="text-xs font-bold uppercase tracking-widest text-txt3 mb-3">What's restricted</div>
                <div className="grid grid-cols-2 gap-2">
                  {['Dashboard Access', 'Lead Management', 'Employee Panel', 'Data Exports', 'Settings', 'API Access'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-txt2">
                      <Lock size={10} className="text-danger shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest text-txt3 mb-2">Contact to renew</div>
                <div className="flex items-center gap-3 p-3 bg-bg2/50 rounded-xl border border-border hover:border-accent/20 transition-colors">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Mail size={14} className="text-accent" />
                  </div>
                  <div>
                    <div className="text-xs text-txt3">Email</div>
                    <div className="text-sm font-bold text-txt">support@dyleadflow.in</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-bg2/50 rounded-xl border border-border hover:border-accent/20 transition-colors">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Phone size={14} className="text-accent" />
                  </div>
                  <div>
                    <div className="text-xs text-txt3">Phone</div>
                    <div className="text-sm font-bold text-txt">+91 98765 43210</div>
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-bg3 hover:bg-danger/10 text-txt hover:text-danger border border-border hover:border-danger/30 rounded-xl py-3 font-medium text-sm transition-all"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-xs text-txt3/60">
            © 2026 DYLeadFlow CRM <span className="mx-1">•</span> All rights reserved
          </div>
        </div>
      </div>
    </div>
  )
}
