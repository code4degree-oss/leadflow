import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

// Maps URL path prefixes to the roles allowed to access them
const ROLE_ROUTE_MAP = {
  '/superadmin': ['SUPER_ADMIN'],
  '/admin':      ['CLIENT_ADMIN', 'MANAGER'],
  '/telecaller': ['TELECALLER'],
  '/fieldagent': ['FIELD_AGENT'],
}

// Where each role should land if they try to access an unauthorized route
const ROLE_DASHBOARD = {
  'SUPER_ADMIN':  '/superadmin',
  'CLIENT_ADMIN': '/admin',
  'MANAGER':      '/admin',
  'TELECALLER':   '/telecaller',
  'FIELD_AGENT':  '/fieldagent',
}

// Pages that don't require any role check
const PUBLIC_PATHS = ['/', '/login', '/change-password', '/subscription-expired']

// Helper to decode JWT without a library
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export default function RouteGuard({ children }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    // Run on initial load
    authCheck(router.asPath)

    // Run on every route change
    const handleRouteChange = (url) => authCheck(url)
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => router.events.off('routeChangeComplete', handleRouteChange)
  }, [router])

  function authCheck(url) {
    const path = url.split('?')[0] // strip query params

    let token = localStorage.getItem('access_token')
    let role  = localStorage.getItem('user_role')

    // Capacitor Native/Cookie Resurrection:
    if (!token && typeof window !== 'undefined') {
        let nToken = null;
        let nRefresh = null;
        let nRole = null;

        if (window.NativeStorage) {
            nToken = window.NativeStorage.getItem('access_token');
            nRefresh = window.NativeStorage.getItem('refresh_token');
            nRole = window.NativeStorage.getItem('user_role');
        }

        if (!nToken) {
            const bToken = document.cookie.match(/(?:^|; )cap_access_token=([^;]*)/);
            const bRef = document.cookie.match(/(?:^|; )cap_refresh_token=([^;]*)/);
            const bRole = document.cookie.match(/(?:^|; )cap_user_role=([^;]*)/);
            nToken = bToken ? bToken[1] : null;
            nRefresh = bRef ? bRef[1] : null;
            nRole = bRole ? bRole[1] : null;
        }

        if (nToken) {
            localStorage.setItem('access_token', nToken);
            if (nRefresh) localStorage.setItem('refresh_token', nRefresh);
            if (nRole) localStorage.setItem('user_role', nRole);
            
            token = nToken;
            role = nRole;
        }
    }

    // SECURE ROUTE GUARD: Override tampered localStorage with signed JWT payload
    if (token) {
      const payload = parseJwt(token)
      if (payload && payload.role) {
        role = payload.role
        // Fix up localStorage if it was tampered with
        if (localStorage.getItem('user_role') !== role) {
          localStorage.setItem('user_role', role)
        }
      }
    }

    // Allow public paths, but redirect if already logged in
    if (PUBLIC_PATHS.some(p => path === p)) {
      if (token && role && (path === '/' || path === '/login')) {
         setAuthorized(false)
         const correctDashboard = ROLE_DASHBOARD[role] || '/'
         router.push(correctDashboard)
         return
      }
      setAuthorized(true)
      return
    }

    // Not logged in → redirect to login
    if (!token) {
      setAuthorized(false)
      router.push('/login')
      return
    }

    // Find which route prefix matches the current path
    const matchedPrefix = Object.keys(ROLE_ROUTE_MAP).find(prefix => path.startsWith(prefix))

    if (matchedPrefix) {
      const allowedRoles = ROLE_ROUTE_MAP[matchedPrefix]
      if (!allowedRoles.includes(role)) {
        // User is trying to access a section they don't belong to
        setAuthorized(false)
        const correctDashboard = ROLE_DASHBOARD[role] || '/'
        router.push(correctDashboard)
        return
      }
    }

    setAuthorized(true)
  }

  return authorized ? children : (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="animate-pulse text-txt3 text-sm">Verifying access...</div>
    </div>
  )
}
