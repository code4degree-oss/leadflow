import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { SectionHeader, StatusBadge, StatCard } from '../../components/UI'
import { MapPin, CheckCircle, Clock, RefreshCw, Phone, Building2, User, Calendar, Eye, XCircle, Filter } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

export default function AdminSiteVisits() {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('completed') // 'completed' | 'scheduled' | 'all'
  const [selectedVisit, setSelectedVisit] = useState(null)
  
  const [dateFilter, setDateFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [projects, setProjects] = useState([])
  const [agents, setAgents] = useState([])

  useEffect(() => {
    fetchWithAuth('/leads/projects/').then(res => setProjects(res || []))
    fetchWithAuth('/accounts/employees/').then(res => {
      const all = res.results || res || []
      setAgents(all.filter(e => e.role === 'FIELD_AGENT'))
    })
  }, [])

  useEffect(() => {
    fetchVisits()
  }, [tab])

  const fetchVisits = async () => {
    setLoading(true)
    try {
      let endpoint = tab === 'all' ? '/visits/' : `/visits/?status=${tab.toUpperCase()}`
      if (dateFilter) endpoint += (endpoint.includes('?') ? '&' : '?') + `date=${dateFilter}`
      if (agentFilter) endpoint += (endpoint.includes('?') ? '&' : '?') + `agent_id=${agentFilter}`
      if (projectFilter) endpoint += (endpoint.includes('?') ? '&' : '?') + `project_id=${projectFilter}`
      
      const data = await fetchWithAuth(endpoint)
      setVisits(data.results || data || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const completedCount = visits.filter(v => v.status === 'COMPLETED').length
  const scheduledCount = visits.filter(v => v.status === 'SCHEDULED').length
  const wonCount = visits.filter(v => v.outcome?.toUpperCase() === 'WON').length
  const interestedCount = visits.filter(v => v.outcome?.toUpperCase() === 'INTERESTED').length

  const getOutcomeStyle = (outcome) => {
    const o = (outcome || '').toUpperCase()
    if (o === 'WON') return 'bg-success/10 text-success border-success/20'
    if (o === 'INTERESTED') return 'bg-primary/10 text-primary border-primary/20'
    if (o === 'LOST' || o === 'NOT_INTERESTED') return 'bg-danger/10 text-danger border-danger/20'
    return 'bg-bg3 text-txt3 border-border'
  }

  return (
    <Layout role="admin" pageTitle="Site Visits">

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Visits" value={visits.length} sub="all time" color="accent" icon={MapPin} />
        <StatCard label="Won" value={wonCount} sub="from site visits" color="green" icon={CheckCircle} />
        <StatCard label="Interested" value={interestedCount} sub="follow up needed" color="purple" icon={Eye} />
        <StatCard label="Pending" value={scheduledCount} sub="upcoming visits" color="amber" icon={Clock} />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'completed', label: 'Completed' },
          { key: 'scheduled', label: 'Scheduled / Pending' },
          { key: 'all', label: 'All Visits' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedVisit(null) }}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border',
              tab === t.key
                ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                : 'bg-bg2 border-border text-txt3 hover:border-primary/20'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-card border border-border rounded-2xl shadow-sm">
        <div className="flex-1 flex gap-3 flex-wrap">
          <input 
            type="date" 
            value={dateFilter} 
            onChange={e => setDateFilter(e.target.value)}
            className="input max-w-[180px] h-10 text-sm bg-bg3 text-txt"
          />
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className="input min-w-[180px] h-10 text-sm bg-bg3 text-txt">
            <option value="">All Field Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
          </select>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="input min-w-[180px] h-10 text-sm bg-bg3 text-txt">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button onClick={fetchVisits} className="px-6 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors">
          Apply Filters
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-xs text-danger font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Visit List */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden shadow-lg border-border/50">
            <div className="px-4 py-3 border-b border-border bg-bg2/30 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />
                <span className="text-[10px] font-bold text-txt3 uppercase tracking-widest">
                  {tab === 'completed' ? 'Completed Visits' : tab === 'scheduled' ? 'Upcoming Visits' : 'All Site Visits'} — {visits.length}
                </span>
              </div>
              <button onClick={fetchVisits} className="p-1 hover:text-primary transition-colors">
                <RefreshCw size={12} className={clsx(loading && "animate-spin")} />
              </button>
            </div>

            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="py-20 text-center">
                  <RefreshCw className="animate-spin mx-auto text-primary" size={24}/>
                </div>
              ) : visits.length === 0 ? (
                <div className="p-10 text-center text-xs text-txt3 uppercase font-bold tracking-widest opacity-50">
                  No {tab === 'completed' ? 'completed' : tab === 'scheduled' ? 'scheduled' : ''} visits found
                </div>
              ) : (
                visits.map(visit => (
                  <div
                    key={visit.id}
                    onClick={() => setSelectedVisit(visit)}
                    className={clsx(
                      'px-4 py-4 cursor-pointer hover:bg-bg2/50 transition-all border-l-4 group',
                      selectedVisit?.id === visit.id ? 'bg-primary/5 border-primary shadow-inner' : 'border-transparent'
                    )}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div>
                        <div className="text-sm font-bold text-txt group-hover:text-primary transition-colors">
                          {visit.lead_name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[10px] text-txt3 font-mono">
                            <Phone size={9}/> {visit.lead_phone}
                          </span>
                          {visit.project_name && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-bold">
                              <Building2 size={9}/> {visit.project_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={clsx(
                        'text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border',
                        visit.status === 'COMPLETED' ? getOutcomeStyle(visit.outcome) : 'bg-amber/10 text-amber border-amber/20'
                      )}>
                        {visit.status === 'COMPLETED' ? (visit.outcome || 'Done') : 'Scheduled'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-txt3 font-mono">
                      <span className="flex items-center gap-1">
                        <User size={9}/> Agent: {visit.agent_name || 'N/A'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User size={9}/> TC: {visit.telecaller_name || 'N/A'}
                      </span>
                      <span>•</span>
                      <span>{new Date(visit.completed_at || visit.scheduled_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selectedVisit ? (
            <div className="card p-6 shadow-xl border-primary/10 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <MapPin size={20}/>
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-txt leading-none">{selectedVisit.lead_name}</h3>
                  <div className="text-[10px] text-txt3 font-mono uppercase">Visit #{selectedVisit.id.substring(0,8)}</div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="bg-bg3 rounded-xl p-3 border border-border/50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-txt3 uppercase">Status</span>
                  <span className={clsx(
                    'text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border',
                    selectedVisit.status === 'COMPLETED' ? getOutcomeStyle(selectedVisit.outcome) : 'bg-amber/10 text-amber border-amber/20'
                  )}>
                    {selectedVisit.status}
                  </span>
                </div>

                {selectedVisit.outcome && (
                  <div className="bg-bg3 rounded-xl p-3 border border-border/50 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-txt3 uppercase">Outcome</span>
                    <span className={clsx(
                      'text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border',
                      getOutcomeStyle(selectedVisit.outcome)
                    )}>
                      {selectedVisit.outcome}
                    </span>
                  </div>
                )}

                <div className="bg-bg3 rounded-xl p-3 border border-border/50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-txt3 uppercase">Phone</span>
                  <span className="text-xs font-mono text-txt font-bold">{selectedVisit.lead_phone}</span>
                </div>

                <div className="bg-bg3 rounded-xl p-3 border border-border/50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-txt3 uppercase">Project</span>
                  <span className="text-xs text-txt font-bold">{selectedVisit.project_name || 'N/A'}</span>
                </div>

                <div className="bg-bg3 rounded-xl p-3 border border-border/50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-txt3 uppercase">Field Agent</span>
                  <span className="text-xs text-txt font-bold">{selectedVisit.agent_name || 'N/A'}</span>
                </div>

                <div className="bg-bg3 rounded-xl p-3 border border-border/50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-txt3 uppercase">Telecaller</span>
                  <span className="text-xs text-txt font-bold">{selectedVisit.telecaller_name || 'N/A'}</span>
                </div>

                <div className="bg-bg3 rounded-xl p-3 border border-border/50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-txt3 uppercase">
                    {selectedVisit.status === 'COMPLETED' ? 'Completed At' : 'Scheduled At'}
                  </span>
                  <span className="text-xs font-mono text-txt">
                    {new Date(selectedVisit.completed_at || selectedVisit.scheduled_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedVisit.notes && (
                <div>
                  <div className="text-[9px] font-bold text-txt3 uppercase tracking-widest mb-2">Agent Notes</div>
                  <div className="bg-bg3 rounded-xl p-4 border border-border/50 text-xs text-txt2 leading-relaxed">
                    {selectedVisit.notes}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-12 flex flex-col items-center justify-center text-center h-[400px] border-dashed border-2 border-border/50 bg-bg2/10 rounded-[32px]">
              <div className="w-16 h-16 rounded-3xl bg-bg3 flex items-center justify-center mb-4 text-txt3 shadow-inner">
                <MapPin size={32} className="opacity-10"/>
              </div>
              <div className="text-txt font-bold text-lg mb-2">Visit Details</div>
              <div className="text-txt3 text-xs max-w-[200px] leading-relaxed">
                Select a visit from the list to view full details, agent notes, and outcome.
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
