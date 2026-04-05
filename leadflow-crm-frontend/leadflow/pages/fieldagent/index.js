import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, StatusBadge } from '../../components/UI'
import { Search, Flame, Clock, X, PhoneCall, Check, FileText, Calendar, RotateCcw, PhoneOff, DollarSign, MapPin, Home, ChevronRight, History, Bell, CheckCircle, CheckCircle2, Circle, Loader2, UserCheck, Building2, ChevronLeft, ChevronRight as ChevronRightIcon, Trophy, XCircle, RefreshCw, Phone, User, Eye } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

export default function FieldAgentDashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [completedCount, setCompletedCount] = useState(0)

  // Visit Action State
  const [selectedVisitLead, setSelectedVisitLead] = useState(null)
  const [visitOutcome, setVisitOutcome] = useState(null)
  const [visitNotes, setVisitNotes] = useState('')
  const [visitSubmitting, setVisitSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [leadsData, statsData, visitsData] = await Promise.all([
        fetchWithAuth('/leads/?page_size=500'), // Get all leads to filter pending
        fetchWithAuth('/leads/stats/'),
        fetchWithAuth('/visits/?status=COMPLETED&page_size=1')
      ])
      setLeads(leadsData.results || leadsData || [])
      setStats(statsData)
      setCompletedCount(visitsData.count || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Pending visits are leads assigned to this agent where they are not WON/LOST/INVALID
  const pendingVisits = leads.filter(l => l.field_agent && l.status !== 'WON' && l.status !== 'LOST' && l.status !== 'INVALID_NUMBER')

  const handleSubmitVisit = async (e) => {
    e.preventDefault()
    if (!visitOutcome || !selectedVisitLead) return
    setVisitSubmitting(true)
    try {
      await fetchWithAuth('/visits/', {
        method: 'POST',
        body: JSON.stringify({
          lead: selectedVisitLead.id,
          status: 'COMPLETED',
          scheduled_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          outcome: visitOutcome.toUpperCase(),
          notes: visitNotes
        })
      })
      alert('Site visit report submitted!')
      setVisitOutcome(null)
      setVisitNotes('')
      setSelectedVisitLead(null)
      fetchData()
    } catch (err) {
      alert('Failed to log visit: ' + err.message)
    } finally {
      setVisitSubmitting(false)
    }
  }

  return (
    <Layout role="fieldagent" pageTitle="Dashboard">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pending Visits" value={pendingVisits.length} sub="action required" color="amber" icon={Clock} />
        <StatCard label="Completed" value={completedCount} sub="visits done" color="green" icon={CheckCircle} />
        <StatCard label="Won" value={stats?.status_counts?.WON || 0} sub="closed deals" color="purple" icon={Trophy} />
        <StatCard label="Total Leads" value={leads.filter(l => l.assigned_to).length} sub="assigned to you" color="accent" icon={User} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pending Visits List */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden shadow-lg border-border/50">
            <div className="px-4 py-3 border-b border-border bg-bg2/30 flex justify-between items-center">
              <span className="text-[10px] font-bold text-txt3 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />
                Pending Site Visits ({pendingVisits.length})
              </span>
              <button onClick={fetchData} className="p-1 hover:text-primary transition-colors">
                <RefreshCw size={12} className={clsx(loading && "animate-spin")} />
              </button>
            </div>
            
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {loading ? (
                 <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={24} /></div>
              ) : pendingVisits.length === 0 ? (
                <div className="p-10 text-center text-xs text-txt3 uppercase font-bold tracking-widest opacity-50">No pending visits</div>
              ) : pendingVisits.map(lead => (
                <div key={lead.id} onClick={() => setSelectedVisitLead(lead)}
                  className={clsx('px-4 py-4 cursor-pointer hover:bg-bg2/50 transition-all border-l-4 group',
                    selectedVisitLead?.id === lead.id ? 'bg-primary/5 border-primary shadow-inner' : 'border-transparent')}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-sm font-bold text-txt group-hover:text-primary transition-colors">{lead.first_name} {lead.last_name}</div>
                    <StatusBadge status={lead.status?.toLowerCase()} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-txt3 font-mono flex-wrap">
                    <span className="flex items-center gap-1"><Phone size={10} /> {lead.phone}</span>
                    {lead.project_name && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-bold">
                        <Building2 size={9} /> {lead.project_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visit Details / Report Submission */}
        <div className="lg:col-span-3">
          {selectedVisitLead ? (
            <div className="card p-6 shadow-xl border-primary/10 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-txt leading-none mb-1">{selectedVisitLead.first_name} {selectedVisitLead.last_name}</h3>
                    <div className="text-[10px] text-txt3 font-mono uppercase tracking-widest font-bold">Site Visit • #{selectedVisitLead.id.substring(0,8)}</div>
                  </div>
                </div>
                <StatusBadge status={selectedVisitLead.status?.toLowerCase()} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-bg3 rounded-xl p-3 border border-border/50">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Phone</div>
                  <div className="text-sm font-mono font-bold text-txt">{selectedVisitLead.phone}</div>
                </div>
                <div className="bg-bg3 rounded-xl p-3 border border-border/50">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Project / Site</div>
                  <div className="text-sm font-medium text-txt">{selectedVisitLead.project_name || 'Not specified'}</div>
                </div>
                <div className="bg-bg3 rounded-xl p-3 border border-border/50">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Telecaller</div>
                  <div className="text-sm font-medium text-txt">{selectedVisitLead.assigned_user_name || 'N/A'}</div>
                </div>
                <div className="bg-bg3 rounded-xl p-3 border border-border/50">
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Budget</div>
                  <div className="text-sm font-medium text-txt">{selectedVisitLead.budget ? `₹${Number(selectedVisitLead.budget).toLocaleString()}` : 'N/A'}</div>
                </div>
                {selectedVisitLead.notes && (
                  <div className="bg-bg3 rounded-xl p-3 border border-border/50 col-span-2">
                    <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-1">Telecaller Notes</div>
                    <div className="text-xs text-txt2 leading-relaxed">{selectedVisitLead.notes}</div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmitVisit} className="space-y-4 pt-2 border-t border-border">
                <div className="text-[10px] font-bold text-txt3 uppercase tracking-widest mb-2 px-1">Log Site Visit Report</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { val:'interested', label:'Interested', color:'border-success/40 bg-success/5 text-success hover:bg-success/10', icon: CheckCircle },
                    { val:'won', label:'Closed (WON)', color:'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10', icon: Trophy },
                    { val:'not_interested', label:'Not Interested', color:'border-danger/40 bg-danger/5 text-danger hover:bg-danger/10', icon: XCircle },
                  ].map(o => (
                    <button key={o.val} type="button" onClick={() => setVisitOutcome(o.val)}
                      className={clsx(
                        'flex flex-col items-center justify-center py-4 rounded-2xl border text-[10px] font-bold uppercase tracking-tight transition-all',
                        visitOutcome === o.val ? o.color + ' ring-1 ring-offset-2 ring-current' : 'border-border bg-bg3 text-txt3 hover:border-border2'
                      )}>
                      <o.icon size={16} className="mb-2"/>{o.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5 mt-4">
                  <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Observation Notes</label>
                  <textarea required value={visitNotes} onChange={e => setVisitNotes(e.target.value)}
                    placeholder="Describe the visit outcome, client interest level, and any concerns…"
                    className="input w-full min-h-[100px] bg-bg3 border-border/50 focus:border-primary resize-none text-sm p-4 rounded-2xl"/>
                </div>
                <button type="submit" disabled={!visitOutcome || visitSubmitting}
                  className="btn-primary w-full justify-center py-3.5 shadow-lg shadow-primary/20 mt-4">
                  {visitSubmitting ? <RefreshCw className="animate-spin" size={16}/> : <><MapPin size={16} /> Submit Visit Report</>}
                </button>
              </form>
            </div>
          ) : (
            <div className="card p-16 flex flex-col items-center justify-center text-center h-[600px] border-dashed border-2 border-border/50 bg-bg2/10 rounded-[32px]">
              <div className="w-20 h-20 rounded-3xl bg-bg3 flex items-center justify-center mb-6 text-txt3 shadow-inner -rotate-6">
                <MapPin size={40} className="opacity-10" />
              </div>
              <div className="text-txt font-bold text-lg mb-2">Select a Pending Visit</div>
              <div className="text-txt3 text-xs max-w-[220px] leading-relaxed">
                Select a lead from the list to view details and file your site visit report.
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
