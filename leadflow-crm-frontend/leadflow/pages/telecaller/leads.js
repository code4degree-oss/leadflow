import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import { Search, Flame, Clock, X, PhoneCall, Check, FileText, Calendar, RotateCcw, PhoneOff, DollarSign, MapPin, Home, ChevronRight, History, Bell, CheckCircle2, Circle, Loader2, UserCheck, Building2, ChevronLeft, ChevronRight as ChevronRightIcon, Trophy } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import DateTimePicker from '../../components/DateTimePicker'

// Helper: get next business day at 9 AM
function getNextBusinessDay(daysFromNow = 1) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d
}

function formatDatetimeLocal(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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
  const [drawerTab, setDrawerTab] = useState('form')
  const [outcome, setOutcome] = useState('CALLED')
  const [notes, setNotes] = useState('')
  const [budget, setBudget] = useState('')
  const [area, setArea] = useState('')
  const [interestedFlat, setInterestedFlat] = useState('')
  const [nextCallAt, setNextCallAt] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedFieldAgent, setSelectedFieldAgent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Data Lists
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

  // Optional: Debounce search
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

  // Smart default for next call based on outcome
  const getSmartNextCall = (outcomeKey) => {
    switch(outcomeKey) {
      case 'INTERESTED': return formatDatetimeLocal(getNextBusinessDay(2))
      case 'CALLED': return formatDatetimeLocal(getNextBusinessDay(3))
      case 'CALLBACK': return '' // user picks
      case 'NOT_ANSWERED': return formatDatetimeLocal(getNextBusinessDay(1)) // auto
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
    setOutcome('CALLED')
    setNextCallAt(getSmartNextCall('CALLED'))
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

    // Enforce mandatory next_call_at
    if (outcome !== 'LOST' && outcome !== 'NOT_ANSWERED' && outcome !== 'WON' && !nextCallAt) {
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

      // next_call_at handling
      if (outcome === 'NOT_ANSWERED') {
        payload.next_call_at = new Date(nextCallAt).toISOString()
      } else if (outcome !== 'LOST' && outcome !== 'WON') {
        payload.next_call_at = new Date(nextCallAt).toISOString()
      }

      // If CALLBACK, also set the follow-up reminder to the same date
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

  return (
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
              {s === 'all' ? 'All' : s.replace(/_/g,' ')}
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
                <th className="th">Next Call</th>
                <th className="th text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border relative">
              {loading ? (
                <tr><td colSpan={6} className="py-24 text-center text-txt3"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={32} />Loading Leads...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-txt3">No leads found matching criteria.</td></tr>
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
                  <td className="td"><StatusBadge status={lead.status.toLowerCase()} /></td>
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

      {/* ═══ LEAD DETAIL DRAWER ═══ */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end animate-in fade-in">
          <div className="bg-card w-full max-w-lg h-full shadow-2xl animate-in slide-in-from-right flex flex-col border-l border-border">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-border bg-bg2/50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display font-bold text-xl text-txt">{selectedLead.first_name} {selectedLead.last_name}</h2>
                    {/* Hot Lead Toggle */}
                    <button
                      onClick={handleToggleHot}
                      className={clsx(
                        'p-1.5 rounded-lg transition-all border shrink-0',
                        selectedLead.is_hot
                          ? 'bg-hot/15 border-hot/30 text-hot shadow-md shadow-hot/20'
                          : 'bg-bg3 border-border text-txt3 hover:text-hot hover:border-hot/30'
                      )}
                      title={selectedLead.is_hot ? "Remove Hot flag" : "Mark as Hot Lead"}
                    >
                      <Flame size={16} />
                    </button>
                    {/* Call Button */}
                    <a
                      href={`tel:${selectedLead.phone}`}
                      className="p-1.5 rounded-lg transition-all border bg-bg3 border-border text-txt3 hover:text-[#10B981] hover:border-[#10B981]/30 hover:bg-[#10B981]/10 flex items-center justify-center shrink-0"
                      title="Call via Dialer"
                    >
                      <PhoneCall size={16} />
                    </a>
                  </div>
                  <p className="text-xs text-txt3 font-mono mt-1">{selectedLead.phone}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={selectedLead.status.toLowerCase()} />
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
                  
                  {/* Outcome Grid */}
                  <div>
                    <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-3 block">Call Outcome</label>
                    <div className="grid grid-cols-3 gap-2">
                       {/* using index for key is ok here usually, but opt.key is safer */}
                      {[
                        { key: 'INTERESTED', label: 'Interested', icon: Flame, activeClass: 'bg-accent2/10 border-accent2 text-accent2 shadow-md shadow-accent2/10' },
                        { key: 'CALLBACK', label: 'Follow-up', icon: Clock, activeClass: 'bg-accent/10 border-accent text-accent shadow-md shadow-accent/10' },
                        { key: 'CALLED', label: 'Just Called', icon: PhoneCall, activeClass: 'bg-bg3 border-txt text-txt' },
                        { key: 'NOT_ANSWERED', label: 'No Answer', icon: PhoneOff, activeClass: 'bg-amber/10 border-amber text-amber shadow-md shadow-amber/10' },
                        { key: 'WON', label: '🎉 Won', icon: Trophy, activeClass: 'bg-[#10B981]/10 border-[#10B981] text-[#10B981] shadow-md shadow-[#10B981]/10' },
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

                  {/* ═══ MANDATORY NEXT CALL SCHEDULING ═══ */}
                  {outcome !== 'LOST' && outcome !== 'WON' && (
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
                      {outcome === 'INTERESTED' && (
                        <p className="text-[9px] text-accent mt-2 font-medium">💡 Suggested: 2 days from now (editable)</p>
                      )}
                      {outcome === 'CALLED' && (
                        <p className="text-[9px] text-txt3 mt-2">💡 Suggested: 3 days from now (editable)</p>
                      )}
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

                    {/* Project Dropdown */}
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
                    {(outcome === 'INTERESTED' || selectedLead?.status === 'INTERESTED' || selectedLead?.status === 'SITE_VISIT') && (
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
                    <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center py-3 shadow-lg shadow-accent/20">
                      {submitting ? <RotateCcw size={16} className="animate-spin" /> : <Check size={16} />} 
                      Save Activity
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
