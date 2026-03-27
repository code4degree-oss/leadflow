import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, SectionHeader, StatusBadge, ProgressBar } from '../../components/UI'
import { Phone, Flame, Target, Calendar, ChevronRight, Plus, Star, Clock, CheckCircle, XCircle, ArrowRight, Bell, RefreshCw, AlertCircle, Eye, EyeOff, MessageSquare, DollarSign, Home, X } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

export default function TelecallerDashboard() {
  const [stats, setStats] = useState(null)
  const [leads, setLeads] = useState([])
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // Contact reveal state
  const [revealedContacts, setRevealedContacts] = useState({})
  
  // Call log form
  const [callForm, setCallForm] = useState({
    notes: '', budget: '', interested_flat: '', outcome: '',
    follow_up_at: '', follow_up_note: ''
  })
  const [submitting, setSubmitting] = useState(false)
  
  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [statsData, leadsData, remindersData] = await Promise.all([
        fetchWithAuth('/leads/stats/'),
        fetchWithAuth('/leads/'),
        fetchWithAuth('/reminders/upcoming/').catch(() => [])
      ])
      setStats(statsData)
      setLeads(leadsData.results || leadsData)
      setReminders(remindersData.results || remindersData || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openDrawer = (lead) => {
    setSelected(lead)
    setDrawerOpen(true)
    setCallForm({ notes: lead.notes || '', budget: lead.budget || '', interested_flat: lead.interested_flat || '', outcome: '', follow_up_at: '', follow_up_note: '' })
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setTimeout(() => setSelected(null), 300)
  }

  const handleRevealContact = async (leadId) => {
    try {
      const data = await fetchWithAuth(`/leads/${leadId}/reveal-contact/`)
      setRevealedContacts(prev => ({ ...prev, [leadId]: data }))
    } catch (err) {
      alert('Failed to reveal contact: ' + err.message)
    }
  }

  const handleLogCall = async (outcome) => {
    if (!selected) return
    setSubmitting(true)
    try {
      const payload = {
        notes: callForm.notes,
        budget: callForm.budget ? parseFloat(callForm.budget) : null,
        interested_flat: callForm.interested_flat,
        outcome: outcome
      }
      
      if (outcome === 'CALLBACK' && callForm.follow_up_at) {
        payload.follow_up_at = new Date(callForm.follow_up_at).toISOString()
        payload.follow_up_note = callForm.follow_up_note
      }
      
      const result = await fetchWithAuth(`/leads/${selected.id}/log-call/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      alert(result.detail)
      closeDrawer()
      fetchDashboardData()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkLost = async () => {
    if (!selected) return
    if (!confirm('Are you sure you want to mark this lead as lost?')) return
    setSubmitting(true)
    try {
      const result = await fetchWithAuth(`/leads/${selected.id}/mark-lost/`, {
        method: 'POST',
        body: JSON.stringify({})
      })
      alert(result.detail)
      closeDrawer()
      fetchDashboardData()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !stats) return (
    <Layout role="telecaller" pageTitle="My Dashboard">
      <div className="py-20 text-center">
        <RefreshCw className="animate-spin text-primary mx-auto mb-2" size={32} />
        <p className="text-sm text-txt3 font-medium">Syncing your leads...</p>
      </div>
    </Layout>
  )

  return (
    <Layout role="telecaller" pageTitle="My Dashboard">
      {/* Performance Overview */}
      <div className="card p-5 mb-6 border-accent/20 bg-accent/5 backdrop-blur-sm shadow-xl shadow-accent/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-accent uppercase tracking-widest leading-none mb-1">Performance Overview</h2>
            <p className="text-xs text-txt3">Conversion Rate: <span className="text-success font-bold">{stats?.conversion_rate || 0}%</span></p>
          </div>
          <div className="text-right">
            <div className="font-display font-bold text-3xl text-accent leading-none">{stats?.total_leads || 0}<span className="text-txt3 text-base font-normal"> total</span></div>
          </div>
        </div>
        <ProgressBar value={stats?.status_counts?.WON || 0} max={stats?.total_leads || 1} color="#4F8EF7" height={8} />
        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-1.5 text-xs text-txt2"><div className="w-1.5 h-1.5 rounded-full bg-success"/> <span className="font-bold">{stats?.status_counts?.WON || 0}</span> Won</div>
          <div className="flex items-center gap-1.5 text-xs text-txt2"><div className="w-1.5 h-1.5 rounded-full bg-amber"/> <span className="font-bold">{stats?.status_counts?.INTERESTED || 0}</span> Interested</div>
          <div className="flex items-center gap-1.5 text-xs text-txt2"><div className="w-1.5 h-1.5 rounded-full bg-danger"/> <span className="font-bold">{stats?.status_counts?.LOST || 0}</span> Lost</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="My Queue" value={stats?.total_leads || 0} sub="total assigned" color="accent" icon={Phone} />
        <StatCard label="New Leads" value={stats?.status_counts?.NEW || 0} sub="needs initial call" color="blue" icon={Plus} />
        <StatCard label="Follow-ups" value={stats?.status_counts?.INTERESTED || 0} sub="high priority" color="amber" icon={Clock} />
        <StatCard label="Lost" value={stats?.status_counts?.LOST || 0} sub="escalated" color="red" icon={XCircle} />
      </div>

      {/* Upcoming Reminders */}
      {reminders.length > 0 && (
        <div className="card p-4 mb-6 border-amber/20 bg-amber/5">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-amber" />
            <span className="text-xs font-bold text-amber uppercase tracking-widest">Upcoming Follow-ups</span>
          </div>
          <div className="space-y-2">
            {reminders.slice(0, 3).map(r => (
              <div key={r.id} className="flex items-center justify-between bg-bg3 rounded-xl px-3 py-2 border border-border/50">
                <div>
                  <span className="text-sm font-bold text-txt">{r.lead_name}</span>
                  <span className="text-xs text-txt3 ml-2">{r.note}</span>
                </div>
                <span className="text-[10px] font-mono text-amber font-bold">
                  {new Date(r.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lead list */}
      <div className="card overflow-hidden shadow-lg border-border/50">
        <div className="p-4 border-b border-border flex items-center justify-between bg-bg2/30">
          <h2 className="text-sm font-bold text-txt">My Leads <span className="text-txt3 font-normal">({leads.length})</span></h2>
          <button 
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-1.5 text-txt3 hover:text-primary transition-all"
          >
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto custom-scrollbar">
          {leads.length === 0 ? (
            <div className="p-10 text-center text-txt3">No leads assigned yet.</div>
          ) : (
            leads.map(lead => (
              <div
                key={lead.id}
                onClick={() => openDrawer(lead)}
                className={clsx(
                  'px-4 py-4 cursor-pointer transition-all hover:bg-bg2/50 flex items-center gap-4 group border-l-4',
                  selected?.id === lead.id && drawerOpen ? 'bg-primary/5 border-primary shadow-inner' : 'border-transparent'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-bg3 border border-border flex items-center justify-center text-xs font-bold text-txt group-hover:bg-primary/10 transition-colors">
                  {lead.first_name?.[0]}{lead.last_name?.[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-txt truncate group-hover:text-primary transition-colors">{lead.first_name} {lead.last_name}</span>
                    <StatusBadge status={lead.status} />
                    {lead.lost_count > 0 && (
                      <span className="text-[9px] font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded">{lead.lost_count}× lost</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-txt3 leading-none">{lead.masked_phone || lead.phone}</span>
                    <span className="text-[10px] text-txt3">•</span>
                    <span className="text-[11px] text-txt2 leading-none uppercase tracking-tighter font-bold">{lead.source}</span>
                  </div>
                </div>
                <ChevronRight size={16} className={clsx("transition-transform text-txt3 group-hover:translate-x-1")} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Slide-Over Drawer */}
      {drawerOpen && selected && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-200" onClick={closeDrawer} />
          
          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border bg-bg2/30">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-txt leading-none mb-1">{selected.first_name} {selected.last_name}</h3>
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
                <button onClick={closeDrawer} className="p-2 hover:bg-bg3 rounded-xl text-txt3 hover:text-txt transition-all">
                  <X size={18} />
                </button>
              </div>
              
              {/* Contact Info (Masked) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg3 rounded-xl p-3 border border-border/50">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Phone</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-txt">
                      {revealedContacts[selected.id]?.phone || selected.masked_phone || selected.phone}
                    </span>
                    {!revealedContacts[selected.id] && selected.masked_phone !== selected.phone && (
                      <button onClick={() => handleRevealContact(selected.id)} className="text-primary hover:text-accent transition-colors">
                        <Eye size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-bg3 rounded-xl p-3 border border-border/50">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Email</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-txt truncate">
                      {revealedContacts[selected.id]?.email || selected.masked_email || selected.email || 'N/A'}
                    </span>
                    {!revealedContacts[selected.id] && selected.masked_email !== selected.email && selected.email && (
                      <button onClick={() => handleRevealContact(selected.id)} className="text-primary hover:text-accent transition-colors">
                        <Eye size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {/* Lead Info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-bg3 rounded-xl p-3 border border-border/50 text-center">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Source</div>
                  <div className="text-xs font-bold text-txt uppercase">{selected.source}</div>
                </div>
                <div className="bg-bg3 rounded-xl p-3 border border-border/50 text-center">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Budget</div>
                  <div className="text-xs font-bold text-txt">{selected.budget ? `₹${Number(selected.budget).toLocaleString()}` : 'N/A'}</div>
                </div>
                <div className="bg-bg3 rounded-xl p-3 border border-border/50 text-center">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Lost Count</div>
                  <div className={clsx("text-xs font-bold", selected.lost_count >= 3 ? 'text-danger' : 'text-txt')}>{selected.lost_count}/4</div>
                </div>
              </div>

              {/* Call Log Form */}
              <div>
                <div className="text-[10px] font-bold text-txt3 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MessageSquare size={12} /> Log Call
                </div>
                
                <div className="space-y-3">
                  <textarea 
                    rows={3}
                    placeholder="Call notes — what was discussed…"
                    className="input w-full bg-bg3 text-sm resize-none"
                    value={callForm.notes}
                    onChange={e => setCallForm({...callForm, notes: e.target.value})}
                  />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-txt3 uppercase tracking-widest ml-1">Budget (₹)</label>
                      <input 
                        type="number" 
                        placeholder="25,00,000"
                        className="input w-full bg-bg3 text-sm mt-1"
                        value={callForm.budget}
                        onChange={e => setCallForm({...callForm, budget: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-txt3 uppercase tracking-widest ml-1">Interested Flat</label>
                      <input 
                        placeholder="2BHK Tower A"
                        className="input w-full bg-bg3 text-sm mt-1"
                        value={callForm.interested_flat}
                        onChange={e => setCallForm({...callForm, interested_flat: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Follow-up scheduler (shown always, used for CALLBACK) */}
              <div className="bg-amber/5 rounded-2xl p-4 border border-amber/20">
                <div className="text-[10px] font-bold text-amber uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Calendar size={12} /> Schedule Follow-up
                </div>
                <input 
                  type="datetime-local"
                  className="input w-full bg-bg3 text-sm mb-2"
                  value={callForm.follow_up_at}
                  onChange={e => setCallForm({...callForm, follow_up_at: e.target.value})}
                />
                <input 
                  placeholder="Reminder note…"
                  className="input w-full bg-bg3 text-sm"
                  value={callForm.follow_up_note}
                  onChange={e => setCallForm({...callForm, follow_up_note: e.target.value})}
                />
              </div>

              {/* Outcome Actions */}
              <div>
                <div className="text-[10px] font-bold text-txt3 uppercase tracking-widest mb-3">Call Outcome</div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleLogCall('CALLED')}
                    disabled={submitting}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-bg3 hover:bg-card border border-border hover:border-accent/40 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:scale-110 transition-transform"><Phone size={16}/></div>
                    <span className="text-[10px] font-bold text-txt uppercase tracking-tight">Called</span>
                  </button>
                  <button 
                    onClick={() => handleLogCall('INTERESTED')}
                    disabled={submitting}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-bg3 hover:bg-card border border-border hover:border-success/40 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-success/10 text-success group-hover:scale-110 transition-transform"><Star size={16}/></div>
                    <span className="text-[10px] font-bold text-txt uppercase tracking-tight">Interested</span>
                  </button>
                  <button
                    onClick={() => handleLogCall('CALLBACK')}
                    disabled={submitting}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-bg3 hover:bg-card border border-border hover:border-amber/40 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-amber/10 text-amber group-hover:scale-110 transition-transform"><Clock size={16}/></div>
                    <span className="text-[10px] font-bold text-txt uppercase tracking-tight">Callback</span>
                  </button>
                  <button 
                    onClick={handleMarkLost}
                    disabled={submitting}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-danger/5 hover:bg-danger/10 border border-danger/20 hover:border-danger/40 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-danger/10 text-danger group-hover:scale-110 transition-transform"><XCircle size={16}/></div>
                    <span className="text-[10px] font-bold text-danger uppercase tracking-tight">Mark Lost</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

function UserIcon({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}
