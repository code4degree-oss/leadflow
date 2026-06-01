import '../styles/globals.css'
import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import RouteGuard from '../components/RouteGuard'
import ReminderPopup from '../components/ReminderPopup'

// Root pages where pressing back should exit the app
const ROOT_PAGES = ['/login', '/telecaller', '/admin', '/fieldagent', '/superadmin']

import ErrorBoundary from '../components/ErrorBoundary'
import { Toaster } from 'react-hot-toast'

export default function App({ Component, pageProps }) {
  const router = useRouter()

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
      <ErrorBoundary>
        <RouteGuard>
          <Component {...pageProps} />
          <ReminderPopup />
          <Toaster position="top-center" />
        </RouteGuard>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
