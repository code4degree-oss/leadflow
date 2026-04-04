import { useState } from 'react'
import { useRouter } from 'next/router'
import { Lock, ArrowRight, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword) return

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.')
      return
    }

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const token = localStorage.getItem('access_token')
      let response
      try {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/change-password/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        })
      } catch (networkErr) {
        throw new Error('Unable to reach the server. Please check your connection and try again.')
      }

      let data
      try {
        data = await response.json()
      } catch (parseErr) {
        if (response.status >= 500) {
          throw new Error('Server is temporarily unavailable. Please try again in a moment.')
        }
        throw new Error(`Unexpected server response (${response.status}). Please try again.`)
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to change password')
      }

      setSuccess(true)

      // Clear password change flag and redirect to the appropriate dashboard
      localStorage.setItem('must_change_password', 'false')
      const role = localStorage.getItem('user_role')
      const roleMap = {
        'SUPER_ADMIN': '/superadmin',
        'CLIENT_ADMIN': '/admin',
        'MANAGER': '/admin',
        'TELECALLER': '/telecaller',
        'FIELD_AGENT': '/fieldagent'
      }
      setTimeout(() => {
        router.push(roleMap[role] || '/')
      }, 1500)

    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative overflow-hidden min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: 'linear-gradient(rgba(124,58,237,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.08) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none z-0" style={{
        background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 50%, transparent 70%)'
      }} />

      <div className="w-full max-w-sm relative z-10 fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-display font-extrabold text-3xl text-txt tracking-tight mb-1">
            Lead<span className="text-accent">Flow</span>
          </div>
          <div className="text-txt3 text-sm">Real Estate CRM Platform</div>
        </div>

        {/* Change Password Card */}
        <div className="card p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-warning/10 rounded-xl text-warning">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-txt">Change Your Password</h2>
              <p className="text-[10px] text-txt3 font-bold uppercase tracking-widest">Required before continuing</p>
            </div>
          </div>

          <div className="p-3 bg-warning/5 border border-warning/20 rounded-lg mb-4">
            <p className="text-xs text-txt2">
              Your administrator has required you to change your password before accessing the system.
              Please set a new secure password.
            </p>
          </div>
          
          {errorMsg && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger text-xs">
              <AlertCircle size={14} />
              {errorMsg}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2 text-success text-xs">
              <CheckCircle2 size={14} />
              Password changed successfully! Redirecting...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
              <input
                type="password"
                placeholder="Current Password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="input pl-9"
                required
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
              <input
                type="password"
                placeholder="New Password (min 8 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input pl-9"
                required
                minLength={8}
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input pl-9"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading || success}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? <span className="opacity-60">Changing password…</span> : <>Update Password <ArrowRight size={14}/></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-txt3 mt-4">
          Geo-lock enforced on login · JWT secured
        </p>
      </div>
    </div>
  )
}
