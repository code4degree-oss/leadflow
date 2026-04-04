import '../styles/globals.css'
import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import RouteGuard from '../components/RouteGuard'
import ReminderPopup from '../components/ReminderPopup'

// Root pages where pressing back should exit the app
const ROOT_PAGES = ['/login', '/telecaller', '/admin', '/fieldagent', '/superadmin']

export default function App({ Component, pageProps }) {
  const router = useRouter()

  // Capacitor WebView Session Persistence Fix:
  // Android aggressively clears localStorage when swiping the app away, but it persists cookies.
  // This safely restores the tokens back to localStorage from cookies exactly when the app loads.
  if (typeof window !== 'undefined') {
    let backupTokenMatch = null;
    let backupRefreshMatch = null;
    let backupRoleMatch = null;

    // Check Hardware Native OS Storage first (The new Android plugin we made)
    if (window.NativeStorage) {
        let nToken = window.NativeStorage.getItem('access_token');
        if (nToken) {
           backupTokenMatch = [null, nToken];
           backupRefreshMatch = [null, window.NativeStorage.getItem('refresh_token')];
           backupRoleMatch = [null, window.NativeStorage.getItem('user_role')];
        }
    }

    // Fallback to cookies if Native storage isn't there
    if (!backupTokenMatch) {
       backupTokenMatch = document.cookie.match(/(?:^|; )cap_access_token=([^;]*)/);
       backupRefreshMatch = document.cookie.match(/(?:^|; )cap_refresh_token=([^;]*)/);
       backupRoleMatch = document.cookie.match(/(?:^|; )cap_user_role=([^;]*)/);
    }
    
    if (backupTokenMatch && !localStorage.getItem('access_token')) {
      localStorage.setItem('access_token', backupTokenMatch[1]);
      if (backupRefreshMatch && backupRefreshMatch[1]) localStorage.setItem('refresh_token', backupRefreshMatch[1]);
      if (backupRoleMatch && backupRoleMatch[1]) localStorage.setItem('user_role', backupRoleMatch[1]);
      console.log('Restored Capacitor session from Native OS / Cookies.');
    }
  }

  useEffect(() => {
    // Only run in Capacitor (native app) context
    let cleanup = null

    async function setupBackButton() {
      try {
        const { App: CapApp } = await import('@capacitor/app')
        const listener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          const isRoot = ROOT_PAGES.includes(router.pathname)
          if (!isRoot && (canGoBack || window.history.length > 1)) {
            router.back()
          } else {
            CapApp.exitApp()
          }
        })
        cleanup = () => listener.remove()
      } catch (e) {
        // Not running in Capacitor (i.e., browser) — silently ignore
      }
    }

    setupBackButton()
    return () => { if (cleanup) cleanup() }
  }, [router])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <RouteGuard>
        <Component {...pageProps} />
        <ReminderPopup />
      </RouteGuard>
    </ThemeProvider>
  )
}
