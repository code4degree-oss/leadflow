import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import { Search, Flame, PhoneCall, Loader2, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import { getDueStatus } from '../../utils/dateHelpers'
import LeadDrawer from '../../components/telecaller/LeadDrawer'

export default function TelecallerLeads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Pagination State
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalLeads, setTotalLeads] = useState(0)

  // Drawer State
  const [selectedLead, setSelectedLead] = useState(null)

  // Reference Data
  const [projects, setProjects] = useState([])
  const [fieldAgents, setFieldAgents] = useState([])
  const [timeline, setTimeline] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchFieldAgents()
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [page, pageSize, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  // Listen for real-time lead assignments
  useEffect(() => {
    const handleWsMessage = (e) => {
      const payload = e.detail;
      if (payload.type === 'lead_assigned') {
        fetchLeads();
      }
    };
    window.addEventListener('ws_message', handleWsMessage);
    return () => window.removeEventListener('ws_message', handleWsMessage);
  }, [page, pageSize, statusFilter, search])

  // Debounce search
  useEffect(() => {
    const delay = setTimeout(fetchLeads, 500)
    return () => clearTimeout(delay)
  }, [search])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      let url = `/leads/?page=${page}&page_size=${pageSize}`
      if (search) url += `&search=${search}`
      if (statusFilter !== 'all') url += `&status=${statusFilter.toUpperCase()}`
      
      const data = await fetchWithAuth(url)
      setLeads(data.results || data || [])
      setTotalLeads(data.count || 0)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchProjects = async (bhk = '') => {
    try {
      let url = '/projects/'
      if (bhk) url += `?bhk=${bhk}`
      const data = await fetchWithAuth(url)
      setProjects(data.results || data || [])
    } catch (err) { console.error(err) }
  }

  const fetchFieldAgents = async () => {
    try {
      const data = await fetchWithAuth('/leads/field-agents/')
      setFieldAgents(data || [])
    } catch (err) { console.error(err) }
  }

  const openLeadDetails = async (lead) => {
    setSelectedLead(lead)
    setLoadingTimeline(true)
    try {
      const [timelineData, followUpData] = await Promise.all([
        fetchWithAuth(`/leads/${lead.id}/timeline/`).catch(() => []),
        fetchWithAuth(`/leads/${lead.id}/follow-ups/`).catch(() => [])
      ])
      setTimeline(timelineData || [])
      setFollowUps(followUpData || [])
    } catch (err) { console.error(err) }
    finally { setLoadingTimeline(false) }
  }

  const totalPages = Math.ceil(totalLeads / pageSize)

  return (
    <>
      <Layout role="telecaller" pageTitle="My Assigned Leads">
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {['all', 'new', 'called', 'not_answered', 'interested', 'site_visit', 'lost'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={clsx(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize border shadow-sm',
                  statusFilter === s ? 'bg-accent text-white border-accent' : 'bg-card text-txt2 hover:bg-bg2 border-border'
                )}>
                {s === 'all' ? 'All' : s === 'called' ? 'follow up' : s.replace(/_/g,' ')}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input w-full pl-10 bg-card" placeholder="Search by name or phone..." />
          </div>
        </div>

        {/* Leads Table */}
        <div className="card overflow-hidden border border-border">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left relative">
              <thead>
                <tr className="bg-bg2/50 border-b border-border">
                  <th className="th">Lead</th>
                  <th className="th">Status</th>
                  <th className="th">Project</th>
                  <th className="th">Budget</th>
                  <th className="th">Next Follow-up</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border relative">
                {loading ? (
                  <tr><td colSpan={6} className="py-24 text-center text-txt3"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={32} />Loading Leads...</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-txt3">No leads found matching criteria.</td></tr>
                ) : leads.map(lead => {
                  const dueStatus = getDueStatus(lead.next_call_at)
                  return (
                    <tr key={lead.id} className="table-row group cursor-pointer" onClick={() => openLeadDetails(lead)}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border-2",
                            lead.is_hot ? "bg-hot/10 text-hot border-hot/30 hot-glow" : "bg-accent/10 text-accent border-transparent"
                          )}>
                            {lead.is_hot && <Flame size={16} className="text-hot" />}
                            {!lead.is_hot && <>{lead.first_name?.[0]}{lead.last_name?.[0] || ''}</>}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-txt flex items-center gap-2 group-hover:text-accent transition-colors">
                              {lead.first_name} {lead.last_name}
                              {lead.is_hot && <span className="text-[8px] font-bold text-hot bg-hot/10 px-1.5 py-0.5 rounded-full uppercase">Hot</span>}
                            </div>
                            <div className="text-[11px] text-txt3 font-mono mt-0.5">{lead.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td"><StatusBadge status={lead.status?.toLowerCase()} /></td>
                      <td className="td">
                        <span className="text-xs text-txt2">{lead.project_name || '—'}</span>
                      </td>
                      <td className="td">
                        <span className="text-xs font-mono text-txt2">{lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—'}</span>
                      </td>
                      <td className="td">
                        {dueStatus.label ? (
                          <span className={clsx(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            dueStatus.bgClass, dueStatus.textClass
                          )}>
                            {dueStatus.label}
                          </span>
                        ) : <span className="text-txt3 text-xs">—</span>}
                      </td>
                      <td className="td text-right">
                        <button className="btn-ghost text-xs group-hover:bg-accent group-hover:text-white transition-all">
                          <PhoneCall size={14} className="mr-1 inline-block" /> Log Call
                        </button>
                      </td>
                    </tr>
                  )
                })}
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
      </Layout>

      {/* ═══ LEAD DRAWER (shared component) ═══ */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={fetchLeads}
          projects={projects}
          fieldAgents={fieldAgents}
          timeline={timeline}
          followUps={followUps}
          loadingTimeline={loadingTimeline}
          showBhkFilter={true}
          onFetchProjects={fetchProjects}
        />
      )}
    </>
  )
}
