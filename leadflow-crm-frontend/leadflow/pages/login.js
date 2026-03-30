import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, MapPin } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [authStatus, setAuthStatus] = useState('Sign In')

  // Store geolocation in a ref so it's available when login fires
  const geoRef = useRef({ lat: null, lng: null, resolved: false })

  // Pre-fetch geolocation silently in background on page load
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          geoRef.current = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            resolved: true
          }
        },
        () => {
          // Silently handle denial — admins won't need it
          geoRef.current = { lat: null, lng: null, resolved: true }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      geoRef.current = { lat: null, lng: null, resolved: true }
    }
  }, [])

  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    if (!email || !password) return
    
    setLoading(true)
    setErrorMsg('')
    setAuthStatus('Authenticating...')

    // Helper: wait for geo if not resolved yet (max 3 seconds)
    const waitForGeo = () => new Promise((resolve) => {
      if (geoRef.current.resolved) return resolve()
      const start = Date.now()
      const interval = setInterval(() => {
        if (geoRef.current.resolved || Date.now() - start > 3000) {
          clearInterval(interval)
          resolve()
        }
      }, 200)
    })

    await waitForGeo()

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          password,
          latitude: geoRef.current.lat,
          longitude: geoRef.current.lng
        })
      })
    
      const data = await response.json()
      
      if (!response.ok) {
        // If geofence error and we didn't have location, show a helpful message
        const msg = data.detail || 'Invalid email or password'
        if (msg.includes('Location coordinates are required') || msg.includes('outside your organization')) {
          throw new Error('📍 ' + msg + ' Please enable location access and try again.')
        }
        throw new Error(msg)
      }
      
      // Store tokens
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      localStorage.setItem('user_role', data.role)
      localStorage.setItem('user_email', email)
      localStorage.setItem('user_first_name', data.first_name || '')
      localStorage.setItem('user_last_name', data.last_name || '')
      localStorage.setItem('must_change_password', data.must_change_password ? 'true' : 'false')
      localStorage.setItem('subscription_active', data.subscription_active !== false ? 'true' : 'false')
      
      // If user must change password, redirect to change-password page
      if (data.must_change_password) {
        router.push('/change-password')
        return
      }

      // Redirect based on role
      setAuthStatus('Redirecting...')
      const roleMap = {
        'SUPER_ADMIN': '/superadmin',
        'CLIENT_ADMIN': '/admin',
        'MANAGER': '/admin',
        'TELECALLER': '/telecaller',
        'FIELD_AGENT': '/fieldagent'
      }
      
      const target = roleMap[data.role] || '/'
      router.push(target)
        
    } catch (err) {
      setErrorMsg(err.message)
      setLoading(false)
      setAuthStatus('Sign In')
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
        background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.05) 50%, transparent 70%)'
      }} />

      <div className="w-full max-w-sm relative z-10 fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-display font-extrabold text-3xl text-txt tracking-tight mb-1">
            Lead<span className="text-accent">Flow</span>
          </div>
          <div className="text-txt3 text-sm">Real Estate CRM Platform</div>
        </div>

        {/* Login Card */}
        <div className="card p-6 mb-4">
          <h2 className="font-display font-bold text-base text-txt mb-5">Sign in to your account</h2>
          
          {errorMsg && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-2 text-danger text-xs">
              {errorMsg.includes('📍') ? <MapPin size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input pl-9"
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
              <input
                type={show ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input pl-9 pr-9"
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt3 hover:text-txt2">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" className="text-xs text-accent hover:underline">Forgot password?</button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? <span className="opacity-60">{authStatus}</span> : <>{authStatus} <ArrowRight size={14}/></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-txt3 mt-4">
          Geo-lock enforced for field employees · JWT secured
        </p>
      </div>
    </div>
  )
}
