import { Filter, Search, RefreshCw, Loader2, Flame, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import clsx from 'clsx'
import { StatusBadge } from '../../UI'

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
            className="input pl-10 h-10 text-sm bg-bg3" placeholder="Search across all leads..." />
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
                {['','Lead','Assigned','Status','Project','Budget','Next Call','Lost #'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border relative">
              {loading ? (
                <tr><td colSpan={8} className="py-24 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={32} /><p className="text-xs text-txt3">Loading Leads...</p></td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="td text-center text-danger py-12 font-bold">{error}</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} className="td text-center text-txt3 py-12">No leads found matching criteria.</td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id} className="table-row group cursor-pointer" onClick={() => onLeadClick(lead)}>
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
                  <td className="td"><StatusBadge status={lead.status.toLowerCase()} /></td>
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
    </>
  )
}
