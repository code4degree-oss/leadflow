import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, MiniAreaChart, DonutChart, SectionHeader, StatusBadge, ProgressBar, LeadRow } from '../../components/UI'
import { Phone, Users, TrendingUp, Upload, AlertTriangle, Flame, Clock, Target, RefreshCw, Trash2, Eye, Filter, Download, ArrowRight } from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'
import clsx from 'clsx'
import Link from 'next/link'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/leads/stats/')
      setStats(data)
      setRecentLeads(data.recent_activity || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const statusColors = {
    'NEW': '#7C3AED',
    'IN_PROGRESS': '#9333EA',
    'INTERESTED': '#10B981',
    'WON': '#059669',
    'LOST': '#EF4444',
    'STALE': '#F59E0B',
    'NOT_ANSWERED': '#64748B'
  }

  const funnelData = stats ? Object.entries(stats.status_counts).map(([name, value]) => ({
    name,
    value,
    color: statusColors[name] || 'var(--border2)'
  })) : []

  return (
    <Layout role="admin" pageTitle="Admin Dashboard"
      actions={
        <Link href="/admin/upload" className="btn-primary shadow-lg shadow-primary/20">
          <Upload size={14}/>Upload Leads
        </Link>
      }>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Leads" value={stats?.total_leads || 0} sub="across all sources" color="accent" icon={Users} trend={0} />
        <StatCard label="Success Rate" value={`${stats?.conversion_rate || 0}%`} sub="leads to won" color="green" icon={TrendingUp} trend={0} />
        <StatCard label="Hot Leads" value={recentLeads.filter(l => l.is_hot).length} sub="ready to close" color="orange" icon={Flame} trend={0} />
        <StatCard label="Active Queue" value={stats?.status_counts?.IN_PROGRESS || 0} sub="currently calling" color="purple" icon={Phone} trend={0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Lead funnel */}
        <div className="card p-5 shadow-xl border-border/50">
          <SectionHeader title="Lead Distribution" sub="Current status breakdown" />
          <div className="flex justify-center py-2">
             <DonutChart data={funnelData} height={140} />
          </div>
          <div className="space-y-2 mt-4">
            {funnelData.filter(d => d.value > 0).map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs group">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full shadow-sm" style={{background: d.color}}/>
                   <span className="text-txt3 font-bold group-hover:text-txt transition-colors">{d.name.replace(/_/g, ' ')}</span>
                </div>
                <span className="font-mono text-txt font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Global Recent Activity */}
        <div className="card p-5 lg:col-span-2 shadow-xl border-border/50">
          <SectionHeader title="Recent Activity Feed" sub="Latest updates from your team">
            <button onClick={fetchStats} className="p-1.5 text-txt3 hover:text-primary transition-all">
              <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
            </button>
          </SectionHeader>
          
          <div className="mt-4 space-y-3">
            {loading && !stats ? (
              <div className="py-20 text-center"><RefreshCw className="animate-spin text-primary mx-auto" size={24}/></div>
            ) : recentLeads.length === 0 ? (
              <div className="py-10 text-center text-txt3 uppercase tracking-widest text-[10px] font-bold">No recent activity detected</div>
            ) : (
              recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 bg-bg2/50 rounded-xl border border-border/50 hover:border-primary/20 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-bold font-display">
                      {lead.first_name[0]}{lead.last_name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-txt group-hover:text-primary transition-colors">{lead.first_name} {lead.last_name}</span>
                         <StatusBadge status={lead.status} />
                      </div>
                      <div className="text-[10px] text-txt3 font-mono">Assigned to: {lead.assigned_to_email || 'Unassigned'} • From {lead.source}</div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                     <span className="text-[10px] text-txt3 font-bold uppercase tracking-tight">{new Date(lead.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                     <Link href={`/admin/leads?id=${lead.id}`} className="p-1.5 hover:bg-bg3 rounded text-txt3 hover:text-primary transition-all">
                       <Eye size={12} />
                     </Link>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-6 flex justify-center">
             <Link href="/admin/leads" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-2">
                View Full Pipeline <ArrowRight size={10} />
             </Link>
          </div>
        </div>
      </div>

      {/* Phase 11: Advanced Analytics Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Source Performance */}
        <div className="card p-5 shadow-xl border-border/50">
          <SectionHeader title="Source Performance" sub="Conversion rate by lead channel" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-txt3 uppercase tracking-widest font-bold border-b border-border">
                <tr>
                  <th className="text-left pb-2">Source</th>
                  <th className="text-right pb-2">Count</th>
                  <th className="text-right pb-2">Conv. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats?.source_performance?.map((s) => (
                  <tr key={s.source} className="hover:bg-bg2/30 transition-colors">
                    <td className="py-3 font-semibold text-txt capitalize">{s.source.toLowerCase()}</td>
                    <td className="py-3 text-right font-mono text-txt3">{s.count}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2 text-txt font-bold">
                        {s.conversion_rate}%
                        <div className="w-12 h-1 bg-bg3 rounded-full overflow-hidden hidden md:block">
                           <div className="h-full bg-primary" style={{width: `${s.conversion_rate}%`}} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team Leaderboard */}
        <div className="card p-5 shadow-xl border-border/50">
          <SectionHeader title="Team Leaderboard" sub="Performance across the sales team" />
          <div className="mt-4 space-y-4">
            {stats?.team_performance?.length === 0 ? (
               <div className="py-10 text-center text-txt3 text-xs opacity-50 uppercase tracking-widest font-bold">No representative data yet</div>
            ) : (
              stats?.team_performance?.sort((a,b) => b.won - a.won).map((member, i) => (
                <div key={member.user} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border shadow-sm transition-all",
                      i === 0 ? "bg-amber/10 border-amber/30 text-amber scale-110" : "bg-bg3 border-border text-txt3"
                    )}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-txt group-hover:text-primary transition-colors">{member.user}</div>
                      <div className="text-[10px] text-txt3 font-mono">{member.total} Leads • {member.won} Won</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-txt">{member.conversion}%</div>
                    <div className="text-[9px] text-txt3 uppercase tracking-tighter font-bold">Conversion</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Insights Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 bg-amber/5 border-amber/20 flex gap-4 items-start shadow-lg shadow-amber/5">
          <div className="p-3 bg-amber/10 rounded-2xl text-amber">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-txt mb-1">Deduplication Pending</h4>
            <p className="text-xs text-txt3 leading-relaxed mb-3">3 leads were flagged as potential duplicates from the latest offline batch. Review before assignment.</p>
            <Link href="/admin/leads?tab=duplicate" className="btn-ghost py-1.5 px-3 text-[10px] border-amber/20 hover:bg-amber/10 text-amber font-bold uppercase">Resolve Now</Link>
          </div>
        </div>

        <div className="card p-4 bg-red/5 border-red/20 flex gap-4 items-start shadow-lg shadow-red/5">
           <div className="p-3 bg-red/10 rounded-2xl text-danger">
              <Clock size={24} />
           </div>
           <div>
             <h4 className="text-sm font-bold text-txt mb-1">Aged Leads Alert</h4>
             <p className="text-xs text-txt3 leading-relaxed mb-3">7 leads have been in "Called" status for over 48 hours without progress. Manual intervention recommended.</p>
             <Link href="/admin/leads?tab=aged" className="btn-ghost py-1.5 px-3 text-[10px] border-red/20 hover:bg-red/10 text-danger font-bold uppercase">Reassign Queue</Link>
           </div>
        </div>
      </div>
    </Layout>
  )
}
