import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../../components/Layout'
import { StatusBadge, ProgressBar, Modal } from '../../../../components/UI'
import {
  ArrowLeft, Building2, KeyRound, AlertCircle, ToggleLeft, ToggleRight,
  CheckCircle2, Copy, HardDrive, Users, Phone, Mail, RefreshCw, ShieldCheck,
  Globe, MapPin, Calendar, TrendingUp, Activity, BarChart2, Settings,
  Clock, Zap, Target, Award, ChevronRight, Eye, Loader2, PhoneCall
} from 'lucide-react'
import { fetchWithAuth } from '../../../../utils/api'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ─── Subscription urgency ───
function getSubStatus(client) {
  if (!client.valid_until) return { label: 'No plan', color: 'text-txt3', urgency: 'none', days: null }
  const days = Math.ceil((new Date(client.valid_until) - new Date()) / 86400000)
  const grace = client.grace_period_days || 7
  if (days < -grace) return { label: 'Locked out', color: 'text-danger', urgency: 'locked', days }
  if (days < 0) return { label: `Grace period: ${grace + days}d remaining`, color: 'text-danger', urgency: 'grace', days }
  if (days <= 7) return { label: `${days} days remaining`, color: 'text-amber', urgency: 'warning', days }
  return { label: `${days} days remaining`, color: 'text-[#10B981]', urgency: 'ok', days }
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart2 },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'subscription', label: 'Subscription', icon: Calendar },
  { key: 'settings', label: 'Settings', icon: Settings },
]

export default function ClientMasterPanel() {
  const router = useRouter()
  const { id } = router.query

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [leadStats, setLeadStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const [empRoleFilter, setEmpRoleFilter] = useState('all')

  // Modals
  const [resetModal, setResetModal] = useState({ isOpen: false, email: '', password: '' })
  const [storageModal, setStorageModal] = useState(false)
  const [newStorageQuota, setNewStorageQuota] = useState('')
  const [updatingStorage, setUpdatingStorage] = useState(false)
  const [subModal, setSubModal] = useState(false)
  const [subForm, setSubForm] = useState({ valid_until: '', max_users: 5, grace_period_days: 7 })
  const [updatingSub, setUpdatingSub] = useState(false)
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' })
  const [copied, setCopied] = useState(false)
  const [featureModal, setFeatureModal] = useState(false)
  const [togglingFeature, setTogglingFeature] = useState(false)

  useEffect(() => {
    if (id) {
      fetchClientDetails()
      fetchLeadStats()
    }
  }, [id])

  const fetchClientDetails = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth(`/superadmin/clients/clients/${id}/details/`)
      setClient(data)
      setNewStorageQuota(data.storage_quota_mb.toString())
      setSubForm({
        valid_until: data.valid_until || '',
        max_users: data.max_users || 5,
        grace_period_days: data.grace_period_days || 7
      })
      setError(null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const fetchLeadStats = async () => {
    setLoadingStats(true)
    try {
      const data = await fetchWithAuth(`/superadmin/clients/clients/${id}/lead-stats/`)
      setLeadStats(data)
    } catch (err) { console.warn('Lead stats unavailable:', err) }
    finally { setLoadingStats(false) }
  }

  const handleToggleActive = async () => {
    const action = client.is_active ? 'suspend' : 'reactivate'
    if (!confirm(`Are you sure you want to ${action} "${client.name}"?`)) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH', body: JSON.stringify({ is_active: !client.is_active })
      })
      toast.success(`${client.name} ${client.is_active ? 'suspended' : 'reactivated'}.`)
      fetchClientDetails()
    } catch (err) { setErrorModal({ isOpen: true, message: err.message }) }
  }

  const handleResetPassword = async () => {
    if (!confirm('Reset admin password? The admin will need to change it on next login.')) return
    try {
      const resp = await fetchWithAuth(`/superadmin/clients/clients/${id}/reset-password/`, { method: 'POST' })
      setResetModal({ isOpen: true, email: resp.email, password: resp.new_password })
    } catch (err) { setErrorModal({ isOpen: true, message: err.message }) }
  }

  const handleUpdateStorage = async (e) => {
    e.preventDefault()
    setUpdatingStorage(true)
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH', body: JSON.stringify({ storage_quota_mb: parseInt(newStorageQuota) })
      })
      toast.success('Storage quota updated.')
      setStorageModal(false)
      fetchClientDetails()
    } catch (err) { setErrorModal({ isOpen: true, message: err.message }) }
    finally { setUpdatingStorage(false) }
  }

  const handleUpdateSubscription = async (e) => {
    e.preventDefault()
    setUpdatingSub(true)
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH', body: JSON.stringify({
          valid_until: subForm.valid_until,
          max_users: parseInt(subForm.max_users),
          grace_period_days: parseInt(subForm.grace_period_days)
        })
      })
      toast.success('Subscription updated.')
      setSubModal(false)
      fetchClientDetails()
    } catch (err) { setErrorModal({ isOpen: true, message: err.message }) }
    finally { setUpdatingSub(false) }
  }

  const handleToggleFeature = async (featureName) => {
    setTogglingFeature(true)
    try {
      const payload = {}
      if (featureName === 'geofencing') payload.geofencing_enabled = !client.geofencing_enabled
      const updated = await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH', body: JSON.stringify(payload)
      })
      setClient({ ...client, ...updated })
      toast.success('Feature updated.')
    } catch (err) { setErrorModal({ isOpen: true, message: err.message }) }
    finally { setTogglingFeature(false) }
  }

  const handleForceLogout = async () => {
    if (!confirm(`Force logout ALL users of "${client.name}"? They will need to re-login.`)) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH', body: JSON.stringify({ force_logout_until: new Date().toISOString() })
      })
      toast.success('All users forced to re-login.')
      fetchClientDetails()
    } catch (err) { setErrorModal({ isOpen: true, message: err.message }) }
  }

  const copyResetCredentials = () => {
    navigator.clipboard.writeText(`Email: ${resetModal.email}\nPassword: ${resetModal.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading && !client) {
    return (
      <Layout role="superadmin" pageTitle="Loading...">
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="animate-spin text-accent" size={32} />
        </div>
      </Layout>
    )
  }

  if (error && !client) {
    return (
      <Layout role="superadmin" pageTitle="Error">
        <div className="p-8 text-center text-danger">
          <AlertCircle className="mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold font-display">Could not load client</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/superadmin')} className="btn-primary mt-6">Go Back</button>
        </div>
      </Layout>
    )
  }

  const sub = client ? getSubStatus(client) : {}
  const usagePct = client ? Math.round((client.user_count / (client.max_users || 1)) * 100) : 0
  const storagePct = client ? Math.round(((client.storage_used_mb || 0) / (client.storage_quota_mb || 1)) * 100) : 0

  // Employee filtering
  const filteredEmployees = (client?.users || []).filter(u => {
    const matchSearch = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(empSearch.toLowerCase())
    const matchRole = empRoleFilter === 'all' || u.role === empRoleFilter
    return matchSearch && matchRole
  })
  const roles = [...new Set((client?.users || []).map(u => u.role).filter(Boolean))]

  return (
    <Layout role="superadmin" pageTitle={client?.name || 'Client'}
      actions={
        <div className="flex gap-2">
          <button onClick={fetchClientDetails} className="p-2 text-txt3 hover:text-accent transition-all rounded-xl hover:bg-bg2">
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
          </button>
          <button onClick={() => router.push('/superadmin')} className="btn-ghost px-4 text-xs font-bold uppercase tracking-wider">
            <ArrowLeft size={14} className="mr-1 inline" />Back
          </button>
        </div>
      }
    >
      {/* ═══ Company Header ═══ */}
      <div className="accent-card p-6 mb-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent/[0.03]" />
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Avatar + Info */}
          <div className="flex items-start gap-5 flex-1">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20 shrink-0 text-2xl font-bold font-display shadow-lg shadow-accent/5">
              {client.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold font-display text-txt">{client.name}</h1>
                <div className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold",
                  client.is_active ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20" : "bg-danger/10 text-danger border border-danger/20"
                )}>
                  <div className={clsx("w-1.5 h-1.5 rounded-full", client.is_active ? "bg-[#10B981]" : "bg-danger")} />
                  {client.is_active ? 'Active' : 'Suspended'}
                </div>
              </div>
              <p className="text-xs text-txt3 font-mono mb-3">ID: {client.id}</p>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5 text-xs text-txt2">
                  <Users size={12} className="text-txt3" />
                  <span className="font-bold">{client.user_count}</span>
                  <span className="text-txt3">/ {client.max_users} users</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-txt2">
                  <HardDrive size={12} className="text-txt3" />
                  <span className="font-bold">{client.storage_used_mb || 0}</span>
                  <span className="text-txt3">/ {client.storage_quota_mb} MB</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock size={12} className={sub.color} />
                  <span className={clsx("font-bold", sub.color)}>{sub.label}</span>
                </div>
              </div>

              {/* Grace period warning */}
              {(sub.urgency === 'grace' || sub.urgency === 'locked') && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-danger/8 border border-danger/15 text-xs text-danger font-bold">
                  <AlertCircle size={14} />
                  {sub.urgency === 'locked' ? 'This client is fully locked out. Subscription expired beyond grace period.' : `Subscription expired. Client is in grace period (${client.grace_period_days || 7} days).`}
                </div>
              )}
            </div>
          </div>

          {/* Admin Contact Card */}
          <div className="bg-bg2/60 rounded-xl border border-border/50 p-4 min-w-[240px]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-txt3 mb-3 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-accent" /> Admin Contact
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-txt">{client.admin_first_name} {client.admin_last_name}</p>
              <div className="flex items-center gap-2 text-xs text-txt2">
                <Mail size={12} className="text-txt3" />{client.admin_email}
              </div>
              {client.admin_phone && (
                <div className="flex items-center gap-2 text-xs text-txt2">
                  <Phone size={12} className="text-txt3" />{client.admin_phone}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border/30">
          <button onClick={() => router.push(`/superadmin/clients/${client.id}`)}
            className="btn-ghost text-xs px-3 py-2 rounded-xl bg-bg2/80 hover:bg-bg3 transition-all flex items-center gap-1.5">
            <Settings size={13} /> Edit Organization
          </button>
          <button onClick={handleToggleActive}
            className={clsx("btn-ghost text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all",
              client.is_active ? 'bg-amber/8 text-amber hover:bg-amber/15' : 'bg-[#10B981]/8 text-[#10B981] hover:bg-[#10B981]/15')}>
            {client.is_active ? <><ToggleRight size={13} /> Suspend</> : <><ToggleLeft size={13} /> Reactivate</>}
          </button>
          <button onClick={handleResetPassword}
            className="btn-ghost text-xs px-3 py-2 rounded-xl bg-accent/8 text-accent hover:bg-accent/15 transition-all flex items-center gap-1.5">
            <KeyRound size={13} /> Reset Admin Password
          </button>
          <button onClick={() => setSubModal(true)}
            className="btn-ghost text-xs px-3 py-2 rounded-xl bg-purple/8 text-purple hover:bg-purple/15 transition-all flex items-center gap-1.5">
            <Calendar size={13} /> Renew Subscription
          </button>
        </div>
      </div>

      {/* ═══ Tabs ═══ */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              "flex items-center gap-2 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap",
              activeTab === tab.key
                ? "border-accent text-accent bg-accent/5"
                : "border-transparent text-txt3 hover:text-txt hover:bg-bg2"
            )}>
            <tab.icon size={14} />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab Content ═══ */}

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Target, label: 'Total Leads', value: leadStats?.total_leads ?? '—', color: 'accent' },
              { icon: CheckCircle2, label: 'Won', value: leadStats?.won_leads ?? '—', color: '[#10B981]' },
              { icon: TrendingUp, label: 'Conversion', value: leadStats ? `${leadStats.conversion_rate}%` : '—', color: 'purple' },
              { icon: PhoneCall, label: 'Calls Today', value: leadStats?.calls_today ?? '—', color: 'amber' },
            ].map((card, i) => {
              const Icon = card.icon
              return (
                <div key={i} className="accent-card p-5 group hover-lift">
                  <div className="flex items-center justify-between mb-3">
                    <div className={clsx(`w-10 h-10 rounded-xl bg-${card.color}/8 flex items-center justify-center text-${card.color}`,
                      `group-hover:bg-${card.color} group-hover:text-white transition-all duration-300`)}>
                      <Icon size={18} />
                    </div>
                  </div>
                  <div className="font-display font-extrabold text-3xl text-txt leading-none tracking-tight">
                    {loadingStats ? <Loader2 size={20} className="animate-spin text-txt3" /> : card.value}
                  </div>
                  <div className="text-xs text-txt3 mt-1.5 font-medium">{card.label}</div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resource Usage */}
            <div className="accent-card p-6">
              <h3 className="text-sm font-bold text-txt flex items-center gap-2 mb-5">
                <Activity size={14} className="text-accent" /> Resource Usage
              </h3>
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-txt">User Licenses</span>
                    <span className="text-xs font-mono text-txt2">{client.user_count} / {client.max_users}</span>
                  </div>
                  <ProgressBar value={client.user_count} max={client.max_users} color={usagePct > 85 ? '#EF4444' : '#4F8EF7'} height={8} />
                  <p className="text-[10px] text-txt3 mt-1">{100 - usagePct}% capacity remaining</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-txt">Storage</span>
                    <span className="text-xs font-mono text-txt2">{client.storage_used_mb || 0} / {client.storage_quota_mb} MB</span>
                  </div>
                  <ProgressBar value={client.storage_used_mb || 0} max={client.storage_quota_mb} color={storagePct > 85 ? '#EF4444' : '#A374F9'} height={8} />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-txt3">{100 - storagePct}% free</p>
                    <button onClick={() => setStorageModal(true)} className="text-[10px] text-accent hover:underline font-bold">Update Quota</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Lead Status Breakdown */}
            <div className="accent-card p-6">
              <h3 className="text-sm font-bold text-txt flex items-center gap-2 mb-5">
                <BarChart2 size={14} className="text-purple" /> Lead Pipeline
              </h3>
              {loadingStats ? (
                <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={20} /><p className="text-xs text-txt3">Loading stats...</p></div>
              ) : leadStats?.status_breakdown?.length > 0 ? (
                <div className="space-y-2">
                  {leadStats.status_breakdown.map((s, i) => {
                    const pct = leadStats.total_leads > 0 ? Math.round((s.count / leadStats.total_leads) * 100) : 0
                    const statusColors = {
                      'NEW': 'bg-accent', 'CALLED': 'bg-purple', 'INTERESTED': 'bg-amber',
                      'NOT_ANSWERED': 'bg-txt3', 'FOLLOW_UP': 'bg-accent2', 'WON': 'bg-[#10B981]',
                      'LOST': 'bg-danger', 'HIGH_PROSPECT': 'bg-purple', 'SITE_VISIT': 'bg-accent2',
                      'VISITED': 'bg-[#10B981]', 'INVALID_NUMBER': 'bg-danger',
                    }
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-txt2 uppercase tracking-wider w-28 truncate">{s.status?.replace('_', ' ')}</span>
                        <div className="flex-1 h-2 bg-bg3 rounded-full overflow-hidden">
                          <div className={clsx("h-full rounded-full transition-all", statusColors[s.status] || 'bg-txt3')} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-txt w-8 text-right">{s.count}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-txt3 text-sm">No lead data available</div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {leadStats?.recent_activity?.length > 0 && (
            <div className="accent-card p-6">
              <h3 className="text-sm font-bold text-txt flex items-center gap-2 mb-4">
                <Activity size={14} className="text-amber" /> Recent Activity
              </h3>
              <div className="space-y-3">
                {leadStats.recent_activity.map((act, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-bg2/40 rounded-xl border border-border/30 hover:border-accent/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-accent/8 flex items-center justify-center text-accent shrink-0 mt-0.5">
                      <Activity size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-txt truncate">{act.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-txt2 bg-bg3 px-1.5 py-0.5 rounded">
                          {act.performed_by__first_name} {act.performed_by__last_name}
                        </span>
                        <span className="text-[10px] text-txt3">
                          → {act.lead__first_name} {act.lead__last_name}
                        </span>
                        <span className="text-[10px] text-txt3 font-mono ml-auto">
                          {new Date(act.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Performers */}
          {leadStats?.top_performers?.length > 0 && (
            <div className="accent-card p-6">
              <h3 className="text-sm font-bold text-txt flex items-center gap-2 mb-4">
                <Award size={14} className="text-[#10B981]" /> Top Performers (by conversions)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {leadStats.top_performers.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-bg2/40 rounded-xl border border-border/30">
                    <div className={clsx(
                      "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
                      i === 0 ? "bg-amber/15 text-amber" : "bg-accent/8 text-accent"
                    )}>
                      {i === 0 ? '🏆' : `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-txt truncate">{p.assigned_to__first_name} {p.assigned_to__last_name}</p>
                      <p className="text-[10px] text-txt3 font-mono truncate">{p.assigned_to__email}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#10B981]">{p.won_count}</div>
                      <div className="text-[9px] text-txt3 font-bold uppercase">won</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === 'employees' && (
        <div className="accent-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60 bg-bg2/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-txt flex items-center gap-2">
                <Users size={14} className="text-accent" /> Employees
                <span className="text-[10px] font-mono text-txt3 bg-bg3 px-2 py-0.5 rounded">{client.users?.length || 0}</span>
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-xs">
                <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                  className="input pl-3 h-8 text-xs bg-bg3 border-border/50 w-full" placeholder="Search employees…" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEmpRoleFilter('all')}
                  className={clsx("px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                    empRoleFilter === 'all' ? "bg-accent text-white" : "text-txt3 hover:bg-bg3")}>
                  All
                </button>
                {roles.map(r => (
                  <button key={r} onClick={() => setEmpRoleFilter(r)}
                    className={clsx("px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      empRoleFilter === r ? "bg-accent text-white" : "text-txt3 hover:bg-bg3")}>
                    {r?.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg2/40">
                  {['Employee', 'Role', 'Status', 'Last Login', 'Joined'].map(h => (
                    <th key={h} className="px-6 py-3.5 text-[10px] font-bold text-txt3 uppercase tracking-[0.08em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan="5" className="py-16 text-center text-txt3 text-sm">No employees match your filter.</td></tr>
                ) : (
                  filteredEmployees.map(user => (
                    <tr key={user.id} className="hover:bg-bg2/30 transition-colors group">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent/8 border border-accent/10 flex items-center justify-center text-xs font-bold text-accent group-hover:bg-accent group-hover:text-white group-hover:border-accent transition-all">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-txt">{user.first_name} {user.last_name}</div>
                            <div className="text-[10px] text-txt3 font-mono">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={clsx("text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border",
                          user.role === 'CLIENT_ADMIN' ? "bg-purple/8 text-purple border-purple/15" :
                          user.role === 'MANAGER' ? "bg-accent/8 text-accent border-accent/15" :
                          user.role === 'TELECALLER' ? "bg-amber/8 text-amber border-amber/15" :
                          user.role === 'FIELD_AGENT' ? "bg-accent2/8 text-accent2 border-accent2/15" :
                          "bg-bg3 text-txt3 border-border"
                        )}>
                          {user.role?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <div className={clsx("w-2 h-2 rounded-full", user.is_active ? "bg-[#10B981]" : "bg-danger")} />
                          <span className={clsx("text-xs font-medium", user.is_active ? "text-[#10B981]" : "text-danger")}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-txt3 font-mono">
                        {user.last_login ? new Date(user.last_login).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-txt3 font-mono">
                        {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUBSCRIPTION TAB ── */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          {/* Subscription Status Card */}
          <div className={clsx("accent-card p-6 border-l-4",
            sub.urgency === 'ok' ? "border-l-[#10B981]" : sub.urgency === 'warning' ? "border-l-amber" : "border-l-danger"
          )}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-txt font-display">Subscription Status</h3>
                <p className={clsx("text-sm font-bold mt-1", sub.color)}>{sub.label}</p>
              </div>
              <button onClick={() => setSubModal(true)} className="btn-primary text-xs">
                <Calendar size={13} className="mr-1" /> Renew / Modify
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-bg2/60 rounded-xl p-4 border border-border/30">
                <div className="text-[10px] font-bold uppercase tracking-wider text-txt3 mb-1">Start Date</div>
                <div className="text-sm font-bold text-txt">
                  {client.subscription_start ? new Date(client.subscription_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'}
                </div>
              </div>
              <div className="bg-bg2/60 rounded-xl p-4 border border-border/30">
                <div className="text-[10px] font-bold uppercase tracking-wider text-txt3 mb-1">End Date</div>
                <div className={clsx("text-sm font-bold", sub.color)}>
                  {client.valid_until ? new Date(client.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'}
                </div>
              </div>
              <div className="bg-bg2/60 rounded-xl p-4 border border-border/30">
                <div className="text-[10px] font-bold uppercase tracking-wider text-txt3 mb-1">Days Remaining</div>
                <div className={clsx("text-sm font-bold", sub.color)}>
                  {sub.days !== null ? (sub.days > 0 ? `${sub.days} days` : `Expired ${Math.abs(sub.days)} days ago`) : '—'}
                </div>
              </div>
              <div className="bg-bg2/60 rounded-xl p-4 border border-border/30">
                <div className="text-[10px] font-bold uppercase tracking-wider text-txt3 mb-1">Grace Period</div>
                <div className="text-sm font-bold text-txt">{client.grace_period_days || 7} days</div>
                <p className="text-[10px] text-txt3 mt-0.5">after expiry before lockout</p>
              </div>
            </div>
          </div>

          {/* Subscription Timeline Visual */}
          <div className="accent-card p-6">
            <h3 className="text-sm font-bold text-txt mb-4">Subscription Timeline</h3>
            <div className="relative">
              <div className="h-3 bg-bg3 rounded-full overflow-hidden">
                {client.subscription_start && client.valid_until && (() => {
                  const start = new Date(client.subscription_start).getTime()
                  const end = new Date(client.valid_until).getTime()
                  const now = Date.now()
                  const total = end - start
                  const elapsed = Math.max(0, Math.min(total, now - start))
                  const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0
                  return (
                    <div className={clsx("h-full rounded-full transition-all duration-1000",
                      pct >= 90 ? "bg-danger" : pct >= 75 ? "bg-amber" : "bg-accent"
                    )} style={{ width: `${Math.min(100, pct)}%` }} />
                  )
                })()}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-txt3 font-mono">
                  {client.subscription_start ? new Date(client.subscription_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </span>
                <span className="text-[10px] text-txt3 font-mono">
                  {client.valid_until ? new Date(client.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Feature Flags */}
          <div className="accent-card p-6">
            <h3 className="text-sm font-bold text-txt flex items-center gap-2 mb-5">
              <Globe size={14} className="text-accent" /> Feature Flags
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-bg2/40 rounded-xl border border-border/30 hover:border-accent/30 transition-colors">
                <div>
                  <h4 className="text-sm font-bold text-txt flex items-center gap-2"><MapPin size={14} className="text-accent" /> Location Geofencing</h4>
                  <p className="text-[10px] text-txt3 mt-1 max-w-[340px] leading-relaxed">Enforces GPS verification against corporate boundaries defined by the Tenant Admin.</p>
                </div>
                <button
                  onClick={() => handleToggleFeature('geofencing')}
                  disabled={togglingFeature}
                  className={clsx(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0",
                    client?.geofencing_enabled ? "bg-[#10B981]" : "bg-border",
                    togglingFeature && "opacity-50 cursor-wait"
                  )}
                >
                  <span className={clsx(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                    client?.geofencing_enabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>
          </div>

          {/* Storage Management */}
          <div className="accent-card p-6">
            <h3 className="text-sm font-bold text-txt flex items-center gap-2 mb-5">
              <HardDrive size={14} className="text-purple" /> Storage Management
            </h3>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-txt2">Current Quota</span>
              <span className="text-sm font-bold font-mono text-txt">{client.storage_quota_mb} MB</span>
            </div>
            <ProgressBar value={client.storage_used_mb || 0} max={client.storage_quota_mb} color={storagePct > 85 ? '#EF4444' : '#A374F9'} height={8} />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-txt3">{client.storage_used_mb || 0} MB used</span>
              <button onClick={() => setStorageModal(true)} className="text-[10px] text-accent hover:underline font-bold">Change Quota</button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="accent-card p-6 border-danger/20">
            <h3 className="text-sm font-bold text-danger flex items-center gap-2 mb-4">
              <AlertCircle size={14} /> Danger Zone
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-danger/5 rounded-xl border border-danger/15">
                <div>
                  <p className="text-sm font-bold text-txt">Force Logout All Users</p>
                  <p className="text-[10px] text-txt3 mt-0.5">Invalidates all active sessions. Users must re-login.</p>
                </div>
                <button onClick={handleForceLogout} className="btn-ghost text-xs px-4 py-2 text-danger border border-danger/20 hover:bg-danger/10 rounded-xl">
                  Force Logout
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-danger/5 rounded-xl border border-danger/15">
                <div>
                  <p className="text-sm font-bold text-txt">{client.is_active ? 'Suspend Organization' : 'Reactivate Organization'}</p>
                  <p className="text-[10px] text-txt3 mt-0.5">{client.is_active ? 'Block all users from accessing the platform.' : 'Restore access for all users.'}</p>
                </div>
                <button onClick={handleToggleActive}
                  className={clsx("btn-ghost text-xs px-4 py-2 rounded-xl border",
                    client.is_active ? "text-danger border-danger/20 hover:bg-danger/10" : "text-[#10B981] border-[#10B981]/20 hover:bg-[#10B981]/10"
                  )}>
                  {client.is_active ? 'Suspend' : 'Reactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Storage Update Modal */}
      <Modal isOpen={storageModal} onClose={() => setStorageModal(false)} title="Update Storage Quota" footer={
        <>
          <button type="button" onClick={() => setStorageModal(false)} className="btn-ghost px-4 py-2">Cancel</button>
          <button onClick={handleUpdateStorage} disabled={updatingStorage} className="btn-primary px-6 py-2">
            {updatingStorage ? <RefreshCw className="animate-spin" size={16}/> : 'Update Quota'}
          </button>
        </>
      }>
        <div className="space-y-4">
          <p className="text-xs text-txt3">Adjust storage allocation for <b>{client.name}</b>. Takes effect immediately.</p>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-txt3 ml-1">New Quota (MB)</label>
            <input type="number" className="input w-full bg-bg3 text-sm" value={newStorageQuota} onChange={e => setNewStorageQuota(e.target.value)} />
          </div>
          <div className="text-xs text-txt3 flex gap-2 items-center bg-accent/8 p-3 rounded-lg text-accent border border-accent/15">
            <HardDrive size={14}/>Current usage: {client.storage_used_mb || 0} MB
          </div>
        </div>
      </Modal>

      {/* Subscription Modal */}
      <Modal isOpen={subModal} onClose={() => setSubModal(false)} title="Manage Subscription" footer={
        <div className="flex gap-2">
          <button type="button" onClick={() => setSubModal(false)} className="btn-ghost px-6 py-2 rounded-xl">Cancel</button>
          <button type="button" onClick={handleUpdateSubscription} disabled={updatingSub} className="btn-primary px-6 py-2">
            {updatingSub ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }>
        <form onSubmit={handleUpdateSubscription} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-txt mb-1 block">Expiration Date</label>
            <input type="date" value={subForm.valid_until} onChange={(e) => setSubForm({...subForm, valid_until: e.target.value})}
              className="input w-full bg-card" required />
          </div>
          <div>
            <label className="text-xs font-bold text-txt mb-1 block">Maximum Users</label>
            <input type="number" value={subForm.max_users} onChange={(e) => setSubForm({...subForm, max_users: e.target.value})}
              className="input w-full bg-card" min="1" required />
          </div>
          <div>
            <label className="text-xs font-bold text-txt mb-1 block">Grace Period (days after expiry)</label>
            <input type="number" value={subForm.grace_period_days} onChange={(e) => setSubForm({...subForm, grace_period_days: e.target.value})}
              className="input w-full bg-card" min="0" required />
            <p className="text-[10px] text-txt3 mt-1">Number of days users can still access after subscription expires.</p>
          </div>
        </form>
      </Modal>

      {/* Password Reset Modal */}
      <Modal isOpen={resetModal.isOpen} onClose={() => setResetModal({ ...resetModal, isOpen: false })} title="Password Reset Successful" footer={
        <button onClick={() => setResetModal({ ...resetModal, isOpen: false })} className="btn-primary px-6 py-2">Close</button>
      }>
        <div className="space-y-4">
          <p className="text-xs text-txt3 leading-relaxed">The admin password has been reset. Share these credentials with the client. They will be forced to change it on next login.</p>
          <div className="p-4 bg-bg3 rounded-xl border border-border space-y-3 relative group">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-txt3 mb-0.5">Admin Email</div>
              <div className="text-sm font-mono text-txt font-bold">{resetModal.email}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-txt3 mb-0.5">New Password</div>
              <div className="text-sm font-mono text-accent font-bold tracking-wider">{resetModal.password}</div>
            </div>
            <button onClick={copyResetCredentials} className="absolute top-4 right-4 p-2 bg-card hover:bg-accent/10 rounded-lg text-txt3 hover:text-accent transition-all shadow-sm border border-border" title="Copy Credentials">
              {copied ? <CheckCircle2 size={14} className="text-[#10B981]" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal isOpen={errorModal.isOpen} onClose={() => setErrorModal({ ...errorModal, isOpen: false })} title="Action Failed" footer={
        <button onClick={() => setErrorModal({ ...errorModal, isOpen: false })} className="btn-primary px-6 py-2">Okay</button>
      }>
        <div className="flex items-start gap-4 text-danger bg-danger/5 p-4 rounded-xl border border-danger/20">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium leading-relaxed">{errorModal.message}</p>
        </div>
      </Modal>
    </Layout>
  )
}
