/**
 * Shared date helper utilities for telecaller workflows.
 * Previously duplicated across telecaller/index.js, leads.js, and reminders.js.
 */

/**
 * Returns the next business day (skips weekends) at 9:00 AM.
 * @param {number} daysFromNow - Number of days ahead to start from.
 * @returns {Date}
 */
export function getNextBusinessDay(daysFromNow = 1) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d
}

/**
 * Formats a Date object into the datetime-local input format (YYYY-MM-DDTHH:MM).
 * @param {Date} date
 * @returns {string}
 */
export function formatDatetimeLocal(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Returns today's date as YYYY-MM-DD string.
 * @returns {string}
 */
export function todayStr() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Given a call outcome, returns a smart default next-call datetime string.
 * - INTERESTED → 2 business days out
 * - CALLED → 3 business days out
 * - NOT_ANSWERED → 1 business day out (auto-scheduled)
 * - CALLBACK → empty (user picks)
 * - LOST/WON → empty (terminal states)
 * @param {string} outcomeKey
 * @returns {string} Formatted datetime-local string or empty string
 */
export function getSmartNextCall(outcomeKey) {
  switch (outcomeKey) {
    case 'INTERESTED': return formatDatetimeLocal(getNextBusinessDay(2))
    case 'CALLED': return formatDatetimeLocal(getNextBusinessDay(3))
    case 'CALLBACK': return ''
    case 'NOT_ANSWERED': return formatDatetimeLocal(getNextBusinessDay(1))
    default: return ''
  }
}

/**
 * Returns a due-status object for a lead based on its next_call_at.
 * Used for inline badges: 🔴 Overdue, 🟡 Due Today, 🟢 Upcoming, ⚪ No date
 * @param {string|null} nextCallAt - ISO date string or null
 * @returns {{ label: string, color: string, bgClass: string, textClass: string, priority: number }}
 */
export function getDueStatus(nextCallAt) {
  if (!nextCallAt) return { label: '', color: 'gray', bgClass: '', textClass: 'text-txt3', priority: 99 }
  
  const now = new Date()
  const due = new Date(nextCallAt)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.floor((dueDay - today) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, color: 'danger', bgClass: 'bg-danger/10', textClass: 'text-danger', priority: 0 }
  }
  if (diffDays === 0) {
    return { label: 'Due today', color: 'amber', bgClass: 'bg-amber/10', textClass: 'text-amber', priority: 1 }
  }
  if (diffDays === 1) {
    return { label: 'Tomorrow', color: 'accent', bgClass: 'bg-accent/10', textClass: 'text-accent', priority: 2 }
  }
  return { label: `In ${diffDays}d`, color: 'accent', bgClass: 'bg-accent/5', textClass: 'text-accent', priority: 3 }
}
