import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { MiniBarChart, DonutChart, ProgressBar } from '../../components/UI'
import {
  Building2, Users, AlertTriangle, RefreshCw, CheckCircle2,
  TrendingUp, Clock, ChevronRight, Activity, Server, Phone,
  Calendar, ArrowUpRight, Search, Filter, Zap, Eye, Ban
} from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ─── Subscription urgency ───
function getSubStatus(client) {
  if (!client.valid_until) return { label: 'No plan', color: 'text-txt3', urgency: 'none', days: null }
  const days = Math.ceil((new Date(client.valid_until) - new Date()) / 86400000)
  const grace = client.grace_period_days || 7
  if (days < -grace) return { label: `Locked out`, color: 'text-danger', urgency: 'locked', days }
  if (days < 0)  return { label: `Grace: ${grace + days}d left`, color: 'text-danger', urgency: 'grace', days }
  if (days <= 7) return { label: `${days}d left`, color: 'text-amber', urgency: 'warning', days }
  return { label: `${days}d left`, color: 'text-[#10B981]', urgency: 'ok', days }
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | active | attention | suspended

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/superadmin/clients/clients/')
      setClients(data.results || data || [])
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  const handleToggleActive = async (e, client) => {
    e.stopPropagation()
    const action = client.is_active ? 'suspend' : 'reactivate'
    if (!confirm(`Are you sure you want to ${action} "${client.name}"?`)) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${client.id}/`, {
        method: 'PATCH', body: JSON.stringify({ is_active: !client.is_active })
      })
      toast.success(`${client.name} ${client.is_active ? 'suspended' : 'reactivated'}.`)
      fetchClients()
    } catch (err) { toast.error(err.message) }
  }

  // ─── Derived stats ───
  const totalStorage = clients.reduce((acc, c) => acc + (c.storage_quota_mb || 0), 0)
  const totalEmployees = clients.reduce((acc, c) => acc + (c.user_count || 0), 0)
  const totalLeads = clients.reduce((acc, c) => acc + (c.lead_count || 0), 0)
  const activeClients = clients.filter(c => c.is_active)
  const suspendedClients = clients.filter(c => !c.is_active)
  const attentionClients = clients.filter(c => {
    const sub = getSubStatus(c)
    return sub.urgency === 'warning' || sub.urgency === 'grace' || sub.urgency === 'locked'
  })

  // ─── Adoption chart data ───
  const getAdoptionData = () => {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const counts = {}
    monthNames.forEach(m => counts[m] = 0)
    clients.forEach(c => {
      if (c.created_at) {
        const monthIdx = new Date(c.created_at).getMonth()
        counts[monthNames[monthIdx]] = (counts[monthNames[monthIdx]] || 0) + 1
      }
    })
    return monthNames.map(m => ({ name: m, v: counts[m] }))
  }

  // ─── Filtering ───
  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'active') return c.is_active && getSubStatus(c).urgency === 'ok'
    if (filter === 'attention') return attentionClients.includes(c)
    if (filter === 'suspended') return !c.is_active
    return true
  })

  const FILTER_TABS = [
    { key: 'all', label: 'All', count: clients.length },
    { key: 'active', label: 'Healthy', count: activeClients.filter(c => getSubStatus(c).urgency === 'ok').length },
    { key: 'attention', label: 'Needs Attention', count: attentionClients.length },
    { key: 'suspended', label: 'Suspended', count: suspendedClients.length },
  ]

  return (
    <Layout role="superadmin" pageTitle="Platform Overview"
      actions={
        <div className="flex gap-1.5 items-center">
          <button onClick={fetchClients} className="p-2 hover:bg-bg2 rounded-xl transition-all text-txt3 hover:text-txt" title="Refresh">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      }>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 stagger-grid">
        {[
          { icon: Building2, label: 'Organizations', value: clients.length, sub: `${activeClients.length} active`, subColor: 'text-[#10B981]', color: 'accent' },
          { icon: Users, label: 'Platform Users', value: totalEmployees, sub: 'across all tenants', subColor: 'text-txt3', color: 'purple' },
          { icon: Zap, label: 'Total Leads', value: totalLeads.toLocaleString(), sub: 'managed on platform', subColor: 'text-txt3', color: 'amber' },
          { icon: Server, label: 'Storage', value: `${(totalStorage / 1024).toFixed(1)}`, valueSuffix: 'GB', sub: 'allocated quota', subColor: 'text-txt3', color: 'accent2' },
          { icon: attentionClients.length > 0 ? AlertTriangle : CheckCircle2,
            label: 'Attention',
            value: attentionClients.length > 0 ? attentionClients.length : '✓',
            sub: attentionClients.length > 0 ? 'needs review' : 'all healthy',
            subColor: attentionClients.length > 0 ? 'text-danger' : 'text-[#10B981]',
            color: attentionClients.length > 0 ? 'danger' : '[#10B981]',
            alert: attentionClients.length > 0 },
        ].map((card, i) => {
          const Icon = card.icon
          return (
            <div key={i} className={clsx(
              "accent-card p-5 group hover-lift relative overflow-hidden",
              card.alert && "border-danger/20 bg-danger/[0.02]"
            )}>
              <div className={clsx(
                "absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity",
                `bg-${card.color}`
              )} />
              <div className="flex items-center justify-between mb-3">
                <div className={clsx(
                  `w-10 h-10 rounded-xl bg-${card.color}/8 flex items-center justify-center text-${card.color}`,
                  `group-hover:bg-${card.color} group-hover:text-white transition-all duration-300`
                )}>
                  <Icon size={18} />
                </div>
                <span className={clsx("text-[10px] font-bold uppercase tracking-widest", card.subColor)}>
                  {card.sub}
                </span>
              </div>
              <div className="font-display font-extrabold text-3xl text-txt leading-none tracking-tight">
                {card.value}
                {card.valueSuffix && <span className="text-lg text-txt3 font-sans font-medium ml-0.5">{card.valueSuffix}</span>}
              </div>
              <div className="text-xs text-txt3 mt-1.5 font-medium">{card.label}</div>
            </div>
          )
        })}
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Client Growth Chart */}
        <div className="accent-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-txt flex items-center gap-2">
                <TrendingUp size={14} className="text-accent" />
                Client Onboarding
              </h3>
              <p className="text-[11px] text-txt3 mt-0.5">New organizations registered by month</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-accent bg-accent/8 px-2.5 py-1 rounded-lg">
              {clients.length} total
            </span>
          </div>
          <MiniBarChart data={getAdoptionData()} height={140} />
        </div>

        {/* Tenant Health Donut */}
        <div className="accent-card p-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-txt flex items-center gap-2">
              <Activity size={14} className="text-purple" />
              Tenant Health
            </h3>
            <p className="text-[11px] text-txt3 mt-0.5">Status breakdown</p>
          </div>
          <div className="flex justify-center">
            <DonutChart data={[
              { name: 'Active', value: activeClients.length },
              { name: 'Attention', value: attentionClients.length },
              { name: 'Suspended', value: suspendedClients.length },
            ]} height={130} />
          </div>
          <div className="space-y-2 mt-5">
            {[
              { label: 'Active', count: activeClients.length, dot: 'bg-[#10B981]', bg: 'bg-[#10B981]/5 border-[#10B981]/10' },
              { label: 'Needs Attention', count: attentionClients.length, dot: 'bg-amber', bg: 'bg-amber/5 border-amber/10' },
              { label: 'Suspended', count: suspendedClients.length, dot: 'bg-danger', bg: 'bg-danger/5 border-danger/10' },
            ].map(item => (
              <div key={item.label} className={clsx("flex items-center justify-between px-3 py-2 rounded-xl border", item.bg)}>
                <div className="flex items-center gap-2.5">
                  <div className={clsx("w-2 h-2 rounded-full", item.dot)} />
                  <span className="text-[11px] font-semibold text-txt">{item.label}</span>
                </div>
                <span className="text-xs font-mono font-bold text-txt2">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Attention Alerts (only if there are issues) ═══ */}
      {attentionClients.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-danger" />
            <h3 className="text-sm font-bold text-txt">Requires Attention</h3>
            <span className="text-[10px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">{attentionClients.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attentionClients.slice(0, 6).map(c => {
              const sub = getSubStatus(c)
              return (
                <div key={c.id}
                  onClick={() => router.push(`/superadmin/clients/view/${c.id}`)}
                  className={clsx(
                    "accent-card p-4 cursor-pointer hover-lift group border-l-4",
                    sub.urgency === 'locked' ? "border-l-danger" : sub.urgency === 'grace' ? "border-l-danger" : "border-l-amber"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger text-sm font-bold">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-txt group-hover:text-accent transition-colors">{c.name}</div>
                        <div className="text-[10px] text-txt3 font-mono">{c.user_count} users · {c.lead_count || 0} leads</div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-txt3 group-hover:text-accent transition-colors" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-md", sub.color,
                      sub.urgency === 'locked' ? 'bg-danger/10' : sub.urgency === 'grace' ? 'bg-danger/10' : 'bg-amber/10'
                    )}>
                      {sub.label}
                    </span>
                    {c.valid_until && (
                      <span className="text-[10px] text-txt3 font-mono flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(c.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ Company Directory ═══ */}
      <div className="accent-card overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/8 flex items-center justify-center text-accent">
                <Building2 size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-txt">Company Directory</h2>
                <p className="text-[11px] text-txt3 mt-0.5">{clients.length} organizations · {totalEmployees} users · {totalLeads.toLocaleString()} leads</p>
              </div>
            </div>
            <button onClick={() => router.push('/superadmin/clients/new')}
              className="btn-primary text-xs shadow-sm shadow-accent/10 hover:shadow-md hover:shadow-accent/15 transition-all">
              + Add Organization
            </button>
          </div>

          {/* Search + Filter Tabs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9 h-9 text-xs bg-bg2 border-border/50 focus:border-accent w-full"
                placeholder="Search companies…"
              />
            </div>
            <div className="flex gap-1 bg-bg2 rounded-xl p-1 border border-border/50">
              {FILTER_TABS.map(tab => (
                <button key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                    filter === tab.key
                      ? "bg-accent text-white shadow-sm"
                      : "text-txt3 hover:text-txt hover:bg-bg3"
                  )}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={clsx(
                      "ml-1.5 px-1.5 py-0.5 rounded text-[9px]",
                      filter === tab.key ? "bg-white/20" : "bg-bg3"
                    )}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Company Cards Grid */}
        <div className="p-5">
          {loading && clients.length === 0 ? (
            <div className="py-20 text-center">
              <RefreshCw className="animate-spin mx-auto text-accent mb-3" size={24} />
              <p className="text-xs text-txt3 font-bold uppercase tracking-widest">Loading tenants…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <Building2 size={32} className="mx-auto text-txt3/30 mb-3" />
              <p className="text-sm font-bold text-txt3">No companies match your filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(c => {
                const sub = getSubStatus(c)
                const usagePct = c.max_users > 0 ? Math.round((c.user_count / c.max_users) * 100) : 0
                return (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/superadmin/clients/view/${c.id}`)}
                    className="accent-card p-5 cursor-pointer hover-lift group relative overflow-hidden"
                  >
                    {/* Background glow */}
                    <div className={clsx(
                      "absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500",
                      c.is_active ? "bg-accent" : "bg-danger"
                    )} />

                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold border shrink-0 transition-all duration-300",
                          c.is_active
                            ? "bg-accent/8 text-accent border-accent/10 group-hover:bg-accent group-hover:text-white group-hover:border-accent"
                            : "bg-danger/8 text-danger border-danger/10"
                        )}>
                          {c.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-txt truncate max-w-[160px] group-hover:text-accent transition-colors">{c.name}</div>
                          <div className="text-[10px] text-txt3 font-mono mt-0.5">{c.subdomain || 'default'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={clsx("w-2 h-2 rounded-full", c.is_active ? "bg-[#10B981]" : "bg-danger")} />
                        <span className={clsx("text-[10px] font-bold", c.is_active ? "text-[#10B981]" : "text-danger")}>
                          {c.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-bg2/60 rounded-lg p-2.5 text-center border border-border/30">
                        <div className="text-sm font-bold text-txt">{c.user_count}</div>
                        <div className="text-[9px] text-txt3 font-bold uppercase tracking-wider mt-0.5">Users</div>
                      </div>
                      <div className="bg-bg2/60 rounded-lg p-2.5 text-center border border-border/30">
                        <div className="text-sm font-bold text-txt">{c.lead_count || 0}</div>
                        <div className="text-[9px] text-txt3 font-bold uppercase tracking-wider mt-0.5">Leads</div>
                      </div>
                      <div className="bg-bg2/60 rounded-lg p-2.5 text-center border border-border/30">
                        <div className="text-sm font-bold text-txt">{c.storage_quota_mb} <span className="text-[9px] text-txt3">MB</span></div>
                        <div className="text-[9px] text-txt3 font-bold uppercase tracking-wider mt-0.5">Storage</div>
                      </div>
                    </div>

                    {/* User capacity bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-txt3 font-bold uppercase tracking-wider">User Capacity</span>
                        <span className="text-[10px] font-mono text-txt2">{c.user_count}/{c.max_users}</span>
                      </div>
                      <div className="h-1.5 bg-bg3 rounded-full overflow-hidden">
                        <div
                          className={clsx("h-full rounded-full transition-all duration-500",
                            usagePct > 85 ? "bg-danger" : usagePct > 60 ? "bg-amber" : "bg-accent"
                          )}
                          style={{ width: `${Math.min(100, usagePct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} className={sub.color} />
                        <span className={clsx("text-[10px] font-bold", sub.color)}>{sub.label}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/superadmin/clients/view/${c.id}`) }}
                          className="p-1.5 rounded-lg text-txt3 hover:text-accent hover:bg-accent/8 transition-all"
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={(e) => handleToggleActive(e, c)}
                          className={clsx("p-1.5 rounded-lg transition-all",
                            c.is_active ? "text-txt3 hover:text-danger hover:bg-danger/8" : "text-txt3 hover:text-[#10B981] hover:bg-[#10B981]/8"
                          )}
                          title={c.is_active ? 'Suspend' : 'Reactivate'}
                        >
                          {c.is_active ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {clients.length > 0 && (
          <div className="px-6 py-3.5 border-t border-border/60 bg-bg2/20 flex items-center justify-between">
            <span className="text-[10px] text-txt3 font-bold uppercase tracking-widest">
              {filtered.length} of {clients.length} shown
            </span>
            <button
              onClick={() => router.push('/superadmin/clients')}
              className="text-[11px] font-bold text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
            >
              Full Client List <ArrowUpRight size={12} />
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
