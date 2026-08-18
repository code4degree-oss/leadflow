import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, MiniAreaChart, DonutChart, SectionHeader, StatusBadge, ProgressBar, LeadRow } from '../../components/UI'
import { Phone, Users, TrendingUp, Upload, AlertTriangle, Flame, Clock, Target, RefreshCw, Trash2, Eye, Filter, Download, ArrowRight } from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/router'
import QuickSearch from '../../components/QuickSearch'

export default function AdminDashboard() {
  const router = useRouter()
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
        <StatCard label="Total Leads" value={loading ? '—' : (stats?.total_leads || 0)} sub="across all sources" color="accent" icon={Users} trend={0} />
        <StatCard label="Success Rate" value={loading ? '—' : `${stats?.conversion_rate || 0}%`} sub="leads to won" color="green" icon={TrendingUp} trend={0} />
        <StatCard label="Hot Leads" value={loading ? '—' : recentLeads.filter(l => l.is_hot).length} sub="ready to close" color="orange" icon={Flame} trend={0} />
        <StatCard label="Active Queue" value={loading ? '—' : (stats?.status_counts?.IN_PROGRESS || 0)} sub="currently calling" color="purple" icon={Phone} trend={0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Lead funnel */}
        <div className="accent-card p-6 border-border/50">
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
        <div className="accent-card p-6 lg:col-span-2 border-border/50">
          <SectionHeader title="Recent Activity Feed" sub="Latest updates from your team">
            <button onClick={fetchStats} className="p-1.5 text-txt3 hover:text-primary transition-all">
              <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
            </button>
          </SectionHeader>
          
          <div className="mt-4 space-y-3">
            {loading && !stats ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-bg2/50 rounded-xl border border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="skeleton skeleton-avatar" />
                    <div className="space-y-1.5">
                      <div className="skeleton skeleton-text w-32" />
                      <div className="skeleton skeleton-text w-48" style={{ height: 10 }} />
                    </div>
                  </div>
                  <div className="skeleton skeleton-text w-10" />
                </div>
              ))
            ) : recentLeads.length === 0 ? (
              <div className="py-10 text-center text-txt3 uppercase tracking-widest text-[10px] font-bold">No recent activity detected</div>
            ) : (
              recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 bg-bg2/50 rounded-xl border border-border/50 hover:border-primary/20 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-bold font-display">
                      {lead.first_name?.[0] || '?'}{lead.last_name?.[0] || ''}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-txt group-hover:text-primary transition-colors">{lead.first_name} {lead.last_name}</span>
                         <StatusBadge status={lead.status?.toLowerCase() || 'new'} />
                      </div>
                      <div className="text-[10px] text-txt3 font-mono">Assigned to: {lead.assigned_to_email || 'Unassigned'} • From {lead.source || 'Unknown'}</div>
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

      </div>

      {/* Quick Insights Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="accent-card p-5 border-amber/20 flex gap-4 items-start shadow-sm shadow-amber/5 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-amber opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="p-3 bg-amber/10 rounded-2xl text-amber shrink-0 relative z-10">
            <AlertTriangle size={20} />
          </div>
          <div className="relative z-10">
            <h4 className="text-sm font-bold text-txt mb-1">Deduplication Pending</h4>
            <p className="text-xs text-txt3 leading-relaxed mb-3 pr-4">3 leads were flagged as potential duplicates from the latest offline batch. Review before assignment.</p>
            <Link href="/admin/leads?tab=duplicate" className="btn-ghost py-1.5 px-3 text-[10px] border-amber/20 hover:bg-amber/10 text-amber font-bold uppercase tracking-wider rounded-lg">Resolve Now</Link>
          </div>
        </div>

        <div className="accent-card p-5 border-red/20 flex gap-4 items-start shadow-sm shadow-red/5 relative overflow-hidden group">
           <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-danger opacity-5 group-hover:opacity-10 transition-opacity" />
           <div className="p-3 bg-danger/10 rounded-2xl text-danger shrink-0 relative z-10">
              <Clock size={20} />
           </div>
           <div className="relative z-10">
             <h4 className="text-sm font-bold text-txt mb-1">Aged Leads Alert</h4>
             <p className="text-xs text-txt3 leading-relaxed mb-3 pr-4">7 leads have been in "Called" status for over 48 hours without progress. Manual intervention recommended.</p>
             <Link href="/admin/leads?tab=aged" className="btn-ghost py-1.5 px-3 text-[10px] border-danger/20 hover:bg-danger/10 text-danger font-bold uppercase tracking-wider rounded-lg">Reassign Queue</Link>
           </div>
        </div>
      </div>
      <QuickSearch onSelectLead={(lead) => router.push(`/admin/leads?detail=${lead.id}`)} />
    </Layout>
  )
}
