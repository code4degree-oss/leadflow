import '../styles/globals.css'
import { ThemeProvider } from 'next-themes'
import RouteGuard from '../components/RouteGuard'

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <RouteGuard>
        <Component {...pageProps} />
      </RouteGuard>
    </ThemeProvider>
  )
}
