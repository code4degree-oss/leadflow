import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import {
  Search, Flame, Clock, X, PhoneCall, Check, FileText, Calendar, RotateCcw,
  PhoneOff, DollarSign, MapPin, Home, ChevronRight, History, Bell, CheckCircle2,
  Circle, Loader2, UserCheck, Building2, ChevronLeft, ChevronRight as ChevronRightIcon,
  Target, Trophy, Filter, Sparkles
} from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import DateTimePicker from '../../components/DateTimePicker'

// ═══ Helpers ═══
function getNextBusinessDay(daysFromNow = 1) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d
}

function formatDatetimeLocal(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function TelecallerDashboard() {
  // ═══ Tab state: 'new' or 'history' ═══
  const [activeTab, setActiveTab] = useState('new')
  const dateInputRef = useRef(null)

  // ═══ Daily Target ═══
  const [target, setTarget] = useState(0)
  const [progress, setProgress] = useState(0)

  // ═══ Leads state ═══
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('new') // for NEW tab
  const [historyFilter, setHistoryFilter] = useState('all') // for HISTORY tab
  const [historyDate, setHistoryDate] = useState(todayStr())

  // ═══ Pagination ═══
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalLeads, setTotalLeads] = useState(0)

  // ═══ Lead Drawer ═══
  const [selectedLead, setSelectedLead] = useState(null)
  const [drawerTab, setDrawerTab] = useState('form')
  const [outcome, setOutcome] = useState('CALLBACK')
  const [notes, setNotes] = useState('')
  const [budget, setBudget] = useState('')
  const [area, setArea] = useState('')
  const [interestedFlat, setInterestedFlat] = useState('')
  const [nextCallAt, setNextCallAt] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedFieldAgent, setSelectedFieldAgent] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  useEffect(() => {
    fetchTarget()
    fetchProjects()
    fetchFieldAgents()
    const interval = setInterval(fetchTarget, 120000) // poll every 2 min
    return () => clearInterval(interval)
  }, [])

  // ═══ Fetch leads when tab/page/filters change ═══
  useEffect(() => {
    fetchLeads()
  }, [activeTab, page, pageSize, statusFilter, historyFilter, historyDate])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, historyFilter, historyDate, activeTab])

  useEffect(() => {
    const delay = setTimeout(fetchLeads, 500)
    return () => clearTimeout(delay)
  }, [search])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      let url = `/leads/?page=${page}&page_size=${pageSize}`
      if (search) url += `&search=${search}`

      if (activeTab === 'new') {
        // Show NEW status only
        url += '&status=NEW'
      } else {
        // History tab — filter by date and status, exclude uncontacted
        if (historyFilter !== 'all') url += `&status=${historyFilter.toUpperCase()}`
        if (historyDate) url += `&date=${historyDate}`
        url += '&exclude_new=true'
      }

      const data = await fetchWithAuth(url)
      setLeads(data.results || data || [])
      setTotalLeads(data.count || 0)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchProjects = async () => {
    try {
      const data = await fetchWithAuth('/projects/')
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
      } else {
        alert("No unassigned new leads available right now.")
      }
    } catch (err) {
      alert("Failed to pull leads: " + err.message)
    } finally {
      setPullingLeads(false)
    }
  }

  const getSmartNextCall = (outcomeKey) => {
    switch (outcomeKey) {
      case 'INTERESTED': return formatDatetimeLocal(getNextBusinessDay(2))
      case 'CALLED': return formatDatetimeLocal(getNextBusinessDay(3))
      case 'CALLBACK': return ''
      case 'NOT_ANSWERED': return formatDatetimeLocal(getNextBusinessDay(1))
      default: return ''
    }
  }

  const openLeadDetails = async (lead) => {
    setSelectedLead(lead)
    setNotes(lead.notes || '')
    setBudget(lead.budget || '')
    setArea(lead.area || '')
    setInterestedFlat(lead.interested_flat || '')
    setSelectedProject(lead.project || '')
    setSelectedFieldAgent(lead.field_agent || '')
    setOutcome('CALLBACK')
    setNextCallAt(getSmartNextCall('CALLBACK'))
    setDrawerTab('form')

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

  const handleOutcomeChange = (newOutcome) => {
    setOutcome(newOutcome)
    setNextCallAt(getSmartNextCall(newOutcome))
  }

  const handleToggleHot = async () => {
    if (!selectedLead) return
    try {
      const result = await fetchWithAuth(`/leads/${selectedLead.id}/toggle-hot/`, { method: 'POST' })
      setSelectedLead(prev => ({ ...prev, is_hot: result.is_hot }))
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, is_hot: result.is_hot } : l))
    } catch (err) { alert("Failed: " + err.message) }
  }

  const handleLogCall = async (e) => {
    e.preventDefault()

    if (outcome !== 'LOST' && outcome !== 'INVALID_NUMBER' && outcome !== 'NOT_ANSWERED' && outcome !== 'WON' && !nextCallAt) {
      alert("⚠️ You must schedule the next call before saving.")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        outcome,
        notes,
        budget: budget ? parseFloat(budget) : null,
        area: area || '',
        interested_flat: interestedFlat || '',
        project_id: selectedProject || null,
        field_agent_id: selectedFieldAgent || null,
      }

      if (outcome === 'NOT_ANSWERED') {
        payload.next_call_at = new Date(nextCallAt).toISOString()
      } else if (outcome !== 'LOST' && outcome !== 'WON' && outcome !== 'INVALID_NUMBER') {
        payload.next_call_at = new Date(nextCallAt).toISOString()
      }

      if (outcome === 'CALLBACK') {
        payload.follow_up_at = new Date(nextCallAt).toISOString()
        payload.follow_up_note = "Follow up scheduled from call logger."
      }

      await fetchWithAuth(`/leads/${selectedLead.id}/log-call/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setSelectedLead(null)
      fetchLeads()
      fetchTarget() // refresh progress
    } catch (err) {
      alert("Failed: " + err.message)
    } finally { setSubmitting(false) }
  }

  const getTimelineIcon = (type) => {
    const icons = {
      'CALL_LOGGED': PhoneCall, 'STATUS_CHANGE': CheckCircle2, 'ASSIGNED': ChevronRight,
      'REASSIGNED': ChevronRight, 'FOLLOW_UP_SET': Calendar, 'FOLLOW_UP_COMPLETED': Check,
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
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0

  return (
    <Layout role="telecaller" pageTitle="My Dashboard">

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

      {/* ═══ NEW / HISTORY TABS ═══ */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('new')}
            className={clsx(
              'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all border',
              activeTab === 'new'
                ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20 scale-[1.02]'
                : 'bg-card text-txt2 border-border hover:bg-bg3'
            )}>
            <Sparkles size={16} /> New Leads
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={clsx(
              'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all border',
              activeTab === 'history'
                ? 'bg-purple text-white border-purple shadow-lg shadow-purple/20 scale-[1.02]'
                : 'bg-card text-txt2 border-border hover:bg-bg3'
            )}>
            <History size={16} /> History
          </button>
        </div>
        
        {/* removed pull leads */}
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
                <th className="th">Next Call</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border relative">
              {loading ? (
                <tr><td colSpan={6} className="py-24 text-center text-txt3"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={32} />Loading Leads...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-txt3">
                  {activeTab === 'new'
                    ? "🎉 All leads have been contacted! Check History for past activity."
                    : "No leads found for the selected date/filter."}
                </td></tr>
              ) : leads.map(lead => (
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
                    {lead.next_call_at ? (
                      <span className={clsx(
                        "text-[10px] font-bold font-mono px-2 py-0.5 rounded-full",
                        new Date(lead.next_call_at) < new Date() ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"
                      )}>
                        {new Date(lead.next_call_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : <span className="text-txt3 text-xs">—</span>}
                  </td>
                  <td className="td text-right">
                    <button className="btn-ghost text-xs group-hover:bg-accent group-hover:text-white transition-all">
                      <PhoneCall size={14} className="mr-1 inline-block" /> Log Call
                    </button>
                  </td>
                </tr>
              ))}
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

      {/* ═══ LEAD DETAIL DRAWER ═══ */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end animate-in fade-in">
          <div className="bg-card w-full max-w-lg h-full shadow-2xl animate-in slide-in-from-right flex flex-col border-l border-border">

            {/* Header */}
            <div className="px-6 py-5 border-b border-border bg-bg2/50">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="text-xl font-display font-extrabold text-txt truncate">
                    {selectedLead.first_name} {selectedLead.last_name}
                  </h2>
                  <p className="text-xs text-txt3 font-mono mt-1">{selectedLead.phone}</p>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleToggleHot}
                      className={clsx(
                        'p-1.5 px-3 rounded-lg transition-all border shrink-0 flex items-center gap-2 text-xs font-bold',
                        selectedLead.is_hot
                          ? 'bg-hot/15 border-hot/30 text-hot shadow-md shadow-hot/20'
                          : 'bg-bg3 border-border text-txt3 hover:text-hot hover:border-hot/30'
                      )}
                      title={selectedLead.is_hot ? "Remove Hot flag" : "Mark as Hot Lead"}
                    >
                      <Flame size={16} /> {selectedLead.is_hot ? "Hot Lead" : "Mark as hot lead"}
                    </button>
                    <a
                      href={`tel:${selectedLead.phone}`}
                      className="p-1.5 px-3 rounded-lg transition-all border bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981] hover:text-white flex items-center gap-2 text-xs font-bold shrink-0"
                      title="Call via Dialer"
                    >
                      <PhoneCall size={16} /> Call now
                    </a>
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <StatusBadge status={selectedLead.status?.toLowerCase()} />
                    <span className="badge badge-gray text-[9px]">{selectedLead.source}</span>
                    {selectedLead.is_hot && (
                      <span className="text-[9px] font-bold text-hot bg-hot/10 px-2 py-0.5 rounded-full">🔥 Hot Lead</span>
                    )}
                    {selectedLead.next_call_at && (
                      <span className={clsx(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full",
                        new Date(selectedLead.next_call_at) < new Date() ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"
                      )}>
                        Next: {new Date(selectedLead.next_call_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-bg3 rounded-xl text-txt3"><X size={20} /></button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-card">
              {[
                { key: 'form', label: 'Log Call', icon: PhoneCall },
                { key: 'timeline', label: 'History', icon: History },
                { key: 'followups', label: 'Follow-ups', icon: Bell },
              ].map(tab => (
                <button key={tab.key} onClick={() => setDrawerTab(tab.key)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors',
                    drawerTab === tab.key ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-txt3 hover:text-txt'
                  )}>
                  <tab.icon size={14} />{tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">

              {/* TAB: Log Call Form */}
              {drawerTab === 'form' && (
                <form onSubmit={handleLogCall} className="p-6 flex flex-col gap-5">

                  {/* Outcome Grid — includes WON */}
                  <div>
                    <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-3 block">Call Outcome</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'INTERESTED', label: 'Interested', icon: Flame, activeClass: 'bg-accent2/10 border-accent2 text-accent2 shadow-md shadow-accent2/10' },
                        { key: 'CALLBACK', label: 'Follow-up', icon: Clock, activeClass: 'bg-accent/10 border-accent text-accent shadow-md shadow-accent/10' },
                        { key: 'NOT_ANSWERED', label: 'No Answer', icon: PhoneOff, activeClass: 'bg-amber/10 border-amber text-amber shadow-md shadow-amber/10' },
                        { key: 'WON', label: '🎉 Won', icon: Trophy, activeClass: 'bg-[#10B981]/10 border-[#10B981] text-[#10B981] shadow-md shadow-[#10B981]/10' },
                        { key: 'INVALID_NUMBER', label: 'Dead No.', icon: PhoneOff, activeClass: 'bg-danger/10 border-danger text-danger shadow-md shadow-danger/10' },
                        { key: 'LOST', label: 'Mark Lost', icon: X, activeClass: 'bg-danger/10 border-danger text-danger shadow-md shadow-danger/10' },
                      ].map(opt => (
                        <button key={opt.key} type="button" onClick={() => handleOutcomeChange(opt.key)}
                          className={clsx(
                            'p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center',
                            outcome === opt.key ? opt.activeClass : 'bg-card border-border hover:border-accent/30 text-txt2'
                          )}>
                          <opt.icon size={18} /><span className="text-[10px] font-bold">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Next Call Scheduling (not for LOST/WON) */}
                  {outcome !== 'LOST' && outcome !== 'WON' && outcome !== 'INVALID_NUMBER' && (
                    <div className={clsx(
                      "p-4 rounded-xl border transition-all",
                      outcome === 'NOT_ANSWERED' ? "bg-amber/5 border-amber/20" : !nextCallAt ? "bg-danger/5 border-danger/30" : "bg-accent/5 border-accent/20"
                    )}>
                      <DateTimePicker
                        label={outcome === 'CALLBACK' ? 'Follow-up Date & Time' : 'Next Call Date & Time'}
                        required={true}
                        value={nextCallAt}
                        onChange={setNextCallAt}
                        readOnly={outcome === 'NOT_ANSWERED'}
                        accentColor={outcome === 'NOT_ANSWERED' ? 'amber' : 'accent'}
                      />
                      {outcome === 'NOT_ANSWERED' && (
                        <p className="text-[9px] text-amber mt-2 font-medium">⚡ Auto-scheduled for next business day, 9:00 AM</p>
                      )}
                    </div>
                  )}

                  {/* WON celebration */}
                  {outcome === 'WON' && (
                    <div className="p-4 rounded-xl border border-[#10B981]/20 bg-[#10B981]/5 text-center">
                      <Trophy size={28} className="mx-auto text-[#10B981] mb-2" />
                      <p className="text-sm font-bold text-[#10B981]">Congratulations! 🎉</p>
                      <p className="text-[10px] text-txt3 mt-1">This lead will be moved to the Won section.</p>
                    </div>
                  )}

                  {/* Lead Intelligence */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">Lead Intelligence</label>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-txt3 mb-1 block flex items-center gap-1"><DollarSign size={10} /> Budget (₹)</label>
                        <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
                          placeholder="e.g. 5000000" className="input w-full bg-bg3 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] text-txt3 mb-1 block flex items-center gap-1"><MapPin size={10} /> Area</label>
                        <input value={area} onChange={e => setArea(e.target.value)}
                          placeholder="e.g. Baner, Pune" className="input w-full bg-bg3 text-sm" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-txt3 mb-1 block flex items-center gap-1"><Building2 size={10} /> Interested Project</label>
                      <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                        className="input w-full bg-bg3 text-sm">
                        <option value="">Select a project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-txt3 mb-1 block flex items-center gap-1"><Home size={10} /> Interested Flat / Unit</label>
                      <input value={interestedFlat} onChange={e => setInterestedFlat(e.target.value)}
                        placeholder="e.g. 2BHK Tower A" className="input w-full bg-bg3 text-sm" />
                    </div>

                    {/* Field Agent Assignment */}
                    {(outcome === 'INTERESTED' || outcome === 'WON' || selectedLead?.status === 'INTERESTED' || selectedLead?.status === 'SITE_VISIT') && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="text-[10px] text-txt3 mb-1 block flex items-center gap-1"><UserCheck size={10} /> Assign Field Agent</label>
                        <select value={selectedFieldAgent} onChange={e => setSelectedFieldAgent(e.target.value)}
                          className="input w-full bg-bg3 text-sm">
                          <option value="">Select field agent...</option>
                          {fieldAgents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.email})</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block flex items-center gap-2">
                      <FileText size={12} /> Notes
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Record conversation notes..."
                      className="input w-full min-h-[80px] bg-bg3 text-sm resize-none" />
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-border flex gap-3 mt-auto">
                    <button type="button" onClick={() => setSelectedLead(null)} className="btn-ghost flex-1 justify-center py-3">Cancel</button>
                    <button type="submit" disabled={submitting} className={clsx(
                      "flex-1 justify-center py-3 shadow-lg font-bold rounded-xl flex items-center gap-2 transition-all",
                      outcome === 'WON'
                        ? 'bg-[#10B981] text-white shadow-[#10B981]/20 hover:bg-[#059669]'
                        : 'btn-primary shadow-accent/20'
                    )}>
                      {submitting ? <RotateCcw size={16} className="animate-spin" /> : <Check size={16} />}
                      {outcome === 'WON' ? 'Mark as Won 🎉' : 'Save Activity'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB: Timeline */}
              {drawerTab === 'timeline' && (
                <div className="p-6">
                  <h3 className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-4">Complete Lead Journey</h3>
                  {loadingTimeline ? (
                    <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={20} /><p className="text-xs text-txt3">Loading...</p></div>
                  ) : timeline.length === 0 ? (
                    <div className="py-12 text-center">
                      <History size={28} className="mx-auto text-txt3 opacity-30 mb-2" />
                      <p className="text-xs text-txt3">No activity recorded yet.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-4">
                        {timeline.map((event, i) => {
                          const Icon = getTimelineIcon(event.activity_type)
                          const colorClass = getTimelineColor(event.activity_type)
                          return (
                            <div key={event.id || i} className="flex gap-4 relative">
                              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10', colorClass)}>
                                <Icon size={14} />
                              </div>
                              <div className="flex-1 min-w-0 pb-1">
                                <p className="text-sm font-medium text-txt">{event.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-txt3">{event.performed_by_name}</span>
                                  <span className="text-[10px] text-txt3">•</span>
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

              {/* TAB: Follow-ups */}
              {drawerTab === 'followups' && (
                <div className="p-6">
                  <h3 className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-4">Follow-ups</h3>
                  {loadingTimeline ? (
                    <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={20} /><p className="text-xs text-txt3">Loading...</p></div>
                  ) : followUps.length === 0 ? (
                    <div className="py-12 text-center">
                      <Bell size={28} className="mx-auto text-txt3 opacity-30 mb-2" />
                      <p className="text-xs text-txt3">No follow-ups scheduled.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {followUps.map((fu, i) => {
                        const isPast = new Date(fu.scheduled_at) < new Date()
                        return (
                          <div key={fu.id || i} className={clsx(
                            'p-4 rounded-xl border',
                            fu.is_completed ? 'bg-[#10B981]/5 border-[#10B981]/20' :
                              isPast ? 'bg-danger/5 border-danger/20' : 'bg-accent/5 border-accent/20'
                          )}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {fu.is_completed ? <CheckCircle2 size={14} className="text-[#10B981]" /> :
                                  isPast ? <Clock size={14} className="text-danger" /> :
                                    <Calendar size={14} className="text-accent" />}
                                <span className="text-xs font-bold text-txt">
                                  {new Date(fu.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <span className={clsx(
                                'text-[9px] font-bold uppercase px-2 py-0.5 rounded-full',
                                fu.is_completed ? 'bg-[#10B981]/10 text-[#10B981]' :
                                  isPast ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
                              )}>
                                {fu.is_completed ? 'Done' : isPast ? 'Overdue' : 'Upcoming'}
                              </span>
                            </div>
                            {fu.note && <p className="text-xs text-txt2 mt-1">{fu.note}</p>}
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
    </Layout>
  )
}
