import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, SectionHeader, ProgressBar } from '../../components/UI'
import { Users, TrendingUp, Flame, AlertTriangle, Phone, Clock, Target, RefreshCw, ArrowUpRight, ArrowDownRight, ChevronRight, UserCheck, Loader2, X, CheckCircle } from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'
import clsx from 'clsx'

export default function TeamDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [selectedTc, setSelectedTc] = useState(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [sortBy, setSortBy] = useState('calls_today')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    fetchTeamData()
  }, [])

  const fetchTeamData = async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/leads/team-overview/')
      setData(res)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  const sortedTeam = data?.team ? [...data.team].sort((a, b) => {
    const aVal = a[sortBy] || 0
    const bVal = b[sortBy] || 0
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal
  }) : []

  if (loading) {
    return (
      <Layout role="admin" pageTitle="Team Dashboard">
        <div className="flex h-[60vh] items-center justify-center flex-col text-txt2">
          <Loader2 size={32} className="animate-spin text-accent mb-4" />
          <span className="text-sm font-medium">Loading team data...</span>
        </div>
      </Layout>
    )
  }

  const summary = data?.summary || {}

  return (
    <Layout role="admin" pageTitle="Team Dashboard"
      actions={
        <button onClick={fetchTeamData} className="btn-secondary text-xs">
          <RefreshCw size={13}/> Refresh
        </button>
      }
    >
      {error && (
        <div className="bg-danger/10 text-danger p-4 rounded-xl text-sm font-medium border border-danger/20 flex gap-2 mb-6">
          <AlertTriangle size={16}/> {error}
        </div>
      )}

      {/* ═══ Summary Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Team"
          value={summary.total_telecallers || 0}
          sub="telecallers & agents"
          color="accent"
          icon={Users}
        />
        <StatCard
          label="Calls Today"
          value={summary.total_calls_today || 0}
          sub="team total"
          color="purple"
          icon={Phone}
        />
        <StatCard
          label="Conversion Rate"
          value={`${summary.team_conversion_rate || 0}%`}
          sub="leads to won"
          color="green"
          icon={TrendingUp}
        />
        <StatCard
          label="Needs Attention"
          value={(summary.total_stale || 0) + (summary.total_overdue_followups || 0)}
          sub={`${summary.total_stale || 0} stale · ${summary.total_overdue_followups || 0} overdue`}
          color="orange"
          icon={AlertTriangle}
        />
      </div>

      {/* ═══ Team Grid ═══ */}
      <div className="card overflow-hidden mb-6">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <SectionHeader title="Team Performance" sub="Click a row to view details" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-txt3">{sortedTeam.length} members</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg3/50">
                {[
                  { key: 'name', label: 'Team Member', align: 'left' },
                  { key: 'total_leads', label: 'Total', align: 'center' },
                  { key: 'calls_today', label: 'Calls Today', align: 'center' },
                  { key: 'won_leads', label: 'Won', align: 'center' },
                  { key: 'conversion_rate', label: 'Conv %', align: 'center' },
                  { key: 'hot_leads', label: 'Hot', align: 'center' },
                  { key: 'stale_leads', label: 'Stale', align: 'center' },
                  { key: 'overdue_followups', label: 'Overdue', align: 'center' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={clsx(
                      'px-3 py-2.5 font-semibold text-xs text-txt3 cursor-pointer hover:text-txt transition-colors select-none',
                      col.align === 'center' ? 'text-center' : 'text-left'
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortBy === col.key && (
                        <span className="text-accent text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedTeam.map(tc => {
                const targetPct = tc.daily_target > 0
                  ? Math.min(Math.round((tc.calls_today / tc.daily_target) * 100), 100) : 0

                return (
                  <tr
                    key={tc.id}
                    onClick={() => setSelectedTc(selectedTc?.id === tc.id ? null : tc)}
                    className={clsx(
                      'hover:bg-card2/50 cursor-pointer transition-colors',
                      selectedTc?.id === tc.id && 'bg-accent/5'
                    )}
                  >
                    {/* Name + Progress */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                          {tc.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-txt text-sm truncate">{tc.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-16 h-1.5 bg-border2 rounded-full overflow-hidden">
                              <div
                                className={clsx('h-full rounded-full transition-all', targetPct >= 100 ? 'bg-accent2' : targetPct >= 50 ? 'bg-accent' : 'bg-amber')}
                                style={{ width: `${targetPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-txt3">{targetPct}% of target</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center font-mono text-txt">{tc.total_leads}</td>

                    <td className="px-3 py-3 text-center">
                      <span className={clsx(
                        'font-mono font-bold',
                        tc.calls_today >= tc.daily_target ? 'text-accent2' : tc.calls_today > 0 ? 'text-txt' : 'text-txt3'
                      )}>
                        {tc.calls_today}
                      </span>
                      <span className="text-txt3 text-xs">/{tc.daily_target}</span>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-accent2 font-bold">{tc.won_leads}</span>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <span className={clsx(
                        'font-mono font-medium',
                        tc.conversion_rate >= 10 ? 'text-accent2' : tc.conversion_rate > 0 ? 'text-txt' : 'text-txt3'
                      )}>
                        {tc.conversion_rate}%
                      </span>
                    </td>

                    <td className="px-3 py-3 text-center">
                      {tc.hot_leads > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber font-bold font-mono">
                          <Flame size={12}/> {tc.hot_leads}
                        </span>
                      ) : (
                        <span className="text-txt3 font-mono">0</span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center">
                      {tc.stale_leads > 0 ? (
                        <span className="badge badge-red text-[10px] font-bold">{tc.stale_leads}</span>
                      ) : (
                        <span className="text-txt3 font-mono">0</span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center">
                      {tc.overdue_followups > 0 ? (
                        <span className="badge badge-amber text-[10px] font-bold">{tc.overdue_followups}</span>
                      ) : (
                        <span className="text-txt3 font-mono">0</span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <ChevronRight size={14} className={clsx('text-txt3 transition-transform', selectedTc?.id === tc.id && 'rotate-90 text-accent')} />
                    </td>
                  </tr>
                )
              })}

              {sortedTeam.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-txt3 text-sm">
                    No team members found. Add telecallers from the Employees page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Selected Telecaller Detail Panel ═══ */}
      {selectedTc && (
        <div className="card overflow-hidden mb-6 border-accent/20 animate-in slide-in-from-top-2">
          <div className="p-4 border-b border-border bg-accent/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                {selectedTc.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <h3 className="font-semibold text-txt">{selectedTc.name}</h3>
                <p className="text-xs text-txt3">{selectedTc.email} · {selectedTc.role === 'FIELD_AGENT' ? 'Field Agent' : 'Telecaller'}</p>
              </div>
            </div>
            <button onClick={() => setSelectedTc(null)} className="text-txt3 hover:text-txt p-1">
              <X size={16}/>
            </button>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MiniStat label="Total Leads" value={selectedTc.total_leads} />
              <MiniStat label="New / Untouched" value={selectedTc.new_leads} color={selectedTc.new_leads > 5 ? 'amber' : ''} />
              <MiniStat label="In Progress" value={selectedTc.in_progress} />
              <MiniStat label="Won" value={selectedTc.won_leads} color="green" />
              <MiniStat label="Lost" value={selectedTc.lost_leads} color="red" />
              <MiniStat label="Hot Leads" value={selectedTc.hot_leads} color="amber" />
              <MiniStat label="Calls This Week" value={selectedTc.calls_this_week} />
              <MiniStat label="Site Visits" value={selectedTc.site_visits} />
            </div>

            <div className="flex gap-2 mt-2">
              <a href={`/admin/leads?assigned_to=${selectedTc.id}`}
                className="btn-secondary text-xs flex-1 justify-center">
                <Users size={13}/> View Their Leads
              </a>
              <button className="btn-primary text-xs flex-1 justify-center"
                onClick={() => window.location.href = `/admin/performance`}>
                <Target size={13}/> Full Performance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Lead Health Monitor ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stale Leads Alert */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Clock size={14} className="text-amber" />
            <span className="font-semibold text-sm text-txt">Stale Leads (&gt;48h idle)</span>
            {summary.total_stale > 0 && (
              <span className="badge badge-amber text-[10px] ml-auto">{summary.total_stale}</span>
            )}
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {sortedTeam.filter(tc => tc.stale_leads > 0).length > 0 ? (
              sortedTeam.filter(tc => tc.stale_leads > 0)
                .sort((a, b) => b.stale_leads - a.stale_leads)
                .map(tc => (
                  <div key={tc.id} className="px-4 py-3 flex items-center justify-between hover:bg-card2/30">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber/10 flex items-center justify-center text-amber text-[10px] font-bold">
                        {tc.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span className="text-sm text-txt font-medium">{tc.name}</span>
                    </div>
                    <span className="badge badge-amber text-[10px]">{tc.stale_leads} stale</span>
                  </div>
                ))
            ) : (
              <div className="px-4 py-8 text-center text-txt3 text-sm flex flex-col items-center gap-2">
                <CheckCircle size={20} className="text-accent2" />
                No stale leads — team is on track!
              </div>
            )}
          </div>
        </div>

        {/* Overdue Follow-ups */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <AlertTriangle size={14} className="text-danger" />
            <span className="font-semibold text-sm text-txt">Overdue Follow-ups</span>
            {summary.total_overdue_followups > 0 && (
              <span className="badge badge-red text-[10px] ml-auto">{summary.total_overdue_followups}</span>
            )}
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {sortedTeam.filter(tc => tc.overdue_followups > 0).length > 0 ? (
              sortedTeam.filter(tc => tc.overdue_followups > 0)
                .sort((a, b) => b.overdue_followups - a.overdue_followups)
                .map(tc => (
                  <div key={tc.id} className="px-4 py-3 flex items-center justify-between hover:bg-card2/30">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-danger/10 flex items-center justify-center text-danger text-[10px] font-bold">
                        {tc.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span className="text-sm text-txt font-medium">{tc.name}</span>
                    </div>
                    <span className="badge badge-red text-[10px]">{tc.overdue_followups} overdue</span>
                  </div>
                ))
            ) : (
              <div className="px-4 py-8 text-center text-txt3 text-sm flex flex-col items-center gap-2">
                <CheckCircle size={20} className="text-accent2" />
                All follow-ups are on schedule!
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

function MiniStat({ label, value, color }) {
  const colorMap = {
    green: 'text-accent2',
    red: 'text-danger',
    amber: 'text-amber',
    '': 'text-txt',
  }
  return (
    <div className="bg-bg3 rounded-xl p-3 text-center">
      <div className={clsx('font-display font-bold text-lg', colorMap[color || ''])}>{value}</div>
      <div className="text-[10px] text-txt3 mt-0.5 uppercase tracking-wide font-medium">{label}</div>
    </div>
  )
}
