import '../styles/globals.css'
import { ThemeProvider } from 'next-themes'
import RouteGuard from '../components/RouteGuard'
import ReminderPopup from '../components/ReminderPopup'

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <RouteGuard>
        <Component {...pageProps} />
        <ReminderPopup />
      </RouteGuard>
    </ThemeProvider>
  )
}
