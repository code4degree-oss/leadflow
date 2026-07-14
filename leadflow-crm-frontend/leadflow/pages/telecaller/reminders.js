/**
 * Reminders page — Now redirects to the unified workspace "Due Today" tab.
 * 
 * The standalone Reminders page has been merged into the main workspace
 * as the "Due Today" tab, providing a simpler single-page experience.
 * This redirect ensures any bookmarks or links still work.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function RemindersRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to workspace with due tab active
    router.replace('/telecaller?tab=due')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-txt2">Redirecting to your workspace...</p>
      </div>
    </div>
  )
}
