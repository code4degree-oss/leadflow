import { useState, useCallback } from 'react'
import { Filter, Search, RefreshCw, Loader2, Flame, ChevronLeft, ChevronRight as ChevronRightIcon, ChevronDown, UserPlus, Repeat, X, CheckSquare, Square } from 'lucide-react'
import clsx from 'clsx'
import { StatusBadge } from '../../UI'
import { fetchWithAuth } from '../../../utils/api'

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New', color: 'bg-accent/10 text-accent' },
  { value: 'CALLED', label: 'Called', color: 'bg-purple/10 text-purple' },
  { value: 'NOT_ANSWERED', label: 'Not Answered', color: 'bg-amber/10 text-amber' },
  { value: 'INTERESTED', label: 'Interested', color: 'bg-accent2/10 text-accent2' },
  { value: 'HIGH_PROSPECT', label: 'High Prospect', color: 'bg-purple/10 text-purple' },
  { value: 'FOLLOW_UP', label: 'Follow Up', color: 'bg-hot/10 text-hot' },
  { value: 'SITE_VISIT', label: 'Site Visit', color: 'bg-[#0EA5E9]/10 text-[#0EA5E9]' },
  { value: 'VISITED', label: 'Visited', color: 'bg-[#06B6D4]/10 text-[#06B6D4]' },
  { value: 'WON', label: 'Won', color: 'bg-[#10B981]/10 text-[#10B981]' },
  { value: 'LOST', label: 'Lost', color: 'bg-danger/10 text-danger' },
]

export default function LeadsTable({
  leads,
  loading,
  error,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  isHotFilter,
  onHotFilterChange,
  batchFilter,
  onBatchFilterChange,
  sourceOptions,
  page,
  pageSize,
  totalLeads,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onLeadClick,
}) {
  const totalPages = Math.ceil(totalLeads / pageSize)
  
  // ── Multi-select state ──
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkAction, setBulkAction] = useState(null)

  const toggleSelect = useCallback((id, e) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)))
    }
  }, [leads, selectedIds.size])

  const clearSelection = () => setSelectedIds(new Set())

  // ── Inline status change ──
  const handleInlineStatusChange = async (leadId, newStatus, e) => {
    e.stopPropagation()
    try {
      await fetchWithAuth(`/leads/${leadId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      })
      onRefresh?.()
    } catch (err) {
      alert('Failed to update status: ' + err.message)
    }
  }

  // ── Bulk status change ──
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedIds.size === 0) return
    try {
      await Promise.all(
        [...selectedIds].map(id =>
          fetchWithAuth(`/leads/${id}/`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
        )
      )
      clearSelection()
      setBulkAction(null)
      onRefresh?.()
    } catch (err) {
      alert('Bulk update failed: ' + err.message)
    }
  }

  // ── Skeleton rows ──
  const SkeletonRows = () => (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="td w-8"><div className="skeleton skeleton-avatar w-5 h-5 mx-auto" /></td>
          <td className="td">
            <div className="flex items-center gap-3">
              <div className="skeleton skeleton-avatar" />
              <div className="space-y-1.5">
                <div className="skeleton skeleton-text w-28" />
                <div className="skeleton skeleton-text w-20" style={{ height: 10 }} />
              </div>
            </div>
          </td>
          <td className="td"><div className="skeleton skeleton-text w-20" /></td>
          <td className="td"><div className="skeleton skeleton-badge" /></td>
          <td className="td"><div className="skeleton skeleton-text w-16" /></td>
          <td className="td"><div className="skeleton skeleton-text w-16" /></td>
          <td className="td"><div className="skeleton skeleton-badge w-14" /></td>
          <td className="td"><div className="skeleton skeleton-text w-6" /></td>
        </tr>
      ))}
    </>
  )

  return (
    <>
      {/* Status pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => { onStatusFilterChange('all'); onHotFilterChange(false); }} className={clsx('px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm', statusFilter === 'all' && !isHotFilter ? 'bg-accent text-white border-accent scale-105' : 'bg-card text-txt2 border-border hover:bg-bg3')}>All Leads</button>
        <button onClick={() => { onStatusFilterChange('INTERESTED'); onHotFilterChange(false); }} className={clsx('px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm', statusFilter === 'INTERESTED' ? 'bg-purple text-white border-purple scale-105' : 'bg-card text-txt2 border-border hover:bg-bg3')}>Interested</button>
        <button onClick={() => { onStatusFilterChange('SITE_VISIT'); onHotFilterChange(false); }} className={clsx('px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm', statusFilter === 'SITE_VISIT' ? 'bg-accent2 text-white border-accent2 scale-105' : 'bg-card text-txt2 border-border hover:bg-bg3')}>Site Visit Done</button>
        <button onClick={() => { onStatusFilterChange('NOT_ANSWERED'); onHotFilterChange(false); }} className={clsx('px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm', statusFilter === 'NOT_ANSWERED' ? 'bg-amber text-white border-amber scale-105' : 'bg-card text-txt2 border-border hover:bg-bg3')}>Call Not Pick Up</button>
        <button onClick={() => { onStatusFilterChange('all'); onHotFilterChange(true); }} className={clsx('flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm', isHotFilter ? 'bg-hot text-white border-hot scale-105' : 'bg-card text-txt2 border-border hover:bg-bg3')}><Flame size={14}/> Hot Lead</button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-card border border-border rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
          <input value={search} onChange={e => onSearchChange(e.target.value)}
            className="input pl-10 h-10 text-sm bg-bg3" placeholder="Search leads... (Ctrl+K for global search)" />
        </div>
        <div className="flex gap-3">
          <select value={batchFilter} onChange={e => onBatchFilterChange(e.target.value)} className="input min-w-[180px] h-10 text-sm bg-bg3">
            {sourceOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={onRefresh} className="p-2.5 bg-bg3 border border-border/50 rounded-xl hover:text-accent transition-colors">
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden shadow-xl border-border/50">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left relative">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                {/* Checkbox column */}
                <th className="th w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-txt3 hover:text-accent transition-colors">
                    {selectedIds.size === leads.length && leads.length > 0
                      ? <CheckSquare size={15} className="text-accent" />
                      : <Square size={15} />}
                  </button>
                </th>
                <th className="th w-8"></th>
                {['Lead','Assigned','Status','Project','Budget','Next Call','Lost #'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border relative">
              {loading ? (
                <SkeletonRows />
              ) : error ? (
                <tr><td colSpan={9} className="td text-center text-danger py-12 font-bold">{error}</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={9} className="td text-center text-txt3 py-12">No leads found matching criteria.</td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id} className={clsx(
                  'table-row group cursor-pointer',
                  selectedIds.has(lead.id) && 'bg-accent/5 border-l-2 border-l-accent'
                )} onClick={() => onLeadClick(lead)}>
                  {/* Checkbox */}
                  <td className="td w-10 text-center">
                    <button onClick={(e) => toggleSelect(lead.id, e)} className="text-txt3 hover:text-accent transition-colors">
                      {selectedIds.has(lead.id)
                        ? <CheckSquare size={15} className="text-accent" />
                        : <Square size={15} />}
                    </button>
                  </td>

                  <td className="td w-8 text-center">{lead.is_hot && <Flame size={14} className="text-hot mx-auto" />}</td>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold", lead.is_hot ? "bg-hot/10 text-hot" : "bg-accent/10 text-accent")}>
                        {lead.first_name?.[0]}{lead.last_name?.[0] || ''}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-txt group-hover:text-accent transition-colors">{lead.first_name} {lead.last_name}</div>
                        <div className="text-[10px] text-txt3 font-mono">{lead.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td text-xs text-txt2">{lead.assigned_user_name || 'Unassigned'}</td>
                  
                  {/* ═══ INLINE STATUS EDIT ═══ */}
                  <td className="td" onClick={e => e.stopPropagation()}>
                    <InlineStatusSelect
                      currentStatus={lead.status}
                      onStatusChange={(newStatus, e) => handleInlineStatusChange(lead.id, newStatus, e)}
                    />
                  </td>

                  <td className="td text-xs text-txt2">{lead.project_name || '—'}</td>
                  <td className="td text-xs font-mono text-txt2">{lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="td">
                    {lead.next_call_at ? (
                      <span className={clsx("text-[10px] font-bold font-mono px-2 py-0.5 rounded-full", new Date(lead.next_call_at) < new Date() ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent")}>
                        {new Date(lead.next_call_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="td">
                    <span className={clsx("text-xs font-bold font-mono", lead.lost_count >= 4 ? 'text-danger' : lead.lost_count > 0 ? 'text-amber' : 'text-txt3')}>{lead.lost_count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-5 py-4 border-t border-border bg-bg2/30 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-txt2">Rows per page:</span>
            <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)) }} className="bg-bg3 border border-border rounded px-2 py-1 text-xs">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-[10px] text-txt3 font-bold uppercase tracking-widest ml-4">
              Showing {leads.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, totalLeads)} of {totalLeads} Total
            </span>
          </div>
          
          <div className="flex gap-1">
            <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1 || loading} className="p-1.5 rounded-lg border border-border bg-card text-txt hover:bg-bg3 disabled:opacity-50">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center px-3 text-xs font-bold font-mono text-txt2">
              Page {page} of {totalPages || 1}
            </div>
            <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading} className="p-1.5 rounded-lg border border-border bg-card text-txt hover:bg-bg3 disabled:opacity-50">
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ BULK ACTION BAR ═══ */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="text-sm font-bold">{selectedIds.size} selected</span>
          <div className="w-px h-6 bg-white/20" />
          
          {/* Bulk Status Change */}
          <div className="relative">
            <button
              onClick={() => setBulkAction(bulkAction === 'status' ? null : 'status')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
            >
              <Repeat size={12} /> Change Status <ChevronDown size={10} />
            </button>
            {bulkAction === 'status' && (
              <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-2xl py-1 w-44 z-10">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} onClick={() => handleBulkStatusChange(s.value)}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-txt hover:bg-bg3 flex items-center gap-2 transition-colors">
                    <span className={clsx('w-2 h-2 rounded-full', s.color.split(' ')[0])} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={clearSelection}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors">
            <X size={12} /> Clear
          </button>
        </div>
      )}
    </>
  )
}


/**
 * Inline Status Select — Click a status badge to change it via dropdown.
 * Prevents row click propagation so opening the dropdown doesn't open lead detail.
 */
function InlineStatusSelect({ currentStatus, onStatusChange }) {
  const [open, setOpen] = useState(false)

  const currentOpt = STATUS_OPTIONS.find(s => s.value === currentStatus) || { label: currentStatus?.replace(/_/g, ' '), color: 'bg-border2 text-txt2' }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={clsx(
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer',
          currentOpt.color,
          'hover:ring-2 hover:ring-accent/20'
        )}
      >
        {currentOpt.label}
        <ChevronDown size={10} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[20]" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl py-1 w-40 z-[30] animate-in fade-in slide-in-from-top-2">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={(e) => {
                  e.stopPropagation()
                  if (s.value !== currentStatus) {
                    onStatusChange(s.value, e)
                  }
                  setOpen(false)
                }}
                className={clsx(
                  'w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-bg3 flex items-center gap-2 transition-colors',
                  s.value === currentStatus ? 'text-accent font-bold' : 'text-txt'
                )}
              >
                <span className={clsx('w-2 h-2 rounded-full', s.color.split(' ')[0])} />
                {s.label}
                {s.value === currentStatus && <span className="ml-auto text-accent">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
