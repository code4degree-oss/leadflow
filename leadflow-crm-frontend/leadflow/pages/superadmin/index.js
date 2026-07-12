import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { MiniBarChart, DonutChart, SectionHeader, ProgressBar } from '../../components/UI'
import {
  Building2, Database, Users, AlertTriangle, Download, Plus, Eye, Ban,
  RefreshCw, Bell, CheckCircle2, Crown, Zap, Shield, Calendar, ArrowUpRight,
  TrendingUp, Clock, ChevronRight, Activity, Server
} from 'lucide-react'
import { fetchWithAuth, API_BASE } from '../../utils/api'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ─── Plan badge config ───
const PLAN_CONFIG = {
  basic:      { label: 'Basic',      icon: Zap,    bg: 'bg-border/60 text-txt2',                    dot: 'bg-txt3' },
  pro:        { label: 'Pro',        icon: Crown,  bg: 'bg-accent/8 text-accent border border-accent/15', dot: 'bg-accent' },
  enterprise: { label: 'Enterprise', icon: Shield, bg: 'bg-purple/8 text-purple border border-purple/15', dot: 'bg-purple' },
}

// ─── Subscription urgency helper ───
function getSubStatus(client) {
  if (!client.valid_until) return { label: 'No plan', color: 'text-txt3', bg: 'bg-bg3', urgency: 'none' }
  const days = Math.ceil((new Date(client.valid_until) - new Date()) / 86400000)
  if (days < 0)  return { label: `Expired ${Math.abs(days)}d ago`, color: 'text-danger', bg: 'bg-danger/8', urgency: 'expired' }
  if (days <= 7) return { label: `${days}d left`, color: 'text-amber', bg: 'bg-amber/8', urgency: 'warning' }
  return { label: `${days}d left`, color: 'text-[#10B981]', bg: 'bg-[#10B981]/8', urgency: 'ok' }
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/superadmin/clients/clients/')
      setClients(data.results || data || [])
      setError(null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

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

  const handleToggleActive = async (client) => {
    const action = client.is_active ? 'suspend' : 'reactivate'
    if (!confirm(`Are you sure you want to ${action} "${client.name}"?`)) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${client.id}/`, {
        method: 'PATCH', body: JSON.stringify({ is_active: !client.is_active })
      })
      toast.success(`${client.name} has been ${client.is_active ? 'suspended' : 'reactivated'}.`)
      fetchClients()
    } catch (err) { toast.error('Failed: ' + err.message) }
  }

  const handleExport = async (client) => {
    try {
      const url = `${API_BASE}/superadmin/clients/clients/${client.id}/export-data/?type=full`
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      const safeName = client.name.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/ /g, '_').toLowerCase()
      a.download = `${safeName}_full_export.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      toast.success(`Exported data for ${client.name}`)
    } catch (err) { toast.error('Export failed: ' + err.message) }
  }

  // ─── Derived stats ───
  const totalStorage = clients.reduce((acc, c) => acc + (c.storage_quota_mb || 0), 0)
  const totalEmployees = clients.reduce((acc, c) => acc + (c.user_count || 0), 0)
  const activeClients = clients.filter(c => c.is_active)
  const expiringSoon = clients.filter(c => c.subscription_status === 'expiring_soon')
  const expired = clients.filter(c => c.subscription_status === 'expired')
  const attentionCount = expiringSoon.length + expired.length

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-grid">
        {/* Total Clients */}
        <div className="accent-card p-5 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/8 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all duration-300">
              <Building2 size={18} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981] flex items-center gap-1">
              <TrendingUp size={10} /> {activeClients.length} active
            </span>
          </div>
          <div className="font-display font-extrabold text-3xl text-txt leading-none tracking-tight">{clients.length}</div>
          <div className="text-xs text-txt3 mt-1.5 font-medium">Total Organizations</div>
        </div>

        {/* Platform Users */}
        <div className="accent-card p-5 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple/8 flex items-center justify-center text-purple group-hover:bg-purple group-hover:text-white transition-all duration-300">
              <Users size={18} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-txt3">
              across all tenants
            </span>
          </div>
          <div className="font-display font-extrabold text-3xl text-txt leading-none tracking-tight">{totalEmployees}</div>
          <div className="text-xs text-txt3 mt-1.5 font-medium">Platform Users</div>
        </div>

        {/* Storage */}
        <div className="accent-card p-5 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber/8 flex items-center justify-center text-amber group-hover:bg-amber group-hover:text-white transition-all duration-300">
              <Server size={18} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-txt3">
              allocated quota
            </span>
          </div>
          <div className="font-display font-extrabold text-3xl text-txt leading-none tracking-tight">{(totalStorage / 1024).toFixed(1)} <span className="text-lg text-txt3 font-sans font-medium">GB</span></div>
          <div className="text-xs text-txt3 mt-1.5 font-medium">Platform Storage</div>
        </div>

        {/* Attention */}
        <div className={clsx("accent-card p-5 group", attentionCount > 0 && "border-danger/20 bg-danger/[0.02]")}>
          <div className="flex items-center justify-between mb-4">
            <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
              attentionCount > 0
                ? "bg-danger/10 text-danger group-hover:bg-danger group-hover:text-white"
                : "bg-[#10B981]/8 text-[#10B981] group-hover:bg-[#10B981] group-hover:text-white"
            )}>
              {attentionCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </div>
            {attentionCount > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-danger flex items-center gap-1">
                <Activity size={10} /> needs review
              </span>
            )}
          </div>
          <div className="font-display font-extrabold text-3xl text-txt leading-none tracking-tight">
            {attentionCount > 0 ? attentionCount : '✓'}
          </div>
          <div className="text-xs text-txt3 mt-1.5 font-medium">
            {attentionCount > 0 ? `${expiringSoon.length} expiring · ${expired.length} expired` : 'All subscriptions healthy'}
          </div>
        </div>
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-accent bg-accent/8 px-2.5 py-1 rounded-lg">
                {clients.length} total
              </span>
            </div>
          </div>
          <MiniBarChart data={getAdoptionData()} height={140} />
        </div>

        {/* Tenant Health */}
        <div className="accent-card p-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-txt flex items-center gap-2">
              <Activity size={14} className="text-purple" />
              Tenant Health
            </h3>
            <p className="text-[11px] text-txt3 mt-0.5">Active vs. suspended breakdown</p>
          </div>
          <div className="flex justify-center">
            <DonutChart data={[
              { name: 'Active', value: activeClients.length },
              { name: 'Suspended', value: clients.filter(c => !c.is_active).length },
            ]} height={130} />
          </div>
          <div className="space-y-2 mt-5">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#10B981]/5 border border-[#10B981]/10">
              <div className="flex items-center gap-2.5">
                <div className="status-dot active" />
                <span className="text-[11px] font-semibold text-txt">Active</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#10B981]">{activeClients.length}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-danger/5 border border-danger/10">
              <div className="flex items-center gap-2.5">
                <div className="status-dot inactive" />
                <span className="text-[11px] font-semibold text-txt">Suspended</span>
              </div>
              <span className="text-xs font-mono font-bold text-danger">{clients.filter(c => !c.is_active).length}</span>
            </div>
            {expiringSoon.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber/5 border border-amber/10">
                <div className="flex items-center gap-2.5">
                  <div className="status-dot warning" />
                  <span className="text-[11px] font-semibold text-txt">Expiring Soon</span>
                </div>
                <span className="text-xs font-mono font-bold text-amber">{expiringSoon.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Client Table ═══ */}
      <div className="accent-card overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/8 flex items-center justify-center text-accent">
              <Database size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-txt">Infrastructure Management</h2>
              <p className="text-[11px] text-txt3 mt-0.5">{clients.length} organizations · {totalEmployees} total users</p>
            </div>
          </div>
          <button onClick={() => router.push('/superadmin/clients/new')}
            className="btn-primary text-xs shadow-sm shadow-accent/10 hover:shadow-md hover:shadow-accent/15 transition-all">
            <Plus size={14} /> Add Organization
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg2/40">
                {['Organization', 'Plan', 'Status', 'Users', 'Storage', 'Subscription', ''].map(h => (
                  <th key={h} className="px-6 py-3.5 text-[10px] font-bold text-txt3 uppercase tracking-[0.08em] first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && clients.length === 0 ? (
                <tr><td colSpan="7" className="py-24 text-center">
                  <RefreshCw size={20} className="animate-spin mx-auto text-accent mb-3" />
                  <p className="text-xs text-txt3">Loading platform data...</p>
                </td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan="7" className="py-24 text-center">
                  <Building2 size={28} className="mx-auto text-txt3/40 mb-3" />
                  <p className="text-sm font-bold text-txt">No organizations yet</p>
                  <p className="text-xs text-txt3 mt-1">Click "Add Organization" to onboard your first client</p>
                </td></tr>
              ) : clients.map((c) => {
                const plan = PLAN_CONFIG[c.plan] || PLAN_CONFIG.basic
                const PlanIcon = plan.icon
                const sub = getSubStatus(c)
                const usagePct = c.max_users > 0 ? Math.round((c.user_count / c.max_users) * 100) : 0

                return (
                  <tr key={c.id} className="premium-row group">
                    {/* Organization */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-accent/8 flex items-center justify-center text-accent text-sm font-bold border border-accent/10 group-hover:bg-accent group-hover:text-white group-hover:border-accent transition-all duration-300 shrink-0">
                          {c.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-txt truncate max-w-[180px] group-hover:text-accent transition-colors">{c.name}</div>
                          <div className="text-[10px] text-txt3 font-mono mt-0.5">{c.subdomain || 'default'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Plan Badge */}
                    <td className="px-6 py-4">
                      <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider", plan.bg)}>
                        <PlanIcon size={11} />
                        {plan.label}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={clsx("status-dot", c.is_active ? "active" : "inactive")} />
                        <span className={clsx("text-xs font-medium", c.is_active ? "text-[#10B981]" : "text-danger")}>
                          {c.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                    </td>

                    {/* Users — count/max with mini bar */}
                    <td className="px-6 py-4">
                      <div className="w-28">
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-xs font-bold text-txt">{c.user_count}</span>
                          <span className="text-[10px] text-txt3 font-mono">/ {c.max_users}</span>
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
                    </td>

                    {/* Storage */}
                    <td className="px-6 py-4">
                      <div className="w-24">
                        <span className="text-xs font-mono font-medium text-txt2">{c.storage_quota_mb} MB</span>
                        <div className="mt-1.5">
                          <ProgressBar value={c.storage_used_mb || 0} max={c.storage_quota_mb || 1} height={4} />
                        </div>
                      </div>
                    </td>

                    {/* Subscription */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className={sub.color} />
                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-md", sub.bg, sub.color)}>
                          {sub.label}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          onClick={() => router.push(`/superadmin/clients/view/${c.id}`)}
                          className="p-2 rounded-lg text-txt3 hover:text-accent hover:bg-accent/8 transition-all"
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(c)}
                          className={clsx("p-2 rounded-lg transition-all",
                            c.is_active
                              ? "text-txt3 hover:text-danger hover:bg-danger/8"
                              : "text-txt3 hover:text-[#10B981] hover:bg-[#10B981]/8"
                          )}
                          title={c.is_active ? 'Suspend' : 'Reactivate'}
                        >
                          {c.is_active ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                        </button>
                        <button
                          onClick={() => handleExport(c)}
                          className="p-2 rounded-lg text-txt3 hover:text-accent hover:bg-accent/8 transition-all"
                          title="Export Data"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          onClick={() => router.push(`/superadmin/clients/view/${c.id}`)}
                          className="p-2 rounded-lg text-txt3 hover:text-accent hover:bg-accent/8 transition-all"
                          title="Open"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {clients.length > 0 && (
          <div className="px-6 py-3.5 border-t border-border/60 bg-bg2/20 flex items-center justify-between">
            <span className="text-[10px] text-txt3 font-bold uppercase tracking-widest">
              {clients.length} organization{clients.length !== 1 ? 's' : ''} · {activeClients.length} active · {totalEmployees} users
            </span>
            <button
              onClick={() => router.push('/superadmin/clients')}
              className="text-[11px] font-bold text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
            >
              View all clients <ArrowUpRight size={12} />
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
