import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import {
  Search, Flame, Clock, PhoneCall, Calendar, History, Bell, Sparkles,
  Loader2, ChevronLeft, ChevronRight as ChevronRightIcon,
  Target, Filter, AlertTriangle
} from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import { todayStr, getDueStatus } from '../../utils/dateHelpers'
import LeadDrawer from '../../components/telecaller/LeadDrawer'

export default function TelecallerWorkspace() {
  const router = useRouter()
  
  // ═══ Tab: new | due | hot | all | history ═══
  const [activeTab, setActiveTab] = useState('new')
  const dateInputRef = useRef(null)

  // Handle ?tab= query param (e.g. redirected from old /reminders page)
  useEffect(() => {
    if (router.query.tab && ['new', 'due', 'hot', 'all', 'history'].includes(router.query.tab)) {
      setActiveTab(router.query.tab)
    }
  }, [router.query.tab])

  // ═══ Daily Target ═══
  const [target, setTarget] = useState(0)
  const [progress, setProgress] = useState(0)

  // ═══ Leads state ═══
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [historyDate, setHistoryDate] = useState(todayStr())

  // ═══ Tab counts for badges ═══
  const [dueTodayCount, setDueTodayCount] = useState(0)
  const [hotCount, setHotCount] = useState(0)

  // ═══ Pagination ═══
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalLeads, setTotalLeads] = useState(0)

  // ═══ Drawer state ═══
  const [selectedLead, setSelectedLead] = useState(null)
  const [pullingLeads, setPullingLeads] = useState(false)

  // ═══ Reference Data ═══
  const [projects, setProjects] = useState([])
  const [fieldAgents, setFieldAgents] = useState([])
  const [timeline, setTimeline] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // ═══ Fetch Daily Target (poll every 2 min) ═══
  const fetchTarget = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/leads/daily-target/')
      setTarget(data.target || 0)
      setProgress(data.progress || 0)
    } catch (err) { console.error(err) }
  }, [])

  // ═══ Fetch tab counts ═══
  const fetchTabCounts = useCallback(async () => {
    try {
      // Fetch due today count
      const dueData = await fetchWithAuth('/leads/?next_call_before=today&exclude_closed=true&page_size=1')
      setDueTodayCount(dueData.count || 0)
      
      // Fetch hot count
      const hotData = await fetchWithAuth('/leads/?is_hot=true&exclude_closed=true&page_size=1')
      setHotCount(hotData.count || 0)
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    fetchTarget()
    fetchProjects()
    fetchFieldAgents()
    fetchTabCounts()
    const interval = setInterval(fetchTarget, 120000)
    return () => clearInterval(interval)
  }, [])

  // ═══ Fetch leads when tab/page/filters change ═══
  useEffect(() => {
    fetchLeads()
  }, [activeTab, page, pageSize, historyFilter, historyDate])

  useEffect(() => {
    setPage(1)
  }, [search, historyFilter, historyDate, activeTab])

  // Listen for real-time lead assignments
  useEffect(() => {
    const handleWsMessage = (e) => {
      const payload = e.detail;
      if (payload.type === 'lead_assigned') {
        fetchLeads();
        fetchTarget();
        fetchTabCounts();
      }
    };
    window.addEventListener('ws_message', handleWsMessage);
    return () => window.removeEventListener('ws_message', handleWsMessage);
  }, [page, pageSize, historyFilter, historyDate, search, activeTab, fetchTarget])

  useEffect(() => {
    const delay = setTimeout(fetchLeads, 500)
    return () => clearTimeout(delay)
  }, [search])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      let url = `/leads/?page=${page}&page_size=${pageSize}`
      if (search) url += `&search=${search}`

      switch (activeTab) {
        case 'new':
          url += '&status=NEW'
          break
        case 'due':
          // Leads with next_call_at <= now (overdue + due today)
          url += '&next_call_before=today&exclude_closed=true'
          break
        case 'hot':
          url += '&is_hot=true&exclude_closed=true'
          break
        case 'all':
          // All assigned leads, no filter
          break
        case 'history':
          if (historyFilter !== 'all') url += `&status=${historyFilter.toUpperCase()}`
          if (historyDate) url += `&date=${historyDate}`
          url += '&exclude_new=true'
          break
      }

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

  const handlePullLeads = async () => {
    setPullingLeads(true)
    try {
      const res = await fetchWithAuth('/leads/pull-leads/', { method: 'POST', body: JSON.stringify({ count: 10 }) })
      if (res.pulled_count > 0) {
        alert(`Successfully pulled ${res.pulled_count} new leads!`)
        fetchLeads()
        fetchTabCounts()
      } else {
        alert("No unassigned new leads available right now.")
      }
    } catch (err) {
      alert("Failed to pull leads: " + err.message)
    } finally {
      setPullingLeads(false)
    }
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

  const handleDrawerUpdate = () => {
    fetchLeads()
    fetchTarget()
    fetchTabCounts()
  }

  const totalPages = Math.ceil(totalLeads / pageSize)
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0

  // ═══ Tab config ═══
  const tabs = [
    { key: 'new', label: 'New', icon: Sparkles, activeColor: 'accent', count: null },
    { key: 'due', label: 'Due Today', icon: Bell, activeColor: 'amber', count: dueTodayCount },
    { key: 'hot', label: 'Hot', icon: Flame, activeColor: 'hot', count: hotCount },
    { key: 'all', label: 'All Leads', icon: Filter, activeColor: 'purple', count: null },
    { key: 'history', label: 'History', icon: History, activeColor: 'purple', count: null },
  ]

  // Dynamic color map for active tabs
  const tabColors = {
    accent: { bg: 'bg-accent', border: 'border-accent', shadow: 'shadow-accent/20', text: 'text-white' },
    amber: { bg: 'bg-amber', border: 'border-amber', shadow: 'shadow-amber/20', text: 'text-white' },
    hot: { bg: 'bg-hot', border: 'border-hot', shadow: 'shadow-hot/20', text: 'text-white' },
    purple: { bg: 'bg-purple', border: 'border-purple', shadow: 'shadow-purple/20', text: 'text-white' },
  }

  // Empty state messages per tab
  const emptyMessages = {
    new: "🎉 All leads have been contacted! Great work today.",
    due: "✅ No calls due right now. You're all caught up!",
    hot: "No high-priority leads at the moment.",
    all: "No leads found matching your search.",
    history: "No leads found for the selected date/filter."
  }

  return (
    <>
      <Layout role="telecaller" pageTitle="My Workspace">

        {/* ═══ DAILY TARGET PROGRESS BAR ═══ */}
        <div className="mb-6 card p-5 border-l-4 border-l-accent shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent/10 text-accent">
                <Target size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-txt">Today's Target</h3>
                <p className="text-[10px] text-txt3 uppercase tracking-wider font-bold">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl font-display font-extrabold text-accent">{progress}</span>
              <span className="text-lg text-txt3 font-bold"> / {target}</span>
              <p className="text-[10px] text-txt3 font-bold uppercase tracking-wider mt-0.5">calls completed</p>
            </div>
          </div>
          <div className="h-3 w-full bg-bg3 rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-1000",
                pct >= 100 ? "bg-[#10B981]" : pct >= 70 ? "bg-accent" : pct >= 40 ? "bg-amber" : "bg-accent/60"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider mt-1.5 text-txt3">
            <span>{pct}% completed</span>
            <span>{Math.max(0, target - progress)} remaining</span>
          </div>
        </div>

        {/* ═══ SMART TABS ═══ */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
            {tabs.map(tab => {
              const colors = tabColors[tab.activeColor]
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border shrink-0 relative',
                    isActive
                      ? `${colors.bg} ${colors.text} ${colors.border} shadow-lg ${colors.shadow} scale-[1.02]`
                      : 'bg-card text-txt2 border-border hover:bg-bg3'
                  )}
                >
                  <tab.icon size={16} /> {tab.label}
                  {/* Count badge */}
                  {tab.count > 0 && (
                    <span className={clsx(
                      "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold",
                      isActive ? "bg-white/25 text-white" : "bg-danger/15 text-danger"
                    )}>
                      {tab.count > 99 ? '99+' : tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ═══ HISTORY TAB: Date picker + status filters ═══ */}
        {activeTab === 'history' && (
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div
                onClick={() => dateInputRef.current?.showPicker()}
                className="flex items-center gap-2 bg-card rounded-xl border border-border px-4 py-2.5 cursor-pointer relative"
              >
                <Calendar size={14} className="text-purple pointer-events-none" />
                <input
                  ref={dateInputRef}
                  type="date"
                  value={historyDate}
                  onChange={e => setHistoryDate(e.target.value)}
                  className="bg-transparent text-sm font-bold text-txt outline-none cursor-pointer"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div className="flex gap-1.5">
                {['Today', 'Yesterday', '2 days ago'].map((label, i) => {
                  const d = new Date()
                  d.setDate(d.getDate() - i)
                  const val = d.toISOString().split('T')[0]
                  return (
                    <button
                      key={label}
                      onClick={() => setHistoryDate(val)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                        historyDate === val ? 'bg-purple/10 text-purple border-purple/30' : 'bg-bg3 text-txt3 border-border hover:text-txt'
                      )}>
                      {label}
                    </button>
                  )
                })}
                <button
                  onClick={() => setHistoryDate('')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                    historyDate === '' ? 'bg-purple text-white border-purple shadow-md shadow-purple/20' : 'bg-bg3 text-txt3 border-border hover:text-txt'
                  )}>
                  All Time
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {['all', 'called', 'interested', 'not_answered', 'site_visit', 'won', 'lost'].map(s => (
                <button key={s} onClick={() => setHistoryFilter(s)}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize border shadow-sm',
                    historyFilter === s
                      ? 'bg-purple text-white border-purple shadow-purple/20'
                      : 'bg-card text-txt2 border-border hover:bg-bg3'
                  )}>
                  {s === 'all' ? 'All' : s === 'called' ? 'follow up' : s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SEARCH BAR ═══ */}
        <div className="mb-6">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input w-full pl-10 bg-card" placeholder="Search by name or phone..." />
          </div>
        </div>

        {/* ═══ LEADS TABLE ═══ */}
        <div className="card overflow-hidden border border-border shadow-xl">
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
                  <tr><td colSpan={6} className="py-12 text-center text-txt3">
                    {emptyMessages[activeTab]}
                  </td></tr>
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

          {/* ═══ PAGINATION ═══ */}
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
          onUpdate={handleDrawerUpdate}
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
