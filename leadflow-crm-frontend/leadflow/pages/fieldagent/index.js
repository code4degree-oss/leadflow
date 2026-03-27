import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, SectionHeader, StatusBadge, ProgressBar } from '../../components/UI'
import { MapPin, Calendar, Clock, CheckCircle, Navigation, ChevronRight, FileText, ArrowRight, RefreshCw, AlertCircle, Phone } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

export default function FieldAgentDashboard() {
  const [leads, setLeads] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [leadsData, statsData] = await Promise.all([
        fetchWithAuth('/leads/'),
        fetchWithAuth('/leads/stats/')
      ])
      setLeads(leadsData.results || leadsData || [])
      setStats(statsData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReport = async (e) => {
    e.preventDefault()
    if (!outcome || !selected) return
    
    setSubmitting(true)
    try {
      // Phase 11: Create a real SiteVisit record
      await fetchWithAuth('/visits/', {
        method: 'POST',
        body: JSON.stringify({ 
          lead: selected.id,
          status: 'COMPLETED',
          scheduled_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          outcome: outcome.toUpperCase(),
          notes: notes
        })
      })
      
      alert('Site visit report filed correctly in platform logs.')
      setOutcome(null)
      setNotes('')
      setSelected(null)
      fetchData()
    } catch (err) {
      alert('Failed to log visit: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !stats) return (
    <Layout role="fieldagent" pageTitle="Field Agent Dashboard">
       <div className="py-20 text-center"><RefreshCw className="animate-spin mx-auto text-primary" size={32}/><p className="text-xs text-txt3 mt-2">Syncing your schedule...</p></div>
    </Layout>
  )

  return (
    <Layout role="fieldagent" pageTitle="Site Visit Dashboard">

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Leads" value={leads.length} sub="assigned to you" color="accent" icon={Calendar} />
        <StatCard label="Interested" value={stats?.status_counts?.INTERESTED || 0} sub="high potential" color="green" icon={CheckCircle} />
        <StatCard label="Pending" value={stats?.status_counts?.NEW || 0} sub="needs visit" color="amber" icon={Clock} trend={0} />
        <StatCard label="Conversions" value={stats?.status_counts?.WON || 0} sub="closed deals" color="purple" icon={MapPin} trend={0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Visit list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card overflow-hidden shadow-lg border-border/50">
            <div className="px-4 py-3 border-b border-border bg-bg2/30 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />
                <span className="text-[10px] font-bold text-txt3 uppercase tracking-widest">My Active Pipeline — {leads.length} leads</span>
              </div>
              <button onClick={fetchData} className="p-1 hover:text-primary transition-colors">
                <RefreshCw size={12} className={clsx(loading && "animate-spin")} />
              </button>
            </div>
            
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {leads.length === 0 ? (
                <div className="p-10 text-center text-xs text-txt3 uppercase font-bold tracking-widest opacity-50">No leads assigned</div>
              ) : (
                leads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => setSelected(lead)}
                    className={clsx(
                      'px-4 py-4 cursor-pointer hover:bg-bg2/50 transition-all border-l-4 group',
                      selected?.id === lead.id ? 'bg-primary/5 border-primary shadow-inner' : 'border-transparent'
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-sm font-bold text-txt group-hover:text-primary transition-colors">{lead.first_name} {lead.last_name}</div>
                      <StatusBadge status={lead.status.toLowerCase()} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-txt3 font-mono">
                      <Phone size={10} /> {lead.phone}
                      <span className="px-1.5 py-0.5 bg-bg3 rounded text-[9px] font-bold uppercase">{lead.source}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {selected ? (
            <div className="card p-6 shadow-xl border-primary/10 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-txt leading-none mb-1">{selected.first_name} {selected.last_name}</h3>
                    <div className="text-[10px] text-txt3 font-mono uppercase tracking-widest font-bold">Client Profile • Lead ID #{selected.id.substring(0,8)}</div>
                  </div>
                </div>
                <StatusBadge status={selected.status.toLowerCase()} />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-bg3 rounded-xl p-4 border border-border/50">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Phone Number</div>
                  <div className="text-sm font-mono font-bold text-txt">{selected.phone}</div>
                </div>
                <div className="bg-bg3 rounded-xl p-4 border border-border/50">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Assigned Date</div>
                  <div className="text-sm font-medium text-txt">{new Date(selected.created_at).toLocaleDateString()}</div>
                </div>
                <div className="bg-bg3 rounded-xl p-4 border border-border/50 col-span-2">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1 italic opacity-60">Lead Requirement / Description</div>
                  <div className="text-xs text-txt2 leading-relaxed">{selected.requirement || 'No specific requirement details logged by telecaller.'}</div>
                </div>
              </div>

              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div className="text-[10px] font-bold text-txt3 uppercase tracking-widest mb-2 px-1">Visit Performance Report</div>
                
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { val:'interested',     label:'Interested',      color:'border-success/40 bg-success/5 text-success hover:bg-success/10' },
                    { val:'won',            label:'Closed (WON)',    color:'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10' },
                    { val:'lost',           label:'Not Interested',  color:'border-danger/40 bg-danger/5 text-danger hover:bg-danger/10' },
                  ].map(o => (
                    <button
                      key={o.val}
                      type="button"
                      onClick={() => setOutcome(o.val)}
                      className={clsx(
                        'flex flex-col items-center justify-center py-4 rounded-2xl border text-[10px] font-bold uppercase tracking-tight transition-all',
                        outcome === o.val ? o.color + ' ring-1 ring-offset-2 ring-current' : 'border-border bg-bg3 text-txt3 hover:border-border2'
                      )}
                    >
                      {o.val === 'won' ? <CheckCircle size={16} className="mb-2"/> : o.val === 'interested' ? <Star size={16} className="mb-2"/> : <XCircle size={16} className="mb-2"/>}
                      {o.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Observation Notes</label>
                  <textarea
                    required
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Describe the visit outcome, property preference, and client concerns…"
                    className="input w-full min-h-[100px] bg-bg3 border-border/50 focus:border-primary resize-none text-sm p-4 rounded-2xl"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={!outcome || submitting}
                    className="btn-primary flex-1 justify-center py-3.5 shadow-lg shadow-primary/20"
                  >
                    {submitting ? <RefreshCw className="animate-spin" size={16}/> : <><CheckCircle size={16} /> Submit Report</>}
                  </button>
                  <button type="button" className="btn-ghost px-6 rounded-2xl border border-border">
                    <Navigation size={16} />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card p-16 flex flex-col items-center justify-center text-center h-[500px] border-dashed border-2 border-border/50 bg-bg2/10 rounded-[32px]">
              <div className="w-20 h-20 rounded-3xl bg-bg3 flex items-center justify-center mb-6 text-txt3 shadow-inner -rotate-6">
                 <MapPin size={40} className="opacity-10" />
              </div>
              <div className="text-txt font-bold text-lg mb-2">Lead Map View</div>
              <div className="text-txt3 text-xs max-w-[220px] leading-relaxed">Select a lead from the roster to view site details and file your visit report.</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

function Star({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
