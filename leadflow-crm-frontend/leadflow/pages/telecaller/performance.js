import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, SectionHeader, ProgressBar } from '../../components/UI'
import { Target, Trophy, Phone, TrendingUp, Calendar, Clock, Loader2 } from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: 'var(--txt)' },
  labelStyle: { color: 'var(--txt2)' },
}

const OUTCOME_COLORS = {
  'WON': '#10B981',
  'CALLED': '#8247E5',
  'INTERESTED': '#00D4AA',
  'NOT_ANSWERED': '#F59E0B',
  'CALLBACK': '#F5A623',
  'LOST': '#EF4444',
  'NEW': '#3B82F6',
  'INVALID_NUMBER': '#6B7280',
  'UNKNOWN': '#6B7280'
}

export default function TelecallerPerformance() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    stats: null,
    target: null,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, targetRes] = await Promise.all([
        fetchWithAuth('/leads/stats/'),
        fetchWithAuth('/leads/daily-target/')
      ])
      setData({ stats: statsRes, target: targetRes })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout role="telecaller" pageTitle="My Performance">
        <div className="flex h-[60vh] items-center justify-center flex-col text-txt2">
          <Loader2 size={32} className="animate-spin text-accent mb-4" />
          <p className="text-sm font-medium">Gathering your metrics...</p>
        </div>
      </Layout>
    )
  }

  const { stats, target } = data

  const progress = target?.target > 0 ? Math.min((target.progress / target.target) * 100, 100) : 0

  const pieData = Object.keys(stats?.status_counts || {})
    .map(key => ({ name: key, value: stats.status_counts[key] }))
    .filter(item => item.value > 0)

  return (
    <Layout 
      role="telecaller" 
      pageTitle="My Performance" 
      actions={
        <button onClick={fetchData} className="btn-ghost text-xs hidden md:flex items-center gap-1">
          <Clock size={13}/> Refresh Data
        </button>
      }
    >
      
      {/* Target Progress */}
      <div className="card p-6 mb-6 bg-gradient-to-br from-bg2/50 to-card border-accent/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-txt flex items-center gap-2 mb-1">
              <Target size={20} className="text-accent" />
              Daily Calling Target
            </h2>
            <p className="text-sm text-txt3 mb-4">You have made {target?.progress || 0} calls out of your {target?.target || 0} target today.</p>
            <div className="flex justify-between items-end mb-2">
               <span className="text-2xl font-mono font-bold text-accent">{target?.progress || 0}</span>
               <span className="text-sm font-medium text-txt3">Target: {target?.target || 0}</span>
            </div>
            <ProgressBar value={target?.progress || 0} max={target?.target || 1} height={8} color={progress >= 100 ? '#10B981' : '#8247E5'} />
            {progress >= 100 && (
              <p className="text-xs font-bold text-[#10B981] mt-3 flex items-center gap-1">
                <Trophy size={14} /> Amazing! You reached your daily target!
              </p>
            )}
          </div>
          <div className="w-full md:w-auto flex gap-3 shrink-0">
             <div className="bg-bg3/50 rounded-xl p-4 flex-1 md:w-32 text-center border border-border">
               <div className="text-xs text-txt3 font-medium uppercase tracking-wider mb-1">Calls Today</div>
               <div className="text-2xl font-mono font-bold text-txt">{stats?.calls_today || 0}</div>
             </div>
             <div className="bg-bg3/50 rounded-xl p-4 flex-1 md:w-32 text-center border border-border">
               <div className="text-xs text-txt3 font-medium uppercase tracking-wider mb-1">Won Overall</div>
               <div className="text-2xl font-mono font-bold text-[#10B981]">{stats?.status_counts?.WON || 0}</div>
             </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Leads" value={stats?.total_leads || 0} sub="assigned to you" color="purple" icon={Phone} />
        <StatCard label="Interested" value={stats?.status_counts?.INTERESTED || 0} sub="warm leads" color="amber" icon={TrendingUp} />
        <StatCard label="Site Visits" value={stats?.status_counts?.SITE_VISIT || 0} sub="scheduled" color="green" icon={Calendar} />
        <StatCard label="Conversion Rate" value={`${stats?.conversion_rate || 0}%`} sub="won / total" color="accent" icon={Trophy} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status Breakdown Chart */}
        <div className="card p-5">
          <SectionHeader title="My Lead Funnel" sub="Current status of your assigned leads" />
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[250px] text-txt3 bg-bg2/40 rounded-xl mt-4">
              <Phone size={24} className="mb-2 opacity-50" />
              <p className="text-xs">No leads to display</p>
            </div>
          ) : (
            <div className="h-[280px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [value, name]} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 20 }} />
                  <Pie
                    data={pieData}
                    cx="50%" cy="45%"
                    innerRadius={70} outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[entry.name] || OUTCOME_COLORS['UNKNOWN']} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Source Performance */}
        <div className="card p-0 flex flex-col h-[355px]">
          <div className="p-5 pb-4 border-b border-border bg-bg2/30">
             <SectionHeader title="Lead Sources" sub="Where your won leads are coming from" />
          </div>
          <div className="p-5 flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="border-b border-border/50 text-left">
                <tr>
                  <th className="pb-2 text-[10px] font-bold text-txt3 uppercase tracking-wider">Source</th>
                  <th className="pb-2 text-[10px] font-bold text-txt3 uppercase tracking-wider text-right">Leads</th>
                  <th className="pb-2 text-[10px] font-bold text-txt3 uppercase tracking-wider text-right">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats?.source_performance?.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-xs text-txt3">No data available</td>
                  </tr>
                ) : (
                  stats?.source_performance?.map(s => (
                    <tr key={s.source}>
                      <td className="py-3 text-sm font-bold text-txt capitalize">{s.source}</td>
                      <td className="py-3 text-sm font-mono text-txt2 text-right">{s.count}</td>
                      <td className="py-3 text-sm font-mono font-bold text-right text-accent">{s.conversion_rate}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </Layout>
  )
}
