import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Command, ArrowRight, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../utils/api'

/**
 * Quick Search (Ctrl+K) — Command palette-style search across all leads.
 * Opens as a modal overlay with keyboard-first navigation.
 */
export default function QuickSearch({ onSelectLead }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)

  // Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await fetchWithAuth(`/leads/?search=${encodeURIComponent(query)}&page_size=8`)
        setResults(data.results || [])
        setSelectedIdx(0)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault()
      onSelectLead?.(results[selectedIdx])
      setOpen(false)
    }
  }

  if (!open) return null

  return (
    <div className="quick-search-modal" onClick={() => setOpen(false)}>
      <div className="quick-search-panel" onClick={e => e.stopPropagation()}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5">
          <Search size={18} className="text-txt3 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="quick-search-input !px-0 !border-b-0"
            placeholder="Search leads by name, phone, email..."
          />
          {loading && <Loader2 size={16} className="animate-spin text-accent flex-shrink-0" />}
          <button onClick={() => setOpen(false)} className="flex-shrink-0 text-txt3 hover:text-txt p-1">
            <X size={16} />
          </button>
        </div>
        <div className="h-px bg-border" />

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-1">
          {!query.trim() && (
            <div className="px-5 py-8 text-center text-txt3 text-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <kbd className="px-2 py-0.5 bg-bg3 rounded border border-border text-[10px] font-mono">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-2 py-0.5 bg-bg3 rounded border border-border text-[10px] font-mono">K</kbd>
              </div>
              Start typing to search across all leads
            </div>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <div className="px-5 py-8 text-center text-txt3 text-sm">
              No leads found for "{query}"
            </div>
          )}
          {results.map((lead, i) => (
            <div
              key={lead.id}
              onClick={() => { onSelectLead?.(lead); setOpen(false) }}
              className={clsx(
                'flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors',
                i === selectedIdx ? 'bg-accent/5' : 'hover:bg-bg3/50'
              )}
            >
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                lead.is_hot ? 'bg-hot/10 text-hot' : 'bg-accent/10 text-accent'
              )}>
                {lead.first_name?.[0]}{lead.last_name?.[0] || ''}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-txt truncate">
                  {lead.first_name} {lead.last_name}
                </div>
                <div className="text-[10px] text-txt3 font-mono">{lead.phone}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={clsx(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  `bg-[var(--status-${lead.status?.toLowerCase()?.replace(/_/g, '-')})]/.1`,
                  'bg-accent/10 text-accent'
                )}>
                  {lead.status?.replace(/_/g, ' ')}
                </span>
                {i === selectedIdx && <ArrowRight size={12} className="text-accent" />}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2 border-t border-border bg-bg3/50 flex items-center gap-4 text-[10px] text-txt3">
          <span className="flex items-center gap-1"><kbd className="px-1 bg-bg3 rounded border border-border">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 bg-bg3 rounded border border-border">↵</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="px-1 bg-bg3 rounded border border-border">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
