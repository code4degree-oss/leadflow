/**
 * Admin Hot Leads — Redirects to the main Leads page with hot filter.
 * Hot Leads is now a filter/tab within the main Leads Management page
 * rather than a separate standalone page.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AdminHotRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/leads?filter=hot')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-txt2">Redirecting to leads...</p>
      </div>
    </div>
  )
}
