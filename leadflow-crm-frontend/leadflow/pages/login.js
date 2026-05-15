import { useState } from 'react'
import { useRouter } from 'next/router'
import { Eye, EyeOff, AlertCircle, MapPin, CheckCircle2, Ban } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [authStatus, setAuthStatus] = useState('Sign In to Dashboard')

  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    if (!email || !password) return
    
    setLoading(true)
    setErrorMsg('')
    setAuthStatus('Checking location...')

    // Always request fresh GPS coordinates when user clicks login
    let lat = null
    let lng = null
    
    try {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
           const req = await Geolocation.requestPermissions();
           if (req.location !== 'granted') {
              throw new Error('Location permission denied');
           }
        }
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        console.log('[LOGIN] Capacitor GPS acquired:', lat, lng);
      } catch (capErr) {
        console.warn('[LOGIN] Capacitor GPS failed, falling back to HTML5:', capErr.message);
        const position = await new Promise((resolve, reject) => {
          if (!("geolocation" in navigator)) {
            reject(new Error('Geolocation not supported'));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0  // Force fresh reading, don't use cache
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        console.log('[LOGIN] Browser GPS acquired:', lat, lng);
      }
    } catch (geoErr) {
      console.warn('[LOGIN] GPS failed:', geoErr.message)
      // Continue with null — backend will decide if this is allowed
    }

    setAuthStatus('Authenticating...')

    try {
      const requestBody = { 
        email: email.trim(), 
        password,
        latitude: lat,
        longitude: lng
      }
      console.log('[LOGIN] Sending request with coords:', { latitude: lat, longitude: lng })

      let response
      try {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/login/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      } catch (networkErr) {
        // Network failure (DNS, CORS, server down, SSL issues, etc.)
        console.error('[LOGIN] Network error:', networkErr)
        throw new Error('Unable to reach the server. Please check your internet connection and try again.')
      }
      console.log('[LOGIN] Response status:', response.status)

      // Safely parse JSON — production servers (nginx/gunicorn) may return HTML error pages
      let data
      try {
        data = await response.json()
      } catch (parseErr) {
        console.error('[LOGIN] JSON parse failed, status:', response.status, parseErr)
        if (response.status >= 500) {
          throw new Error('Server is temporarily unavailable. Please try again in a moment.')
        }
        throw new Error(`Unexpected server response (${response.status}). Please try again.`)
      }
      
      if (!response.ok) {
        // Extract error message — handle both string and array formats
        let msg = data.detail || data.non_field_errors || 'Invalid email or password'
        if (Array.isArray(msg)) msg = msg.join(' ')
        const lowerMsg = msg.toLowerCase()
        
        // Django SimpleJWT returns "No active account found with the given credentials"
        // for BOTH wrong passwords AND inactive accounts. Treat it as a credentials error.
        if (lowerMsg.includes('no active account')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.')
        }
        // Suspended accounts
        if (lowerMsg.includes('suspended') || lowerMsg.includes('subscription has expired')) {
          throw new Error('🚫 Your account has been suspended. Please contact your organization administrator.')
        }
        // Geofencing blocks (403 from view layer, 400 from serializer layer)
        if (response.status === 403 || lowerMsg.includes('location') || lowerMsg.includes('geofence') || lowerMsg.includes('outside')) {
          throw new Error('📍 ' + msg)
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
      localStorage.setItem('subscription_status', data.subscription_status || 'active')
      localStorage.setItem('days_remaining', data.days_remaining != null ? String(data.days_remaining) : '')
      
      // Native Android OS Backup (bypasses ALL Capacitor limits)
      if (typeof window !== 'undefined' && window.NativeStorage) {
        window.NativeStorage.setItem('access_token', data.access);
        window.NativeStorage.setItem('refresh_token', data.refresh);
        window.NativeStorage.setItem('user_role', data.role);
      }
      
      // Capacitor WebView Persistent Sessions Backup
      // Cookies reliably survive app kills on Android WebViews, whereas localStorage can be aggressively purged.
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString(); // 30 days
      document.cookie = `cap_access_token=${data.access}; expires=${expiry}; path=/; SameSite=Strict`;
      document.cookie = `cap_refresh_token=${data.refresh}; expires=${expiry}; path=/; SameSite=Strict`;
      document.cookie = `cap_user_role=${data.role}; expires=${expiry}; path=/; SameSite=Strict`;
      
      // If user must change password, redirect
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
      setAuthStatus('Sign In to Dashboard')
    }
  }

  return (
    <div className="flex min-h-screen bg-bg font-sans">
      {/* Theme Toggle */}
      <div className="fixed top-6 right-6 z-50 shadow-sm rounded-full bg-white/10 backdrop-blur-md">
        <ThemeToggle />
      </div>

      {/* LEFT SECTION - Branding & Features */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] xl:w-1/2 p-12 xl:p-20 relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950 text-white shadow-2xl z-10">
        
        {/* Subtle background abstract shapes */}
        <div className="absolute top-[-20%] left-[-10%] w-[140%] h-[140%] opacity-30 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse-slow"></div>
          <div className="absolute top-2/3 right-1/4 w-[500px] h-[500px] bg-indigo-500 rounded-full mix-blend-screen filter blur-[120px] opacity-40"></div>
        </div>

        <div className="relative z-10 flex flex-col pt-8">
          {/* Headline & Subhead */}
          <h1 className="text-4xl xl:text-5xl font-bold mb-6 tracking-tight leading-[1.15]">
            Manage Your Leads Smarter
          </h1>
          <p className="text-indigo-200 text-lg xl:text-xl max-w-md leading-relaxed mb-12">
            Track, convert, and manage real estate leads efficiently in one platform.
          </p>

          {/* Feature List */}
          <div className="space-y-5 text-indigo-100 font-medium text-[1.05rem]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-purple-400 w-6 h-6 flex-shrink-0" />
              <span>Track Property Leads</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-purple-400 w-6 h-6 flex-shrink-0" />
              <span>Assign Leads to Agents</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-purple-400 w-6 h-6 flex-shrink-0" />
              <span>Follow-ups & Reminders</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-purple-400 w-6 h-6 flex-shrink-0" />
              <span>Deal Pipeline Management</span>
            </div>
          </div>
        </div>


        
        {/* Simple decor */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-indigo-950/80 to-transparent pointer-events-none"></div>
      </div>

      {/* RIGHT SECTION - Login Form */}
      <div className="w-full lg:w-[55%] xl:w-1/2 flex flex-col relative bg-bg">
        {/* Grid pattern background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{
          backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        <div className="flex-1 flex flex-col justify-center items-center p-8 sm:p-12 relative z-10">
          <div className="w-full max-w-[420px]">
            {/* Logo */}
            <div className="mb-10 text-center lg:text-left">
              <div className="font-display font-extrabold text-4xl text-txt tracking-tight mb-1 flex items-center justify-center lg:justify-start">
                DY Lead<span className="text-accent">Flow</span>
              </div>
              <div className="text-txt3 text-sm flex items-center justify-center lg:justify-start">Real Estate CRM Platform</div>
            </div>

            {/* Title & Sub */}
            <h2 className="text-2xl font-bold text-txt mb-2">Login to your account</h2>
            <p className="text-txt3 text-sm mb-8">
              Welcome back! Please enter your details.
            </p>

            {errorMsg && (
              <div className="mb-6 p-4 bg-danger/5 border border-danger/20 rounded-xl flex items-start gap-3 text-danger text-sm shadow-sm ring-1 ring-danger/10">
                {errorMsg.includes('📍') ? (
                  <MapPin size={18} className="shrink-0 mt-0.5" />
                ) : errorMsg.includes('🚫') ? (
                  <Ban size={18} className="shrink-0 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{errorMsg.replace('🚫 ', '')}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-txt2">Email Address</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 min-h-[48px] rounded-xl border border-border bg-bg hover:border-txt3 focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all outline-none text-txt shadow-sm"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-txt2">Password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 min-h-[48px] rounded-xl border border-border bg-bg hover:border-txt3 focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all outline-none text-txt shadow-sm pr-12"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShow(!show)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-txt3 hover:text-txt2 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-txt2 hover:text-txt transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30 focus:ring-offset-0 bg-transparent transition-colors" />
                  <span className="font-medium">Remember Me</span>
                </label>
                <button type="button" className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors">
                  Forgot Password?
                </button>
              </div>

              {/* Buttons */}
              <div className="pt-4 space-y-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent/90 text-white min-h-[48px] rounded-xl shadow-[0_4px_14px_0_rgba(124,58,237,0.39)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.23)] hover:-translate-y-0.5 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                >
                  {loading ? <span className="opacity-90">{authStatus}</span> : 'Sign In to Dashboard'}
                </button>

                <button
                  type="button"
                  className="w-full bg-transparent border-2 border-border hover:border-txt3 text-txt min-h-[48px] rounded-xl transition-all font-semibold flex items-center justify-center"
                >
                  View Demo
                </button>
              </div>

            </form>

            <div className="mt-8 text-center text-xs text-txt3 font-medium">
              Admin <span className="mx-1 opacity-40">•</span> Agent <span className="mx-1 opacity-40">•</span> Manager
            </div>

          </div>

          {/* Footer */}
          <div className="absolute bottom-6 w-full text-center flex items-center justify-center text-xs font-medium text-txt3/60">
            © 2026 DY LeadFlow CRM <span className="mx-2">|</span> Privacy Policy <span className="mx-2">|</span> Terms
          </div>

        </div>
      </div>
    </div>
  )
}
