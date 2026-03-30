import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, SectionHeader, ProgressBar } from '../../components/UI'
import { BarChart2, TrendingUp, Phone, CheckCircle, Calendar, Download, Loader2, Trophy, Clock, X, AlertCircle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fetchWithAuth } from '../../utils/api'
import clsx from 'clsx'

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
  'UNKNOWN': '#6B7280'
}

export default function Performance() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    kpis: {},
    outcome_breakdown: [],
    activity_stream: [],
    team_performance: [],
    target_telecaller: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetchWithAuth('/leads/performance-report/')
      setData({
        kpis: res.kpis || {},
        outcome_breakdown: res.outcome_breakdown || [],
        activity_stream: res.activity_stream || [],
        team_performance: res.team_performance || [],
        target_telecaller: res.target_telecaller || 50
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout role="admin" pageTitle="Live Team Performance">
        <div className="flex h-[60vh] items-center justify-center flex-col text-txt2">
          <Loader2 size={32} className="animate-spin text-accent mb-4" />
          <p className="text-sm font-medium">Gathering live performance metrics...</p>
        </div>
      </Layout>
    )
  }

  const { kpis, outcome_breakdown, activity_stream, team_performance } = data

  return (
    <Layout role="admin" pageTitle="Live Team Performance"
      actions={<button onClick={fetchData} className="btn-ghost text-xs"><Clock size={13}/>Refesh Data</button>}>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Calls Logged" value={kpis.total_calls_today || 0} sub="across all employees today" color="accent" icon={Phone} />
        <StatCard label="Leads Won" value={kpis.leads_won_month || 0} sub="this month overall" color="green" icon={TrendingUp} />
        <StatCard label="Site Visits" value={kpis.site_visits_month || 0} sub="scheduled this month" color="amber" icon={Calendar} />
        <StatCard label="Conversion Rate" value={`${kpis.conversion_rate || 0}%`} sub="won / total leads" color="purple" icon={BarChart2} />
      </div>

      {/* Widgets Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Outcome Breakdown (Chart) */}
        <div className="card p-5">
          <SectionHeader title="Today's Call Outcomes" sub="Quality of interactions today" />
          {outcome_breakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-txt3 bg-bg2/40 rounded-xl mt-4">
              <Phone size={24} className="mb-2 opacity-50" />
              <p className="text-xs">No calls logged today yet</p>
            </div>
          ) : (
            <div className="h-[220px] mt-2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [value, name]} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                  <Pie
                    data={outcome_breakdown}
                    cx="50%" cy="45%"
                    innerRadius={50} outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {outcome_breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[entry.name] || OUTCOME_COLORS['UNKNOWN']} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none -mt-4">
                <span className="text-2xl font-bold font-mono text-txt">{kpis.total_calls_today}</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Leaderboard */}
        <div className="card p-5">
          <SectionHeader title="Live Leaderboard" sub="Top callers today" />
          <div className="mt-4 space-y-3">
            {team_performance.length === 0 ? (
               <p className="text-txt3 text-xs text-center py-10">No active employees found</p>
            ) : (
              team_performance.slice(0, 5).map((e, idx) => (
                <div key={e.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-bg2/50 transition-colors">
                  <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm shrink-0",
                    idx === 0 ? "bg-amber text-white ring-2 ring-amber/30" : 
                    idx === 1 ? "bg-slate-300 text-slate-800" :
                    idx === 2 ? "bg-amber-700/50 text-white" : "bg-bg3 text-txt2"
                  )}>
                    {idx < 3 ? <Trophy size={14} /> : `#${idx+1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-txt truncate">{e.name}</div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] text-txt3 capitalize">{e.role.replace('_', ' ')}</span>
                       {e.won_today > 0 && <span className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded-md">+{e.won_today} won today</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold text-accent">{e.calls_today}</div>
                    <div className="text-[9px] text-txt3 uppercase tracking-wider -mt-1">calls</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Activity Stream */}
        <div className="card p-0 flex flex-col h-[330px]">
          <div className="p-5 pb-3 border-b border-border bg-bg2/50 shrink-0 flex justify-between items-center">
             <div>
               <SectionHeader title="Activity Stream" sub="Live pulse of the team" />
             </div>
             <div className="flex h-2 w-2 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
             </div>
          </div>
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {activity_stream.length === 0 ? (
               <p className="text-txt3 text-xs text-center py-10">No recent activity recorded</p>
            ) : (
              activity_stream.map((act) => (
                <div key={act.id} className="flex gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0 opacity-60"></div>
                  <div>
                    <p className="text-txt text-xs font-medium leading-tight">
                       <span className="font-bold text-accent">{act.user}</span> • {act.title}
                    </p>
                    <p className="text-[10px] text-txt3 font-mono mt-0.5">{act.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Team table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-bg2/30">
          <SectionHeader title="Team Matrix" sub="Detailed breakdown for today" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-card">
              <tr>
                {['Employee','Calls Today / Target','Won Today','Lost Today','Site Visits (Today)','Last Login'].map(h => (
                  <th key={h} className="th text-[10px] px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {team_performance.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-txt3 text-sm">No employees found.</td>
                </tr>
              ) : (
                team_performance.map((e) => {
                  const progress = Math.min((e.calls_today / (e.target || 1)) * 100, 100)
                  return (
                    <tr key={e.id} className="table-row group">
                      <td className="td px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold border border-accent/20">
                            {e.name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-txt group-hover:text-accent transition-colors">{e.name}</div>
                            <div className="text-[10px] text-txt3 font-mono capitalize">{e.role.replace('_', ' ')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td px-5">
                        <div className="flex flex-col gap-1 w-32">
                          <div className="flex justify-between items-baseline">
                             <span className="text-sm font-mono font-bold text-txt">{e.calls_today}</span>
                             <span className="text-[10px] text-txt3">/ {e.target}</span>
                          </div>
                          <ProgressBar value={e.calls_today} max={e.target || 1}
                            color={progress>=90 ? '#10B981' : progress>=50 ? '#F5A623' : '#8247E5'} height={4}/>
                        </div>
                      </td>
                      <td className="td px-5">
                         {e.won_today > 0 ? (
                           <span className="inline-flex items-center gap-1 font-mono font-bold text-[#10B981] bg-[#10B981]/10 px-2.5 py-0.5 rounded-full text-xs">
                             <Trophy size={11} /> {e.won_today}
                           </span>
                         ) : <span className="text-txt3 text-sm font-mono">—</span>}
                      </td>
                      <td className="td px-5">
                         {e.lost_today > 0 ? (
                           <span className="inline-flex items-center gap-1 font-mono font-medium text-danger bg-danger/10 px-2 py-0.5 rounded-sm text-xs border border-danger/20">
                             <X size={11} /> {e.lost_today}
                           </span>
                         ) : <span className="text-txt3 text-sm font-mono">—</span>}
                      </td>
                      <td className="td px-5 font-mono text-amber text-sm font-medium">{e.visits_today || <span className="text-txt3">—</span>}</td>
                      <td className="td px-5 text-txt2 text-xs font-mono">{e.last_login}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
