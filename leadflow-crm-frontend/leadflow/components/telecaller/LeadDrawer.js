/**
 * LeadDrawer — Unified lead detail drawer with call logging, timeline, and follow-ups.
 * 
 * Previously duplicated across telecaller/index.js (~350 lines), telecaller/leads.js (~300 lines),
 * and telecaller/reminders.js (~250 lines). Now a single shared component.
 * 
 * Features:
 * - Call outcome logging with smart scheduling
 * - Lead intelligence form (budget, area, BHK, project, field agent)
 * - Activity timeline view
 * - Follow-ups view
 * - Hot lead toggle
 * - Confirmation modal for terminal actions (WON/LOST/INVALID)
 */

import { useState } from 'react'
import { StatusBadge } from '../UI'
import DateTimePicker from '../DateTimePicker'
import { getSmartNextCall, getDueStatus } from '../../utils/dateHelpers'
import { fetchWithAuth } from '../../utils/api'
import clsx from 'clsx'
import {
  X, PhoneCall, Check, FileText, Calendar, RotateCcw,
  PhoneOff, DollarSign, MapPin, Home, ChevronRight, History, Bell,
  CheckCircle2, Circle, Loader2, UserCheck, Building2, Clock,
  Flame, Trophy
} from 'lucide-react'

// ═══ Timeline helpers ═══

const TIMELINE_ICONS = {
  'CALL_LOGGED': PhoneCall, 'STATUS_CHANGE': CheckCircle2, 'ASSIGNED': ChevronRight,
  'REASSIGNED': ChevronRight, 'FOLLOW_UP_SET': Calendar, 'FOLLOW_UP_COMPLETED': Check,
  'SITE_VISIT_SCHEDULED': MapPin, 'SITE_VISIT_COMPLETED': CheckCircle2, 'NOTE_ADDED': FileText,
  'ESCALATED': Flame, 'IMPORTED': FileText,
}

const TIMELINE_COLORS = {
  'CALL_LOGGED': 'text-accent bg-accent/10', 'STATUS_CHANGE': 'text-purple bg-purple/10',
  'FOLLOW_UP_SET': 'text-amber bg-amber/10', 'FOLLOW_UP_COMPLETED': 'text-[#10B981] bg-[#10B981]/10',
  'SITE_VISIT_SCHEDULED': 'text-accent2 bg-accent2/10', 'ESCALATED': 'text-danger bg-danger/10',
}

function getTimelineIcon(type) { return TIMELINE_ICONS[type] || Circle }
function getTimelineColor(type) { return TIMELINE_COLORS[type] || 'text-txt3 bg-bg3' }

// ═══ Outcome options ═══

const OUTCOME_OPTIONS = [
  { key: 'INTERESTED', label: 'Interested', icon: Flame, activeClass: 'bg-accent2/10 border-accent2 text-accent2 shadow-md shadow-accent2/10' },
  { key: 'CALLBACK', label: 'Follow-up', icon: Clock, activeClass: 'bg-accent/10 border-accent text-accent shadow-md shadow-accent/10' },
  { key: 'NOT_ANSWERED', label: 'No Answer', icon: PhoneOff, activeClass: 'bg-amber/10 border-amber text-amber shadow-md shadow-amber/10' },
  { key: 'WON', label: '🎉 Won', icon: Trophy, activeClass: 'bg-[#10B981]/10 border-[#10B981] text-[#10B981] shadow-md shadow-[#10B981]/10' },
  { key: 'INVALID_NUMBER', label: 'Dead No.', icon: PhoneOff, activeClass: 'bg-danger/10 border-danger text-danger shadow-md shadow-danger/10' },
  { key: 'LOST', label: 'Mark Lost', icon: X, activeClass: 'bg-danger/10 border-danger text-danger shadow-md shadow-danger/10' },
]

/**
 * @param {Object} props
 * @param {Object} props.lead - The lead object to display/edit
 * @param {Function} props.onClose - Callback when drawer is closed
 * @param {Function} props.onUpdate - Callback after successful call log (re-fetch leads)
 * @param {Array} props.projects - List of project options
 * @param {Array} props.fieldAgents - List of field agent options
 * @param {Array} props.timeline - Timeline events for this lead
 * @param {Array} props.followUps - Follow-up reminders for this lead
 * @param {boolean} props.loadingTimeline - Whether timeline is loading
 * @param {Function} [props.onFetchProjects] - Optional callback to re-fetch projects filtered by BHK
 * @param {boolean} [props.showBhkFilter] - Whether to show BHK filter dropdown (leads.js and reminders.js have it)
 */
export default function LeadDrawer({
  lead,
  onClose,
  onUpdate,
  projects = [],
  fieldAgents = [],
  timeline = [],
  followUps = [],
  loadingTimeline = false,
  onFetchProjects,
  showBhkFilter = false,
}) {
  // ═══ Form State ═══
  const [drawerTab, setDrawerTab] = useState('form')
  const [outcome, setOutcome] = useState('CALLBACK')
  const [notes, setNotes] = useState(lead.notes || '')
  const [budget, setBudget] = useState(lead.budget || '')
  const [area, setArea] = useState(lead.area || '')
  const [interestedFlat, setInterestedFlat] = useState(lead.interested_flat || '')
  const [bhkPreference, setBhkPreference] = useState(lead.interested_flat || '')
  const [nextCallAt, setNextCallAt] = useState(getSmartNextCall('CALLBACK'))
  const [selectedProject, setSelectedProject] = useState(lead.project || '')
  const [selectedFieldAgent, setSelectedFieldAgent] = useState(lead.field_agent || '')
  const [submitting, setSubmitting] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)

  // ═══ Hot lead ═══
  const [isHot, setIsHot] = useState(lead.is_hot || false)

  const handleOutcomeChange = (newOutcome) => {
    setOutcome(newOutcome)
    setNextCallAt(getSmartNextCall(newOutcome))
  }

  const handleToggleHot = async () => {
    try {
      const result = await fetchWithAuth(`/leads/${lead.id}/toggle-hot/`, { method: 'POST' })
      setIsHot(result.is_hot)
    } catch (err) { alert("Failed: " + err.message) }
  }

  const processCallLog = async (payload) => {
    setSubmitting(true)
    try {
      await fetchWithAuth(`/leads/${lead.id}/log-call/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      onUpdate?.()
      onClose()
    } catch (err) {
      alert("Failed: " + err.message)
    } finally { setSubmitting(false) }
  }

  const handleLogCall = async (e) => {
    e.preventDefault()

    // Enforce mandatory next_call_at for non-terminal outcomes
    if (outcome !== 'LOST' && outcome !== 'INVALID_NUMBER' && outcome !== 'NOT_ANSWERED' && outcome !== 'WON' && !nextCallAt) {
      alert("⚠️ You must schedule the next call before saving.")
      return
    }

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
    } else if (outcome !== 'LOST' && outcome !== 'WON' && outcome !== 'INVALID_NUMBER') {
      payload.next_call_at = new Date(nextCallAt).toISOString()
    }

    // If CALLBACK, also set the follow-up reminder
    if (outcome === 'CALLBACK') {
      payload.follow_up_at = new Date(nextCallAt).toISOString()
      payload.follow_up_note = "Follow up scheduled from call logger."
    }

    // Terminal actions need confirmation
    if (outcome === 'LOST' || outcome === 'WON' || outcome === 'INVALID_NUMBER') {
      setConfirmModal({ outcome, payload })
      return
    }

    processCallLog(payload)
  }

  const handleBhkChange = (val) => {
    setInterestedFlat(val)
    setBhkPreference(val)
    setSelectedProject('')
    if (onFetchProjects) {
      onFetchProjects(val ? val.replace('BHK', '') : '')
    }
  }

  const dueStatus = getDueStatus(lead.next_call_at)

  return (
    <>
      {/* ═══ DRAWER OVERLAY ═══ */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end animate-in fade-in" onClick={onClose}>
        <div className="bg-card w-full max-w-lg h-full shadow-2xl animate-in slide-in-from-right flex flex-col border-l border-border" onClick={e => e.stopPropagation()}>

          {/* ═══ HEADER ═══ */}
          <div className="px-6 py-5 border-b border-border bg-bg2/50">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-xl font-display font-extrabold text-txt truncate">
                  {lead.first_name} {lead.last_name}
                </h2>
                <p className="text-xs text-txt3 font-mono mt-1">{lead.phone}</p>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleToggleHot}
                    className={clsx(
                      'p-1.5 px-3 rounded-lg transition-all border shrink-0 flex items-center gap-2 text-xs font-bold',
                      isHot
                        ? 'bg-hot/15 border-hot/30 text-hot shadow-md shadow-hot/20'
                        : 'bg-bg3 border-border text-txt3 hover:text-hot hover:border-hot/30'
                    )}
                    title={isHot ? "Remove Hot flag" : "Mark as Hot Lead"}
                  >
                    <Flame size={16} /> {isHot ? "Hot Lead" : "Mark as hot lead"}
                  </button>
                  <a
                    href={`tel:${lead.phone}`}
                    className="p-1.5 px-3 rounded-lg transition-all border bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981] hover:text-white flex items-center gap-2 text-xs font-bold shrink-0"
                    title="Call via Dialer"
                  >
                    <PhoneCall size={16} /> Call now
                  </a>
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <StatusBadge status={lead.status?.toLowerCase()} />
                  <span className="badge badge-gray text-[9px]">{lead.source}</span>
                  {isHot && (
                    <span className="text-[9px] font-bold text-hot bg-hot/10 px-2 py-0.5 rounded-full">🔥 Hot Lead</span>
                  )}
                  {dueStatus.label && (
                    <span className={clsx("text-[9px] font-bold px-2 py-0.5 rounded-full", dueStatus.bgClass, dueStatus.textClass)}>
                      {dueStatus.label}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-bg3 rounded-xl text-txt3"><X size={20} /></button>
            </div>
          </div>

          {/* ═══ TABS ═══ */}
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

          {/* ═══ TAB CONTENT ═══ */}
          <div className="flex-1 overflow-y-auto">

            {/* ────── LOG CALL FORM ────── */}
            {drawerTab === 'form' && (
              <form onSubmit={handleLogCall} className="p-6 flex flex-col gap-5">

                {/* Outcome Grid */}
                <div>
                  <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-3 block">Call Outcome</label>
                  <div className="grid grid-cols-3 gap-2">
                    {OUTCOME_OPTIONS.map(opt => (
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

                {/* Next Call Scheduling (not for terminal states) */}
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
                    {outcome === 'INTERESTED' && (
                      <p className="text-[9px] text-accent mt-2 font-medium">💡 Suggested: 2 days from now (editable)</p>
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

                  {/* BHK Requirement (conditional) */}
                  {showBhkFilter ? (
                    <div>
                      <label className="text-[10px] text-txt3 mb-1 block flex items-center gap-1"><Home size={10} /> Requirement (BHK)</label>
                      <select value={interestedFlat} onChange={e => handleBhkChange(e.target.value)}
                        className="input w-full bg-bg3 text-sm">
                        <option value="">Select requirement...</option>
                        <option value="1BHK">1 BHK</option>
                        <option value="2BHK">2 BHK</option>
                        <option value="3BHK">3 BHK</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] text-txt3 mb-1 block flex items-center gap-1"><Home size={10} /> Interested Flat / Unit</label>
                      <input value={interestedFlat} onChange={e => setInterestedFlat(e.target.value)}
                        placeholder="e.g. 2BHK Tower A" className="input w-full bg-bg3 text-sm" />
                    </div>
                  )}

                  {/* Project Dropdown */}
                  <div>
                    <label className="text-[10px] text-txt3 mb-1 block flex items-center gap-1"><Building2 size={10} /> Interested Project</label>
                    <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                      className="input w-full bg-bg3 text-sm">
                      <option value="">{showBhkFilter && bhkPreference ? `Projects with ${bhkPreference} available...` : 'Select a project...'}</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ''}</option>)}
                    </select>
                    {showBhkFilter && bhkPreference && projects.length === 0 && (
                      <p className="text-[9px] text-amber mt-1">⚠ No projects with {bhkPreference} available</p>
                    )}
                  </div>

                  {/* Field Agent Assignment */}
                  {(outcome === 'INTERESTED' || outcome === 'WON' || lead.status === 'INTERESTED' || lead.status === 'SITE_VISIT') && (
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
                  <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center py-3">Cancel</button>
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

            {/* ────── TIMELINE TAB ────── */}
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

            {/* ────── FOLLOW-UPS TAB ────── */}
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

      {/* ═══ CONFIRMATION MODAL ═══ */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-border animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center">
              <div className={clsx(
                "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                confirmModal.outcome === 'WON' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-danger/10 text-danger'
              )}>
                {confirmModal.outcome === 'WON' ? <Trophy size={32} /> : confirmModal.outcome === 'INVALID_NUMBER' ? <PhoneOff size={32} /> : <X size={32} />}
              </div>
              <h3 className="text-xl font-bold text-txt mb-2">Are you sure?</h3>
              <p className="text-sm text-txt2 mb-6">
                You are about to mark this lead as <strong>{confirmModal.outcome}</strong>. This action is terminal and will clear any future reminders.
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 bg-bg3 text-txt rounded-xl font-bold hover:bg-bg2 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    processCallLog(confirmModal.payload)
                    setConfirmModal(null)
                  }}
                  className={clsx(
                    "flex-1 py-3 text-white rounded-xl font-bold transition-colors shadow-lg",
                    confirmModal.outcome === 'WON' ? 'bg-[#10B981] hover:bg-[#059669] shadow-[#10B981]/20' : 'bg-danger hover:bg-danger/90 shadow-danger/20'
                  )}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
