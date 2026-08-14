import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check, Filter } from 'lucide-react'
import clsx from 'clsx'

/**
 * FacetedFilter — Multi-select dropdown with counts, search, and badge display.
 * Used for filtering leads by status, source, project, assignee, etc.
 *
 * Props:
 *  - label: string (e.g. "Status")
 *  - options: [{ value, label, count?, color? }]
 *  - selected: string[] (currently selected values)
 *  - onChange: (selected: string[]) => void
 *  - multi: boolean (default true)
 */
export default function FacetedFilter({ label, options = [], selected = [], onChange, multi = true }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const filteredOptions = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const toggleOption = (value) => {
    if (!multi) {
      onChange([value])
      setOpen(false)
      return
    }
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const clearAll = (e) => {
    e.stopPropagation()
    onChange([])
  }

  const hasSelection = selected.length > 0

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
          hasSelection
            ? 'bg-accent/5 border-accent/30 text-accent'
            : 'bg-card border-border text-txt2 hover:bg-bg3 hover:text-txt'
        )}
      >
        <Filter size={12} />
        <span>{label}</span>
        {hasSelection && (
          <>
            <div className="w-px h-3 bg-accent/20" />
            <span className="bg-accent/10 text-accent px-1.5 py-0.5 rounded-md text-[10px] font-bold">
              {selected.length}
            </span>
            <button onClick={clearAll} className="hover:bg-accent/10 rounded-full p-0.5 -mr-1 transition-colors">
              <X size={10} />
            </button>
          </>
        )}
        <ChevronDown size={10} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl w-56 z-30 animate-in fade-in slide-in-from-top-2 overflow-hidden">
          {/* Search within options */}
          {options.length > 6 && (
            <div className="p-2 border-b border-border">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full text-xs bg-bg3 rounded-lg px-2.5 py-1.5 text-txt placeholder:text-txt3/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
                autoFocus
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto py-1">
            {filteredOptions.map(opt => {
              const isSelected = selected.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors',
                    isSelected ? 'bg-accent/5 text-accent font-semibold' : 'text-txt hover:bg-bg3'
                  )}
                >
                  {/* Checkbox/radio indicator */}
                  <div className={clsx(
                    'w-4 h-4 rounded flex items-center justify-center border transition-all flex-shrink-0',
                    multi ? 'rounded' : 'rounded-full',
                    isSelected ? 'bg-accent border-accent' : 'border-border2'
                  )}>
                    {isSelected && <Check size={10} className="text-white" />}
                  </div>

                  {/* Color dot */}
                  {opt.color && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                  )}

                  <span className="flex-1 truncate">{opt.label}</span>

                  {/* Count */}
                  {opt.count !== undefined && (
                    <span className="text-[10px] font-mono text-txt3">{opt.count}</span>
                  )}
                </button>
              )
            })}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-txt3 text-xs">
                No options match "{search}"
              </div>
            )}
          </div>

          {/* Footer */}
          {hasSelection && multi && (
            <div className="p-2 border-t border-border flex justify-between items-center">
              <span className="text-[10px] text-txt3 font-medium">{selected.length} selected</span>
              <button onClick={clearAll} className="text-[10px] text-accent hover:text-accent/80 font-bold">
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
