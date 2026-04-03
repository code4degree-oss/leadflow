import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import { Bell, Phone, Clock, CheckCircle, Calendar, Loader2, AlertTriangle, PhoneCall, Check, X, ChevronDown, Flame, Trophy, ChevronRight, FileText, Circle, CheckCircle2, PhoneOff, DollarSign, MapPin, Building2, Home, UserCheck, History } from 'lucide-react'
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

function getSmartNextCall(newOutcome) {
  if (['LOST', 'WON'].includes(newOutcome)) return ''
  if (newOutcome === 'NOT_ANSWERED') {
    return formatDatetimeLocal(getNextBusinessDay(1))
  }
  return formatDatetimeLocal(getNextBusinessDay(2))
}

const getTimelineIcon = (type) => {
  const icons = {
    'CALL_LOGGED': PhoneCall, 'STATUS_CHANGE': CheckCircle2, 'ASSIGNED': ChevronRight,
    'REASSIGNED': ChevronRight, 'FOLLOW_UP_SET': Calendar, 'FOLLOW_UP_COMPLETED': Check,
    'SITE_VISIT_SCHEDULED': Flame, 'SITE_VISIT_COMPLETED': CheckCircle2, 'NOTE_ADDED': FileText,
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

export default function Reminders() {
  const [reminders, setReminders] = useState([])
  const [overdueLeads, setOverdueLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)

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

  // ═══ Reference Data ═══
  const [projects, setProjects] = useState([])
  const [fieldAgents, setFieldAgents] = useState([])
  const [timeline, setTimeline] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  useEffect(() => {
    loadReminders()
    fetchProjects()
    fetchFieldAgents()
  }, [])

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

  const loadReminders = async () => {
    setLoading(true)
    try {
      const [reminderData, leadsData] = await Promise.all([
        fetchWithAuth('/reminders/?ordering=scheduled_at').catch(() => []),
        fetchWithAuth('/leads/?ordering=next_call_at').catch(() => ({ results: [] })),
      ])

      const allReminders = Array.isArray(reminderData) ? reminderData : (reminderData?.results || [])
      setReminders(allReminders)

      const allLeads = leadsData?.results || leadsData || []
      const now = new Date()
      const scheduled = allLeads.filter(lead => {
        if (!lead.next_call_at) return false
        if (['WON', 'LOST'].includes(lead.status)) return false
        return true
      })
      setOverdueLeads(scheduled)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (e, reminderId) => {
    e.stopPropagation()
    setCompletingId(reminderId)
    try {
      await fetchWithAuth(`/reminders/${reminderId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_completed: true })
      })
      setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, is_completed: true } : r))
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setCompletingId(null)
    }
  }

  const openDrawerForReminder = async (leadId) => {
    setLoadingTimeline(true)
    try {
      // First, fetch the full lead object using its ID
      const lead = await fetchWithAuth(`/leads/${leadId}/`)
      openLeadDetails(lead)
    } catch (err) {
      alert("Failed to load lead details: " + err.message)
      setLoadingTimeline(false)
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
    } catch (err) { alert("Failed: " + err.message) }
  }

  const handleLogCall = async (e) => {
    e.preventDefault()

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

      if (outcome === 'NOT_ANSWERED') {
        payload.next_call_at = new Date(nextCallAt).toISOString()
      } else if (outcome !== 'LOST' && outcome !== 'WON') {
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
      loadReminders()
    } catch (err) {
      alert("Failed: " + err.message)
    } finally { setSubmitting(false) }
  }

  const now = new Date()
  const pendingReminders = reminders.filter(r => !r.is_completed)
  const completedReminders = reminders.filter(r => r.is_completed)

  const pendingReminderLeadIds = new Set(pendingReminders.map(r => r.lead))

  // Merge overdue leads into a unified pending list so we have 2 straight sections
  const unifiedPending = [
    // Transform scheduled leads into "reminder" like objects purely for list display
    ...overdueLeads
      .filter(lead => !pendingReminderLeadIds.has(lead.id))
      .map(lead => ({
      id: `lead_${lead.id}`,
      is_lead: true,
      lead: lead.id,
      lead_name: `${lead.first_name} ${lead.last_name}`,
      phone: lead.phone,
      scheduled_at: lead.next_call_at,
      status: lead.status,
      note: new Date(lead.next_call_at) < now ? 'Overdue regular call' : 'Scheduled regular call',
      isOverdue: new Date(lead.next_call_at) < now
    })),
    // Map reminders
    ...pendingReminders.map(r => ({
      ...r,
      is_reminder: true,
      isOverdue: new Date(r.scheduled_at) < now
    }))
  ].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))

  return (
    <Layout role="telecaller" pageTitle="Call Reminders">
      <div className="max-w-2xl space-y-5">

        {loading ? (
          <div className="card p-16 flex flex-col items-center justify-center text-center">
            <Loader2 size={32} className="animate-spin text-accent mb-3" />
            <div className="text-txt2 font-medium text-sm">Loading reminders...</div>
          </div>
        ) : (
          <>
            {/* UPCOMING / PENDING SECTION */}
            <h2 className="text-sm font-bold text-txt uppercase tracking-wider mb-2">Upcoming & Overdue</h2>
            
            {unifiedPending.length === 0 ? (
               <div className="card p-16 flex flex-col items-center justify-center text-center">
                 <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-4 border border-[#10B981]/20">
                   <CheckCircle size={32} className="text-[#10B981]" />
                 </div>
                 <div className="text-txt font-display font-bold text-lg mb-1">All caught up!</div>
                 <div className="text-txt3 text-xs">No pending call reminders or overdue follow-ups</div>
               </div>
            ) : (
               <div className="card overflow-hidden border border-border">
                 <div className="divide-y divide-border">
                   {unifiedPending.map((item) => {
                     const scheduledDate = new Date(item.scheduled_at)
                     const isPast = scheduledDate < now
                     const daysAgo = Math.floor((now - scheduledDate) / (1000 * 60 * 60 * 24))
                     
                     return (
                       <div key={item.id} 
                         onClick={() => openDrawerForReminder(item.lead)}
                         className="px-4 py-3.5 flex items-center justify-between hover:bg-card/50 transition-colors cursor-pointer group">
                         <div className="flex items-center gap-3">
                           <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', isPast ? 'bg-danger/15' : 'bg-accent/15')}>
                             {isPast ? <Clock size={14} className="text-danger" /> : <Bell size={14} className="text-accent" />}
                           </div>
                           <div>
                             <div className="text-sm font-bold text-txt group-hover:text-accent transition-colors">{item.lead_name || 'Lead'}</div>
                             <div className="flex items-center gap-2 mt-0.5">
                               <span className={clsx('text-[10px] font-bold', isPast ? 'text-danger' : 'text-accent')}>
                                 {isPast && daysAgo > 0 ? `${daysAgo}d overdue` : ''}
                                 {!isPast ? scheduledDate.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                 {isPast && daysAgo === 0 ? `${item.is_lead ? 'Due' : 'Scheduled'} earlier today` : ''}
                               </span>
                               {isPast && daysAgo > 0 && (
                                 <>
                                   <span className="text-[10px] text-txt3">·</span>
                                   <span className="text-[10px] text-txt3 font-mono">
                                     was {item.is_lead ? 'due' : 'scheduled'} {scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                   </span>
                                 </>
                               )}
                             </div>
                             {item.note && <p className="text-[10px] text-txt3 mt-0.5 truncate max-w-[250px]">{item.note}</p>}
                           </div>
                         </div>
                         <div className="flex items-center gap-2">
                           {item.is_reminder && (
                             <button
                               onClick={(e) => handleComplete(e, item.id)}
                               disabled={completingId === item.id}
                               className={clsx(
                                 "p-1.5 rounded-lg border transition-colors",
                                 completingId === item.id ? 'opacity-50' : 'hover:bg-[#10B981]/10 hover:text-[#10B981] hover:border-[#10B981]/30',
                                 'bg-bg3 border-border text-txt3'
                               )}
                               title="Mark done"
                             >
                               {completingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                             </button>
                           )}
                           <div className="btn-primary text-[10px] py-1.5 px-3 shadow-sm">
                             <PhoneCall size={11} className="mr-1 inline" /> Log
                           </div>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               </div>
            )}

            {/* Completed Section (collapsible) */}
            {completedReminders.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-xs text-txt3 font-bold uppercase tracking-wider mb-3 hover:text-txt transition-colors"
                >
                  <ChevronDown size={14} className={clsx('transition-transform', showCompleted && 'rotate-180')} />
                  Completed ({completedReminders.length})
                </button>
                {showCompleted && (
                  <div className="card overflow-hidden border border-[#10B981]/20 bg-[#10B981]/5 animate-in fade-in slide-in-from-top-2">
                    <div className="divide-y divide-[#10B981]/10">
                      {completedReminders.slice(0, 20).map((r) => (
                        <div key={r.id} className="px-4 py-3 flex items-center justify-between opacity-60">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
                              <CheckCircle size={14} className="text-[#10B981]" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-txt line-through">{r.lead_name || 'Lead'}</div>
                              <div className="text-[10px] text-txt3 font-mono">
                                {new Date(r.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold uppercase text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">Done</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ DETAIL DRAWER ═══ */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end animate-in fade-in" onClick={() => setSelectedLead(null)}>
          <div className="bg-card w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right flex flex-col border-l border-border" onClick={e => e.stopPropagation()}>
            
            {/* Drawer Header */}
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
                      {[
                        { key: 'INTERESTED', label: 'Interested', icon: Flame, activeClass: 'bg-accent2/10 border-accent2 text-accent2 shadow-md shadow-accent2/10' },
                        { key: 'CALLBACK', label: 'Follow-up', icon: Clock, activeClass: 'bg-accent/10 border-accent text-accent shadow-md shadow-accent/10' },
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

                  {/* Next Call Scheduling */}
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
                    </div>
                  )}

                  <hr className="border-border border-dashed" />

                  {/* Lead Intelligence */}
                  <div>
                    <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-3 block">Lead Intelligence</label>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[9px] font-medium text-txt3 mb-1 block flex items-center gap-1"><DollarSign size={10} />Budget (₹)</label>
                        <input type="number" className="input text-sm w-full bg-bg3 py-2" placeholder="e.g. 5000000" value={budget} onChange={e => setBudget(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-medium text-txt3 mb-1 block flex items-center gap-1"><MapPin size={10} />Area</label>
                        <input type="text" className="input text-sm w-full bg-bg3 py-2" placeholder="e.g. Baner, Pune" value={area} onChange={e => setArea(e.target.value)} />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="text-[9px] font-medium text-txt3 mb-1 block flex items-center gap-1"><Building2 size={10} />Interested Project</label>
                      <select className="input text-sm w-full bg-bg3 py-2" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                        <option value="">Select a project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {/* Interested Flat */}
                    <div className="mb-3">
                      <label className="text-[9px] font-medium text-txt3 mb-1 block flex items-center gap-1"><Home size={10} />Interested Flat / Unit</label>
                      <input type="text" className="input text-sm w-full bg-bg3 py-2" placeholder="e.g. A-402, 2BHK" value={interestedFlat} onChange={e => setInterestedFlat(e.target.value)} />
                    </div>
                    {/* Field Agent Assignment */}
                    <div className="mb-3">
                      <label className="text-[9px] font-medium text-txt3 mb-1 block flex items-center gap-1"><UserCheck size={10} />Assign Field Agent (Site Visit)</label>
                      <select className="input text-sm w-full bg-bg3 py-2" value={selectedFieldAgent} onChange={e => setSelectedFieldAgent(e.target.value)}>
                        <option value="">No field agent...</option>
                        {fieldAgents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
                      </select>
                    </div>
                  </div>

                  <hr className="border-border border-dashed" />

                  {/* Notes */}
                  <div>
                    <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block">Call Notes</label>
                    <textarea
                      placeholder="Discussed requirements, customer requested..."
                      className="input w-full bg-bg3 resize-none h-24 text-sm"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    ></textarea>
                  </div>

                  {/* Submit Button */}
                  <div className="sticky bottom-0 bg-card pt-2 pb-6 w-full z-10">
                    <button type="submit" disabled={submitting} className={clsx(
                      "btn-primary w-full justify-center transition-all h-12 shadow-xl hover:-translate-y-0.5 mt-2",
                      ['WON', 'INTERESTED'].includes(outcome) ? "bg-accent border-accent hover:shadow-accent/40 shadow-accent/20" :
                        outcome === 'CALLBACK' ? "bg-purple border-purple hover:shadow-purple/40 shadow-purple/20" :
                          outcome === 'LOST' ? "bg-danger border-danger hover:shadow-danger/40 shadow-danger/20" :
                            "bg-amber border-amber hover:shadow-amber/40 shadow-amber/20"
                    )}>
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      {submitting ? 'Saving changes...' : 'Save & Log Call'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB: TIMELINE */}
              {drawerTab === 'timeline' && (
                <div className="p-6">
                  {loadingTimeline ? (
                    <div className="text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-accent mb-2" /><p className="text-xs text-txt3">Loading history...</p></div>
                  ) : timeline.length === 0 ? (
                    <div className="text-center py-12 text-txt3 text-xs">No activity yet.</div>
                  ) : (
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                      {timeline.map((event, idx) => {
                        const Icon = getTimelineIcon(event.activity_type)
                        const colorClass = getTimelineColor(event.activity_type)
                        return (
                          <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className={clsx("flex items-center justify-center w-6 h-6 rounded-full border-4 border-card shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10", colorClass)}>
                              <Icon size={10} />
                            </div>
                            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] card p-3 shadow-md hover:shadow-lg transition-all border border-border">
                              <div className="flex items-center justify-between mb-1">
                                <span className={clsx("font-bold text-xs", colorClass.split(' ')[0])}>{event.title}</span>
                              </div>
                              <p className="text-[10px] text-txt3 font-mono mt-1 mb-2">
                                {new Date(event.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} • {event.performed_by_name}
                              </p>
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
    </Layout>
  )
}
