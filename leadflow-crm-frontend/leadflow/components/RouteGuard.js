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

    // Allow public paths
    if (PUBLIC_PATHS.some(p => path === p)) {
      setAuthorized(true)
      return
    }

    const token = localStorage.getItem('access_token')
    const role  = localStorage.getItem('user_role')

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
