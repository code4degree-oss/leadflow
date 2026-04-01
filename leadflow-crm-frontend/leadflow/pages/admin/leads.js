import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import { Filter, Download, Search, RefreshCw, Trash2, ChevronDown, Loader2, FileSpreadsheet, AlertTriangle, UserPlus, X, History, Calendar, PhoneCall, CheckCircle2, Circle, Flame, MapPin, FileText, ChevronRight, Clock, Bell, DollarSign, Building2, UserCheck, Layers, ChevronLeft, ChevronRight as ChevronRightIcon, Trophy, Users, Shuffle, BarChart2 } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

const STATUS_FILTERS = ['all','new','called','not_answered','interested','site_visit','won','lost']

export default function AdminLeads() {
  const [leads, setLeads] = useState([])
  const [lostLeads, setLostLeads] = useState([])
  const [batchStats, setBatchStats] = useState([])
  const [employees, setEmployees] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)
  
  const [activeTab, setActiveTab] = useState('all') // 'all', 'batches', 'lost', 'won', 'assign'
  
  // Won Leads
  const [wonLeads, setWonLeads] = useState([])
  
  // Bulk Assign
  const [assignMode, setAssignMode] = useState('manual') // manual, round_robin, load_balance
  const [assignUserId, setAssignUserId] = useState('')
  const [fromUserId, setFromUserId] = useState('')  // redistribute FROM this user
  const [assignStatusFilter, setAssignStatusFilter] = useState('NEW') // NEW, all
  const [assignCount, setAssignCount] = useState(10)
  const [assigning, setAssigning] = useState(false)
  
  // Filtering & Pagination
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [batchFilter, setBatchFilter] = useState('all')
  const [sourceOptions, setSourceOptions] = useState([])
  
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalLeads, setTotalLeads] = useState(0)

  const [reassignLead, setReassignLead] = useState(null)
  const [selectedUser, setSelectedUser] = useState('')

  const [detailLead, setDetailLead] = useState(null)
  const [detailTab, setDetailTab] = useState('info')
  const [timeline, setTimeline] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => { 
    fetchEmployees() 
    fetchBatchProgress() // To get source options initially
  }, [])

  useEffect(() => {
    if (activeTab === 'all') fetchLeads()
    if (activeTab === 'batches') fetchBatchProgress()
    if (activeTab === 'lost') fetchLostQueue()
    if (activeTab === 'won') fetchWonLeads()
  }, [activeTab, page, pageSize, statusFilter, batchFilter])

  useEffect(() => {
    setPage(1) // Reset to page 1 when search or filters change
  }, [search, statusFilter, batchFilter])

  // Optional: Debounce search
  useEffect(() => {
    if (activeTab === 'all') {
      const delay = setTimeout(fetchLeads, 500)
      return () => clearTimeout(delay)
    }
  }, [search])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      let url = `/leads/?page=${page}&page_size=${pageSize}`
      if (search) url += `&search=${search}`
      if (statusFilter !== 'all') url += `&status=${statusFilter.toUpperCase()}`
      if (batchFilter !== 'all') url += `&source=${batchFilter}`
      
      const data = await fetchWithAuth(url)
      setLeads(data.results || [])
      setTotalLeads(data.count || 0)
      setError(null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const fetchBatchProgress = async () => {
    try {
      setLoading(true)
      const data = await fetchWithAuth('/leads/batch-progress/')
      setBatchStats(data || [])
      setSourceOptions(['all', ...(data || []).map(b => b.source)])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchLostQueue = async () => {
    try {
      setLoading(true)
      const data = await fetchWithAuth('/leads/lost-queue/')
      setLostLeads(data.results || data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchEmployees = async () => {
    try {
      const data = await fetchWithAuth('/accounts/employees/')
      setEmployees((data.results || data || []).filter(e => e.role === 'TELECALLER' || e.role === 'FIELD_AGENT'))
    } catch (err) { /* */ }
  }

  const fetchWonLeads = async () => {
    try {
      setLoading(true)
      const data = await fetchWithAuth('/leads/won-leads/')
      setWonLeads(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleBulkAssign = async () => {
    if (assignMode === 'manual' && !assignUserId) {
      alert('Please select a user to assign leads to.')
      return
    }
    setAssigning(true)
    try {
      const payload = {
        mode: assignMode,
        count: assignCount,
        status_filter: assignStatusFilter,
      }
      if (assignMode === 'manual') payload.user_id = assignUserId
      if (fromUserId) payload.from_user_id = fromUserId
      
      const result = await fetchWithAuth('/leads/bulk-assign/', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      alert(result.detail)
      fetchLeads()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally { setAssigning(false) }
  }

  const openDetailDrawer = async (lead) => {
    setDetailLead(lead)
    setDetailTab('info')
    setLoadingDetail(true)
    try {
      const [t, f] = await Promise.all([
        fetchWithAuth(`/leads/${lead.id}/timeline/`).catch(() => []),
        fetchWithAuth(`/leads/${lead.id}/follow-ups/`).catch(() => [])
      ])
      setTimeline(t || [])
      setFollowUps(f || [])
    } catch (err) { console.error(err) }
    finally { setLoadingDetail(false) }
  }

  const handleExport = async (format = 'csv') => {
    try {
      setExporting(true)
      const response = await fetchWithAuth(`/leads/export/?format=${format}`, {
        method: 'GET',
        headers: { 'Accept': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      }, true)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads_export_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) { alert('Export failed: ' + err.message) }
    finally { setExporting(false) }
  }

  const handleAdminReassign = async () => {
    if (!reassignLead || !selectedUser) return
    try {
      const result = await fetchWithAuth(`/leads/${reassignLead.id}/admin-reassign/`, {
        method: 'POST', body: JSON.stringify({ user_id: selectedUser })
      })
      alert(result.detail)
      setReassignLead(null)
      setSelectedUser('')
      fetchLostQueue()
    } catch (err) { alert('Error: ' + err.message) }
  }

  const handlePermanentDelete = async (leadId) => {
    if (!confirm('⚠️ PERMANENTLY delete this lead?')) return
    try {
      await fetchWithAuth(`/leads/${leadId}/permanent-delete/`, { method: 'DELETE' })
      fetchLostQueue()
    } catch (err) { alert('Error: ' + err.message) }
  }

  const getTimelineIcon = (type) => {
    const icons = {
      'CALL_LOGGED': PhoneCall, 'STATUS_CHANGE': CheckCircle2, 'ASSIGNED': ChevronRight,
      'REASSIGNED': ChevronRight, 'FOLLOW_UP_SET': Calendar, 'FOLLOW_UP_COMPLETED': CheckCircle2,
      'SITE_VISIT_SCHEDULED': MapPin, 'SITE_VISIT_COMPLETED': CheckCircle2, 'NOTE_ADDED': FileText,
      'ESCALATED': Flame, 'IMPORTED': FileText,
    }
    return icons[type] || Circle
  }

  const getTimelineColor = (type) => {
    const colors = {
      'CALL_LOGGED': 'text-accent bg-accent/10', 'STATUS_CHANGE': 'text-purple bg-purple/10',
      'FOLLOW_UP_SET': 'text-amber bg-amber/10', 'FOLLOW_UP_COMPLETED': 'text-[#10B981] bg-[#10B981]/10',
      'SITE_VISIT_SCHEDULED': 'text-accent2 bg-accent2/10', 'ESCALATED': 'text-danger bg-danger/10',
    }
    return colors[type] || 'text-txt3 bg-bg3'
  }

  const totalPages = Math.ceil(totalLeads / pageSize)

  return (
    <Layout role="admin" pageTitle="Lead Management"
      actions={
        <div className="flex gap-2">
          <button disabled={exporting} onClick={() => handleExport('csv')} className="btn-ghost text-xs group">
            {exporting ? <Loader2 size={13} className="animate-spin text-accent" /> : <Download size={13} />} Export CSV
          </button>
          <button disabled={exporting} onClick={() => handleExport('excel')} className="btn-ghost text-xs border-green/20 hover:bg-green/5 text-green-600">
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Excel
          </button>
        </div>
      }
    >

      {/* Tab Toggle */}
      <div className="flex gap-2 mb-6 border-b border-border pb-4 flex-wrap">
        <button onClick={() => setActiveTab('all')}
          className={clsx('px-5 py-2.5 rounded-xl text-xs font-bold transition-all border',
            activeTab === 'all' ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-card text-txt2 border-border hover:bg-bg3')}>
          All Leads
        </button>
        <button onClick={() => setActiveTab('assign')}
          className={clsx('px-5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2',
            activeTab === 'assign' ? 'bg-accent2 text-white border-accent2 shadow-lg shadow-accent2/20' : 'bg-card text-txt2 border-border hover:bg-bg3')}>
          <Users size={14} /> Assign Leads
        </button>
        <button onClick={() => setActiveTab('won')}
          className={clsx('px-5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2',
            activeTab === 'won' ? 'bg-[#10B981] text-white border-[#10B981] shadow-lg shadow-[#10B981]/20' : 'bg-card text-txt2 border-border hover:bg-bg3')}>
          <Trophy size={14} /> Won Leads
        </button>
        <button onClick={() => setActiveTab('batches')}
          className={clsx('px-5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2',
            activeTab === 'batches' ? 'bg-purple text-white border-purple shadow-lg shadow-purple/20' : 'bg-card text-txt2 border-border hover:bg-bg3')}>
          <Layers size={14} /> Batch Tracking
        </button>
        <button onClick={() => setActiveTab('lost')}
          className={clsx('px-5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2',
            activeTab === 'lost' ? 'bg-danger text-white border-danger shadow-lg shadow-danger/20' : 'bg-card text-txt2 border-border hover:bg-bg3')}>
          <AlertTriangle size={14} /> Lost Queue
        </button>
      </div>

      {activeTab === 'all' && (
        <>
          {/* Status pills - Filter purely handles server-side filtering */}
          <div className="flex flex-wrap gap-2 mb-6">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize border shadow-sm',
                  statusFilter === s ? 'bg-accent text-white border-accent shadow-accent/20 scale-105' : 'bg-card text-txt2 border-border hover:bg-bg3'
                )}>
                {s === 'all' ? 'All' : s.replace(/_/g,' ')}
              </button>
            ))}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-card border border-border rounded-2xl shadow-sm">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="input pl-10 h-10 text-sm bg-bg3" placeholder="Search across all leads..." />
            </div>
            <div className="flex gap-3">
              <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className="input min-w-[180px] h-10 text-sm bg-bg3">
                {sourceOptions.map(b => <option key={b} value={b}>{b === 'all' ? 'All Sources' : b}</option>)}
              </select>
              <button onClick={fetchLeads} className="p-2.5 bg-bg3 border border-border/50 rounded-xl hover:text-accent transition-colors">
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
                    <tr key={lead.id} className="table-row group cursor-pointer" onClick={() => openDetailDrawer(lead)}>
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
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="bg-bg3 border border-border rounded px-2 py-1 text-xs">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-[10px] text-txt3 font-bold uppercase tracking-widest ml-4">
                  Showing {leads.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, totalLeads)} of {totalLeads} Total
                </span>
              </div>
              
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="p-1.5 rounded-lg border border-border bg-card text-txt hover:bg-bg3 disabled:opacity-50">
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center px-3 text-xs font-bold font-mono text-txt2">
                  Page {page} of {totalPages || 1}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} className="p-1.5 rounded-lg border border-border bg-card text-txt hover:bg-bg3 disabled:opacity-50">
                  <ChevronRightIcon size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BATCH PROGRESS TABS */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-display text-txt">Batch Progress Tracking</h2>
            <button onClick={fetchBatchProgress} className="btn-ghost text-xs"><RefreshCw size={14} className={clsx("mr-2", loading && "animate-spin")} />Refresh Stats</button>
          </div>
          
          {loading ? (
             <div className="py-24 text-center card"><Loader2 className="animate-spin mx-auto text-purple mb-2" size={32} /><p className="text-xs text-txt3">Loading Batch Stats...</p></div>
          ) : batchStats.length === 0 ? (
            <div className="py-24 text-center card"><Layers className="mx-auto text-txt3 opacity-40 mb-3" size={40} /><p className="text-sm font-bold text-txt">No batches uploaded yet.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batchStats.map((batch, idx) => (
                <div key={idx} className="card p-5 border-t-4 border-t-purple shadow-md hover:shadow-lg hover:border-border2 transition-all">
                  <div className="flex items-center gap-2 mb-4">
                    <FileSpreadsheet size={18} className="text-purple" />
                    <h3 className="font-bold text-txt truncate" title={batch.source}>{batch.source}</h3>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-bold text-txt2">Coverage Progress</span>
                      <span className="font-mono font-bold text-purple">{batch.progress_percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-bg3 rounded-full overflow-hidden">
                      <div className="h-full bg-purple transition-all duration-1000" style={{ width: `${batch.progress_percentage}%` }} />
                    </div>
                    <div className="text-[10px] text-txt3 text-right mt-1">{batch.covered} / {batch.total} Leads Covered</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-bg2/50 p-2 rounded border border-border">
                      <div className="text-[9px] uppercase tracking-wider text-txt3 mb-0.5">Untouched (New)</div>
                      <div className="font-bold text-txt">{batch.new_leads}</div>
                    </div>
                    <div className="bg-accent/5 p-2 rounded border border-accent/20">
                      <div className="text-[9px] uppercase tracking-wider text-accent mb-0.5">In Progress</div>
                      <div className="font-bold text-accent">{batch.in_progress}</div>
                    </div>
                    <div className="bg-[#10B981]/5 p-2 rounded border border-[#10B981]/20">
                      <div className="text-[9px] uppercase tracking-wider text-[#10B981] mb-0.5">Won</div>
                      <div className="font-bold text-[#10B981]">{batch.won}</div>
                    </div>
                    <div className="bg-danger/5 p-2 rounded border border-danger/20">
                      <div className="text-[9px] uppercase tracking-wider text-danger mb-0.5">Lost</div>
                      <div className="font-bold text-danger">{batch.lost}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LOST LEADS QUEUE */}
      {activeTab === 'lost' && (
        <div className="card overflow-hidden shadow-xl border-danger/20">
          <div className="p-4 border-b border-border bg-danger/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="text-danger" />
              <div>
                <h2 className="text-sm font-bold text-txt">Lost Leads Review Queue</h2>
                <p className="text-[10px] text-txt3">Leads marked lost 4+ times.</p>
              </div>
            </div>
          </div>
          {loading ? (
             <div className="py-24 text-center"><Loader2 className="animate-spin mx-auto text-danger mb-2" size={32} /></div>
          ) : lostLeads.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-4 border border-[#10B981]/20">
                <CheckCircle2 size={28} className="text-[#10B981]" />
              </div>
              <p className="text-sm font-bold text-txt">Queue is clear!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {lostLeads.map(lead => (
                <div key={lead.id} className="px-5 py-4 flex items-center gap-4 hover:bg-bg2/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger text-xs font-bold border border-danger/20">
                    {lead.first_name?.[0]}{lead.last_name?.[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-txt">{lead.first_name} {lead.last_name}</span>
                      <span className="text-[9px] font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded">{lead.lost_count}× lost</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-txt3">{lead.phone}</span>
                      <span className="text-[10px] text-txt3">{lead.source}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setReassignLead(lead); setSelectedUser('') }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-[10px] font-bold hover:bg-accent/20 border border-accent/20">
                      <UserPlus size={12} /> Reassign
                    </button>
                    <button onClick={() => handlePermanentDelete(lead.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-danger/10 text-danger text-[10px] font-bold hover:bg-danger/20 border border-danger/20">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ═══ WON LEADS ═══ */}
      {activeTab === 'won' && (
        <div className="card overflow-hidden shadow-xl border-[#10B981]/20">
          <div className="p-4 border-b border-border bg-[#10B981]/5 flex items-center gap-3">
            <Trophy size={18} className="text-[#10B981]" />
            <div>
              <h2 className="text-sm font-bold text-txt">Won Leads</h2>
              <p className="text-[10px] text-txt3">Successfully converted leads with credit attribution</p>
            </div>
            <span className="ml-auto text-lg font-display font-extrabold text-[#10B981]">{wonLeads.length}</span>
          </div>
          {loading ? (
            <div className="py-24 text-center"><Loader2 className="animate-spin mx-auto text-[#10B981] mb-2" size={32} /></div>
          ) : wonLeads.length === 0 ? (
            <div className="p-16 text-center">
              <Trophy size={40} className="mx-auto text-txt3 opacity-30 mb-3" />
              <p className="text-sm font-bold text-txt">No won leads yet</p>
              <p className="text-xs text-txt3 mt-1">Leads marked as WON will appear here with full credit attribution.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-bg2/50 border-b border-border">
                    <th className="th">Lead</th>
                    <th className="th">Project</th>
                    <th className="th">Budget</th>
                    <th className="th">Telecaller</th>
                    <th className="th">Field Agent</th>
                    <th className="th">Won Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {wonLeads.map(lead => (
                    <tr key={lead.id} className="hover:bg-[#10B981]/5 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981] text-xs font-bold border border-[#10B981]/20">
                            🎉
                          </div>
                          <div>
                            <div className="text-sm font-bold text-txt">{lead.first_name} {lead.last_name}</div>
                            <div className="text-[10px] text-txt3 font-mono">{lead.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td text-xs text-txt2">{lead.project_name || '—'}</td>
                      <td className="td text-xs font-mono text-txt2">{lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="td">
                        {lead.telecaller_name ? (
                          <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-lg">
                            📞 {lead.telecaller_name}
                          </span>
                        ) : <span className="text-xs text-txt3">—</span>}
                      </td>
                      <td className="td">
                        {lead.field_agent_name ? (
                          <span className="text-xs font-bold text-amber bg-amber/10 px-2 py-1 rounded-lg">
                            🏃 {lead.field_agent_name}
                          </span>
                        ) : <span className="text-xs text-txt3">—</span>}
                      </td>
                      <td className="td text-xs font-mono text-txt3">
                        {lead.won_date ? new Date(lead.won_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ ASSIGN LEADS ═══ */}
      {activeTab === 'assign' && (
        <div className="max-w-2xl space-y-6">
          <div className="card p-6 shadow-xl border-accent2/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-accent2/10 rounded-xl text-accent2">
                <Users size={24} />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-txt">Bulk Lead Assignment</h2>
                <p className="text-xs text-txt3 mt-1">Assign uncontacted (NEW) leads to telecallers or field agents</p>
              </div>
            </div>

            {/* Assignment Mode */}
            <div className="mb-6">
              <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-3 block">Assignment Mode</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'manual', label: 'Manual', desc: 'Pick a specific person', icon: UserPlus },
                  { key: 'round_robin', label: 'Round Robin', desc: 'Distribute equally in order', icon: Shuffle },
                  { key: 'load_balance', label: 'Load Balance', desc: 'Assign to least loaded', icon: BarChart2 },
                ].map(m => (
                  <button key={m.key} onClick={() => setAssignMode(m.key)}
                    className={clsx(
                      'p-4 rounded-xl border text-left transition-all',
                      assignMode === m.key
                        ? 'bg-accent2/10 border-accent2 shadow-md shadow-accent2/10'
                        : 'bg-card border-border hover:border-accent2/30'
                    )}>
                    <m.icon size={20} className={assignMode === m.key ? 'text-accent2 mb-2' : 'text-txt3 mb-2'} />
                    <div className="text-sm font-bold text-txt">{m.label}</div>
                    <div className="text-[10px] text-txt3 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Redistribute FROM (optional) */}
            <div className="mb-6">
              <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block">Redistribute From (Optional)</label>
              <select value={fromUserId} onChange={e => setFromUserId(e.target.value)}
                className="input w-full bg-bg3 text-sm">
                <option value="">Unassigned leads (default)</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} — {emp.role === 'FIELD_AGENT' ? '🏃 Field Agent' : '📞 Telecaller'} ({emp.email})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-txt3 mt-1">{fromUserId ? 'Leads will be taken FROM this employee and redistributed' : 'Only unassigned leads will be used'}</p>
            </div>

            {/* Lead Status Filter */}
            <div className="mb-6">
              <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block">Lead Status Filter</label>
              <div className="flex gap-2">
                {[
                  { key: 'NEW', label: 'New Only' },
                  { key: 'all', label: 'All Statuses' },
                ].map(s => (
                  <button key={s.key} onClick={() => setAssignStatusFilter(s.key)}
                    className={clsx(
                      'px-4 py-2 rounded-lg border text-sm font-bold transition-all',
                      assignStatusFilter === s.key ? 'bg-accent2 text-white border-accent2' : 'bg-card text-txt2 border-border hover:border-accent2/30'
                    )}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target User (Manual mode) */}
            {assignMode === 'manual' && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block">Assign To</label>
                <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                  className="input w-full bg-bg3 text-sm">
                  <option value="">Select employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} — {emp.role === 'FIELD_AGENT' ? '🏃 Field Agent' : '📞 Telecaller'} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Count */}
            <div className="mb-6">
              <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block">Number of Leads to Assign</label>
              <div className="flex gap-2 flex-wrap">
                {[5, 10, 20, 50, 100].map(n => (
                  <button key={n} onClick={() => setAssignCount(n)}
                    className={clsx(
                      'px-4 py-2 rounded-lg border text-sm font-bold transition-all',
                      assignCount === n ? 'bg-accent2 text-white border-accent2' : 'bg-card text-txt2 border-border hover:border-accent2/30'
                    )}>
                    {n}
                  </button>
                ))}
                <input type="number" value={assignCount} onChange={e => setAssignCount(parseInt(e.target.value) || 0)}
                  className="input w-20 text-sm bg-bg3 text-center" min={1} />
              </div>
            </div>

            {/* Summary & Action */}
            <div className="p-4 bg-bg2/50 rounded-xl border border-border mb-4">
              <p className="text-xs text-txt2">
                <strong className="text-txt">Summary:</strong>{' '}
                {fromUserId
                  ? <>Take <strong className="text-accent2">{assignCount}</strong> leads from <strong className="text-accent2">{employees.find(e => e.id === fromUserId)?.first_name || 'selected user'}</strong> and </>
                  : <>Assign <strong className="text-accent2">{assignCount}</strong> unassigned leads </>
                }
                {assignMode === 'manual' ? `to ${employees.find(e => e.id === assignUserId)?.first_name || 'selected user'}` : `via ${assignMode.replace(/_/g, ' ')}`}
                {' '}({assignStatusFilter === 'NEW' ? 'NEW status only' : 'all statuses'})
              </p>
            </div>

            <button onClick={handleBulkAssign} disabled={assigning}
              className="btn-primary w-full justify-center py-3.5 text-sm font-bold shadow-lg shadow-accent2/20 bg-accent2 border-accent2 hover:bg-accent2/90">
              {assigning ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {assigning ? 'Assigning...' : `Assign ${assignCount} Leads`}
            </button>
          </div>

          <div className="p-4 bg-bg2 rounded-xl border border-border text-xs text-txt2 leading-relaxed">
            <strong className="text-txt">💡 Lead Assignment Rules:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Select <strong>"Redistribute From"</strong> to move leads from one employee to others</li>
              <li>Leave it as <strong>"Unassigned leads"</strong> to assign fresh unassigned leads</li>
              <li>Leads assigned to a <strong>Field Agent</strong> bypass the telecaller pipeline</li>
              <li>Only you (Client Admin) can reassign leads between employees</li>
            </ul>
          </div>
        </div>
      )}

      {/* ═══ DETAIL DRAWER ═══ */}
      {detailLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end animate-in fade-in" onClick={() => setDetailLead(null)}>
          <div className="bg-card w-full max-w-lg h-full shadow-2xl animate-in slide-in-from-right flex flex-col border-l border-border" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-border bg-bg2/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-bold text-xl text-txt">{detailLead.first_name} {detailLead.last_name}</h2>
                    {detailLead.is_hot && <span className="text-[9px] font-bold text-hot bg-hot/10 px-2 py-0.5 rounded-full border border-hot/20">🔥 Hot</span>}
                  </div>
                  <p className="text-xs text-txt3 font-mono mt-1">{detailLead.phone} {detailLead.email && `• ${detailLead.email}`}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={detailLead.status.toLowerCase()} />
                    <span className="px-2 py-0.5 bg-bg3 border border-border rounded text-[9px] uppercase tracking-wider">{detailLead.source}</span>
                    <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">👤 {detailLead.assigned_user_name || 'Unassigned'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${detailLead.phone}`}
                    className="p-2 bg-bg3 border border-border text-txt3 hover:text-[#10B981] hover:border-[#10B981]/30 hover:bg-[#10B981]/10 transition-all rounded-xl flex items-center justify-center shrink-0"
                    title="Call via Dialer"
                  >
                    <PhoneCall size={20} />
                  </a>
                  <button onClick={() => setDetailLead(null)} className="p-2 hover:bg-danger/10 hover:text-danger hover:border-danger/30 border border-transparent transition-all rounded-xl text-txt3"><X size={20} /></button>
                </div>
              </div>
            </div>

            <div className="flex border-b border-border bg-card">
              {[
                { key: 'info', label: 'Details', icon: FileText },
                { key: 'timeline', label: 'History', icon: History },
                { key: 'followups', label: 'Follow-ups', icon: Bell },
              ].map(tab => (
                <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors',
                    detailTab === tab.key ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-txt3 hover:text-txt hover:bg-bg2'
                  )}>
                  <tab.icon size={14} />{tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailTab === 'info' && (
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Budget', value: detailLead.budget ? `₹${Number(detailLead.budget).toLocaleString('en-IN')}` : 'Not set', icon: DollarSign },
                      { label: 'Area', value: detailLead.area || 'Not set', icon: MapPin },
                      { label: 'Project', value: detailLead.project_name || 'Not set', icon: Building2 },
                      { label: 'Flat/Unit', value: detailLead.interested_flat || 'Not set', icon: FileText },
                      { label: 'Field Agent', value: detailLead.field_agent_name || 'Not assigned', icon: UserCheck },
                      { label: 'Lost Count', value: `${detailLead.lost_count}×`, icon: AlertTriangle },
                    ].map(item => (
                      <div key={item.label} className="p-4 bg-bg2/50 rounded-xl border border-border hover:border-accent/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <item.icon size={12} className="text-txt3" />
                          <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider">{item.label}</span>
                        </div>
                        <p className="text-sm font-bold text-txt">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {detailLead.next_call_at && (
                    <div className={clsx("p-4 rounded-xl border flex items-center gap-3", new Date(detailLead.next_call_at) < new Date() ? "bg-danger/5 border-danger/20" : "bg-accent/5 border-accent/20")}>
                      <Calendar size={20} className={new Date(detailLead.next_call_at) < new Date() ? "text-danger" : "text-accent"} />
                      <div>
                        <span className="text-[10px] font-bold text-txt3 uppercase">Next Scheduled Action</span>
                        <p className={clsx("text-sm font-bold mt-0.5", new Date(detailLead.next_call_at) < new Date() ? "text-danger" : "text-accent")}>
                          {new Date(detailLead.next_call_at).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <h4 className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12}/> Notes from Telecaller</h4>
                    <div className="p-4 bg-bg2/50 rounded-xl border border-border text-sm text-txt2 whitespace-pre-wrap font-mono min-h-[80px]">
                      {detailLead.notes || 'No specific notes recorded yet.'}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'timeline' && (
                <div className="p-6">
                  {loadingDetail ? (
                    <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={20} /><p className="text-xs text-txt3">Loading history...</p></div>
                  ) : timeline.length === 0 ? (
                    <div className="py-12 text-center border-dashed border-2 border-border rounded-xl"><History size={28} className="mx-auto text-txt3 opacity-40 mb-2" /><p className="text-sm font-bold text-txt3">No activity logged.</p></div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />
                      <div className="space-y-5">
                        {timeline.map((event, i) => {
                          const Icon = getTimelineIcon(event.activity_type)
                          const colorClass = getTimelineColor(event.activity_type)
                          return (
                            <div key={event.id || i} className="flex gap-4 relative">
                              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border shadow-sm outline outline-4 outline-card', colorClass.replace('text-', 'border-').replace('bg-', 'bg-').split(' ')[1])}>
                                <Icon size={14} className={colorClass.split(' ')[0]} />
                              </div>
                              <div className="flex-1 min-w-0 bg-bg2/50 border border-border rounded-xl p-3 shadow-sm hover:border-txt3 transition-colors">
                                <p className="text-sm font-bold text-txt leading-tight">{event.title}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-bg3 px-1.5 py-0.5 rounded text-txt2">{event.performed_by_name}</span>
                                  <span className="text-[10px] text-txt3 font-mono">
                                    {new Date(event.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'followups' && (
                <div className="p-6">
                  {loadingDetail ? (
                    <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={20} /><p className="text-xs text-txt3">Loading follow-ups...</p></div>
                  ) : followUps.length === 0 ? (
                    <div className="py-12 text-center border-dashed border-2 border-border rounded-xl"><Bell size={28} className="mx-auto text-txt3 opacity-40 mb-2" /><p className="text-sm font-bold text-txt3">No follow-ups.</p></div>
                  ) : (
                    <div className="space-y-3">
                      {followUps.map((fu, i) => {
                        const isPast = new Date(fu.scheduled_at) < new Date()
                        return (
                          <div key={fu.id || i} className={clsx('p-4 rounded-xl border flex gap-3',
                            fu.is_completed ? 'bg-[#10B981]/5 border-[#10B981]/20' :
                            isPast ? 'bg-danger/5 border-danger/20' : 'bg-accent/5 border-accent/20')}>
                            <div className="mt-0.5">
                              {fu.is_completed ? <CheckCircle2 size={16} className="text-[#10B981]" /> :
                               isPast ? <Clock size={16} className="text-danger" /> : <Calendar size={16} className="text-accent" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1 text-xs">
                                <span className={clsx("font-bold", fu.is_completed ? 'text-[#10B981]' : isPast ? 'text-danger' : 'text-accent')}>
                                  {new Date(fu.scheduled_at).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className={clsx('text-[9px] font-bold uppercase px-2 py-0.5 rounded-full',
                                  fu.is_completed ? 'bg-[#10B981]/10 text-[#10B981]' :
                                  isPast ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent')}>
                                  {fu.is_completed ? 'Done' : isPast ? 'Overdue' : 'Upcoming'}
                                </span>
                              </div>
                              <div className="text-[10px] text-txt3 mb-1.5 font-bold uppercase tracking-wider">Set by {fu.created_by_name}</div>
                              {fu.note && <p className="text-xs text-txt2 leading-relaxed bg-bg3/50 p-2 rounded-lg font-mono border border-border/50">{fu.note}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setReassignLead(null)}>
          <div className="bg-card w-full max-w-sm p-6 rounded-3xl border border-border shadow-2xl animate-in zoom-in-95" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flexItems-center gap-3">
                <div className="p-3 bg-accent/10 rounded-xl text-accent"><UserPlus size={24} /></div>
                <div>
                  <h3 className="font-display font-bold text-xl text-txt">Reassign Lead</h3>
                  <p className="text-[10px] text-txt3 font-bold uppercase tracking-wider mt-1">{reassignLead.first_name} {reassignLead.last_name} • <span className="text-danger">Lost {reassignLead.lost_count}×</span></p>
                </div>
              </div>
              <button onClick={()=>setReassignLead(null)} className="p-1.5 text-txt3 hover:bg-bg2 rounded-lg transition-colors"><X size={16}/></button>
            </div>
            <div className="space-y-2 mb-8">
              <label className="text-[10px] font-bold uppercase tracking-wider text-txt3 ml-1">Select New Telecaller</label>
              <select className="input w-full bg-bg3 border shadow-inner" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                <option value="">Choose an agent...</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.email})</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdminReassign} disabled={!selectedUser || loading} className="btn-primary flex-1 justify-center py-3.5 shadow-lg shadow-accent/20 disabled:opacity-50 text-sm font-bold">
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
